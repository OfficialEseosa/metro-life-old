/**
 * Bridge between the 3D scene and the HUD feedback layer: the scene registers a projector,
 * the HUD asks where a world anchor sits on screen. No three.js import here, so the HUD
 * chunk stays independent of the scene chunk.
 */
import type { FeedbackAnchor } from "../feedback";
import { motion } from "../walking";

export type ScreenPoint = { x: number; y: number; visible: boolean };
/** Writes the screen position (CSS px) of a world point lifted `lift` metres into `out`. */
export type FeedbackProjector = (
  anchor: FeedbackAnchor,
  lift: number,
  out: ScreenPoint,
) => boolean;

let projector: FeedbackProjector | null = null;

export function setFeedbackProjector(next: FeedbackProjector) {
  projector = next;
  return () => {
    if (projector === next) projector = null;
  };
}

/** The anchor for an event, falling back to the player. */
export function anchorOrPlayer(
  anchor: FeedbackAnchor | undefined,
): FeedbackAnchor | undefined {
  if (anchor && Number.isFinite(anchor.x) && Number.isFinite(anchor.z))
    return anchor;
  const p = motion.position;
  return p ? { x: p.x, z: p.z } : undefined;
}

/** Screen position of a world anchor, or null when the scene is not mounted or it is off screen. */
export function projectFeedbackAnchor(
  anchor: FeedbackAnchor | undefined,
  lift = 2.2,
  out: ScreenPoint = { x: 0, y: 0, visible: false },
): ScreenPoint | null {
  const at = anchorOrPlayer(anchor);
  if (!at || !projector) return null;
  return projector(at, lift, out) && out.visible ? out : null;
}

/**
 * Dev builds only: journey scripts on slow machines set `window.__feedbackHold` (ms) so toasts
 * stay up and effects slow down long enough to be captured. Always 0 in production.
 */
export function feedbackHold(): number {
  if (!import.meta.env.DEV) return 0;
  return (window as unknown as { __feedbackHold?: number }).__feedbackHold ?? 0;
}
