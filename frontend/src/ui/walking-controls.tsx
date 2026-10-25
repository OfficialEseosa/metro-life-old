import { Icon, ReasonButton } from "./primitives";
import {
  enterBuilding,
  stationAction,
  nearbyPerson,
  meet,
} from "./walking-actions";
import { useCallback, useEffect, useRef, useState } from "react";
import { useStore } from "../store";
import { api } from "../api/client";
import {
  motion,
  useWalking,
  interact,
  type InteractionIntent,
} from "../walking";
import { nearbyBench, nearbyDoor, interiorType, roomType } from "../navigation";
import { clearQueuedInteractions, useInteractions } from "../interactions";
import { policyHours, actionReason, workCareNote } from "./action-rules";
import { serverNow } from "../server-time";

/** The person the action button talks to. The store may provide a server-checked target. */
type SocialTarget = { id: string; name: string; npc?: boolean } | null;
const readSocialTarget = (s: object): SocialTarget | undefined =>
  (s as { socialTarget?: SocialTarget }).socialTarget;

const NO_PLAYERS: never[] = [];
/** "Your home" reads as "your home" in the middle of a sentence. */
const placeName = (name: string) => name.replace(/^Your /, "your ");

function useHelpSeen() {
  const [help, setHelp] = useState(() => {
    try {
      return !localStorage.getItem("metro-walk-help");
    } catch {
      return true;
    }
  });
  const dismiss = useCallback(() => {
    setHelp(false);
    try {
      localStorage.setItem("metro-walk-help", "1");
    } catch {
      /* Storage may be blocked. */
    }
  }, []);
  return [help, dismiss] as const;
}

/** One-time hint: how to walk and interact, worded for the device in hand. */
export function WalkHelp() {
  const [help, dismiss] = useHelpSeen(),
    blocked = useStore((s) => !!s.panel || !!s.sim?.pendingBeat),
    touch =
      typeof matchMedia === "function" &&
      matchMedia("(pointer: coarse)").matches;
  useEffect(() => {
    if (!help) return;
    const timer = setTimeout(dismiss, 12000);
    let start: { x: number; z: number } | null = null;
    const off = useWalking.subscribe((s) => {
      if (!s.position) return;
      if (!start) start = { ...s.position };
      if (Math.hypot(s.position.x - start.x, s.position.z - start.z) > 3)
        dismiss();
    });
    return () => {
      clearTimeout(timer);
      off();
    };
  }, [help, dismiss]);
  if (!help || blocked) return null;
  return (
    <div className="walk-help plate" role="note">
      <span className="semantic-tile travel" aria-hidden="true">
        <Icon name="footprints" />
      </span>
      <p>
        {touch
          ? "Drag the left side to walk. Tap the green button to act."
          : "Walk with WASD or the arrow keys, Shift to run. Press E or Enter to use the green button."}
      </p>
      <button className="secondary" onClick={dismiss}>
        Got it
      </button>
    </div>
  );
}

/** Touch joystick. Mounted once for the whole session; hidden while a panel is open. */
export function Joystick() {
  const [stick, setStick] = useState<{
      x: number;
      y: number;
      dx: number;
      dy: number;
    } | null>(null),
    origin = useRef({ x: 0, y: 0 });
  const clear = () => {
    motion.x = motion.z = 0;
    setStick(null);
    motion.wake();
  };
  useEffect(
    () =>
      useStore.subscribe((s, previous) => {
        if ((s.panel && !previous.panel) || (s.searchOpen && !previous.searchOpen)) {
          motion.x = motion.z = 0;
          setStick(null);
        }
      }),
    [],
  );
  return (
    <div
      className={`walk-joystick hide-with-panel ${stick ? "active" : ""}`}
      aria-label="Walking joystick"
      role="region"
      onPointerDown={(e) => {
        e.preventDefault();
        window.getSelection()?.removeAllRanges();
        e.currentTarget.setPointerCapture(e.pointerId);
        origin.current = { x: e.clientX, y: e.clientY };
        setStick({ x: e.clientX, y: e.clientY, dx: 0, dy: 0 });
        motion.wake();
      }}
      onPointerMove={(e) => {
        e.preventDefault();
        if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
        const dx = e.clientX - origin.current.x,
          dy = e.clientY - origin.current.y,
          length = Math.max(36, Math.hypot(dx, dy));
        motion.x = dx / length;
        motion.z = dy / length;
        setStick({
          x: origin.current.x,
          y: origin.current.y,
          dx: (dx / length) * 32,
          dy: (dy / length) * 32,
        });
        motion.wake();
      }}
      onPointerUp={clear}
      onPointerCancel={clear}
      onLostPointerCapture={clear}
    >
      <span
        className="stick-base"
        style={
          stick
            ? {
                position: "fixed",
                left: stick.x - 54,
                top: stick.y - 54,
                bottom: "auto",
              }
            : undefined
        }
      >
        <span
          style={{
            transform: `translate(${stick?.dx ?? 0}px,${stick?.dy ?? 0}px)`,
          }}
        />
      </span>
    </div>
  );
}

