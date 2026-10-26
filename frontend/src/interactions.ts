import { create } from "zustand";
import { api } from "./api/client";
import type { CityId, Player, ActivitySlot, Job, Action } from "./api/types";
import {
  activityUse,
  canStand,
  doorsFor,
  homeStationSupports,
  roomLayout,
  roomType,
  interiorType,
} from "./navigation";
import { navigationRoute } from "./scene/navigation-route";
import type { PickTarget } from "./scene/object-picking";
import { useStore } from "./store";
import {
  ERROR_TTL_MS,
  friendlyMessage,
  motion,
  useWalking,
} from "./walking";
import { actionReason, policyHours } from "./ui/action-rules";
import { serverNow } from "./server-time";

type Point = { x: number; z: number };
export type QueuedAction = {
  id: string;
  label: string;
  icon: string;
  kind: "walk" | "act" | "door" | "social" | "apply" | "posture" | "transit";
  city: CityId;
  room: string | null;
  point: Point;
  loc?: string;
  actionId?: string;
  slotId?: string;
  targetId?: string;
  socialKind?: "wave" | "hangout" | "gift";
  jobId?: string;
  benchId?: string;
  enter?: boolean;
};
type Task = Omit<QueuedAction, "id">;
type Option = {
  id: string;
  label: string;
  icon: string;
  reason: string;
  task: Task;
};
export const useInteractions = create<{
  menu: { target: PickTarget; title: string; options: Option[] } | null;
  current: QueuedAction | null;
  waiting: QueuedAction[];
  phase: "walking" | "starting" | "performing" | null;
  error: string;
}>(() => ({ menu: null, current: null, waiting: [], phase: null, error: "" }));
let interactionEpoch = 0,
  cancelling = false,
  sequence = 0,
  path: Point[] = [],
  settleAt = 0,
  manualAt = 0,
  lastRepath = 0,
  stuckAt = 0,
  repaths = 0,
  lastProgress: Point | null = null,
  cancelled = new Set<string>();
const state = () => useInteractions.getState();
const personPoint = (p: Player) => p.activitySlot ?? p.position;
let socialRouteTarget = "",
  socialAnchor: Point | null = null,
  socialRetries = 0;
