import type {
  ActResult,
  BillboardAd,
  Billboards,
  ChatMessage,
  CityId,
  Clock,
  Daily,
  Homes,
  Job,
  Look,
  MayorState,
  Me,
  Player,
  PlotAd,
  Plots,
  ServerEvent,
  Sim,
  SocialKind,
  Stats,
  StoryOutcome,
  User,
  World,
  TransitState,
  TransitTrip,
  TransitMode,
} from "./types";
import { syncServerTime } from "../server-time";
import { apiUrl, session, sessionHeaders, socketUrl } from "./base";
import { useStore } from "../store";
import { confirmPurchase } from "../ui/purchase-confirmation";
import { emitFeedback } from "../feedback";
import { motion } from "../walking";

let mutationRevision = 0,
  mutations = 0,
  lastSimSnapshotAt = 0;
let unauthorized: ((path: string) => void) | null = null;
/** Called when the API answers 401: the saved session is no longer valid. */
export function onUnauthorized(listener: ((path: string) => void) | null) {
  unauthorized = listener;
}
const signInPaths = new Set(["/api/auth/guest", "/api/life/new"]);
/** Mutations whose refusals are routine and silent (movement is corrected by a snap). */
const quietErrors = new Set(["/api/move", "/api/posture"]);
const here = () =>
  motion.position ? { x: motion.position.x, z: motion.position.z } : undefined;
