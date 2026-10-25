import { memo, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, FormEvent, ReactNode } from "react";
import {
  ArrowRight as PhArrowRight,
  Bus,
  Check as PhCheck,
  Clock,
  MapPin as PhMapPin,
  ChatCircleDots,
  Moon as PhMoon,
  Airplane,
  PaperPlaneRight,
  Ticket as PhTicket,
  Users as PhUsers,
} from "@phosphor-icons/react";
import type { IconProps } from "@phosphor-icons/react";

const duo = (Component: (p: IconProps) => ReactNode) =>
  function Duotone(props: IconProps) {
    return <Component weight="duotone" aria-hidden="true" {...props} />;
  };
const ArrowRight = duo(PhArrowRight),
  BusFront = duo(Bus),
  Check = duo(PhCheck),
  Clock3 = duo(Clock),
  MapPin = duo(PhMapPin),
  MessageCircle = duo(ChatCircleDots),
  Moon = duo(PhMoon),
  Plane = duo(Airplane),
  Send = duo(PaperPlaneRight),
  Ticket = duo(PhTicket),
  Users = duo(PhUsers);
import type { TransitTrip } from "../api/types";
import { serverNow } from "../server-time";
import { useStore } from "../store";
import "./travel-ride.css";

type Props = {
  trip: TransitTrip;
  onNap: () => Promise<void>;
  onSendChat: (text: string) => Promise<void>;
};
type Passenger = TransitTrip["passengers"][number];
const scenery = Array.from({ length: 24 }, (_, i) => ({
  x: i * 95 + 10,
  width: 36 + ((i * 19) % 48),
  height: 45 + ((i * 37) % 130),
  colour: ["#798c85", "#b9977c", "#91a2a0", "#c6b498"][i % 4],
}));

/** Self-built window scenery; CSS translates layers for the entire real ride. */
const RideWindow = memo(function RideWindow({
  mode,
  destination,
}: {
  mode: "bus" | "plane";
  destination: string;
}) {
  return (
    <div
      className={`ride-window ride-window--${mode}`}
      aria-label={
        mode === "bus"
          ? `A moving window view on the road to ${destination}`
          : `Clouds outside your flight to ${destination}`
      }
      role="img"
    >
      <div className="ride-sun" />
      <svg
        className="ride-clouds"
        viewBox="0 0 1800 260"
        preserveAspectRatio="xMinYMid slice"
        aria-hidden="true"
      >
        {[90, 480, 850, 1300, 1650].map((x, i) => (
          <g
            key={x}
            transform={`translate(${x},${35 + (i % 3) * 40})`}
            fill="#fff7e8"
            opacity=".7"
          >
            <ellipse cx="0" cy="18" rx="50" ry="15" />
            <ellipse cx="-15" cy="7" rx="25" ry="21" />
            <ellipse cx="18" cy="10" rx="30" ry="19" />
          </g>
        ))}
      </svg>
      <svg
        className="ride-hills"
        viewBox="0 0 2400 300"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d="M0 230Q170 80 350 170T700 175T1050 150T1400 190T1750 160T2100 165T2450 155V300H0Z"
          fill="#93aca0"
        />
        <path
          d="M0 265Q240 140 460 230T920 210T1380 240T1840 210T2300 230V300H0Z"
          fill="#698b7b"
        />
      </svg>
      <svg
        className="ride-city"
        viewBox="0 0 2400 270"
        preserveAspectRatio="xMinYMax slice"
        aria-hidden="true"
      >
        {scenery.map((b, i) => (
          <g key={b.x}>
            <rect
              x={b.x}
              y={260 - b.height}
              width={b.width}
              height={b.height}
              rx="2"
              fill={b.colour}
            />
            {[0, 1, 2].flatMap((col) =>
              [0, 1, 2, 3].map((row) => (
                <rect
                  key={`${col}-${row}`}
                  x={b.x + 7 + (col * (b.width - 13)) / 3}
                  y={270 - b.height + row * 23}
                  width="5"
                  height="9"
                  fill={i % 3 ? "#e9d8aa" : "#d4e4dc"}
                />
              )),
            )}
          </g>
        ))}
      </svg>
      <div className="ride-road">
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
      </div>
      <div className="ride-window-reflection" />
      <span className="ride-window-label">
        {mode === "bus" ? "Metro Coach" : "Metro Air"}
        <span>Bound for {destination}</span>
      </span>
    </div>
  );
});
const Seat = memo(function Seat({
  person,
  self,
}: {
  person: Passenger;
  self: boolean;
}) {
  return (
    <li
      className={`ride-seat${person.nap ? " is-resting" : ""}${self ? " is-you" : ""}`}
      aria-label={`${person.username}, seat ${person.seat + 1}${self ? ", you" : ""}`}
      title={person.username}
    >
      <svg viewBox="0 0 96 100" aria-hidden="true">
        <path d="M12 92V58q0-13 13-13h46q13 0 13 13v34" fill="#647f79" />
        <path d="M27 92V76q0-17 21-17t21 17v16" fill={person.look.top} />
        <path d="M43 56h10v12H43z" fill={person.look.skin} />
        <ellipse cx="48" cy="41" rx="18" ry="22" fill={person.look.skin} />
        <path
          d="M30 42V28q3-19 22-16 22 1 15 33l-6-18-10 3-13-4-5 19Z"
          fill={person.look.hairColor}
        />
        <path
          d={person.nap ? "M37 43q4 4 8 0m8 0q4 4 8 0" : "M39 43h1m15 0h1"}
          stroke="#38403a"
          strokeWidth="2.4"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M42 53q6 4 12 0"
          stroke="#8e6050"
          strokeWidth="1.5"
          fill="none"
        />
      </svg>
      <strong>{self ? "You" : person.username}</strong>
      <span>
        {person.nap ? "Napping" : `Seat ${person.seat + 1}`}
        {!person.online && !self ? " · reconnecting" : ""}
      </span>
    </li>
  );
});

