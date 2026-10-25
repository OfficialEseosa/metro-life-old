import { useEffect } from "react";
import { resumeCue } from "./sound";

/**
 * Tap feedback for every control: a soft click and a short vibration on touch devices.
 * Outcomes (results, money, social moments) are voiced by the feedback bus in `feedback.tsx`.
 */
export function useGameFeedback() {
  useEffect(() => {
    const tap = (e: PointerEvent) => {
      if (
        !(e.target instanceof Element) ||
        !e.target.closest("button,a,[role=button],summary")
      )
        return;
      resumeCue("tap");
      navigator.vibrate?.(8);
    };
    document.addEventListener("pointerdown", tap, { passive: true });
    return () => document.removeEventListener("pointerdown", tap);
  }, []);
}