/** Thin progress bar inside the action button while an activity runs. */
function BusyFill() {
  const until = useStore((s) => s.sim?.busyUntil),
    started = useStore((s) => s.sim?.busyStartedAt),
    [now, setNow] = useState(serverNow);
  useEffect(() => {
    if (!until) return;
    const timer = setInterval(() => setNow(serverNow()), 250);
    return () => clearInterval(timer);
  }, [until]);
  if (!until) return null;
  const start = started ?? until - 3000,
    share = Math.max(0, Math.min(1, (now - start) / Math.max(1, until - start)));
  return (
    <span
      className="busy-fill"
      style={{ width: `${share * 100}%` }}
      aria-hidden="true"
    />
  );
}

/**
 * The contextual action button plus the social row and payoff anchor.
 * Mounted once; the HUD hides it with CSS while a panel or story is open.
 */
export function ActionButton() {
  const sim = useStore((s) => s.sim),
    city = useStore((s) => s.city),
    world = useStore((s) => s.world),
    acting = useStore((s) => s.acting),
    position = useWalking((s) => s.position),
    transition = useWalking((s) => s.transition),
    result = useStore((s) => s.lastResult),
    players = useStore((s) =>
      readSocialTarget(s) === undefined ? s.players : NO_PLAYERS,
    ),
    target = useStore(readSocialTarget),
    clock = useStore((s) => s.clock),
    policy = useStore((s) => s.mayor?.mayor?.policy),
    panel = useStore((s) => s.panel);
  const room = position?.room,
    context = sim && position ? stationAction(sim, world, position) : undefined,
    station = context?.station,
    door = sim && position && !room ? nearbyDoor(sim, position) : undefined;
  const bench = position ? nearbyBench(city, position) : undefined,
    seated = sim?.activitySlot?.bench;
  const fallback =
      target === undefined && sim && position
        ? nearbyPerson(sim, position, players)
        : undefined,
    person: { id: string; name: string } | undefined = target
      ? { id: target.id, name: target.name }
      : fallback
        ? { id: fallback.id, name: fallback.username }
        : undefined,
    firstName = person?.name.split(" ")[0] ?? "",
    place = world?.cities
      .find((c) => c.id === city)
      ?.landmarks.find((l) => l.id === position?.place),
    open = policyHours(place?.open ?? [0, 24], place?.category ?? "", policy),
    hour = clock
      ? ((clock.hour * 60 +
          clock.minute +
          (serverNow() - clock.at) / clock.msPerMinute) %
          1440) /
        60
      : 12,
    inside = !!position?.room?.endsWith(`:${position?.place}`),
    closed =
      !inside &&
      (open[0] < open[1]
        ? hour < open[0] || hour >= open[1]
        : hour < open[0] && hour >= open[1]);
  const reason =
    context?.reason ||
    (sim && context?.action
      ? actionReason(context.action, sim, closed, serverNow())
      : "");
  const canTalk =
    !!person &&
    station?.id !== "exit" &&
    (!!room || !door) &&
    (!station ||
      Math.hypot(station.x - position!.x, station.z - position!.z) > 0.65);
  const label = seated
    ? "Stand up"
    : bench
      ? "Sit on the bench"
      : canTalk
        ? `Wave to ${firstName}`
        : room
          ? context?.label || "Walk to the furniture"
          : door
            ? `${interiorType(world, city, door[0]) ? "Enter" : "Explore"} ${placeName(door[1].name)}`
            : "Walk to a door";
  const intent: InteractionIntent | null =
    sim && position
      ? seated || bench
        ? {
            kind: "bench",
            label,
            city: sim.city,
            room: position.room,
            loc: position.place,
            benchId: seated ? undefined : bench?.id,
          }
        : canTalk
          ? {
              kind: "social",
              label,
              city: sim.city,
              room: position.room,
              loc: position.place,
              targetId: person!.id,
            }
          : room && station
            ? {
                kind:
                  station.id === "exit"
                    ? "door"
                    : context?.apply
                      ? "apply"
                      : "act",
                label,
                city: sim.city,
                room: position.room,
                loc: position.place,
                stationId: station.id,
                actionId: context?.action?.id,
                jobId: context?.jobId,
                enter: false,
              }
            : door
              ? {
                  kind: interiorType(world, city, door[0])
                    ? "door"
                    : "location",
                  label,
                  city: sim.city,
                  room: null,
                  loc: door[0],
                  enter: true,
                }
              : null
      : null;
  useEffect(() => {
    motion.interactionIntent = intent;
    return () => {
      motion.interactionIntent = null;
    };
  });
  useEffect(() => {
    const act = async (event: Event) => {
      const s = useStore.getState(),
        p = motion.position;
      if (
        s.panel ||
        s.searchOpen ||
        s.acting ||
        s.sim?.busyUntil ||
        s.sim?.pendingBeat ||
        !s.sim ||
        !p
      )
        return;
      const active = document.activeElement;
      if (active?.matches('input,textarea,select,[contenteditable="true"]'))
        return;
      const back = event.type === "metro-back",
        context = stationAction(s.sim, s.world, p);
      if (back && !p.room) return;
      const chosen: InteractionIntent | null =
        back && p.room
          ? {
              kind: "door",
              label: "Leave building",
              city: s.sim.city,
              room: p.room,
              loc: p.place,
              stationId: "exit",
              enter: false,
            }
          : ((event as CustomEvent<InteractionIntent>).detail ??
            motion.interactionIntent);
      if (!chosen) return;
      if (chosen.city !== s.sim.city || chosen.room !== p.room) return;
      if (
        useInteractions.getState().phase === "starting" ||
        useInteractions.getState().phase === "performing"
      )
        return;
      clearQueuedInteractions();
      if (chosen.kind === "social") {
        await meet("wave", chosen.targetId);
        return;
      }
      useStore.setState({ acting: true });
      try {
        if (chosen.kind === "bench") {
          if (
            chosen.benchId &&
            nearbyBench(s.sim.city, p)?.id !== chosen.benchId
          )
            throw Error("Walk back to that bench first.");
          await motion.flush();
          const r = await api.posture(chosen.benchId ?? null);
          s.setSim(r.sim);
        } else if (chosen.kind === "act" || chosen.kind === "apply") {
          if (!context.station || context.station.id !== chosen.stationId)
            throw Error("Walk back to that station first.");
          if (context.reason) throw Error(context.reason);
          if (chosen.kind === "apply") {
            if (!chosen.jobId || chosen.jobId !== context.jobId)
              throw Error("Choose the available role again.");
            await motion.flush();
            const r = await api.applyJob(chosen.jobId);
            s.setSim(r.sim);
          } else {
            if (!chosen.actionId || context.action?.id !== chosen.actionId)
              throw Error("Choose the activity again.");
            const place = s.world?.cities
                .find((c) => c.id === s.sim!.city)
                ?.landmarks.find((l) => l.id === p.place),
              hours = policyHours(
                place?.open ?? [0, 24],
                place?.category ?? "",
                s.mayor?.mayor?.policy,
              ),
              c = s.clock,
              hour = c
                ? ((c.hour * 60 +
                    c.minute +
                    (serverNow() - c.at) / c.msPerMinute) %
                    1440) /
                  60
                : 12,
              closed =
                !p.room?.endsWith(`:${p.place}`) &&
                (hours[0] < hours[1]
                  ? hour < hours[0] || hour >= hours[1]
                  : hour < hours[0] && hour >= hours[1]),
              blocked = actionReason(
                context.action,
                s.sim,
                closed,
                serverNow(),
              );
            if (blocked) throw Error(blocked);
            await motion.flush();
            const r = await api.act(s.sim.city, chosen.loc, chosen.actionId);
            s.setSim(r.sim);
            s.setLastResult(r.result);
          }
        } else if (chosen.kind === "door") {
          if (p.room) {
            if (context.station?.id !== "exit")
              throw Error("Walk to the front door to leave.");
            await motion.flush();
            useWalking.setState({ transition: true });
            const r = await api.door(chosen.loc, false);
            s.setSim(r.sim);
            setTimeout(() => useWalking.setState({ transition: false }), 350);
          } else {
            if (nearbyDoor(s.sim, p)?.[0] !== chosen.loc)
              throw Error("Walk back to that door first.");
            await enterBuilding(chosen.loc);
          }
        } else if (chosen.kind === "location") {
          if (nearbyDoor(s.sim, p)?.[0] !== chosen.loc)
            throw Error("Walk back to that place first.");
          s.selectLocation(chosen.loc);
        }
        useWalking.setState({ error: "" });
      } catch (e) {
        useWalking.setState({
          error:
            e instanceof Error
              ? e.message
              : "Could not interact with the city.",
          transition: false,
        });
      } finally {
        useStore.setState({ acting: false });
      }
    };
    window.addEventListener("metro-interact", act);
    window.addEventListener("metro-back", act);
    return () => {
      window.removeEventListener("metro-interact", act);
      window.removeEventListener("metro-back", act);
    };
  }, []);
  useEffect(() => {
    motion.follow = !panel;
    if (!panel) motion.wake();
  }, [panel]);
  if (!sim) return null;
  if (city !== sim.city)
    return (
      <button
        className="walk-interact primary"
        onClick={() => {
          void useStore
            .getState()
            .setCity(sim.city)
            .then(() => useStore.getState().setFocus("home"));
        }}
      >
        <span className="walk-target">Back to your city</span>
      </button>
    );
  const busy = !!sim.busyUntil,
    giftReason =
      (clock?.msPerMinute ?? 1000) >= 1000 &&
      serverNow() - sim.createdAt < 1440000
        ? "Live here for one game day before gifting"
        : sim.cash < 25
          ? "Save $25 for a gift"
          : "";
  return (
    <>
      {person && station?.id !== "exit" && !busy && (
        <div
          className="walk-social"
          role="group"
          aria-label={`Say hello to ${person.name}`}
        >
          <span aria-hidden="true">With {firstName}</span>
          <ReasonButton
            onClick={() => meet("wave", person.id)}
            reason={acting ? "Sending…" : ""}
            aria-label={`Wave to ${person.name}`}
          >
            Wave
          </ReasonButton>
          <ReasonButton
            onClick={() => meet("hangout", person.id)}
            reason={acting ? "Sending…" : ""}
            aria-label={`Hang out with ${person.name}`}
          >
            Hang out
          </ReasonButton>
          <ReasonButton
            onClick={() => meet("gift", person.id)}
            reason={acting ? "Sending your gift…" : giftReason}
            aria-label={`Give ${person.name} a $25 gift`}
            title={giftReason || undefined}
          >
            Gift $25
          </ReasonButton>
        </div>
      )}
      {station &&
        station.id !== "exit" &&
        roomType(room) !== "home" &&
        !busy &&
        !canTalk && (
          <button
            className="secondary walk-more"
            onClick={() => useStore.getState().selectLocation(position!.place)}
          >
            More activities here
          </button>
        )}
      {!busy &&
      !acting &&
      !door &&
      !station &&
      !person &&
      !bench &&
      !seated ? (
        <button className="walk-interact primary is-idle" disabled>
          <span className="walk-target">
            {room
              ? "Walk to furniture or the door"
              : "Walk up to a door or a neighbour"}
          </span>
        </button>
      ) : busy ? (
        <button
          className="walk-interact primary is-busy"
          disabled
          aria-label={`${sim.busyLabel ?? "Your activity"} in progress`}
        >
          <span className="walk-target">{sim.busyLabel ?? "Busy"}</span>
          <BusyFill />
        </button>
      ) : (
        <ReasonButton
          className="walk-interact primary"
          reason={acting ? "Sending…" : reason && !canTalk ? reason : ""}
          onClick={interact}
        >
          <span className="walk-target">{label}</span>
          <kbd className="key-hint">
            {context?.action?.requires?.job
              ? workCareNote(sim) ||
                `${sim.shiftSchedule?.shiftSeconds ?? 25}s shift · E`
              : "E"}
          </kbd>
        </ReasonButton>
      )}
      <div className="walking-anchor" aria-live="polite">
        {result && (
          <span
            className="walking-payoff"
            key={`${result.text}:${result.busyUntil}`}
          >
            {result.activity?.id === "cook" ? (
              <>
                <b>Dinner is ready</b>
                <small>Spent ${result.activity.cost}</small>
                {result.activity.dailyCash > 0 && (
                  <small>Daily goal +${result.activity.dailyCash}</small>
                )}
              </>
            ) : (
              (result.deltas.cash ?? 0) !== 0 && (
                <b>
                  {(result.deltas.cash ?? 0) > 0 ? "+" : "-"}$
                  {Math.abs(result.deltas.cash ?? 0)}
                </b>
              )
            )}
            {Object.entries(result.deltas.needs ?? {})
              .filter(([, n]) => n > 0)
              .map(([need, n]) => (
                <small key={need}>
                  +{Math.round(n)} {need}
                </small>
              ))}
          </span>
        )}
      </div>
      {transition && <div className="room-curtain" />}
    </>
  );
}
