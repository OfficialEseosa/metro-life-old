import { installHomeDesign, useHomeDesign } from "./home-design";
import { friendlyMessage, motion, useWalking } from "./walking";
import { serverNow, syncServerTime } from "./server-time";
import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { emitFeedback } from "./feedback";
import { api, ApiError, connectSocket, onUnauthorized } from "./api/client";
import { session } from "./api/base";
import type {
  ActResult,
  Billboards,
  ChatMessage,
  CityId,
  Clock,
  Daily,
  Homes,
  MayorState,
  Me,
  Player,
  PlayerPatch,
  Plots,
  ServerEvent,
  Sim,
  Stats,
  Rect,
  User,
  World,
  WorldInfo,
} from "./api/types";

export type Panel =
  | null
  | "creator"
  | "city"
  | "settings"
  | "location" // selectedLoc (landmark id or "home")
  | "sim" // needs, skills, goals, aspiration
  | "jobs"
  | "people"
  | "chat"
  | "mayor"
  | "plots"
  | "billboard" // selectedSlot
  | "homes"
  | "travel";

/**
 * connecting: first load. online: API and socket reachable. reconnecting: the live socket dropped
 * while playing. unreachable: the API cannot be reached (retrying on a timer). blocked: the browser
 * keeps no session for this site. ended: the saved session no longer exists on the server.
 */
export type Connection =
  | "connecting"
  | "online"
  | "reconnecting"
  | "unreachable"
  | "blocked"
  | "ended";

export type CityData =
  "daily" | "mayor" | "plots" | "billboards" | "homes" | "players" | "chat";

/**
 * Who a Wave, Hang out or Gift would reach right now: the nearest resident the player faces, with
 * real players preferred over city residents. `null` when nobody is within reach.
 */
export type SocialTarget = {
  id: string;
  name: string;
  npc: boolean;
  /** metres between the player and the target, from the latest positions frame */
  distance: number;
};

type State = {
  sceneFailed: boolean;
  acting: boolean;
  ready: boolean;
  loadError: string | null;
  // static content
  world: World | null;
  // session
  user: User | null;
  worldInfo: WorldInfo | null;
  sim: Sim | null;
  clock: Clock | null;
  stats: Stats | null;
  socialNotice: string;
  /** See SocialTarget. Updated by the walking loop a few times a second, only when it changes. */
  socialTarget: SocialTarget | null;
  setSocialTarget: (target: SocialTarget | null) => void;
  connected: boolean;
  connection: Connection;
  /** when the live socket last dropped (ms epoch), null while connected */
  disconnectedAt: number | null;
  /** when the next automatic retry runs while the API is unreachable */
  retryAt: number | null;
  /** retry the API or the live socket immediately */
  retryNow: () => void;
  /** forget this browser's saved session and begin again as a new guest */
  startFresh: () => Promise<void>;
  // the city map being looked at (may differ from sim.city)
  city: CityId;
  sceneQuality: "normal" | "low";
  wallMode: "up" | "cutaway" | "down";
  setWallMode: (mode: "up" | "cutaway" | "down") => void;
  setSceneQuality: (quality: "normal" | "low") => void;
  sceneTheme: "auto" | "day" | "night";
  mapLens: "all" | "eat" | "earn" | "fun" | "affordable";
  searchOpen: boolean;
  setSearchOpen: (open: boolean) => void;
  needWarningDismissed: string;
  dismissNeedWarning: (need: string) => void;
  setMapLens: (lens: State["mapLens"]) => void;
  hudInsets: { top: number; right: number; bottom: number; left: number };
  setHudInsets: (insets: State["hudInsets"]) => void;
  cameraMoving: boolean;
  setCameraMoving: (moving: boolean) => void;
  rewardAnchor: { x: number; y: number } | null;
  setRewardAnchor: (anchor: State["rewardAnchor"]) => void;
  setSceneTheme: (theme: "auto" | "day" | "night") => void;
  // per viewed city
  daily: Daily | null;
  mayor: MayorState | null;
  plots: Plots | null;
  billboards: Billboards | null;
  homes: Homes | null;
  /**
   * Stable roster of the viewed city. The array changes only when someone joins or leaves,
   * changes city, look, online state or visible state (activity, label, slot, room, condition);
   * never for position or need drift. Entries are the live objects of `livePlayers`, so
   * `players[i].position` read inside a frame loop or event handler is current.
   */
  players: Player[];
  chat: ChatMessage[];
  // ui <-> scene
  panel: Panel;
  selectedLoc: string | null;
  selectedSlot: number | null;
  plotSelection: Rect | null;
  setPlotSelection: (rect: Rect) => void;
  /** set by the UI to make the scene camera fly to a landmark id, "plots", "homes" or "home"; the scene clears it */
  focus: string | null;
  /** last action result, for a toast; the UI clears it */
  lastResult: ActResult | null;

  load: () => Promise<void>;
  /** re-read session, world info, sim and clock (after login, world switch, etc.), then the city data */
  syncSession: (known?: Me) => Promise<void>;
  changeSession: (change: () => Promise<unknown>) => Promise<void>;
  /** `arrive`: the player's own sim moved here (flight, bus): keep following them, no overview flight. */
  setCity: (city: CityId, arrive?: boolean) => Promise<void>;
  refresh: (...what: CityData[]) => Promise<void>;
  setSim: (sim: Sim | null) => void;
  setUser: (user: User | null) => void;
  setMayor: (m: MayorState) => void;
  setLastResult: (r: ActResult | null) => void;
  openPanel: (p: Panel) => void;
  selectLocation: (id: string | null) => void;
  selectSlot: (slot: number | null) => void;
  travelTo: (location: string, afterPanel?: Panel) => Promise<void>;
  setFocus: (key: string | null) => void;
};

