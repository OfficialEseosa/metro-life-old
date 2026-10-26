import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowClockwise,
  CloudSlash,
  Cookie,
  UserSwitch,
  WifiSlash,
} from "@phosphor-icons/react";
import { useConnection, useStore } from "../store";
import "./connection.css";

/** Seconds the first load may take before the page offers a way out. */
const SLOW_LOAD_MS = 12000;

function useTick(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active]);
  return now;
}

function Card({
  icon,
  title,
  children,
  busy,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
  busy?: boolean;
}) {
  return (
    <div className="connection-gate">
      <section
        className="plate connection-card"
        role={busy ? "status" : "alert"}
        aria-live="polite"
      >
        <span className="connection-icon" aria-hidden="true">
          {icon}
        </span>
        <h1>{title}</h1>
        {children}
      </section>
    </div>
  );
}

function StartFresh({
  label = "Start fresh",
  primary = false,
}: {
  label?: string;
  primary?: boolean;
}) {
  const [working, setWorking] = useState(false);
  return (
    <button
      className={primary ? "primary full" : "secondary full"}
      disabled={working}
      onClick={() => {
        setWorking(true);
        void useStore
          .getState()
          .startFresh()
          .finally(() => setWorking(false));
      }}
    >
      <UserSwitch size={20} weight="bold" aria-hidden="true" />
      {working ? "Starting fresh…" : label}
    </button>
  );
}

/**
 * Full-screen states shown instead of the game when there is no usable session: first load,
 * API unreachable, cookies blocked, or a session that no longer exists. Every state has a button.
 */
export function ConnectionGate() {
  const connection = useStore((s) => s.connection),
    retryAt = useStore((s) => s.retryAt),
    loadError = useStore((s) => s.loadError),
    loadLimited = useStore((s) => s.loadLimited);
  const [startedAt] = useState(() => Date.now());
  const now = useTick(
    connection === "connecting" || connection === "unreachable",
  );
  const retry = () => useStore.getState().retryNow();

  if (connection === "ended")
    return (
      <Card
        icon={<UserSwitch size={34} weight="duotone" />}
        title="This life is no longer here"
      >
        <p>
          Your session ended, perhaps because a new life was started in another
          tab or on another device. Start fresh to create a new character here.
        </p>
        <div className="connection-actions">
          <StartFresh primary />
          <button className="secondary full" onClick={() => location.reload()}>
            <ArrowClockwise size={20} weight="bold" aria-hidden="true" />
            Reload the page
          </button>
        </div>
      </Card>
    );

  if (connection === "blocked")
    return (
      <Card
        icon={<Cookie size={34} weight="duotone" />}
        title="Your browser is not keeping your life"
      >
        <p>
          Metro Life keeps your character with a small sign-in cookie, and this
          browser blocked it. Allow cookies for this site, or open it in a
          normal (not private) window, then try again.
        </p>
        <div className="connection-actions">
          <button className="primary full" onClick={retry}>
            <ArrowClockwise size={20} weight="bold" aria-hidden="true" />
            Try again
          </button>
          <StartFresh />
        </div>
      </Card>
    );

  if (connection === "unreachable") {
    const seconds = retryAt
      ? Math.max(0, Math.ceil((retryAt - now) / 1000))
      : 0;
    return (
      <Card
        icon={<CloudSlash size={34} weight="duotone" />}
        title={loadLimited ? "The city is full of new arrivals" : "The city is taking a breather"}
      >
        {loadLimited ? (
          <p>{loadError}</p>
        ) : (
          <p>
            We cannot reach the Metro Life server right now
            {retryAt ? ", and we will keep trying to reconnect" : ""}. Nothing is
            lost while you wait.
          </p>
        )}
        {retryAt ? (
          <p className="connection-countdown" aria-live="off">
            {seconds > 0 ? `Trying again in ${seconds} s` : "Trying again…"}
          </p>
        ) : loadError && !loadLimited ? (
          <p className="connection-countdown">{loadError}</p>
        ) : null}
        <div className="connection-actions">
          <button className="primary full" onClick={retry}>
            <ArrowClockwise size={20} weight="bold" aria-hidden="true" />
            Try now
          </button>
        </div>
      </Card>
    );
  }

  if (now - startedAt < SLOW_LOAD_MS)
    return (
      <Card
        busy
        icon={<span className="connection-spinner" />}
        title="Opening your city…"
      >
        <p>Finding your home and your neighbours.</p>
      </Card>
    );

  return (
    <Card
      busy
      icon={<WifiSlash size={34} weight="duotone" />}
      title="This is taking longer than usual"
    >
      <p>
        The city is slow to answer. Your life is saved on the server; trying
        again usually helps.
      </p>
      <div className="connection-actions">
        <button className="primary full" onClick={() => location.reload()}>
          <ArrowClockwise size={20} weight="bold" aria-hidden="true" />
          Try again
        </button>
        <StartFresh />
      </div>
    </Card>
  );
}

/** Non-blocking banner while the live connection is down during play. */
export function ReconnectBanner() {
  const { connection, disconnectedAt: since, retryNow } = useConnection();
  const now = useTick(connection === "reconnecting");
  if (connection !== "reconnecting" || !since || now - since < 5000)
    return null;
  return (
    <div className="hud-toast reconnect-banner" role="status" aria-live="polite">
      <WifiSlash size={22} weight="bold" aria-hidden="true" />
      <span>
        <strong>Connection lost.</strong> Reconnecting… Your life is saved.
      </span>
      <button
        className="secondary"
        onClick={retryNow}
      >
        <ArrowClockwise size={18} weight="bold" aria-hidden="true" />
        Retry now
      </button>
    </div>
  );
}
