import { create } from "zustand";
import type { Position } from "./navigation";
export type InteractionIntent = {
  kind: "act" | "apply" | "door" | "location" | "bench" | "social";
  label: string;
  city: string;
  room: string | null;
  loc: string;
  stationId?: string;
  actionId?: string;
  jobId?: string;
  targetId?: string;
  benchId?: string;
  enter?: boolean;
};
export const motion = {
  interactionIntent: null as InteractionIntent | null,
  revision: 0,
  teleport: 0,
  x: 0,
  z: 0,
  run: false,
  position: null as Position | null,
  follow: true,
  moving: false,
  camera: null as { angle: number; distance: number; height: number } | null,
  useApproach: null as { slotId: string; x: number; z: number } | null,
  /**
   * Corners the player turned since the last position the server confirmed. They travel with the
   * next /api/move so the server checks the walked polyline, not a chord that cuts a corner.
   */
  trail: [] as { x: number; z: number }[],
  /** Set after a teleport (map shortcut, flight, door): the follow camera jumps instead of gliding. */
  snapCamera: false,
  /** Seconds of walking simulated so far. Stuck detection counts this, not wall time, so a slow or
   * stalled frame never reads as "blocked". */
  walkClock: 0,
  flush: async () => {},
  wake: () => {},
};
export const useWalking = create<{
  position: Position | null;
  error: string;
  hint: boolean;
  transition: boolean;
}>(() => ({ position: null, error: "", hint: false, transition: false }));
export const interact = () =>
  window.dispatchEvent(
    new CustomEvent("metro-interact", { detail: motion.interactionIntent }),
  );

/** Script errors (a bug, a cut-off response) are never shown to players as raw text. */
const SCRIPT_ERROR =
  /cannot read|undefined|is not a function|is not an object|typeerror|referenceerror|syntaxerror|unexpected token|json|failed to fetch|networkerror|load failed|aborted/i;
export const FRIENDLY_FALLBACK = "That did not work. Please try again.";
/** A message that is safe and kind to show on screen. */
export function friendlyMessage(message: unknown, fallback = FRIENDLY_FALLBACK) {
  const text =
    message instanceof Error
      ? message.message
      : typeof message === "string"
        ? message
        : "";
  if (!text.trim() || SCRIPT_ERROR.test(text)) return fallback;
  return text;
}

/** How long a walking or action message stays before it clears itself. */
export const ERROR_TTL_MS = 6000;
let errorTimer: ReturnType<typeof setTimeout> | null = null;
useWalking.subscribe((state, previous) => {
  if (state.error === previous.error) return;
  if (errorTimer) clearTimeout(errorTimer);
  errorTimer = null;
  if (!state.error) return;
  const safe = friendlyMessage(state.error);
  if (safe !== state.error) {
    useWalking.setState({ error: safe });
    return;
  }
  const shown = state.error;
  errorTimer = setTimeout(() => {
    errorTimer = null;
    if (useWalking.getState().error === shown) useWalking.setState({ error: "" });
  }, ERROR_TTL_MS);
});
