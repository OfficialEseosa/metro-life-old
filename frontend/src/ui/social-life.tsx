import { clearQueuedInteractions } from "../interactions";
import { apiRequest } from "../api/client";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import type { CityId, Clock, Sim, User } from "../api/types";
import { useStore } from "../store";
import { motion } from "../walking";
import { serverNow, syncServerTime } from "../server-time";
import { Icon, ErrorMessage, ReasonButton } from "./primitives";
import { HudNotice, ToastPortal } from "./notices";
import { sound, setPartyAudio } from "./sound";
import { venueName } from "../content-names";
import { emitFeedback } from "../feedback";
import { useSocialUi } from "./social-ui";
import "./social-life.css";

export type CityEvent = {
  id: string;
  city: CityId;
  loc: string;
  name: string;
  startsAt: number;
  endsAt: number;
  active: boolean;
  progress: number;
  target: number;
  joined: boolean;
  rewardClaimed: boolean;
  finished?: boolean;
  success?: boolean;
  result?: string;
};
export type OpenHouse = {
  ownerId: string;
  username: string;
  city: CityId;
  neighborhood: string;
  likes: number;
  here: boolean;
};
export type SocialLifeState = {
  event: CityEvent | null;
  openHouses: OpenHouse[];
  inviteCode: string;
  clock?: Clock;
};
export const useSocialLife = create<SocialLifeState>(() => ({
  event: null,
  openHouses: [],
  inviteCode: "",
}));
export type WorkGame = {
  id: string;
  startsAt: number;
  endsAt: number;
  taps: number;
  best: number;
};
type SocialReply = {
  sim?: Sim;
  clock?: Clock;
  user?: User;
  code?: string;
  url?: string;
  text?: string;
  score?: number;
  bonus?: number;
};
export async function socialRequest<T = SocialReply>(
  path: string,
  body?: unknown,
): Promise<T> {
  const relocating = [
    "open-house/visit",
    "invite/join",
    "quick-start",
  ].includes(path);
  if (relocating) {
    clearQueuedInteractions();
    motion.x = motion.z = 0;
    motion.revision++;
    useStore.setState({ acting: true });
  }
  let data: SocialReply;
  try {
    data = await apiRequest<SocialReply>(
      body === undefined ? "GET" : "POST",
      "/api/" + path,
      body,
    );
  } finally {
    if (relocating) useStore.setState({ acting: false });
  }
  if (data.clock) {
    syncServerTime(data.clock.at);
    useStore.setState({ clock: data.clock });
  }
  return data as T;
}
export async function refreshSocialLife() {
  const sim = useStore.getState().sim;
  if (!sim) return;
  const data = await socialRequest<SocialLifeState>(
    "social-life?city=" + sim.city,
  );
  if (
    useStore.getState().sim?.userId === sim.userId &&
    useStore.getState().sim?.city === sim.city
  )
    useSocialLife.setState(data);
}
/**
 * A small celebration. The scene listens for the burst; the feedback bus shows
 * the toast and plays the sound. Paydays and goals already reach the bus from
 * the settled result, so only moments the bus cannot see are emitted here.
 */