/** Reach a free point near the current person, rather than their old clicked body position. */
function socialApproach(
  city: CityId,
  room: string | null,
  person: Player,
  from: Point,
) {
  const point = personPoint(person);
  if (!point) return;
  const toward = Math.atan2(from.x - point.x, from.z - point.z),
    candidates: Point[] = [];
  for (const r of [1.15, 1.65, 2.1])
    for (let i = 0; i < 8; i++) {
      const a = toward + (i * Math.PI) / 4,
        next = { x: point.x + Math.sin(a) * r, z: point.z + Math.cos(a) * r };
      if (canStand(city, next.x, next.z, room)) candidates.push(next);
    }
  candidates.sort(
    (a, b) =>
      Math.hypot(a.x - from.x, a.z - from.z) -
      Math.hypot(b.x - from.x, b.z - from.z),
  );
  for (const candidate of candidates.slice(0, 12)) {
    const route = navigationRoute(city, room, from, candidate);
    if (route.length) return { point: candidate, route };
  }
}
function approach(
  city: CityId,
  room: string | null,
  point: Point,
  from: Point,
  radius = 1.3,
) {
  const candidates: Point[] = [];
  if (canStand(city, point.x, point.z, room)) candidates.push(point);
  for (const r of [0.7, 1, 1.3, radius])
    for (let i = 0; i < 16; i++) {
      const a = (i * Math.PI) / 8,
        p = { x: point.x + Math.sin(a) * r, z: point.z + Math.cos(a) * r };
      if (canStand(city, p.x, p.z, room)) candidates.push(p);
    }
  return candidates.sort(
    (a, b) =>
      Math.hypot(a.x - from.x, a.z - from.z) -
      Math.hypot(b.x - from.x, b.z - from.z),
  )[0];
}
function closed(loc: string) {
  const s = useStore.getState();
  // Whoever came in before closing may finish their visit (the server allows it too).
  const room = motion.position?.room ?? s.sim?.position?.room ?? "";
  if (room && room.endsWith(`:${loc}`)) return false;
  const place = s.world?.cities
      .find((c) => c.id === s.sim?.city)
      ?.landmarks.find((l) => l.id === loc);
  if (!place) return false;
  const [a, b] = policyHours(
      place.open,
      place.category,
      s.mayor?.mayor?.policy,
    ),
    c = s.clock,
    h = c
      ? ((c.hour * 60 + c.minute + (serverNow() - c.at) / c.msPerMinute) %
          1440) /
        60
      : 12;
  return a < b ? h < a || h >= b : h < a && h >= b;
}
function socialReason(p: Player | undefined) {
  const s = useStore.getState();
  return !p || (!p.npc && !p.online)
    ? "That neighbour has left"
    : p.socialBusy
      ? "Your neighbour is busy"
      : p.city !== s.sim?.city ||
          (p.position?.room ?? null) !== (s.sim?.position?.room ?? null)
        ? "Meet in the same room first"
        : s.sim?.loc === "home"
          ? "Meet at a public place first"
          : "";
}
/** An explicit navigation request replaces old walking tasks and enters through the real door. */
function routeToStation(loc: string, last: Task) {
  const s = useStore.getState(),
    sim = s.sim,
    p = motion.position,
    phase = state().phase,
    defer = !!(s.acting || sim?.busyUntil || phase === "starting" || phase === "performing");
  if (!sim) throw Error("Start your life first");
  if (!p) throw Error("The city is still placing you. Try again in a moment");
  if (sim.pendingBeat) throw Error("Choose your story first");
  const tasks: Task[] = [],
    base = { city: sim.city, icon: "footprints" };
  if (p.room !== last.room) {
    if (p.room) {
      const layout = roomLayout(sim.city, roomType(p.room)!);
      tasks.push({
        ...base,
        kind: "door",
        room: p.room,
        loc: p.place,
        point: layout.exit,
        enter: false,
        label: "Leave through the front door",
      });
    }
    if (last.room) {
      const door = doorsFor(sim)[loc];
      if (!door) throw Error("There is no entrance to that workplace");
      const point = approach(sim.city, null, door, p, 2.5);
      if (!point) throw Error("There is no clear approach to that door");
      tasks.push({
        ...base,
        kind: "door",
        room: null,
        loc,
        point,
        enter: true,
        label: `Enter ${door.name}`,
      });
    }
  }
  tasks.push(last);
  const queue = tasks.map((task) => ({ ...task, id: `action-${++sequence}` }));
  if (defer) {
    useInteractions.setState({ waiting: queue, error: "", menu: null });
    s.openPanel(null);
    s.selectLocation(null);
    motion.wake();
    return;
  }
  clearQueuedInteractions();
  path = [];
  settleAt = 0;
  useInteractions.setState({
    current: queue[0],
    waiting: queue.slice(1),
    phase: "walking",
    error: "",
    menu: null,
  });
  s.openPanel(null);
  s.selectLocation(null);
  motion.wake();
}
export function queueWorkplace(
  job: Pick<Job, "id" | "title" | "city" | "loc">,
  apply = false,
) {
  const s = useStore.getState(),
    sim = s.sim;
  if (!sim) throw Error("Start your life first");
  if (sim.city !== job.city)
    throw Error("Travel to this city before visiting its workplace");
  const type = interiorType(s.world, sim.city, job.loc),
    layout = type && roomLayout(sim.city, type),
    desk = layout && layout.stations.find((st) => st.id === "desk");
  if (!type || !desk) throw Error("No hiring desk is available here");
  routeToStation(job.loc, {
    kind: apply ? "apply" : "walk",
    city: sim.city,
    room: `${type}:${job.loc}`,
    loc: job.loc,
    point: desk,
    jobId: job.id,
    label: apply
      ? `Walk to the desk and apply: ${job.title}`
      : "Walk to your work desk",
    icon: "briefcase",
  });
}
export function queueLocationAction(city: CityId, loc: string, action: Action) {
  const s = useStore.getState(),
    sim = s.sim,
    p = motion.position;
  if (!sim || !p || sim.city !== city) throw Error("Visit this city first");
  const blocked = actionReason(action, sim, closed(loc), serverNow());
  if (blocked) throw Error(blocked);
  const type = interiorType(s.world, city, loc),
    layout = type && roomLayout(city, type),
    use = type && activityUse(city, type, action);
  const station =
    layout &&
    (type === "home"
      ? (layout.stations.find((st) => st.action === action.id) ??
        layout.stations.find((st) => homeStationSupports(st, action.id)))
      : layout.stations.find((st) => st.id === use?.station));
  const room = type ? `${type}:${loc === "home" ? sim.userId : loc}` : null,
    door = doorsFor(sim)[loc];
  const point = station ?? (door && approach(city, null, door, p, 2.5));
  if (!point) throw Error("There is no usable station for this activity");
  routeToStation(loc, {
    kind: "act",
    city,
    room,
    loc,
    point,
    actionId: action.id,
    label: action.label,
    icon: action.icon,
  });
}
export function clearQueuedInteractions() {
  finish();
  useInteractions.setState({ waiting: [], menu: null });
}
export function closeObjectMenu() {
  useInteractions.setState({ menu: null });
}
export function openObjectMenu(target: PickTarget) {
  const s = useStore.getState(),
    sim = s.sim,
    p = motion.position;
  if (
    !sim ||
    !p ||
    sim.introDone === false ||
    (sim.firstDay?.complete && !sim.firstDay.closingSeen) ||
    s.panel ||
    s.searchOpen ||
    sim.pendingBeat ||
    target.city !== sim.city ||
    target.room !== p.room
  )
    return;
  const base = { city: sim.city, room: p.room, point: target.point },
    options: Option[] = [];
  const add = (
    id: string,
    label: string,
    icon: string,
    task: Task,
    reason = "",
  ) => options.push({ id, label, icon, task, reason });
  let title = "Walk here";
  if (target.kind === "ground") {
    enqueueAction({
      ...base,
      kind: "walk",
      label: "Walk here",
      icon: "footprints",
    });
    return;
  }
  if (target.kind === "furniture" && p.room) {
    const type = roomType(p.room)!,
      layout = roomLayout(sim.city, type),
      furniture = layout.furniture.find((f) => f.id === target.id),
      station = layout.stations.find((st) => st.id === target.stationId),
      city = s.world?.cities.find((c) => c.id === sim.city),
      loc = p.place;
    title = station?.name ?? "Furniture";
    const actions =
        type === "home"
          ? city?.homeActions
          : city?.landmarks.find((l) => l.id === loc)?.actions,
      supported = new Set([
        target.stationId,
        ...(furniture?.slots.map((slot) => slot.station).filter(Boolean) ?? []),
      ]);
    for (const action of actions ?? []) {
      const counterOrder =
          type === "cafe" &&
          target.stationId === "counter" &&
          action.kind === "food",
        use = counterOrder
          ? { station: "counter", pose: "Eat" }
          : type === "home"
            ? { station: station?.id, pose: furniture?.slots[0]?.pose }
            : activityUse(sim.city, type, action);
      if (
        !use ||
        action.id === "visit-workplace" ||
        !supported.has(use.station) ||
        (type === "home" && !homeStationSupports(station, action.id))
      )
        continue;
      if (action.to) {
        if (!options.some((o) => o.id === "departures"))
          add("departures", "View departures", "plane", {
            ...base,
            kind: "transit",
            point:
              layout.stations.find((st) => st.id === use.station) ??
              target.point,
            label: "View departures",
            icon: "plane",
          });
        continue;
      }
      const slots =
        furniture?.slots.filter(
          (slot) =>
            (slot.station ?? station?.id) === use.station &&
            (!use.pose || slot.pose === use.pose),
        ) ?? [];
      const slot: ActivitySlot | undefined =
        slots.find(
          (slot) =>
            !s.players.some(
              (other) =>
                other.id !== sim.userId &&
                (other.npc || other.online) &&
                other.city === sim.city &&
                other.position?.room === p.room &&
                other.activitySlot?.id === slot.id,
            ),
        ) ?? slots[0];
      const actionStation = layout.stations.find((st) => st.id === use.station),
        point =
          type === "home" && actionStation
            ? { x: actionStation.x, z: actionStation.z }
            : slot
              ? approach(sim.city, p.room, slot, p)
              : actionStation;
      const occupied =
        slot &&
        s.players.some(
          (other) =>
            other.id !== sim.userId &&
            (other.npc || other.online) &&
            other.city === sim.city &&
            other.position?.room === p.room &&
            other.activitySlot?.id === slot.id,
        );
      const reason = !point
        ? "There is no clear use point"
        : occupied
          ? "This place is occupied"
          : action.requires?.job &&
              sim.job?.track === action.requires.job &&
              (sim.job.city !== sim.city || sim.job.loc !== loc)
            ? "Your workplace is elsewhere"
            : actionReason(
                action,
                { ...sim, busyUntil: null },
                closed(loc),
                serverNow(),
              );
      add(
        action.id,
        action.cost > 0
          ? `${action.label} · $${action.cost}`
          : action.pay > 0
            ? `${action.label} · earn $${action.pay}`
            : action.label,
        action.icon,
        {
          ...base,
          kind: "act",
          loc,
          actionId: action.id,
          slotId: slot?.id,
          point: point ?? target.point,
          label: action.label,
          icon: action.icon,
        },
        reason,
      );
    }
    if (
      type === "airport" &&
      (furniture?.kind === "counter" || furniture?.kind === "desk") &&
      !options.some((o) => o.id === "departures")
    ) {
      const point =
        approach(sim.city, p.room, target.point, p) ??
        layout.stations.find((st) => st.id === target.stationId) ??
        target.point;
      add("departures", "Book a flight", "plane", {
        ...base,
        kind: "transit",
        point,
        label: "Book a flight",
        icon: "plane",
      });
    }
    const desk = layout.stations.find((st) => st.id === "desk");
    if (supported.has("desk") && desk && !sim.job) {
      for (const career of s.world?.careers ?? []) {
        const level = career.levels.find((l) => l.level === 1);
        if (
          !level ||
          !actions?.some((action) => action.requires?.job === career.track)
        )
          continue;
        const label = `Apply: ${level.title}`;
        add(
          `apply-${career.track}`,
          label,
          "briefcase",
          {
            ...base,
            point: desk,
            kind: "apply",
            jobId: `${sim.city === "atl" ? "" : sim.city + "-"}${career.track}-1`,
            label,
            icon: "briefcase",
          },
          closed(loc) ? "Apply while the workplace is open" : "",
        );
      }
    }
  } else if (target.kind === "door") {
    const entering = !p.room,
      door = entering
        ? doorsFor(sim)[target.id as keyof ReturnType<typeof doorsFor>]
        : roomLayout(sim.city, roomType(p.room)!).exit,
      loc = entering ? target.id : p.place,
      point = door
        ? entering
          ? approach(sim.city, null, door, p, 2.5)
          : door
        : undefined;
    title = entering
      ? target.id === "home"
        ? "Home"
        : (s.world?.cities
            .find((c) => c.id === sim.city)
            ?.landmarks.find((l) => l.id === target.id)?.name ?? "Building")
      : "Door";
    const bus = entering && target.id.endsWith("Bus"),
      label = bus
        ? "View departures"
        : entering
          ? `Enter ${title}`
          : "Leave building";
    add(
      "door",
      label,
      bus ? "train-front" : "house",
      {
        ...base,
        kind: bus ? "transit" : "door",
        loc,
        point: point ?? target.point,
        enter: entering,
        label,
        icon: "house",
      },
      !point
        ? "There is no clear doorway"
        : entering && closed(loc)
          ? "Closed right now"
          : "",
    );
  } else if (target.kind === "bench") {
    title = "Park bench";
    const label = sim.activitySlot?.id === target.id ? "Stand up" : "Sit down",
      point = approach(sim.city, null, target.point, p, 1.5);
    add(
      "posture",
      label,
      "moon",
      {
        ...base,
        kind: "posture",
        point: point ?? target.point,
        benchId: label === "Stand up" ? undefined : target.id,
        label,
        icon: "moon",
      },
      point ? "" : "There is no clear approach",
    );
  } else if (target.kind === "person") {
    const person = s.players.find((other) => other.id === target.id);
    title = person?.username ?? "Neighbour";
    for (const [kind, label, icon] of [
      ["wave", "Wave", "users"],
      ["hangout", "Hang out", "messages-square"],
      ["gift", "Give $25", "hand-coins"],
    ] as const) {
      const reason =
        socialReason(person) ||
        (kind === "gift"
          ? (s.clock?.msPerMinute ?? 1000) >= 1000 &&
            serverNow() - sim.createdAt < 1440000
            ? "Live here for one game day before sending gifts"
            : sim.cash < 25
              ? "Needs $25"
              : ""
          : "");
      add(
        kind,
        label,
        icon,
        {
          ...base,
          kind: "social",
          targetId: target.id,
          socialKind: kind,
          label: `${label}: ${title}`,
          icon,
        },
        reason,
      );
    }
  }
  if (!options.length)
    add(
      "none",
      "No activity here",
      "map-pin",
      { ...base, kind: "walk", label: "Walk here", icon: "footprints" },
      "Choose another usable object",
    );
  const full = state().waiting.length >= 3;
  if (full)
    for (const option of options)
      option.reason = option.reason || "The action queue is full";
  useInteractions.setState({ menu: { target, title, options }, error: "" });
}
export function chooseObjectAction(id: string) {
  const option = state().menu?.options.find((o) => o.id === id);
  if (!option || option.reason) return;
  closeObjectMenu();
  enqueueAction(option.task);
}
export function enqueueAction(task: Task) {
  const sim = useStore.getState().sim,
    s = state();
  if (!sim) return;
  const next = { ...task, id: `action-${++sequence}` };
  if (s.current || sim.busyUntil || cancelling || s.waiting.length) {
    if (s.waiting.length >= 3) {
      useInteractions.setState({
        error: "The action queue is full. Cancel an action to make space.",
      });
      return;
    }
    useInteractions.setState({ waiting: [...s.waiting, next], error: "" });
  } else {
    path = [];
    settleAt = 0;
    useInteractions.setState({ current: next, phase: "walking", error: "" });
  }
  motion.wake();
}
function finish(error = "") {
  motion.useApproach = null;
  path = [];
  settleAt = 0;
  stuckAt = 0;
  repaths = 0;
  lastProgress = null;
  useInteractions.setState({
    current: null,
    phase: null,
    error: error ? friendlyMessage(error) : "",
  });
  motion.wake();
}
export async function cancelInteraction(id: string) {
  if (cancelling) return;
  if (id !== "external" && state().current?.id !== id) {
    useInteractions.setState({
      waiting: state().waiting.filter((t) => t.id !== id),
    });
    return;
  }
  path = [];
  if (state().phase === "walking") {
    finish();
    return;
  }
  cancelled.add(id);
  if (state().phase === "starting") return;
  cancelling = true;
  const epoch = interactionEpoch;
  try {
    if (
      useStore.getState().sim?.busyUntil ||
      useStore.getState().sim?.activitySlot
    ) {
      const r = await api.cancelAction();
      if (epoch !== interactionEpoch) return;
      useStore.getState().setSim(r.sim);
      useStore.setState({ clock: r.clock });
      useStore.getState().setLastResult(null);
    }
    cancelled.delete(id);
    finish();
  } catch (e) {
    if (epoch === interactionEpoch)
      useInteractions.setState({
        error: friendlyMessage(e, "Could not stop this action. Try again."),
      });
  } finally {
    if (epoch === interactionEpoch) cancelling = false;
    motion.wake();
  }
}
async function perform(task: QueuedAction) {
  const epoch = interactionEpoch;
  useInteractions.setState({ phase: "starting" });
  useStore.setState({ acting: true });
  try {
    await motion.flush();
    if (epoch !== interactionEpoch) return;
    if (cancelled.has(task.id)) {
      finish();
      return;
    }
    const s = useStore.getState();
    if (
      !s.sim ||
      s.sim.city !== task.city ||
      (s.sim.position?.room ?? null) !== task.room
    )
      throw Error("The scene changed. Choose the action again.");
    if (task.kind === "act") {
      const city = s.world?.cities.find((c) => c.id === task.city),
        action = (
          task.loc === "home"
            ? city?.homeActions
            : city?.landmarks.find((l) => l.id === task.loc)?.actions
        )?.find((a) => a.id === task.actionId);
      if (!action) throw Error("This activity is no longer available");
      const reason = actionReason(
        action,
        s.sim,
        closed(task.loc!),
        serverNow(),
      );
      if (reason) throw Error(reason);
      motion.useApproach = task.slotId
        ? { slotId: task.slotId, ...task.point }
        : null;
      const r = await api.act(
        task.city,
        task.loc!,
        task.actionId!,
        task.slotId,
      );
      if (epoch !== interactionEpoch) return;
      s.setSim(r.sim);
      s.setLastResult(r.result);
    } else if (task.kind === "door") {
      const r = await api.door(task.loc!, !!task.enter);
      if (epoch !== interactionEpoch) return;
      s.setSim(r.sim);
      s.selectLocation(r.sim.loc);
      s.openPanel(null);
    } else if (task.kind === "transit") {
      s.openPanel("travel");
    } else if (task.kind === "posture") {
      const r = await api.posture(task.benchId ?? null);
      if (epoch !== interactionEpoch) return;
      s.setSim(r.sim);
    } else if (task.kind === "social") {
      // The server allows one social moment every few seconds: wait it out instead of failing.
      const readyIn = (s.sim.socialReadyAt ?? 0) - serverNow();
      if (readyIn > 0)
        await new Promise((resolve) =>
          setTimeout(resolve, Math.min(readyIn + 60, 3500)),
        );
      if (epoch !== interactionEpoch) return;
      try {
        const r = await api.social(
          task.targetId!,
          task.socialKind!,
          task.socialKind === "gift" ? 25 : undefined,
        );
        if (epoch !== interactionEpoch) return;
        s.setSim(r.sim);
        useStore.setState({ socialNotice: r.text });
      } catch (error) {
        if (
          epoch === interactionEpoch &&
          socialRetries < 3 &&
          error instanceof Error &&
          /walk up|walk a little closer|same place|nearby/i.test(error.message)
        ) {
          socialRetries++;
          path = [];
          socialAnchor = null;
          lastRepath = 0;
          useInteractions.setState({ phase: "walking" });
          return;
        }
        throw error;
      }
    } else if (task.kind === "apply") {
      const r = await api.applyJob(task.jobId!);
      if (epoch !== interactionEpoch) return;
      s.setSim(r.sim);
      useStore.setState({
        socialNotice: r.hired
          ? `You joined as ${r.sim.job?.title ?? "a new colleague"}.`
          : (r.reason ?? "Your application was received."),
      });
    }
    if (cancelled.has(task.id)) {
      if (
        useStore.getState().sim?.busyUntil ||
        useStore.getState().sim?.activitySlot
      ) {
        const r = await api.cancelAction();
        if (epoch !== interactionEpoch) return;
        s.setSim(r.sim);
        s.setLastResult(null);
      }
      finish();
      return;
    }
    if (
      task.kind === "walk" ||
      task.kind === "door" ||
      task.kind === "apply" ||
      task.kind === "transit"
    ) {
      finish();
      return;
    }
    settleAt =
      performance.now() +
      (task.kind === "social" ? 3200 : task.kind === "posture" ? 600 : 0);
    useInteractions.setState({ phase: "performing" });
  } catch (e) {
    if (epoch === interactionEpoch)
      finish(friendlyMessage(e, "This action could not start. Try again."));
  } finally {
    cancelled.delete(task.id);
    if (epoch === interactionEpoch) useStore.setState({ acting: false });
    motion.wake();
  }
}
/** Called by the existing walking loop. Returns an axis without changing manual input. */
export function interactionSteering(now: number, manual: boolean): Point {
  const s = useStore.getState(),
    sim = s.sim,
    p = motion.position,
    q = state();
  if (!sim || !p || cancelling) return { x: 0, z: 0 };
  if (manual) {
    manualAt = now;
    if (q.current && q.phase === "walking") clearQueuedInteractions();
    return { x: 0, z: 0 };
  }
  if (now - manualAt < 350) return { x: 0, z: 0 };
  if (!q.current) {
    if (
      q.waiting.length &&
      !sim.busyUntil &&
      !s.acting &&
      !s.panel &&
      !s.searchOpen &&
      !sim.pendingBeat
    ) {
      useInteractions.setState({
        current: q.waiting[0],
        waiting: q.waiting.slice(1),
        phase: "walking",
      });
      path = [];
      settleAt = 0;
      motion.wake();
    }
    return { x: 0, z: 0 };
  }
  const task = q.current;
  if (q.phase === "starting") return { x: 0, z: 0 };
  if (q.phase === "performing") {
    if (!sim.busyUntil) {
      if (!settleAt) settleAt = now + 650;
      if (now >= settleAt) finish();
    }
    motion.wake();
    return { x: 0, z: 0 };
  }
  if (task.city !== sim.city || task.room !== p.room) {
    finish("The scene changed. Choose an action in this room.");
    return { x: 0, z: 0 };
  }
  if (s.acting || sim.busyUntil || sim.pendingBeat || s.panel || s.searchOpen)
    return { x: 0, z: 0 };
  let endpoint = task.point;
  if (task.kind === "social") {
    const person = s.players.find((other) => other.id === task.targetId),
      reason = socialReason(person),
      point = person && personPoint(person);
    if (reason || !point) {
      finish(reason || "Your neighbour has left");
      return { x: 0, z: 0 };
    }
    if (socialRouteTarget !== task.id) {
      socialRouteTarget = task.id;
      socialAnchor = null;
      socialRetries = 0;
      path = [];
      lastRepath = 0;
    }
    // A wave works from across the way; hanging out and gifts walk right up.
    if (Math.hypot(point.x - p.x, point.z - p.z) < (task.socialKind === "wave" ? 5 : 2.1)) {
      void perform(task);
      return { x: 0, z: 0 };
    }
    const moved =
      !socialAnchor ||
      Math.hypot(point.x - socialAnchor.x, point.z - socialAnchor.z) > 0.6;
    if (!path.length || (moved && now - lastRepath > 400)) {
      const next = socialApproach(task.city, task.room, person!, p);
      if (!next) {
        finish(
          "There is no clear way to your neighbour. Try meeting on open floor.",
        );
        return { x: 0, z: 0 };
      }
      task.point = next.point;
      endpoint = next.point;
      path = next.route;
      socialAnchor = { x: point.x, z: point.z };
      lastRepath = now;
      lastProgress = { ...p };
      stuckAt = motion.walkClock * 1000;
    }
  }
  if (Math.hypot(endpoint.x - p.x, endpoint.z - p.z) < 0.12) {
    void perform(task);
    return { x: 0, z: 0 };
  }
  if (!path.length) {
    path = navigationRoute(task.city, task.room, p, endpoint);
    lastProgress = { ...p };
    stuckAt = motion.walkClock * 1000;
    if (!path.length) {
      finish("There is no clear walking path to that spot.");
      return { x: 0, z: 0 };
    }
  }
  // Turn at each corner without stopping: the corner joins `motion.trail`, and the next position
  // update carries it so the server checks both straight pieces instead of a chord.
  while (
    path.length > 1 &&
    Math.hypot(path[0].x - p.x, path[0].z - p.z) < 0.02
  ) {
    const corner = path.shift()!;
    if (motion.trail.length < 16) motion.trail.push({ x: corner.x, z: corner.z });
  }
  const next = path[0];
  if (!next) {
    void perform(task);
    return { x: 0, z: 0 };
  }
  // Measured in simulated walking time: at a low frame rate a frame is long, not blocked.
  const walked = motion.walkClock * 1000;
  if (
    !lastProgress ||
    Math.hypot(lastProgress.x - p.x, lastProgress.z - p.z) > 0.2
  ) {
    lastProgress = { ...p };
    stuckAt = walked;
  } else if (walked - stuckAt > 2500) {
    // Something moved into the way: look for a fresh route once before giving up.
    if (repaths < 2) {
      repaths++;
      path = navigationRoute(task.city, task.room, p, endpoint);
      lastProgress = { ...p };
      stuckAt = walked;
      if (path.length) return { x: path[0].x - p.x, z: path[0].z - p.z };
    }
    finish("Something is in the way. Choose another spot.");
    return { x: 0, z: 0 };
  }
  return { x: next.x - p.x, z: next.z - p.z };
}

