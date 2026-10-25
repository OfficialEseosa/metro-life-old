import network from "./shared-data/streets.json";
import type { CityId } from "./api/types";
export type StreetGraph = {
  nodes: number[][];
  links: number[][];
  edges: number[][];
  plazas: number[];
  access: Record<string, { node: number; points: number[][] }>;
  width: number;
};
export const streets = network.cities as Record<CityId, StreetGraph>;
/** Shared corridors underpin pedestrian routing, resident routines, paving and moving cars. */
export function streetRoute(
  city: CityId,
  start: { x: number; z: number },
  end: { x: number; z: number },
) {
  const graph = streets[city],
    nearest = (p: typeof start) =>
      graph.nodes.reduce(
        (best, n, i) =>
          graph.links[i].length && Math.hypot(n[0] - p.x, n[2] - p.z) < best.d
            ? { i, d: Math.hypot(n[0] - p.x, n[2] - p.z) }
            : best,
        { i: -1, d: Infinity },
      ),
    a = nearest(start),
    b = nearest(end);
  if (a.i < 0 || b.i < 0 || a.d > 18 || b.d > 18) return [];
  const queue = [a.i],
    parents = new Map<number, number | null>([[a.i, null]]);
  for (let at = 0; at < queue.length; at++) {
    const id = queue[at];
    if (id === b.i) break;
    for (const next of graph.links[id])
      if (!parents.has(next)) {
        parents.set(next, id);
        queue.push(next);
      }
  }
  if (!parents.has(b.i)) return [];
  const points: { x: number; z: number }[] = [];
  let id: number | null = b.i;
  while (id !== null) {
    points.unshift({ x: graph.nodes[id][0], z: graph.nodes[id][2] });
    id = parents.get(id) ?? null;
  }
  return points.filter(
    (p, i) =>
      i === 0 ||
      i === points.length - 1 ||
      (p.x - points[i - 1].x) * (points[i + 1].z - p.z) !==
        (p.z - points[i - 1].z) * (points[i + 1].x - p.x),
  );
}
