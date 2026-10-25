import { apiRequest } from "../api/client";
import { useEffect, useRef, useState } from "react";
import { create } from "zustand";
import type { Sim } from "../api/types";
import venueData from "../shared-data/venues.json";
import { useStore } from "../store";
import { enqueueAction } from "../interactions";
import { motion } from "../walking";
import { serverNow } from "../server-time";
import { Icon, ReasonButton } from "./primitives";
import { sound } from "./sound";
import { confirmPurchase } from "./purchase-confirmation";
import "./venue-moments.css";
export type VenueAction = {
  id: string;
  label: string;
  station: string;
  kind: string;
  cost: number;
  pose: string;
  reason: string;
  point?: { x: number; z: number; name: string };
};
export type VenueSnapshot = {
  loc: string;
  city: string;
  type: string;
  title: string;
  at: number;
  actions: VenueAction[];
  moment: {
    id: string;
    title: string;
    startsAt: number;
    endsAt: number;
    nextAt: number;
    phase: "prelude" | "active" | "encore" | "between";
    cycleMs: number;
  };
  shared: {
    waveAt?: number;
    waveCount?: number;
    danceAt?: number;
    danceName?: string;
    danceUserId?: string;
    curtainAt?: number;
    organAt?: number;
    trainAt?: number;
    rayAt?: number;
    lastPlayAt?: number;
    lastPlayer?: string;
    lastKind?: string;
    lastScore?: number;
    turn?: {
      username: string;
      userId: string;
      kind: string;
      expiresAt: number;
    };
    scores: {
      id: string;
      username: string;
      kind: string;
      score: number;
      precision: number;
      at: number;
      text: string;
    }[];
    art: {
      id: string;
      userId: string;
      username: string;
      cells: string[];
      at: number;
    }[];
  };
  attempt: {
    id: string;
    kind: string;
    startedAt: number;
    expiresAt: number;
    periodMs: number;
    target: number;
  } | null;
  sim?: Sim;
  message?: string;
};
export const useVenueMoment = create<{ data: VenueSnapshot | null }>(() => ({
  data: null,
}));
const supported = (loc: string | null | undefined) =>
  !!loc && Object.hasOwn(venueData.landmarkLife, loc);