/** Report a confirmed spend after the server accepted it. */
function purchased<T>(result: T, title: string, amount: number) {
  if (amount > 0)
    emitFeedback({ kind: "purchase", title, amount: -amount, anchor: here() });
  return result;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function req<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const mutation = method !== "GET",
    // Movement only changes the position, which the client owns while walking, so a sim snapshot
    // read during a step is still current. Counting it would refuse every refresh while walking.
    tracked = mutation && path !== "/api/move",
    revision = mutationRevision,
    started = performance.now();
  if (tracked) {
    mutationRevision++;
    mutations++;
  }
  try {
    let res: Response;
    const signIn = signInPaths.has(path);
    const headers: Record<string, string> = { ...sessionHeaders() };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (signIn && session.wanted) headers["X-Metro-Token-Fallback"] = "1";
    try {
      res = await fetch(apiUrl(path), {
        signal: AbortSignal.timeout(15000),
        method,
        credentials: "include",
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new ApiError(
        0,
        "Could not reach the city. Check your connection and try again.",
      );
    }
    const data = await res.json().catch(() => null);
    if (res.status === 401 && !signIn) unauthorized?.(path);
    // A body cut off by a timeout or a dropped link must never reach callers as `null`.
    if (res.ok && (data === null || typeof data !== "object"))
      throw new ApiError(
        0,
        "The city took too long to answer. Please try again.",
      );
    if (!res.ok) {
      const error = new ApiError(
        res.status,
        data?.error ?? `Request failed (${res.status})`,
      );
      if (mutation && !quietErrors.has(path) && res.status !== 401)
        emitFeedback({
          kind: "error",
          title: error.message,
          anchor: here(),
          data: { path, status: res.status },
        });
      throw error;
    }
    if (signIn && typeof data?.sessionToken === "string") {
      session.store(data.sessionToken);
      delete data.sessionToken;
    }
    if (path === "/api/sim" && (mutations > 0 || revision !== mutationRevision))
      throw new ApiError(0, "A newer action is already in progress.");
    if (path === "/api/sim" && data?.clock?.at < lastSimSnapshotAt)
      throw new ApiError(0, "A newer city update has already arrived.");
    if (data?.sim && data?.clock?.at)
      lastSimSnapshotAt = Math.max(lastSimSnapshotAt, data.clock.at);
    if (data?.now || data?.clock?.at)
      syncServerTime(data.now ?? data.clock.at, performance.now() - started);
    return data as T;
  } finally {
    if (tracked) {
      mutations--;
      mutationRevision++;
    }
  }
}

/** One shared read of the sim at a time: several callers asking together share a single request. */
let simRead: Promise<{ sim: Sim; clock: Clock }> | null = null;
function readSim() {
  if (!simRead)
    simRead = req<{ sim: Sim; clock: Clock }>("GET", "/api/sim").finally(() => {
      simRead = null;
    });
  return simRead;
}

async function approvePurchase(amount: number, reason: string) {
  if (!(await confirmPurchase(amount, reason, useStore.getState().sim)))
    throw new ApiError(0, "Purchase cancelled");
}

const q = (city?: CityId) => (city ? `?city=${city}` : "");

export const api = {
  world: () => req<World>("GET", "/api/world"),
  stats: () => req<Stats>("GET", "/api/stats"),
  version: () => req<{ build: string }>("GET", "/api/version"),
  daily: (city?: CityId) => req<Daily>("GET", `/api/daily${q(city)}`),

  me: () => req<Me>("GET", "/api/auth/me"),
  guest: (username?: string) =>
    req<{ user: User }>("POST", "/api/auth/guest", { username }),
  newLife: () =>
    req<{ user: User }>("POST", "/api/life/new", { confirm: true }),
  finishIntro: () => req<{ sim: Sim }>("POST", "/api/intro/complete"),
  finishFirstDay: () => req<{ sim: Sim }>("POST", "/api/first-day/complete"),
  payFirstRent: () => req<{ sim: Sim }>("POST", "/api/home/rent"),
  outfit: async (style: string) => {
    const sim = useStore.getState().sim,
      owned =
        ["casual", "street"].includes(style) ||
        (style === "work" && !!sim?.job) ||
        !!sim?.outfits?.[style];
    const price = owned ? 0 : style === "party" ? 90 : 120;
    await approvePurchase(price, `New ${style} outfit`);
    return purchased(
      await req<{ sim: Sim }>("POST", "/api/sim/outfit", {
        style,
        confirm: true,
      }),
      `New ${style} outfit`,
      price,
    );
  },

  travel: (city: CityId, loc: string) =>
    req<{ sim: Sim; clock: Clock }>("POST", "/api/travel", { city, loc }),
  transit: (city?: CityId) =>
    req<TransitState>("GET", `/api/transit${q(city)}`),
  bookTransit: async (
    to: CityId,
    mode: TransitMode,
    confirmTimeAdvance = false,
  ) => {
    const state = useStore.getState(),
      routes = await req<TransitState>(
        "GET",
        `/api/transit${q(state.sim?.city)}`,
      ),
      route = routes.routes.find((r) => r.to === to && r.mode === mode);
    if (!route) throw new ApiError(0, "This departure is no longer available");
    const city = state.world?.cities.find((c) => c.id === to)?.name ?? to;
    await approvePurchase(
      route.fare,
      `${mode === "bus" ? "Bus" : "Plane"} ticket to ${city}. Visiting keeps your home.`,
    );
    return purchased(
      await req<{ sim: Sim; clock: Clock }>("POST", "/api/transit/book", {
        to,
        mode,
        confirmTimeAdvance,
        confirm: true,
      }),
      `${mode === "bus" ? "Bus" : "Plane"} ticket to ${city}`,
      route.fare,
    );
  },
  napTransit: () => req<{ sim: Sim; clock: Clock }>("POST", "/api/transit/nap"),
  chatTransit: (text: string) =>
    req<{ message: ChatMessage; trip: TransitTrip; clock: Clock }>(
      "POST",
      "/api/transit/chat",
      { text },
    ),
  door: (loc: string, enter: boolean) =>
    req<{ sim: Sim }>("POST", "/api/door", { loc, enter }),
  posture: (bench: string | null) =>
    req<{ sim: Sim }>("POST", "/api/posture", { bench }),
  /** `via`: corners walked since the last confirmed position (see `motion.trail`). */
  move: (
    city: CityId,
    p: import("../navigation").Position,
    via: { x: number; z: number }[] = [],
  ) =>
    req<{ position: import("../navigation").Position }>("POST", "/api/move", {
      city,
      ...p,
      ...(via.length ? { via } : {}),
    }),
  sim: readSim,
  setupSim: (setup: {
    traits?: string[];
    username: string;
    pronouns: "she" | "he" | "they";
    city: CityId;
    neighborhood: string;
    aspiration: string;
    look?: Partial<Look>;
  }) => req<{ sim: Sim }>("POST", "/api/sim/setup", setup),
  act: async (city: CityId, loc: string, action: string, slotId?: string) => {
    const c = useStore.getState().world?.cities.find((c) => c.id === city),
      a = (
        loc === "home"
          ? c?.homeActions
          : c?.landmarks.find((l) => l.id === loc)?.actions
      )?.find((a) => a.id === action);
    await approvePurchase(a?.cost ?? 0, a?.label ?? "City activity");
    const r = await req<{ sim: Sim; result: ActResult }>("POST", "/api/act", {
      city,
      loc,
      action,
      confirm: true,
      ...(slotId ? { slotId } : {}),
    });
    emitFeedback({
      kind: "actionStart",
      title: r.sim.busyLabel ?? a?.label ?? r.result.text,
      amount: a?.cost ? -a.cost : undefined,
      anchor: here(),
      data: { actionId: action, loc, busyUntil: r.result.busyUntil },
    });
    return r;
  },
  cancelAction: async () => {
    const label = useStore.getState().sim?.busyLabel;
    const r = await req<{ sim: Sim; clock: Clock }>(
      "POST",
      "/api/action/cancel",
    );
    emitFeedback({
      kind: "cancel",
      title: label ? `Stopped ${label.toLowerCase()}` : "Stopped",
      anchor: here(),
    });
    return r;
  },
  choose: (beatId: string, choice: string) =>
    req<{ sim: Sim; outcome: StoryOutcome }>("POST", "/api/story/choose", {
      beatId,
      choice,
    }),
  moveHome: async (city: CityId, neighborhood: string) => {
    const c = useStore.getState().world?.cities.find((c) => c.id === city),
      home = c?.neighborhoods.find((n) => n.id === neighborhood);
    if (!home) throw new ApiError(0, "Choose a listed neighbourhood");
    await approvePurchase(
      home.rent,
      `Move your home to ${home.name}, ${c?.name ?? city}. One daily rent deposit; future daily rent is $${home.rent}.`,
    );
    return purchased(
      await req<{ sim: Sim }>("POST", "/api/home/move", {
        city,
        neighborhood,
        confirm: true,
      }),
      `New home in ${home.name}`,
      home.rent,
    );
  },
  setAspiration: (aspiration: string) =>
    req<{ sim: Sim }>("POST", "/api/aspiration", { aspiration }),

  jobs: (city?: CityId) => req<{ jobs: Job[] }>("GET", `/api/jobs${q(city)}`),
  applyJob: (jobId: string) =>
    req<{ sim: Sim; hired: boolean; reason?: string }>(
      "POST",
      "/api/jobs/apply",
      { jobId },
    ),
  quitJob: () => req<{ sim: Sim }>("POST", "/api/jobs/quit"),

  players: (city?: CityId) =>
    req<{ players: Player[] }>("GET", `/api/players${q(city)}`),
  social: async (targetId: string, kind: SocialKind, amount?: number) => {
    const r = await req<{ sim: Sim; text: string }>("POST", "/api/social", {
      targetId,
      kind,
      amount,
    });
    const target = useStore.getState().players.find((p) => p.id === targetId);
    emitFeedback({
      kind: "social",
      title: r.text,
      amount: kind === "gift" && amount ? -amount : undefined,
      anchor: target?.position
        ? { x: target.position.x, z: target.position.z }
        : here(),
      data: { social: kind, targetId },
    });
    return r;
  },
  chat: (city?: CityId) =>
    req<{ messages: ChatMessage[] }>("GET", `/api/chat${q(city)}`),
  say: (city: CityId, text: string) =>
    req<{ message: ChatMessage }>("POST", "/api/chat", { city, text }),

  mayor: (city?: CityId) => req<MayorState>("GET", `/api/mayor${q(city)}`),
  mayorVote: (city: CityId, candidateId: string) =>
    req<MayorState>("POST", "/api/mayor/vote", { city, candidateId }),
  mayorRun: (city: CityId, slogan: string) =>
    req<MayorState>("POST", "/api/mayor/run", { city, slogan }),
  mayorPolicy: (city: CityId, policy: string) =>
    req<MayorState>("POST", "/api/mayor/policy", { city, policy }),
  mayorAnnounce: (city: CityId, text: string) =>
    req<MayorState>("POST", "/api/mayor/announce", { city, text }),

  plots: (city?: CityId) => req<Plots>("GET", `/api/plots${q(city)}`),
  buyPlot: async (plot: {
    city: CityId;
    x: number;
    y: number;
    w: number;
    h: number;
    title: string;
    link: string;
  }) => {
    await approvePurchase(
      plot.w * plot.h * 35,
      `Community plot booking: ${plot.w} by ${plot.h} cells for 7 days`,
    );
    return purchased(
      await req<{ ad: PlotAd; sim: Sim }>("POST", "/api/plots", {
        ...plot,
        confirm: true,
      }),
      `Plot booked: ${plot.title}`,
      plot.w * plot.h * 35,
    );
  },
  billboards: (city?: CityId) =>
    req<Billboards>("GET", `/api/billboards${q(city)}`),
  bookBillboard: async (
    city: CityId,
    slot: number,
    title: string,
    link: string,
  ) => {
    await approvePurchase(300, "Billboard booking for 3 days");
    return purchased(
      await req<{ ad: BillboardAd; sim: Sim }>("POST", "/api/billboards", {
        city,
        slot,
        title,
        link,
        confirm: true,
      }),
      `Billboard booked: ${title}`,
      300,
    );
  },
  homes: (city?: CityId) => req<Homes>("GET", `/api/homes${q(city)}`),
};

/**
 * Reconnecting JSON socket. Backoff is capped at 8 s with jitter, and a lost connection is retried
 * at once when the browser comes back online or the tab becomes visible. When an attempt fails
 * before the socket ever opens, `verify` decides whether to keep trying (the server may be down)
 * or stop (the session behind this socket no longer exists).
 */
const STALE_SOCKET_MS = 15000;

export function connectSocket(
  onEvent: (e: ServerEvent) => void,
  onStatus?: (open: boolean) => void,
  verify?: () => Promise<boolean>,
) {
  let ws: WebSocket | null = null;
  let closed = false;
  let retry = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastFrameAt = Date.now();
  const queue: string[] = [];
  /** The server sends at least a clock frame every 5 s; silence means a dead link. */
  const watchdog = setInterval(() => {
    if (closed || document.hidden || ws?.readyState !== WebSocket.OPEN) return;
    if (Date.now() - lastFrameAt <= STALE_SOCKET_MS) return;
    // Treat it as closed now: a close handshake on a dead link can take minutes.
    const dead = ws;
    dead.onclose?.(new CloseEvent("close"));
    dead.onclose = dead.onmessage = dead.onerror = null;
    dead.close();
  }, 3000);

  const schedule = (delay: number) => {
    clearTimeout(timer);
    timer = setTimeout(open, delay);
  };
  const open = () => {
    if (closed) return;
    clearTimeout(timer);
    let opened = false;
    const socket = new WebSocket(socketUrl(session.token));
    ws = socket;
    socket.onopen = () => {
      if (ws !== socket) return;
      opened = true;
      lastFrameAt = Date.now();
      retry = 0;
      onStatus?.(true);
      while (queue.length) socket.send(queue.shift()!);
    };
    socket.onmessage = (m) => {
      if (ws !== socket) return;
      lastFrameAt = Date.now();
      try {
        onEvent(JSON.parse(m.data as string) as ServerEvent);
      } catch {
        // ignore malformed frames
      }
    };
    socket.onclose = () => {
      if (closed || ws !== socket) return;
      ws = null;
      onStatus?.(false);
      retry = Math.min(retry + 1, 4);
      const delay =
        Math.min(8000, 500 * 2 ** retry) * (0.75 + Math.random() * 0.5);
      if (opened || !verify) {
        schedule(delay);
        return;
      }
      void verify()
        .then((keep) => {
          if (keep && !closed) schedule(delay);
          else if (!keep) stop();
        })
        .catch(() => {
          if (!closed) schedule(delay);
        });
    };
    socket.onerror = () => socket.close();
  };
  const wake = () => {
    if (closed || document.hidden) return;
    if (!ws || ws.readyState === WebSocket.CLOSED) {
      retry = 0;
      open();
    }
  };
  const stop = () => {
    closed = true;
    clearTimeout(timer);
    clearInterval(watchdog);
    window.removeEventListener("online", wake);
    document.removeEventListener("visibilitychange", wake);
  };
  window.addEventListener("online", wake);
  document.addEventListener("visibilitychange", wake);
  open();

  return {
    send(msg: { type: "view"; city: CityId } | { type: "ping" }) {
      const text = JSON.stringify(msg);
      if (ws?.readyState === WebSocket.OPEN) ws.send(text);
      else if (msg.type !== "ping") queue.splice(0, queue.length, text);
    },
    /** Try to connect now instead of waiting for the next backoff step. */
    retryNow() {
      if (closed) return;
      retry = 0;
      if (!ws || ws.readyState === WebSocket.CLOSED) open();
    },
    close() {
      stop();
      const socket = ws;
      ws = null;
      socket?.close();
    },
  };
}

export { req as apiRequest };
