import { api } from "../api/client";
import { useStore } from "../store";
import { friendlyMessage, motion, useWalking } from "../walking";
import { serverNow } from "../server-time";
import { nearbyStation, stationActionFor } from "../navigation";
import type { Position } from "../navigation";
import type { Player, Sim, World } from "../api/types";
export const enterHome = () => enterBuilding("home");
export async function enterBuilding(loc: string) {
  useWalking.setState({ transition: true });
  try {
    await motion.flush();
    await new Promise((r) => setTimeout(r, 120));
    const r = await api.door(loc, true);
    motion.snapCamera = true;
    useStore.getState().setSim(r.sim);
    useStore.getState().openPanel(null);
  } catch (e) {
    useWalking.setState({ error: friendlyMessage(e) });
    throw e;
  } finally {
    setTimeout(() => useWalking.setState({ transition: false }), 350);
  }
}

export function stationAction(sim: Sim, world: World | null, p: Position) {
  const station = nearbyStation(p, sim.city),
    city = world?.cities.find((c) => c.id === sim.city),
    place = city?.landmarks.find((l) => l.id === p.place);
  const workplace = place?.actions.some((a) => !!a.requires?.job),
    atWork = station?.id === "desk" && workplace;
  const role =
    atWork && !sim.job
      ? world?.careers
          .filter((c) =>
            place?.actions.some((a) => a.requires?.job === c.track),
          )
          .map((c) => ({
            ...c.levels[0],
            id: `${sim.city === "atl" ? "" : sim.city + "-"}${c.track}-1`,
          }))[0]
      : undefined;
  const owned = sim.job?.loc === p.place && sim.job.city === sim.city;
  const action = atWork
    ? owned
      ? place?.actions.find((a) => a.requires?.job === sim.job?.track)
      : undefined
    : station
      ? station.id === "counter"
        ? place?.actions.find((a) => a.kind === "food")
        : stationActionFor(p.room, sim.city, world, station, sim.job?.track)
      : undefined;
  return {
    station,
    action,
    apply: !!role,
    jobId: role?.id,
    label: atWork
      ? sim.job
        ? owned
          ? (action?.label ?? "Work a shift")
          : "Your workplace is elsewhere"
        : role
          ? `Apply: ${role.title}`
          : "No entry role here"
      : (action?.label ?? station?.name),
    reason:
      atWork && sim.job && !owned
        ? "Your workplace is elsewhere"
        : station && station.id !== "exit" && !action && !role
          ? "There is no activity here right now. Try another station."
          : "",
  };
}

/** Reach for Wave, Hang out and Gift: a little inside the server's own limit (3.3 m, 3.8 m for residents). */
export const SOCIAL_REACH = 2.9;
/**
 * How good a social target this person is; lower is better. Distance counts most, people behind
 * the player count as further away, and real players count as half as far as city residents, so a
 * neighbour who is actually online wins whenever both are in reach.
 */
function socialScore(n: Player, p: Position) {
  const at = n.position!,
    dx = at.x - p.x,
    dz = at.z - p.z,
    distance = Math.hypot(dx, dz),
    facing =
      distance > 0.01
        ? Math.cos(Math.atan2(dx, dz) - (p.face ?? 0))
        : 1; // 1 straight ahead, -1 behind
  return distance * (1 + 0.45 * (1 - facing)) * (n.npc ? 1 : 0.5);
}
/** The person a social action reaches from `p` (see SocialTarget in the store). */
export function nearbyPerson(sim: Sim, p: Position, players: Player[]) {
  if (p.place === "home" || p.room?.startsWith("home:")) return undefined;
  let best: Player | undefined,
    bestScore = Infinity;
  for (const n of players) {
    if (
      n.loc === "home" ||
      n.id === sim.userId ||
      n.city !== sim.city ||
      !(n.npc || n.online) ||
      !n.position ||
      n.tripId ||
      (n.position.room ?? null) !== (p.room ?? null) ||
      Math.hypot(n.position.x - p.x, n.position.z - p.z) > SOCIAL_REACH
    )
      continue;
    const score = socialScore(n, p);
    if (score < bestScore) {
      best = n;
      bestScore = score;
    }
  }
  return best;
}
export async function meet(
  kind: "wave" | "hangout" | "gift" = "wave",
  targetId?: string,
) {
  // Another request (a step being confirmed, a door) may still be finishing: wait briefly for it.
  for (let i = 0; i < 20 && useStore.getState().acting; i++)
    await new Promise((resolve) => setTimeout(resolve, 150));
  const s = useStore.getState(),
    p = motion.position;
  if (!s.sim || !p) return "not ready";
  if (s.acting || s.sim.busyUntil || s.sim.pendingBeat) {
    useWalking.setState({
      error: s.sim.pendingBeat
        ? "Make your story choice first."
        : "Finish what you are doing first.",
    });
    return "busy";
  }
  // The person named on the button, even if they took a step since; a wave carries further than
  // a hang out or a gift (the server allows 8 m for a wave).
  const wanted = targetId ?? s.socialTarget?.id,
    reach = kind === "wave" ? 7 : SOCIAL_REACH + 0.4;
  const person =
    (wanted
      ? s.players.find(
          (n) =>
            n.id === wanted &&
            n.city === s.sim!.city &&
            (n.position?.room ?? null) === (p.room ?? null) &&
            n.position &&
            Math.hypot(n.position.x - p.x, n.position.z - p.z) < reach,
        )
      : undefined) ?? nearbyPerson(s.sim, p, s.players);
  if (!person) {
    useWalking.setState({
      error: "Walk up to someone first. Their name shows on the button.",
    });
    return "nobody";
  }
  useStore.setState({ acting: true });
  try {
    // One social moment every few seconds: wait out the short cooldown rather than failing.
    const readyIn = (s.sim.socialReadyAt ?? 0) - serverNow();
    if (readyIn > 0)
      await new Promise((resolve) =>
        setTimeout(resolve, Math.min(readyIn + 60, 3500)),
      );
    await motion.flush();
    const r = await api.social(
      person.id,
      kind,
      kind === "gift" ? 25 : undefined,
    );
    useStore.getState().setSim(r.sim);
    useStore.setState({ socialNotice: r.text });
    useWalking.setState({ error: "" });
    return "sent";
  } catch (e) {
    const message = friendlyMessage(e, `Could not reach ${person.username}. Try again.`);
    useWalking.setState({ error: message });
    return message;
  } finally {
    useStore.setState({ acting: false });
  }
}
