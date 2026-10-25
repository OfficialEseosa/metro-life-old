import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "@phosphor-icons/react";
import { useStore } from "../store";
import { useWalking } from "../walking";
import { useInteractions } from "../interactions";
import { Icon } from "./primitives";
import { friendlyError } from "./helpers";
import { onFeedback } from "../feedback";

/** id of the top-centre toast region; other features may portal into it. */
export const TOAST_REGION_ID = "hud-toasts";

/** Render children into the HUD toast region when it exists. */
export function ToastPortal({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<HTMLElement | null>(() =>
    document.getElementById(TOAST_REGION_ID),
  );
  useEffect(() => {
    if (target?.isConnected) return;
    const frame = requestAnimationFrame(() =>
      setTarget(document.getElementById(TOAST_REGION_ID)),
    );
    return () => cancelAnimationFrame(frame);
  }, [target]);
  return target ? createPortal(children, target) : null;
}

/** One dismissable notice. It hides itself after `ttl` ms even if the store keeps the text. */
export function HudNotice({
  text,
  title = "Not right now",
  icon = "warning",
  tone = "error",
  ttl = 7000,
  onDismiss,
}: {
  text: string;
  title?: string;
  icon?: string;
  tone?: "error" | "info";
  ttl?: number;
  onDismiss: () => void;
}) {
  const [hidden, setHidden] = useState("");
  useEffect(() => {
    if (!text) return;
    const timer = setTimeout(() => setHidden(text), ttl);
    return () => clearTimeout(timer);
  }, [text, ttl]);
  if (!text || hidden === text) return null;
  return (
    <div
      className={`hud-toast ${tone === "error" ? "error-notice" : ""}`}
      role={tone === "error" ? "alert" : "status"}
    >
      <span className={`semantic-tile ${tone === "error" ? "hunger" : "travel"}`}>
        <Icon name={icon} />
      </span>
      <div>
        <strong>{title}</strong>
        <p>{friendlyError(text)}</p>
      </div>
      <button
        className="icon-button"
        aria-label="Dismiss message"
        onClick={() => {
          setHidden(text);
          onDismiss();
        }}
      >
        <X size={20} weight="bold" />
      </button>
    </div>
  );
}

/** Server errors the feedback bus has just announced, so the HUD does not repeat them. */
const announced = new Map<string, number>();
let listening = false;
function listenForAnnouncements() {
  if (listening) return;
  listening = true;
  onFeedback((event) => {
    if (event.kind === "error") announced.set(event.title, event.at);
  });
}
/** Only defer to the bus when its toast layer is actually on screen. */
const recentlyAnnounced = (text: string) =>
  !!document.querySelector(".feedback-layer") &&
  Date.now() - (announced.get(text) ?? 0) < 4000;

/** Walking and interaction errors, shown once, dismissable and short-lived. */
export function ErrorNotices() {
  const walking = useWalking((s) => s.error),
    queue = useInteractions((s) => s.error),
    blocked = useStore((s) => !!s.panel || !!s.sim?.pendingBeat);
  useEffect(listenForAnnouncements, []);
  if (blocked) return null;
  return (
    <>
      {!recentlyAnnounced(walking) && (
        <HudNotice
          text={walking}
          onDismiss={() => useWalking.setState({ error: "" })}
        />
      )}
      {queue !== walking && !recentlyAnnounced(queue) && (
        <HudNotice
          text={queue}
          onDismiss={() => useInteractions.setState({ error: "" })}
        />
      )}
    </>
  );
}
