import { create } from "zustand";

/** HUD-only intentions shared between cues, the vitals plate and panels. */
export const useHudUi = create<{
  /** a workplace id the Career panel should bring forward when it opens */
  jobFocus: string;
  /** the quick sheet open under the vitals plate */
  sheet: "" | "money" | "clock";
}>(() => ({ jobFocus: "", sheet: "" }));