const safe = <T>(p: Promise<T>) => p.catch(() => null);
const selfAnchor = () =>
  motion.position ? { x: motion.position.x, z: motion.position.z } : undefined;
function placeName(city: CityId, loc: string | null) {
  if (!loc) return "Out in the city";
  if (loc === "home") return "Home";
  return (
    useStore
      .getState()
      .world?.cities.find((c) => c.id === city)
      ?.landmarks.find((l) => l.id === loc)?.name ?? "Arrived"
  );
}
/** A settled activity (or story outcome) reached the player. */
function announceResult(result: ActResult) {
  const anchor = selfAnchor();
  emitFeedback({
    kind: "actionDone",
    title: result.activity?.label ?? result.text,
    detail: result.activity ? result.text : undefined,
    amount: result.deltas.cash,
    anchor,
    data: {
      actionId: result.activity?.id ?? null,
      leveledUp: result.leveledUp,
    },
  });
  for (const goal of result.goalsCompleted)
    emitFeedback({ kind: "goal", title: goal, anchor });
}
let socket: ReturnType<typeof connectSocket> | null = null;
let loading: Promise<void> | null = null;
let resultTimer: ReturnType<typeof setTimeout> | null = null;
/**
 * The accepted outcome of the running activity. It is shown once, when an authoritative sim (from
 * the socket's `sim` event, any response, or the single fallback read) shows the activity finished.
 */
let pendingResult: {
  result: ActResult;
  worldId: string | undefined;
  tries: number;
} | null = null;
/** First fallback read after the deadline, then a few slower retries, if no socket event arrived. */
const SETTLE_GRACE_MS = 1500,
  SETTLE_RETRY_MS = 2500,
  SETTLE_TRIES = 5;
let panelTrigger: HTMLElement | null = null;
export const getPanelTrigger = () => panelTrigger;
function rememberTrigger() {
  const active = document.activeElement;
  if (
    active instanceof HTMLElement &&
    active.matches("button") &&
    !active.closest(".sheet")
  )
    panelTrigger = active;
}
const realtimeEnabled = true;
let socketEpoch = 0,
  presenceRevision = 0,
  resourceRevision = 0,
  sessionChanging = false;
let indoorTravelPending = false;
/** Server time from which chat messages count as new (see the `chat` event). */
let chatNewsSince = 0;
let retryTimer: ReturnType<typeof setTimeout> | null = null,
  retryStep = 0,
  verifying: Promise<boolean> | null = null;
const RETRY_DELAYS = [2000, 4000, 8000, 15000];
export const mergeChat = (current: ChatMessage[], incoming: ChatMessage[]) =>
  [...new Map([...current, ...incoming].map((m) => [m.id, m])).values()]
    .sort((a, b) => a.at - b.at || a.id.localeCompare(b.id))
    .slice(-50);

/**
 * Live players of the viewed city keyed by id: mutated in place by presence (1 Hz) and
 * positions (5 Hz) frames without a React update. Read it from useFrame or handlers.
 * `revision` increments on every patch; `at` is the server time of the last positions frame.
 */
export const livePlayers = {
  byId: new Map<string, Player>(),
  revision: 0,
  at: 0,
  listeners: new Set<() => void>(),
  get(id: string) {
    return this.byId.get(id);
  },
  /** Called after every presence or positions patch (e.g. to invalidate a demand frame loop). */
  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  },
};
function notifyLive() {
  livePlayers.revision++;
  for (const listener of livePlayers.listeners) listener();
}