async function readVenue(loc: string, body?: Record<string, unknown>) {
  return apiRequest<VenueSnapshot>(
    body ? "POST" : "GET",
    body
      ? "/api/venue-moment"
      : `/api/venue-moment?loc=${encodeURIComponent(loc)}`,
    body ? { loc, ...body } : undefined,
  );
}
/** One room-local poll shared by the venue UI and its animated scenery. */
export function VenueMomentBridge() {
  const loc = useStore((s) => s.sim?.loc),
    room = useStore((s) => s.sim?.position?.room),
    city = useStore((s) => s.sim?.city);
  useEffect(() => {
    if (city !== "atl" || !room || !supported(loc)) {
      useVenueMoment.setState({ data: null });
      return;
    }
    let live = true,
      pending = false;
    const update = async () => {
      if (pending || document.hidden) return;
      pending = true;
      try {
        const data = await readVenue(loc!);
        if (live) useVenueMoment.setState({ data });
      } catch {
        /* The game retains the last shared cue across a short disconnect. */
      } finally {
        pending = false;
      }
    };
    void update();
    const timer = setInterval(() => void update(), 1200);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [loc, room, city]);
  return null;
}
const palette = [
  "#e4b95b",
  "#6f9e8b",
  "#779bc0",
  "#c87d8c",
  "#ede0c7",
  "#64537f",
];
function PowerBar({
  attempt,
}: {
  attempt: NonNullable<VenueSnapshot["attempt"]>;
}) {
  const marker = useRef<HTMLElement>(null);
  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const wave =
          ((serverNow() - attempt.startedAt) % attempt.periodMs) /
          (attempt.periodMs / 2),
        position = wave <= 1 ? wave : 2 - wave;
      if (marker.current) marker.current.style.left = `${position * 100}%`;
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(frame);
  }, [attempt]);
  return (
    <div
      className="venue-power"
      aria-label="Stop the moving marker in the green centre"
    >
      <span />
      <i ref={marker} />
    </div>
  );
}
export function VenueMoments({ loc: requested }: { loc?: string }) {
  const selected = useStore((s) => s.selectedLoc),
    sim = useStore((s) => s.sim),
    live = useVenueMoment((s) => s.data),
    loc = requested ?? selected,
    [data, setData] = useState<VenueSnapshot | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [now, setNow] = useState(serverNow),
    [brush, setBrush] = useState(palette[0]),
    [cells, setCells] = useState<string[]>(Array(16).fill(palette[4]));
  useEffect(() => {
    if (live?.loc === loc) setData(live);
  }, [live, loc]);
  useEffect(() => {
    if (!supported(loc)) return;
    let active = true;
    void readVenue(loc!)
      .then((data) => {
        if (active) setData(data);
      })
      .catch(() => {});
    const timer = setInterval(() => setNow(serverNow()), 250);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [loc]);
  if (!supported(loc) || !data || data.loc !== loc) return null;
  const update = async (kind: string, phase?: string) => {
    setBusy(true);
    setError("");
    try {
      const action = data.actions.find((row) => row.id === kind);
      if (
        action &&
        action.cost > 0 &&
        phase !== "finish" &&
        !(await confirmPurchase(
          action.cost,
          action.label,
          useStore.getState().sim,
        ))
      )
        return;
      const response = await readVenue(loc!, {
        kind,
        phase,
        ...(kind === "paint" ? { cells } : {}),
      });
      setData(response);
      useVenueMoment.setState({ data: response });
      if (response.sim) useStore.getState().setSim(response.sim);
      setNotice(response.message ?? "");
      sound(
        phase === "finish"
          ? "reward"
          : kind === "wave"
            ? "cheer"
            : kind === "dancecam"
              ? "dance"
              : kind === "train"
                ? "arrival"
                : "open",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not join this moment");
    } finally {
      setBusy(false);
    }
  };
  const walk = (action: VenueAction) => {
    if (!sim || !action.point || !motion.position) return;
    enqueueAction({
      kind: "walk",
      label: `Walk to ${action.point.name}`,
      icon: "footprints",
      city: sim.city,
      room: motion.position.room,
      point: action.point,
    });
    useStore.getState().openPanel(null);
  };
  const m = data.moment,
    active = m.phase === "active",
    next = m.phase === "prelude" ? m.startsAt : m.nextAt,
    seconds = Math.max(0, Math.ceil((next - now) / 1000)),
    attempt =
      data.attempt && data.attempt.expiresAt > now ? data.attempt : null,
    turn =
      data.shared.turn && data.shared.turn.expiresAt > now
        ? data.shared.turn
        : null;
  return (
    <section className="venue-moments">
      <h3>Something to be part of</h3>
      <div className="venue-event">
        <strong>{m.title}</strong>
        <small>
          {active
            ? "Happening now · shared by everyone here"
            : m.phase === "encore"
              ? "The encore is wrapping up"
              : `Next in ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`}
        </small>
      </div>
      {data.shared.waveAt && now - data.shared.waveAt < 14000 ? (
        <p className="venue-notice">
          The crowd wave is rolling · {data.shared.waveCount ?? 1} joined
        </p>
      ) : null}
      {data.shared.danceAt && now - data.shared.danceAt < 12000 ? (
        <p className="venue-notice">
          On the dance cam: {data.shared.danceName}
        </p>
      ) : null}
      {notice && (
        <p className="venue-notice" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className="venue-error" role="alert">
          {error}
        </p>
      )}
      {turn && !attempt && (
        <p className="venue-state">
          {turn.username} is taking a turn. Cheer them on.
        </p>
      )}
      {attempt && (
        <div className="venue-turn">
          <strong>
            {attempt.kind === "golf"
              ? "Line up your putt"
              : attempt.kind === "skee"
                ? "Roll for the high rings"
                : "Take the half-court shot"}
          </strong>
          <p>
            Stop the marker in the green centre. Your timing decides the score.
          </p>
          <PowerBar attempt={attempt} />
          <ReasonButton
            className="primary full"
            reason={busy ? "Releasing…" : ""}
            onClick={() => void update(attempt.kind, "finish")}
          >
            Release now
          </ReasonButton>
        </div>
      )}
      <div className="venue-actions">
        {data.actions.map((action) => {
          const canWalk =
            !!action.point &&
            sim?.city === data.city &&
            sim.position?.room === motion.position?.room &&
            sim.loc === loc &&
            action.reason.startsWith("Walk to ");
          return (
            <article key={action.id} className="venue-action">
              <div>
                <Icon
                  name={
                    action.kind === "food"
                      ? "utensils"
                      : action.kind === "game"
                        ? "target"
                        : action.id === "paint"
                          ? "palette"
                          : "sparkles"
                  }
                />
                <strong>{action.label}</strong>
                {action.cost > 0 && <span>${action.cost}</span>}
              </div>
              {action.id === "paint" && (
                <div className="venue-paint">
                  <div className="venue-palette">
                    {palette.map((color, i) => (
                      <button
                        key={color}
                        style={{ background: color }}
                        aria-label={`Brush colour ${i + 1}`}
                        aria-pressed={brush === color}
                        onClick={() => setBrush(color)}
                      />
                    ))}
                  </div>
                  <div className="venue-canvas">
                    {cells.map((color, i) => (
                      <button
                        key={i}
                        aria-label={`Paint square ${i + 1}`}
                        style={{ background: color }}
                        onClick={() =>
                          setCells((old) =>
                            old.map((c, j) => (j === i ? brush : c)),
                          )
                        }
                      />
                    ))}
                  </div>
                </div>
              )}
              <ReasonButton
                className="secondary full"
                reason={
                  busy
                    ? "Joining…"
                    : attempt && action.kind === "game"
                      ? "Finish your current turn"
                      : action.reason
                }
                onClick={() =>
                  void update(
                    action.id,
                    action.kind === "game" ? "start" : undefined,
                  )
                }
              >
                {action.kind === "game"
                  ? "Take a turn"
                  : action.id === "paint"
                    ? "Hang my canvas"
                    : action.label}
              </ReasonButton>
              {canWalk && (
                <button
                  className="text-button venue-walk"
                  onClick={() => walk(action)}
                >
                  <Icon name="footprints" size={18} />
                  Walk to this activity
                </button>
              )}
            </article>
          );
        })}
      </div>
      {data.shared.scores.length > 0 && (
        <>
          <h3>Room scoreboard</h3>
          <ol className="venue-scoreboard">
            {data.shared.scores
              .slice(-6)
              .reverse()
              .map((row) => (
                <li key={row.id}>
                  <span>
                    {row.username}
                    <small>
                      {row.kind === "golf"
                        ? "Mini golf"
                        : row.kind === "skee"
                          ? "Skee-ball"
                          : "Half-court shot"}
                    </small>
                  </span>
                  <strong>{row.text}</strong>
                </li>
              ))}
          </ol>
        </>
      )}
      {data.shared.art.length > 0 && (
        <div className="venue-art">
          {data.shared.art.slice(-4).map((art) => (
            <figure key={art.id}>
              <div className="venue-art-grid">
                {art.cells.map((color, i) => (
                  <i key={i} style={{ background: color }} />
                ))}
              </div>
              <figcaption>{art.username}</figcaption>
            </figure>
          ))}
        </div>
      )}
    </section>
  );
}
