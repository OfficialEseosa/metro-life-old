import metrics from "../shared-data/model-metrics.json";
import type { Placement } from "./fabric";

export const METRES = {
  person: 1.78,
  door: 2.1,
  storey: 3,
  counter: 0.9,
  desk: 0.75,
  seat: 0.45,
  bed: [2, 1.5],
  lane: 3.2,
  sidewalk: 2,
  curb: 0.15,
  lamp: 5.5,
  tree: 8,
} as const;
export const KAYKIT_SCALE = 3 / 0.7; // The authored floor repeat is 0.7 units.
export function modelMetrics(url: string) {
  return (
    metrics as Record<
      string,
      { min: number[]; size: number[]; triangles: number }
    >
  )[url.replace(/^\/models\//, "")];
}
/** Keep authored proportions; dimensions also feed the collision generator. */
export function metricPlacement(
  url: string,
  p: Placement,
  factor?: number,
): Placement {
  const m = modelMetrics(url);
  if (!m) throw Error("Missing asset measurement: " + url);
  const scale =
    factor ??
    (/(?:vehicles|streets)\//.test(url)
      ? 1
      : /building/.test(url)
        ? KAYKIT_SCALE
        : /streetlight/.test(url)
          ? METRES.lamp / m.size[1]
          : /tree-/.test(url)
            ? METRES.tree / m.size[1]
            : /car[_/]/.test(url)
              ? 4.4 / m.size[2]
              : /road_/.test(url)
                ? METRES.lane
                : 1);
  return {
    ...p,
    scale,
    sx: m.size[0] * scale,
    sy: m.size[1] * scale,
    sz: m.size[2] * scale,
  };
}