const low = (value: number | undefined) => (value ?? 100) < 20;
/** Fields whose change is worth a React update; position and raw needs are excluded on purpose. */
function visibleKey(p: Player) {
  const action = p.lifeAction as
    { label?: string; pose?: string } | null | undefined;
  return [
    p.loc,
    p.position?.room ?? "",
    p.activity ?? "",
    p.busyLabel ?? "",
    action?.label ?? action?.pose ?? "",
    p.activitySlot?.id ?? "",
    p.socialBusy ? 1 : 0,
    p.tripId ?? "",
    p.travelStatus ?? "",
    low(p.needs?.energy) ? 1 : 0,
    low(p.needs?.hunger) ? 1 : 0,
    low(p.needs?.hygiene) ? 1 : 0,
  ].join("|");
}
const identityKeys = new WeakMap<Player, string>();
function identityKey(p: Player) {
  let key = identityKeys.get(p);
  if (key === undefined) {
    key = [
      p.id,
      p.username,
      p.city,
      p.online ? 1 : 0,
      p.npc ? 1 : 0,
      p.job ?? "",
      p.level,
      JSON.stringify(p.look),
    ].join("|");
    identityKeys.set(p, key);
  }
  return key;
}
let rosterKey = "";
function computeRosterKey(list: Player[]) {
  let key = "";
  for (const p of list) key += identityKey(p) + "~" + visibleKey(p) + "\n";
  return key;
}
/** Replace the live map with a full player list; returns the new roster or null when unchanged. */
function applyPresence(list: Player[], current: Player[]): Player[] | null {
  const next = new Map<string, Player>();
  const roster: Player[] = [];
  for (const incoming of list) {
    const existing = livePlayers.byId.get(incoming.id);
    let entry: Player;
    if (existing && identityKey(existing) === identityKey(incoming)) {
      Object.assign(existing, incoming);
      entry = existing;
    } else entry = { ...incoming };
    next.set(entry.id, entry);
    roster.push(entry);
  }
  livePlayers.byId = next;
  notifyLive();
  const key = computeRosterKey(roster);
  const same =
    key === rosterKey &&
    roster.length === current.length &&
    roster.every((p, i) => p === current[i]);
  rosterKey = key;
  return same ? null : roster;
}
/** Patch live fields in place; returns a new roster array only when visible state changed. */
function applyPositions(
  patches: PlayerPatch[],
  current: Player[],
): Player[] | null {
  for (const patch of patches) {
    const existing = livePlayers.byId.get(patch.id);
    if (existing) Object.assign(existing, patch);
  }
  notifyLive();
  const key = computeRosterKey(current);
  if (key === rosterKey) return null;
  rosterKey = key;
  return [...current];
}
function resetPlayers(): Player[] {
  livePlayers.byId = new Map();
  notifyLive();
  rosterKey = "";
  return [];
}
/** World position of a player for feedback anchors (own sim falls back to `motion.position`). */
export function playerAnchor(id: string | undefined) {
  if (!id) return undefined;
  const self = useStore.getState().user?.id === id ? motion.position : null;
  const at = self ?? livePlayers.get(id)?.position;
  return at ? { x: at.x, z: at.z } : undefined;
}