export function TravelRide({ trip, onNap, onSendChat }: Props) {
  const simId = useStore((s) => s.sim?.userId),
    clock = useStore((s) => s.clock),
    [now, setNow] = useState(serverNow),
    [draft, setDraft] = useState(""),
    [sending, setSending] = useState(false),
    [napping, setNapping] = useState(false),
    [error, setError] = useState(""),
    dialog = useRef<HTMLElement>(null),
    heading = useRef<HTMLHeadingElement>(null),
    chat = useRef<HTMLDivElement>(null);
  const lastMessageId = trip.messages.at(-1)?.id;
  useEffect(() => {
    const timer = setInterval(() => {
      if (!document.hidden) setNow(serverNow());
    }, 250);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    heading.current?.focus({ preventScroll: true });
    return () => {
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);
  useEffect(() => {
    chat.current?.scrollTo({
      top: chat.current.scrollHeight,
      behavior: "auto",
    });
  }, [lastMessageId]);
  const boarding = now < trip.departAt,
    remaining = Math.max(
      0,
      Math.ceil(((boarding ? trip.departAt : trip.arriveAt) - now) / 1000),
    ),
    duration = Math.max(1, trip.arriveAt - trip.departAt),
    progress = Math.max(0, Math.min(1, (now - trip.departAt) / duration)),
    arriving = !boarding && remaining === 0;
  const animationDelay = useMemo(
    () => -Math.max(0, serverNow() - trip.departAt) / 1000,
    [trip.departAt],
  );
  const minutes = clock
      ? clock.hour * 60 +
        clock.minute +
        Math.max(0, now - clock.at) / clock.msPerMinute
      : 0,
    day = clock ? clock.day + Math.floor(minutes / 1440) : 0,
    hour = Math.floor(minutes / 60) % 24,
    minute = Math.floor(minutes) % 60;
  const napReason = napping
    ? "Settling into your seat…"
    : trip.nap
      ? "You are napping. Energy returns when you arrive."
      : !trip.napAvailable
        ? boarding
          ? "Settle in after departure to take a nap."
          : "Napping is unavailable for this departure."
        : "";
  const style = {
    "--ride-duration": `${duration / 1000}s`,
    "--ride-delay": `${animationDelay}s`,
    "--ride-progress": `${progress * 100}%`,
  } as CSSProperties;
  const nap = async () => {
    if (napping || !trip.napAvailable || trip.nap) return;
    setNapping(true);
    setError("");
    try {
      await onNap();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Your nap could not start. Try again.",
      );
    } finally {
      setNapping(false);
    }
  };
  const send = async (event: FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (sending || !text) return;
    setSending(true);
    setError("");
    try {
      await onSendChat(text);
      setDraft("");
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Your message could not be sent. Try again.",
      );
    } finally {
      setSending(false);
    }
  };
  const Vehicle = trip.mode === "bus" ? BusFront : Plane;
  return (
    <div className="travel-ride-wrap">
      <section
        ref={dialog}
        className={`travel-ride travel-ride--${trip.mode}${boarding ? " is-boarding" : ""}${trip.nap ? " is-napping" : ""}`}
        style={style}
        role="dialog"
        aria-modal="true"
        aria-label={`${trip.mode === "bus" ? "Bus" : "Flight"} to ${trip.toName}`}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key !== "Tab") return;
          const controls = Array.from(
              dialog.current?.querySelectorAll<HTMLElement>(
                'button:not(:disabled),input:not(:disabled),[tabindex="0"]',
              ) ?? [],
            ),
            first = controls[0],
            last = controls.at(-1);
          if (
            event.shiftKey &&
            (document.activeElement === first ||
              document.activeElement === heading.current)
          ) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }}
      >
        <header className="ride-heading">
          <span className="ride-operator">
            <Vehicle size={22} />
            {trip.mode === "bus" ? "Metro Coach" : "Metro Air"}
            <small>Shared departure</small>
          </span>
          <div className="ride-clock">
            <Clock3 size={16} />
            <span>
              {clock
                ? `Day ${day} · ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
                : "Shared world time"}
            </span>
          </div>
        </header>
        <div className="ride-main">
          <div className="ride-journey">
            <div className="ride-route">
              <p>
                {trip.fromName}
                <ArrowRight size={15} />
                {trip.toName}
              </p>
              <h1 ref={heading} tabIndex={-1}>
                {boarding
                  ? "Find your seat."
                  : arriving
                    ? "Your next stop."
                    : trip.mode === "bus"
                      ? "A little time between cities."
                      : "Above the everyday."}
              </h1>
              <span>
                {boarding
                  ? `Leaving in ${remaining}s`
                  : `${trip.mode === "bus" ? "On the bus" : "Flying"} to ${trip.toName}`}
              </span>
            </div>
            <div className="ride-cabin">
              <div className="ride-cabin-top">
                <span>Your window seat</span>
                <i />
                <i />
                <i />
              </div>
              <RideWindow mode={trip.mode} destination={trip.toName} />
              <div className="ride-window-sill" />
              <div className="ride-seat-line">
                <span />
                <span />
                <span />
              </div>
            </div>
            <div className="ride-progress">
              <div className="ride-progress-copy">
                <span>
                  {boarding
                    ? "Boarding"
                    : arriving
                      ? "Arriving at your hub"
                      : `${remaining}s to arrival`}
                </span>
                <strong>
                  {trip.gameMinutes / 60} game hours{" "}
                  <span>· {trip.durationSeconds}s ride</span>
                </strong>
              </div>
              <div
                className="ride-progress-track"
                role="progressbar"
                aria-label="Journey progress"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(progress * 100)}
              >
                <span />
                <Vehicle size={18} />
              </div>
              <div className="ride-stops">
                <span>
                  <i />
                  {trip.fromName}
                </span>
                <span>
                  {trip.toName}
                  <MapPin size={13} />
                </span>
              </div>
            </div>
            <div className="ride-small-print">
              <Ticket size={16} />
              <p>
                Arriving at the{" "}
                {trip.mode === "bus" ? "downtown bus station" : "airport"}. You
                are visiting; your home stays in your home city.
              </p>
            </div>
            {trip.mode === "bus" && (
              <div className="ride-rest">
                <div>
                  <Moon size={20} />
                  <div>
                    <strong>
                      {trip.nap
                        ? "Rest comes with you."
                        : "Make the most of the slow road."}
                    </strong>
                    <span>
                      {trip.nap
                        ? "+25 Energy when you arrive."
                        : "A nap restores 25 Energy when you arrive."}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void nap()}
                  disabled={!!napReason}
                  title={napReason || "Nap on the bus"}
                >
                  {trip.nap ? <Check size={16} /> : <Moon size={16} />}
                  {trip.nap
                    ? "Napping"
                    : napping
                      ? "One moment…"
                      : "Take a nap"}
                </button>
                {napReason && <small>{napReason}</small>}
              </div>
            )}
          </div>
          <aside className="ride-company">
            <div className="ride-company-title">
              <Users size={17} />
              <h2>Along for the ride</h2>
              <span>{trip.passengers.length}</span>
            </div>
            <ol
              className="ride-passengers"
              aria-label="Passengers on this departure"
            >
              {trip.passengers.map((person) => (
                <Seat
                  key={person.id}
                  person={person}
                  self={person.id === simId}
                />
              ))}
            </ol>
            <div className="ride-events" aria-live="polite">
              {trip.events
                .filter((event) => event.at <= now)
                .slice(-2)
                .map((event) => (
                  <p key={event.id}>
                    <span>From your ride</span>
                    {event.text}
                  </p>
                ))}
            </div>
            <div className="ride-chat-title">
              <MessageCircle size={16} />
              <h2>Cabin conversation</h2>
              <span>This departure only</span>
            </div>
            <div
              ref={chat}
              className="ride-chat"
              role="log"
              aria-live="polite"
              aria-label="Messages on this departure"
            >
              {trip.messages.length ? (
                trip.messages.slice(-24).map((message) => (
                  <article
                    key={message.id}
                    className={message.userId === simId ? "is-mine" : ""}
                  >
                    <strong>
                      {message.userId === simId ? "You" : message.username}
                    </strong>
                    <p>{message.text}</p>
                  </article>
                ))
              ) : (
                <p className="ride-chat-empty">
                  A window view and a few new faces. Say hello to someone
                  sharing your journey.
                </p>
              )}
            </div>
            <form
              className="ride-chat-compose"
              onSubmit={(event) => void send(event)}
            >
              <label className="ride-sr-only" htmlFor="ride-chat-message">
                Message your fellow passengers
              </label>
              <input
                id="ride-chat-message"
                value={draft}
                maxLength={240}
                autoComplete="off"
                placeholder="Hello, fellow travellers…"
                onChange={(event) => setDraft(event.target.value)}
                disabled={sending}
              />
              <button
                type="submit"
                disabled={sending || !draft.trim()}
                aria-label={
                  sending ? "Sending your message" : "Send to this departure"
                }
                title={
                  sending
                    ? "Sending…"
                    : !draft.trim()
                      ? "Write a message first"
                      : "Send to this departure"
                }
              >
                <Send size={17} />
              </button>
            </form>
          </aside>
        </div>
        {error && (
          <p className="ride-error" role="alert">
            {error}
          </p>
        )}
        <footer className="ride-footer">
          <span className="ride-live-dot" />A shared journey. Time keeps moving.
          <span>
            {arriving
              ? "Opening the doors…"
              : trip.mode === "bus"
                ? "Watch the city turn into somewhere new."
                : "Your destination is getting closer."}
          </span>
        </footer>
      </section>
    </div>
  );
}
