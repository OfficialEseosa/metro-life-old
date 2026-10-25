/**
 * Feedback bus: one typed stream of player-facing outcomes. Flows emit; toasts, sounds and
 * in-world effects subscribe. Emitting never throws and never waits on a listener.
 */

export type FeedbackKind =
  | "actionStart"
  | "actionDone"
  | "cancel"
  | "error"
  | "social"
  | "socialReceived"
  | "purchase"
  | "levelUp"
  | "promotion"
  | "rent"
  | "arrival"
  | "travel"
  | "goal"
  | "milestone"
  | "chat"
  /** City event moments; `data.stage` is "find", "join", "progress" or "ready". */
  | "event";

/** A world position in scene units (same space as `Position.x/z`). */
export type FeedbackAnchor = { x: number; y?: number; z: number };

export type FeedbackEvent = {
  kind: FeedbackKind;
  /** Short line a toast can show as-is. */
  title: string;
  /** Optional second line. */
  detail?: string;
  /** Signed money change in dollars (negative = spent), or a count for goal/levelUp. */
  amount?: number;
  /** Where in the world it happened, when known. */
  anchor?: FeedbackAnchor;
  /** Client epoch ms when the event was emitted (`Date.now()`). */
  at: number;
  /** Extra machine-readable context (action id, social kind, user id...). */
  data?: Record<string, string | number | boolean | null>;
};

export type FeedbackInput = Omit<FeedbackEvent, "at"> & { at?: number };
export type FeedbackListener = (event: FeedbackEvent) => void;

const listeners = new Set<FeedbackListener>();

/** Publish an outcome to every listener. */
export function emitFeedback(input: FeedbackInput): FeedbackEvent {
  const event: FeedbackEvent = { ...input, at: input.at ?? Date.now() };
  for (const listener of [...listeners]) {
    try {
      listener(event);
    } catch (error) {
      console.error("Feedback listener failed", error);
    }
  }
  return event;
}

/** Subscribe to every outcome. Returns the unsubscribe function (suitable as a useEffect cleanup). */
export function onFeedback(listener: FeedbackListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