// A message expires on its own, and any change of place or activity clears it at once, so a stale
// "closed" or "walk closer" never contradicts what the player sees.
let interactionErrorTimer: ReturnType<typeof setTimeout> | null = null;
useInteractions.subscribe((next, previous) => {
  if (next.error === previous.error) return;
  if (interactionErrorTimer) clearTimeout(interactionErrorTimer);
  interactionErrorTimer = null;
  if (!next.error) return;
  const shown = next.error;
  interactionErrorTimer = setTimeout(() => {
    interactionErrorTimer = null;
    if (state().error === shown) useInteractions.setState({ error: "" });
  }, ERROR_TTL_MS);
});
useStore.subscribe((next, previous) => {
  const a = next.sim,
    b = previous.sim;
  if (!a || !b || a === b) return;
  if (
    a.loc !== b.loc ||
    a.city !== b.city ||
    (a.position?.room ?? null) !== (b.position?.room ?? null) ||
    !!a.busyUntil !== !!b.busyUntil ||
    !!a.pendingBeat !== !!b.pendingBeat
  ) {
    if (state().error) useInteractions.setState({ error: "" });
    if (useWalking.getState().error) useWalking.setState({ error: "" });
  }
});

// Browser-life changes invalidate queued work and every pending response.
useStore.subscribe((next, previous) => {
  if (next.sim?.userId === previous.sim?.userId) return;
  interactionEpoch++;
  cancelling = false;
  cancelled.clear();
  path = [];
  settleAt = 0;
  motion.useApproach = null;
  useInteractions.setState({
    current: null,
    waiting: [],
    phase: null,
    menu: null,
    error: "",
  });
});