export function celebrate(label: string, kind = "reward") {
  window.dispatchEvent(
    new CustomEvent("metro-celebrate", { detail: { label, kind } }),
  );
  if (kind === "friend") emitFeedback({ kind: "social", title: label });
  else if (kind === "event") emitFeedback({ kind: "goal", title: label });
}
function useCelebrations() {
  useEffect(
    () =>
      useStore.subscribe((next, previous) => {
        const sim = next.sim,
          old = previous.sim;
        if (!sim || !old || sim.userId !== old.userId) return;
        const previousEntries = new Set(
            (old.economy?.entries ?? []).map((entry) => entry.id),
          ),
          paid = (sim.economy?.entries ?? []).some(
            (entry) =>
              !previousEntries.has(entry.id) &&
              entry.amount > 0 &&
              /wage|pay|shift/i.test(entry.reason),
          );
        if (paid) {
          const key = "metro:first-pay:" + sim.userId;
          let seen = false;
          try {
            seen = localStorage.getItem(key) === "yes";
            localStorage.setItem(key, "yes");
          } catch {}
          if (!seen) celebrate("Your first paycheck!", "payday");
        }
        if (
          sim.daily.some(
            (g) => g.done && !old.daily.find((p) => p.id === g.id)?.done,
          )
        )
          celebrate("A goal, made real!");
        for (const [id, friend] of Object.entries(sim.relationships ?? {})) {
          const before = old.relationships?.[id];
          if (
            before &&
            before.label !== friend.label &&
            friend.value > before.value
          ) {
            celebrate("A new " + friend.label.toLowerCase() + "!", "friend");
            break;
          }
        }
      }),
    [],
  );
}
function useClockTick() {
  const [now, setNow] = useState(serverNow);
  useEffect(() => {
    const id = setInterval(() => {
      if (!document.hidden) setNow(serverNow());
    }, 250);
    return () => clearInterval(id);
  }, []);
  return now;
}
const EMOTES = [
  ["dance", "Dance", "music"],
  ["wave", "Wave", "users"],
  ["cheer", "Cheer", "confetti"],
  ["laugh", "Laugh", "smiley"],
  ["clap", "Clap", "heart"],
  ["point", "Point", "map-pin"],
  ["sit", "Sit", "seating"],
  ["honk", "Honk", "speaker-high"],
] as const;
function WorkTiming({
  game,
  send,
  working,
}: {
  game: WorkGame;
  send: (path: string, body: unknown) => Promise<SocialReply>;
  working: boolean;
}) {
  const marker = useRef<HTMLSpanElement>(null),
    [notice, setNotice] = useState(""),
    [used, setUsed] = useState(game.taps),
    now = useClockTick();
  useEffect(() => {
    setUsed(game.taps);
  }, [game.taps]);
  useEffect(() => {
    let frame = 0;
    const draw = () => {
      const phase =
          ((((serverNow() - game.startsAt) % 1600) + 1600) % 1600) / 1600,
        position = phase < 0.5 ? phase * 2 : 2 - phase * 2;
      if (marker.current) marker.current.style.left = position * 100 + "%";
      frame = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(frame);
  }, [game.startsAt]);
  if (now >= game.endsAt) return null;
  return (
    <section className="shift-timing plate" aria-label="Work timing game">
      <div>
        <span className="semantic-tile work">
          <Icon name="briefcase" />
        </span>
        <span>
          <strong>A little rhythm to your shift</strong>
          <small>Tap in the green. Three tries; your best counts.</small>
        </span>
        <b>{Math.max(0, 3 - used)} left</b>
      </div>
      <div className="timing-track" aria-hidden="true">
        <i />
        <span ref={marker} />
      </div>
      <ReasonButton
        className="primary"
        reason={
          working ? "Scoring..." : used >= 3 ? "All three tries complete" : ""
        }
        onClick={() =>
          void send("shift/timing", {})
            .then((r) => {
              setUsed((n) => n + 1);
              setNotice(
                r.text ?? "Nice timing. Your best tap adds to your pay.",
              );
            })
            .catch(() => {})
        }
      >
        {used >= 3 ? "Nice work" : "Tap the beat"}
        <Icon name="sparkles" size={17} />
      </ReasonButton>
      {notice && <small role="status">{notice}</small>}
    </section>
  );
}
/** Express yourself and Friends & homes, shown in the HUD action stack. */
export function SocialTools({ onOpen }: { onOpen?: () => void }) {
  const wheel = useSocialUi((s) => s.wheel),
    friends = useSocialUi((s) => s.friends),
    ready = useStore(
      (s) => !!s.sim && !s.sim.trip && s.sim.introDone !== false,
    );
  if (!ready) return null;
  return (
    <>
      <button
        className="hud-tool"
        aria-label="Express yourself: dance, wave, cheer"
        aria-expanded={wheel}
        onClick={() => {
          useSocialUi.setState({ wheel: !wheel, friends: false });
          onOpen?.();
          sound("open");
        }}
      >
        <Icon name="smiley" />
        <span>Express</span>
        <kbd>G</kbd>
      </button>
      <button
        className="hud-tool"
        aria-label="Friends and open houses"
        aria-expanded={friends}
        onClick={() => {
          useSocialUi.setState({ friends: !friends, wheel: false });
          onOpen?.();
        }}
      >
        <Icon name="users" />
        <span>Friends</span>
      </button>
    </>
  );
}
export function SocialLifeHud() {
  const sim = useStore(
      useShallow((s) => {
        const game = s.sim
          ? (s.sim as Sim & { workGame?: WorkGame | null }).workGame
          : null;
        return s.sim
          ? {
              userId: s.sim.userId,
              city: s.sim.city,
              loc: s.sim.loc,
              trip: !!s.sim.trip,
              introDone: s.sim.introDone,
              pendingBeat: !!s.sim.pendingBeat,
              busyUntil: s.sim.busyUntil,
              gameId: game?.id ?? "",
              gameStart: game?.startsAt ?? 0,
              gameEnd: game?.endsAt ?? 0,
              gameTaps: game?.taps ?? 0,
              gameBest: game?.best ?? 0,
            }
          : null;
      }),
    ),
    panel = useStore((s) => s.panel),
    event = useSocialLife((s) => s.event),
    houses = useSocialLife((s) => s.openHouses),
    wheel = useSocialUi((s) => s.wheel),
    friends = useSocialUi((s) => s.friends),
    setWheel = (next: boolean | ((v: boolean) => boolean)) =>
      useSocialUi.setState((s) => ({
        wheel: typeof next === "function" ? next(s.wheel) : next,
      })),
    setFriends = (next: boolean) => useSocialUi.setState({ friends: next }),
    [dismissedEvent, setDismissedEvent] = useState(""),
    [working, setWorking] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [invite, setInvite] = useState(""),
    now = useClockTick(),
    mounted = useRef(true);
  useCelebrations();
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (!sim) return;
    let active = true;
    const refresh = () => {
      if (active && !document.hidden) void refreshSocialLife().catch(() => {});
    };
    refresh();
    const timer = setInterval(refresh, 3000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [sim?.userId, sim?.city]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        (e.target as HTMLElement)?.closest(
          "input,textarea,select,[contenteditable=true]",
        )
      )
        return;
      if (
        e.key.toLowerCase() === "g" &&
        !e.repeat &&
        !useStore.getState().panel &&
        !useStore.getState().searchOpen &&
        useStore.getState().sim
      ) {
        e.preventDefault();
        setWheel((v) => !v);
      } else if (e.key === "Escape" && (wheel || friends)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        setWheel(false);
        setFriends(false);
      }
    };
    window.addEventListener("keydown", key, true);
    return () => window.removeEventListener("keydown", key, true);
  }, [wheel, friends]);
  useEffect(() => {
    if (!event?.rewardClaimed || !event.joined || !sim) return;
    const key = "metro:event-result:" + sim.userId + ":" + event.id;
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, "yes");
    } catch {}
    celebrate(
      (event.success || event.progress >= event.target
        ? "City goal complete! +$25"
        : "Thanks for joining! +$10") + " · party outfit unlocked",
      "event",
    );
    void socialRequest<{ sim: Sim }>("sim")
      .then((r) => {
        if (useStore.getState().sim?.userId === sim.userId)
          useStore.getState().setSim(r.sim);
      })
      .catch(() => {});
  }, [event?.id, event?.rewardClaimed, sim?.userId]);
  useEffect(() => {
    const party =
      !!event?.active &&
      !!sim &&
      sim.city === event.city &&
      sim.loc === event.loc;
    setPartyAudio(party);
    return () => setPartyAudio(false);
  }, [event?.active, event?.city, event?.loc, sim?.city, sim?.loc]);
  const send = async (path: string, body: unknown): Promise<SocialReply> => {
    if (working) return {};
    setWorking(true);
    setError("");
    const id = useStore.getState().sim?.userId;
    try {
      if (path !== "shift/timing") await motion.flush();
      const r = await socialRequest<SocialReply>(path, body);
      if (r.sim && useStore.getState().sim?.userId === id)
        useStore.getState().setSim(r.sim);
      if (r.text) setNotice(r.text);
      void refreshSocialLife().catch(() => {});
      return r;
    } catch (e) {
      if (mounted.current)
        setError(e instanceof Error ? e.message : "Try again in a moment.");
      throw e;
    } finally {
      if (mounted.current) setWorking(false);
    }
  };
  if (!sim || sim.trip || sim.introDone === false) return null;
  const own = houses.find((h) => h.ownerId === sim.userId),
    game: WorkGame | null = sim.gameId
      ? {
          id: sim.gameId,
          startsAt: sim.gameStart,
          endsAt: sim.gameEnd,
          taps: sim.gameTaps,
          best: sim.gameBest,
        }
      : null,
    eventTime = event
      ? Math.max(
          0,
          Math.ceil(
            ((event.active ? event.endsAt : event.startsAt) - now) / 1000,
          ),
        )
      : 0,
    hidden = !!panel || !!sim.pendingBeat,
    showEvent =
      !!event &&
      event.id !== dismissedEvent &&
      (!event.finished || event.joined);
  return (
    <>
      {wheel && (
        <div className="emote-scrim" onPointerDown={() => setWheel(false)}>
          <section
            className="emote-wheel"
            role="dialog"
            aria-label="Express yourself"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="emote-wheel-center">
              <strong>
                Say it
                <br />
                your way
              </strong>
              <button onClick={() => setWheel(false)} aria-label="Close emotes">
                Close
              </button>
            </div>
            {EMOTES.map(([kind, label, icon], i) => (
              <button
                key={kind}
                className="emote-item"
                style={{ "--angle": i * 45 + "deg" } as CSSProperties}
                disabled={working || !!sim.busyUntil}
                onClick={() => {
                  setWheel(false);
                  void send("emote", { kind })
                    .then(() =>
                      sound(
                        kind === "clap" || kind === "point" || kind === "sit"
                          ? "tap"
                          : kind,
                      ),
                    )
                    .catch(() => {});
                }}
              >
                <Icon name={icon} size={25} />
                <span>{label}</span>
              </button>
            ))}
          </section>
        </div>
      )}
      {!hidden && showEvent && event && (
        <section
          className={`world-event-banner plate ${event.active ? "live" : ""} ${event.finished ? "finished" : ""}`}
          aria-label="City event"
        >
          <span className="semantic-tile fun" aria-hidden="true">
            <Icon name="confetti" />
          </span>
          <div className="event-copy">
            <strong>{event.name}</strong>
            <span>
              {event.finished
                ? event.success || event.progress >= event.target
                  ? "You helped make it happen"
                  : "Thanks for joining in"
                : event.active
                  ? `${Math.floor(eventTime / 60)}:${String(eventTime % 60).padStart(2, "0")} left · ${event.progress}/${event.target} moments · ${venueName(event.loc, event.loc)}`
                  : `Starts in ${Math.floor(eventTime / 60)}:${String(eventTime % 60).padStart(2, "0")} · ${venueName(event.loc, event.loc)}`}
            </span>
            {event.active && (
              <progress
                aria-label={`Shared moments ${event.progress} of ${event.target}`}
                max={event.target}
                value={event.progress}
              />
            )}
            <small>
              {event.finished
                ? (event.result ?? "Your reward and party outfit are yours.")
                : event.active
                  ? `${event.progress} / ${event.target} shared moments · dance, wave or cheer there`
                  : "A little party, a few neighbours, a free outfit."}
            </small>
          </div>
          {!event.finished && (
            <button
              className="secondary event-find"
              onClick={() => {
                useStore.getState().selectLocation(event.loc);
                useStore.getState().setFocus(event.loc);
              }}
            >
              Find it
            </button>
          )}
          {event.active && (
            <ReasonButton
              className="primary event-join"
              reason={
                working
                  ? "Joining…"
                  : event.rewardClaimed
                    ? "Reward collected"
                    : event.joined && event.progress < event.target
                      ? "You are part of it"
                      : ""
              }
              onClick={() => {
                void (async () => {
                  if (useStore.getState().sim?.loc !== event.loc)
                    await useStore.getState().travelTo(event.loc);
                  await send("event/join", {});
                })().catch(() => {});
              }}
            >
              {event.progress >= event.target && !event.rewardClaimed
                ? "Collect $25"
                : event.joined
                  ? "Joined"
                  : "Join in"}
            </ReasonButton>
          )}
          <button
            className="icon-button event-dismiss"
            aria-label="Hide this event"
            onClick={() => setDismissedEvent(event.id)}
          >
            <Icon name="x" size={18} />
          </button>
        </section>
      )}
      {friends && (
        <section
          className="social-life-panel plate"
          role="dialog"
          aria-label="Friends and open houses"
        >
          <header>
            <span>
              <small>Better together</small>
              <h2>Make a little room.</h2>
            </span>
            <button
              className="icon-button"
              aria-label="Close friends panel"
              onClick={() => setFriends(false)}
            >
              <Icon name="x" size={20} />
            </button>
          </header>
          <p>
            Invite a friend straight to your side, or welcome the neighbourhood
            into your home.
          </p>
          <ReasonButton
            className="primary full"
            reason={working ? "Making an invitation..." : ""}
            onClick={() =>
              void send("invite", {})
                .then(async (r) => {
                  const url = r.url
                    ? new URL(r.url, location.origin).href
                    : location.origin +
                      "/?invite=" +
                      encodeURIComponent(r.code ?? "");
                  setInvite(url);
                  try {
                    await navigator.clipboard.writeText(url);
                    setNotice(
                      "Invite copied. Your friend will arrive beside you.",
                    );
                  } catch {
                    setNotice("Your invite is ready below.");
                  }
                })
                .catch(() => {})
            }
          >
            <Icon name="users" />
            Copy invite link
          </ReasonButton>
          {invite && (
            <input
              aria-label="Friend invite link"
              value={invite}
              readOnly
              onFocus={(e) => e.currentTarget.select()}
            />
          )}
          <ReasonButton
            className="secondary full"
            reason={working ? "Updating your door..." : ""}
            onClick={() =>
              void send("open-house", { open: !own }).catch(() => {})
            }
          >
            <Icon name="house" />
            {own ? "Close your open house" : "Open your house to visitors"}
            {own && <small>{own.likes} likes</small>}
          </ReasonButton>
          <h3>Doors open in your city</h3>
          {houses.filter((h) => h.ownerId !== sim.userId).length ? (
            houses
              .filter((h) => h.ownerId !== sim.userId)
              .map((h) => (
                <article className="open-house-row" key={h.ownerId}>
                  <span className="semantic-tile rest">
                    <Icon name="house" />
                  </span>
                  <div>
                    <strong>{h.username}'s place</strong>
                    <small>
                      {h.likes} likes ·{" "}
                      {h.here ? "You are visiting" : "Come say hello"}
                    </small>
                  </div>
                  <ReasonButton
                    className="secondary"
                    reason={working ? "One moment..." : ""}
                    onClick={() =>
                      void send(
                        h.here ? "open-house/like" : "open-house/visit",
                        { ownerId: h.ownerId },
                      )
                        .then(() => sound(h.here ? "friend" : "arrival"))
                        .catch(() => {})
                    }
                  >
                    {h.here ? "Like it" : "Visit"}
                  </ReasonButton>
                </article>
              ))
          ) : (
            <p className="small-copy">
              A quiet street. Open your door and be the first host.
            </p>
          )}
          <ErrorMessage text={error} />
          {notice && (
            <p role="status" className="notice">
              {notice}
            </p>
          )}
        </section>
      )}
      {game && (
        <WorkTiming key={game.id} game={game} send={send} working={working} />
      )}
      {!friends && (
        <ToastPortal>
          <HudNotice text={error} onDismiss={() => setError("")} />
        </ToastPortal>
      )}
    </>
  );
}