export const useStore = create<State>((set, get) => {
  /** Re-read the authoritative sim after the server says it changed. */
  const refreshSim = () => {
    const wid = get().worldInfo?.id;
    if (!wid) return;
    void api
      .sim()
      .then((r) => {
        if (get().worldInfo?.id === wid) {
          set({ clock: r.clock });
          get().setSim(r.sim);
        }
      })
      .catch(() => {});
  };

  /** Show the finished activity once its outcome is authoritative. */
  const deliverSettled = (sim: Sim) => {
    const pending = pendingResult;
    if (!pending || pending.worldId !== sim.worldId) return;
    const { result } = pending;
    const finished =
      (!sim.busyUntil || sim.busyUntil !== result.busyUntil) &&
      serverNow() >= (result.busyUntil ?? 0) - 400;
    if (!finished) return;
    pendingResult = null;
    if (resultTimer) clearTimeout(resultTimer);
    resultTimer = null;
    set({ lastResult: result, rewardAnchor: null });
    announceResult(result);
  };
  /** The socket normally reports completion; read the sim ourselves only if it has not. */
  const scheduleSettleCheck = (delay: number) => {
    if (resultTimer) clearTimeout(resultTimer);
    resultTimer = setTimeout(() => {
      resultTimer = null;
      const pending = pendingResult;
      if (!pending || pending.worldId !== get().sim?.worldId) return;
      pending.tries++;
      void api
        .sim()
        .then((r) => {
          set({ clock: r.clock });
          get().setSim(r.sim);
        })
        .catch(() => {})
        .finally(() => {
          if (pendingResult === pending && pending.tries < SETTLE_TRIES)
            scheduleSettleCheck(SETTLE_RETRY_MS);
        });
    }, delay);
  };

  const onEvent = (e: ServerEvent) => {
    const { city } = get();
    switch (e.type) {
      case "hello":
      case "clock":
        syncServerTime(e.clock.at);
        set({ clock: e.clock });
        break;
      case "presence":
        if (e.city === city) {
          presenceRevision++;
          const roster = applyPresence(e.players, get().players);
          if (roster) set({ players: roster });
        }
        break;
      case "positions":
        if (e.city === city) {
          presenceRevision++;
          livePlayers.at = e.at;
          const roster = applyPositions(e.players, get().players);
          if (roster) set({ players: roster });
        }
        break;
      case "chat":
        if (e.message.city === city) {
          const known = get().chat.some((m) => m.id === e.message.id);
          set((s) => ({ chat: mergeChat(s.chat, [e.message]) }));
          // Only messages written since this city came into view are news; the backlog that
          // arrives on connect or after a flight is history, not a flood of toasts.
          if (
            !known &&
            e.message.userId !== get().user?.id &&
            e.message.at >= chatNewsSince
          )
            emitFeedback({
              kind: "chat",
              title: e.message.username,
              detail: e.message.text,
              anchor: playerAnchor(e.message.userId),
              data: { userId: e.message.userId, npc: e.message.npc },
            });
        }
        break;
      case "socialReceived": {
        set({ socialNotice: e.text });
        emitFeedback({
          kind: "socialReceived",
          title: e.text,
          amount: e.kind === "gift" ? e.amount : undefined,
          anchor: playerAnchor(e.fromId),
          data: { social: e.kind, fromId: e.fromId, fromName: e.fromName },
        });
        refreshSim();
        break;
      }
      case "resync":
        void get().refresh("players", "chat");
        refreshSim();
        break;
      case "event":
        if (e.kind === "sim" || e.kind === "story") {
          refreshSim();
          if (e.text) set({ socialNotice: e.text });
        } else if (e.city === city) void get().refresh(e.kind);
        break;
    }
  };

  const reconnect = () => {
    socket?.close();
    const epoch = ++socketEpoch;
    if (!get().user) {
      socket = null;
      set({ connected: false });
      return;
    }
    socket = connectSocket(
      (e) => {
        if (epoch === socketEpoch) onEvent(e);
      },
      (connected) => {
        if (epoch !== socketEpoch) return;
        set((s) => ({
          connected,
          connection: connected
            ? "online"
            : s.connection === "online"
              ? "reconnecting"
              : s.connection,
          disconnectedAt: connected ? null : (s.disconnectedAt ?? Date.now()),
        }));
        if (connected) {
          chatNewsSince = serverNow() - 2000;
          socket?.send({ type: "view", city: get().city });
          void get().refresh(
            "players",
            "chat",
            "mayor",
            "plots",
            "billboards",
            "homes",
          );
        }
      },
      () => (epoch === socketEpoch ? verifySession() : Promise.resolve(false)),
    );
  };

  /** The socket or an API call was refused: check whether this browser's session still exists. */
  const verifySession = () => {
    if (verifying) return verifying;
    const userId = get().user?.id;
    verifying = api
      .me()
      .then(
        (me) => {
          if (!me.user) {
            socketEpoch++;
            socket?.close();
            socket = null;
            set({ connected: false, connection: "ended" });
            return false;
          }
          if (me.user.id !== userId) {
            void get().syncSession(me);
            return false;
          }
          return true;
        },
        () => true,
      )
      .finally(() => {
        verifying = null;
      });
    return verifying;
  };
  onUnauthorized(() => {
    if (get().user && get().connection !== "ended") void verifySession();
  });

  const scheduleRetry = () => {
    if (retryTimer) clearTimeout(retryTimer);
    const delay = RETRY_DELAYS[Math.min(retryStep, RETRY_DELAYS.length - 1)];
    retryStep++;
    set({ retryAt: Date.now() + delay });
    retryTimer = setTimeout(() => {
      retryTimer = null;
      void get().load();
    }, delay);
  };

  return {
    sceneFailed: false,
    acting: false,
    ready: false,
    loadError: null,
    world: null,
    user: null,
    worldInfo: null,
    sim: null,
    clock: null,
    stats: null,
    connected: false,
    connection: "connecting",
    disconnectedAt: null,
    retryAt: null,
    socialNotice: "",
    socialTarget: null,
    setSocialTarget: (socialTarget) => {
      const current = get().socialTarget;
      if (
        current?.id === socialTarget?.id &&
        current?.name === socialTarget?.name &&
        (!current ||
          !socialTarget ||
          Math.abs(current.distance - socialTarget.distance) < 0.25)
      )
        return;
      set({ socialTarget });
    },
    city: "atl",
    sceneQuality: (() => {
      try {
        return localStorage.getItem("metro-quality") === "low"
          ? "low"
          : "normal";
      } catch {
        return "normal";
      }
    })(),
    wallMode: "cutaway",
    setWallMode: (wallMode) => set({ wallMode }),
    setSceneQuality: (sceneQuality) => {
      try {
        localStorage.setItem("metro-quality", sceneQuality);
      } catch {
        /* Session preference still works with blocked storage. */
      }
      set({ sceneQuality });
    },
    sceneTheme: "auto",
    mapLens: "all",
    setMapLens: (mapLens) => set({ mapLens }),
    searchOpen: false,
    setSearchOpen: (searchOpen) =>
      set(searchOpen ? { searchOpen, panel: null } : { searchOpen }),
    needWarningDismissed: "",
    dismissNeedWarning: (needWarningDismissed) => set({ needWarningDismissed }),
    hudInsets: { top: 0, right: 0, bottom: 0, left: 0 },
    setHudInsets: (hudInsets) => set({ hudInsets }),
    cameraMoving: false,
    setCameraMoving: (cameraMoving) => set({ cameraMoving }),
    rewardAnchor: null,
    setRewardAnchor: (rewardAnchor) => set({ rewardAnchor }),
    setSceneTheme: (sceneTheme) => set({ sceneTheme }),
    daily: null,
    mayor: null,
    plots: null,
    billboards: null,
    homes: null,
    players: [],
    chat: [],
    panel: null,
    selectedLoc: null,
    selectedSlot: null,
    plotSelection: null,
    setPlotSelection: (plotSelection) => set({ plotSelection }),
    focus: null,
    lastResult: null,

    load: () => {
      if (loading) return loading;
      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
      loading = (async () => {
        try {
          const [world, stats] = await Promise.all([api.world(), api.stats()]);
          set({ world, stats, loadError: null });
          await api.guest();
          let me = await api.me();
          // The cookie did not stick (third-party cookies blocked): switch to the header session once.
          if (!me.user && !session.token) {
            session.want();
            await api.guest();
            me = await api.me();
          }
          retryStep = 0;
          if (!me.user) {
            set({ connection: "blocked", retryAt: null });
            return;
          }
          set({ connection: "online", retryAt: null });
          await get().syncSession(me);
        } catch (error) {
          if (error instanceof ApiError && error.status === 0) {
            set({ connection: "unreachable", loadError: error.message });
            scheduleRetry();
          } else
            set({
              connection: "unreachable",
              retryAt: null,
              loadError:
                error instanceof Error
                  ? error.message
                  : "Could not reach the city. Try again.",
            });
        } finally {
          set({ ready: true });
          loading = null;
        }
      })();
      return loading;
    },

    retryNow: () => {
      const { connection } = get();
      if (connection === "reconnecting") {
        socket?.retryNow();
        return;
      }
      retryStep = 0;
      void get().load();
    },

    startFresh: async () => {
      session.forget();
      socketEpoch++;
      socket?.close();
      socket = null;
      retryStep = 0;
      set({
        user: null,
        sim: null,
        worldInfo: null,
        connected: false,
        connection: "connecting",
        disconnectedAt: null,
        loadError: null,
        panel: null,
      });
      await get().load();
    },

    changeSession: async (change) => {
      const panel = get().panel;
      sessionChanging = true;
      resourceRevision++;
      socketEpoch++;
      socket?.close();
      socket = null;
      set({
        plots: null,
        billboards: null,
        players: resetPlayers(),
        chat: [],
        connected: false,
      });
      // Let layout-effect image cleanup abort old-world requests before changing the cookie.
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      try {
        await change();
        await api.guest();
        await get().syncSession();
      } catch (error) {
        await get().syncSession();
        set({ panel });
        throw error;
      }
    },

    syncSession: async (known) => {
      const me = known ?? (await safe(api.me()));
      const city = me?.sim?.city ?? get().city;
      if (resultTimer) clearTimeout(resultTimer);
      resultTimer = null;
      pendingResult = null;
      presenceRevision++;
      installHomeDesign(me?.sim?.homeDesign, me?.sim?.homeLayout);
      useHomeDesign.getState().setOpen(false);
      set({
        user: me?.user ?? null,
        worldInfo: me?.world ?? null,
        sim: me?.sim ?? null,
        clock: me?.clock ?? null,
        city,
        players: resetPlayers(),
        chat: [],
        socialNotice: "",
        socialTarget: null,
        mayor: null,
        plots: null,
        billboards: null,
        homes: null,
        plotSelection: null,
        lastResult: null,
        selectedLoc: null,
        selectedSlot: null,
        searchOpen: false,
        rewardAnchor: null,
        focus: null,
        panel: null,
        acting: false,
      });
      sessionChanging = false;
      resourceRevision++;
      // Civic and live resources become available in M6/M7; do not poll absent routes.
      if (realtimeEnabled) reconnect();
      await get().refresh("daily", "mayor", "plots", "billboards");
    },

    setCity: async (city, arrive = false) => {
      if (city === get().city) return;
      if (arrive) {
        motion.follow = true;
        motion.snapCamera = true;
        motion.camera = null;
      }
      set({
        city,
        daily: null,
        mayor: null,
        plots: null,
        billboards: null,
        homes: null,
        players: resetPlayers(),
        chat: [],
        selectedLoc: null,
        selectedSlot: null,
        plotSelection: null,
        panel: null,
        socialTarget: null,
        focus: arrive ? null : "overview",
      });
      chatNewsSince = serverNow() - 2000;
      socket?.send({ type: "view", city });
      await get().refresh("daily", "mayor", "plots", "billboards");
    },

    refresh: async (...what) => {
      if (sessionChanging) return;
      const city = get().city,
        worldId = get().worldInfo?.id,
        presenceAtStart = presenceRevision,
        revision = resourceRevision;
      const jobs: Promise<void>[] = [];
      const put = <K extends keyof State>(
        key: K,
        p: Promise<State[K] | null>,
      ) =>
        jobs.push(
          p.then((v) => {
            // drop the result if the user switched city meanwhile
            if (
              sessionChanging ||
              revision !== resourceRevision ||
              get().city !== city ||
              get().worldInfo?.id !== worldId ||
              v === null
            )
              return;
            if (key === "chat") {
              set((s) => ({ chat: mergeChat(s.chat, v as ChatMessage[]) }));
              return;
            }
            if (key === "players") {
              if (presenceRevision !== presenceAtStart) return;
              const roster = applyPresence(v as Player[], get().players);
              if (roster) set({ players: roster });
              return;
            }
            set({ [key]: v } as Pick<State, K>);
          }),
        );
      for (const w of what) {
        if (w === "daily") put("daily", safe(api.daily(city)));
        if (w === "mayor") put("mayor", safe(api.mayor(city)));
        if (w === "plots") put("plots", safe(api.plots(city)));
        if (w === "billboards") put("billboards", safe(api.billboards(city)));
        if (w === "homes") put("homes", safe(api.homes(city)));
        if (w === "players")
          put("players", safe(api.players(city).then((r) => r.players)));
        if (w === "chat")
          put("chat", safe(api.chat(city).then((r) => r.messages)));
      }
      await Promise.all(jobs);
    },

    setSim: (sim) => {
      if (indoorTravelPending) return;
      if (sim && sim.worldId !== get().worldInfo?.id) return;
      installHomeDesign(sim?.homeDesign, sim?.homeLayout);
      const travelled = sim && get().sim && sim.city !== get().sim?.city;
      const before = get().sim?.position;
      // Snap only when the server itself moved the player (door, travel, a refused step): a
      // snapshot that merely trails a walking player must not pull them back.
      if (
        sim?.position &&
        motion.position &&
        (sim.position.room !== motion.position.room ||
          (Math.hypot(
            sim.position.x - motion.position.x,
            sim.position.z - motion.position.z,
          ) > 4 &&
            (!before ||
              (before.room ?? null) !== (sim.position.room ?? null) ||
              Math.hypot(sim.position.x - before.x, sim.position.z - before.z) >
                4)))
      ) {
        motion.revision++;
        motion.teleport++;
        motion.trail = [];
        motion.position = { ...sim.position };
        useWalking.setState({ position: { ...sim.position } });
        motion.follow = true;
        motion.snapCamera = true;
        motion.wake();
      }
      set({ sim });
      // Arriving in another city (a flight or bus): follow the player there, never the overview.
      if (travelled && sim) void get().setCity(sim.city, true);
      if (sim) deliverSettled(sim);
    },
    setUser: (user) => set({ user }),
    setMayor: (mayor) => set({ mayor }),
    setLastResult: (lastResult) => {
      if (resultTimer) clearTimeout(resultTimer);
      resultTimer = null;
      pendingResult = null;
      const wait = (lastResult?.busyUntil ?? 0) - serverNow();
      if (lastResult && wait > 0) {
        // One settlement path: the socket's `sim` event (or any fresher sim) delivers it in
        // deliverSettled; a single fallback read covers a quiet or missing socket.
        pendingResult = { result: lastResult, worldId: get().sim?.worldId, tries: 0 };
        set({ lastResult: null, rewardAnchor: null });
        scheduleSettleCheck(wait + SETTLE_GRACE_MS);
      } else {
        set({ lastResult, rewardAnchor: null });
        if (lastResult) announceResult(lastResult);
      }
    },
    openPanel: (panel) => {
      if (panel) rememberTrigger();
      set(panel ? { panel, searchOpen: false } : { panel });
    },
    selectLocation: (id) => {
      if (id) rememberTrigger();
      const targetCity =
        id === "home"
          ? get().sim?.home.city
          : get().world?.cities.find((c) =>
              c.landmarks.some((l) => l.id === id),
            )?.id;
      if (targetCity && targetCity !== get().city)
        void get().setCity(targetCity);
      set({
        selectedLoc: id,
        panel: id ? "location" : null,
        searchOpen: false,
      });
    },
    selectSlot: (slot) =>
      set({ selectedSlot: slot, panel: slot === null ? null : "billboard" }),
    travelTo: async (destination, afterPanel = null) => {
      const state = get(),
        sim = state.sim;
      if (!sim || state.city !== sim.city || indoorTravelPending) return;
      if (sim.busyUntil || sim.pendingBeat) {
        useWalking.setState({
          error: sim.busyUntil
            ? "Finish this activity before travelling."
            : "Make your story choice before travelling.",
        });
        return;
      }
      indoorTravelPending = true;
      set({ focus: null, acting: true });
      motion.x = motion.z = 0;
      const world = sim.worldId;
      try {
        await motion.flush();
        motion.revision++;
        const current = get().sim ?? sim;
        const alreadyThere =
          !current.position?.room && current.position?.place === destination;
        let result = alreadyThere
          ? await api.sim()
          : await api.travel(sim.city, destination);
        if (get().sim?.worldId !== world) return;
        installHomeDesign(result.sim.homeDesign, result.sim.homeLayout);
        set({
          sim: result.sim,
          clock: result.clock,
          searchOpen: false,
          cameraMoving: false,
        });
        const deadline = Date.now() + 30000;
        while (result.sim.busyUntil) {
          if (Date.now() > deadline)
            throw Error(
              "Your trip is taking longer than expected. Please try again.",
            );
          await new Promise((resolve) => setTimeout(resolve, 300));
          // A refused or late read (another request in flight) is simply tried again.
          result = await api.sim().catch((error: unknown) => {
            if (error instanceof ApiError && error.status === 0) return result;
            throw error;
          });
          if (get().sim?.worldId !== world) return;
        }
        const arrived = result.sim.position;
        if (!arrived)
          throw Error("Could not find your way there. Please try again.");
        motion.revision++;
        motion.teleport++;
        motion.trail = [];
        motion.position = { ...arrived };
        motion.follow = true;
        motion.camera = null;
        motion.snapCamera = true;
        // A map shortcut arrives behind a short fade, so the jump reads as travel, not a glitch.
        useWalking.setState({
          position: { ...arrived },
          error: "",
          ...(alreadyThere ? {} : { transition: true }),
        });
        installHomeDesign(result.sim.homeDesign, result.sim.homeLayout);
        set({
          sim: result.sim,
          clock: result.clock,
          panel: afterPanel,
          selectedLoc: destination,
          focus: null,
          cameraMoving: false,
        });
        motion.wake();
        if (!alreadyThere)
          emitFeedback({
            kind: "arrival",
            title: placeName(result.sim.city, destination),
            detail: "Map shortcut",
            anchor: { x: arrived.x, z: arrived.z },
            data: { loc: destination, city: result.sim.city },
          });
        if (afterPanel === "mayor") await get().refresh("mayor");
      } catch (error) {
        useWalking.setState({
          error: friendlyMessage(error, "Could not travel there. Try again."),
        });
        throw error;
      } finally {
        indoorTravelPending = false;
        set({ acting: false });
        setTimeout(() => useWalking.setState({ transition: false }), 500);
      }
    },
    setFocus: (focus) => {
      const state = get(),
        sim = state.sim;
      const destination = focus === "homes" ? "home" : focus;
      const landmark =
        destination === "home" ||
        state.world?.cities
          .find((c) => c.id === sim?.city)
          ?.landmarks.some((l) => l.id === destination);
      if (destination && landmark && sim && state.city === sim.city) {
        void get()
          .travelTo(destination)
          .catch(() => {});
        return;
      }
      if (sim?.position?.room && state.city === sim.city) {
        set({ focus: null });
        motion.follow = true;
        motion.wake();
        return;
      }
      set({ focus });
    },
  };
});

