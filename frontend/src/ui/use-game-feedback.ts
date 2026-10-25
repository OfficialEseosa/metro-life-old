import { useEffect } from "react";
import { resumeCue } from "./sound";
import { emitFeedback } from "../feedback";
import { useStore } from "../store";
import { venueName } from "../content-names";
import { sitesFor } from "../scene/cities";
import { useSocialLife, type CityEvent } from "./social-life";

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
  useEventFeedback();
}

const eventData = (event: CityEvent, stage: string) => ({
  stage,
  loc: event.loc,
  progress: event.progress,
  target: event.target,
});

/** The city event's "Find it", "Join in" and every shared moment answer on the feedback bus. */
function useEventFeedback() {
  useEffect(() => {
    const find = (e: MouseEvent) => {
      const event = useSocialLife.getState().event;
      if (
        !event ||
        !(e.target instanceof Element) ||
        !e.target.closest(".event-find")
      )
        return;
      const site = sitesFor(event.city)?.[event.loc];
      emitFeedback({
        kind: "event",
        title: event.name,
        detail: `Heading to ${venueName(event.loc, event.loc)}`,
        anchor:
          site && useStore.getState().city === event.city
            ? { x: site.x, z: site.z }
            : undefined,
        data: eventData(event, "find"),
      });
    };
    document.addEventListener("click", find);
    const off = useSocialLife.subscribe((next, previous) => {
      const now = next.event,
        before = previous.event;
      if (!now || !before || now.id !== before.id || !now.active) return;
      if (now.joined && !before.joined)
        emitFeedback({
          kind: "event",
          title: now.name,
          detail: "Dance, wave or cheer there to add moments",
          data: eventData(now, "join"),
        });
      if (now.progress > before.progress)
        emitFeedback({
          kind: "event",
          title: now.name,
          detail: `${now.progress} of ${now.target} shared moments`,
          data: eventData(
            now,
            now.progress >= now.target && before.progress < now.target
              ? "ready"
              : "progress",
          ),
        });
    });
    return () => {
      document.removeEventListener("click", find);
      off();
    };
  }, []);
}
