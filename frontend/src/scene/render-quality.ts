import { create } from "zustand";
import { useStore } from "../store";

/**
 * Adaptive downgrade lives here for this session only. The saved preference in
 * the main store is changed only by the player in Settings.
 */
export const useRenderQuality = create<{ autoLow: boolean }>(() => ({
  autoLow: false,
}));
export function useEffectiveQuality(): "normal" | "low" {
  const preference = useStore((s) => s.sceneQuality),
    autoLow = useRenderQuality((s) => s.autoLow);
  return preference === "low" || autoLow ? "low" : "normal";
}