// ---- outcomes derived from authoritative sim changes ------------------------

const ledgerSeen = new Set<string>();
let ledgerOwner = "";
useStore.subscribe((state, previous) => {
  const next = state.sim,
    before = previous.sim;
  if (!next || next === before) return;
  const entries = next.economy?.entries ?? [];
  if (!before || before.userId !== next.userId || ledgerOwner !== next.userId) {
    ledgerOwner = next.userId;
    ledgerSeen.clear();
    for (const entry of entries) ledgerSeen.add(entry.id);
    return;
  }
  const anchor = selfAnchor();
  for (const entry of entries) {
    if (ledgerSeen.has(entry.id)) continue;
    ledgerSeen.add(entry.id);
    if (/rent/i.test(entry.reason) && entry.amount !== 0)
      emitFeedback({
        kind: "rent",
        title: entry.reason,
        amount: -Math.abs(entry.amount),
        anchor,
      });
  }
  if (next.level > before.level)
    emitFeedback({
      kind: "levelUp",
      title: `Level ${next.level}`,
      amount: next.level,
      anchor,
    });
  if (next.job && (!before.job || next.job.id !== before.job.id))
    emitFeedback({
      kind: "promotion",
      title:
        before.job && before.job.track === next.job.track
          ? `Promoted to ${next.job.title}`
          : `Hired as ${next.job.title}`,
      detail: `$${next.job.payPerHour} an hour`,
      anchor,
      data: {
        hired: !before.job || before.job.track !== next.job.track,
        jobId: next.job.id,
      },
    });
  if (
    next.aspiration &&
    before.aspiration &&
    next.aspiration.id === before.aspiration.id &&
    next.aspiration.step > before.aspiration.step
  )
    emitFeedback({
      kind: "milestone",
      title: before.aspiration.current?.text ?? next.aspiration.label,
      detail: next.aspiration.label,
      amount: before.aspiration.current?.reward.cash,
      anchor,
    });
  if (next.city !== before.city)
    emitFeedback({
      kind: "travel",
      title: `Arrived in ${state.world?.cities.find((c) => c.id === next.city)?.name ?? next.city}`,
      anchor,
      data: { from: before.city, to: next.city },
    });
});

// ---- narrow selectors ---------------------------------------------------------

export type SimVitals = {
  needs: Sim["needs"];
  cash: number;
  mood: Sim["mood"];
};
/** Needs, cash and mood of the player's sim; re-renders only when one of them changes. */
export const useSimVitals = (): SimVitals | null =>
  useStore(
    useShallow((s) =>
      s.sim ? { needs: s.sim.needs, cash: s.sim.cash, mood: s.sim.mood } : null,
    ),
  );

export type SimIdentity = {
  userId: string;
  name: string;
  look: Sim["look"];
  city: CityId;
  loc: string | null;
};
/** Who and where the player is; ignores needs, cash and every other sim field. */
let stableLook: { key: string; look: Sim["look"] } | null = null;
const lookOf = (look: Sim["look"]) => {
  const key = JSON.stringify(look);
  if (stableLook?.key !== key) stableLook = { key, look };
  return stableLook.look;
};
export const useSimIdentity = (): SimIdentity | null =>
  useStore(
    useShallow((s) =>
      s.sim
        ? {
            userId: s.sim.userId,
            name: s.sim.username,
            look: lookOf(s.sim.look),
            city: s.sim.city,
            loc: s.sim.loc,
          }
        : null,
    ),
  );

export type ConnectionInfo = {
  connection: Connection;
  connected: boolean;
  disconnectedAt: number | null;
  retryAt: number | null;
  retryNow: () => void;
};
/** Connection state for banners and gates. */
export const useConnection = (): ConnectionInfo =>
  useStore(
    useShallow((s) => ({
      connection: s.connection,
      connected: s.connected,
      disconnectedAt: s.disconnectedAt,
      retryAt: s.retryAt,
      retryNow: s.retryNow,
    })),
  );
