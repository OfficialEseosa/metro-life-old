import { canStand } from "../navigation";
import type { CityId } from "../api/types";
type Point = { x: number; z: number };
/** Small indoor grid; test every edge so a diagonal never cuts a furniture corner. */
export function activityRoute(
  city: CityId,
  room: string,
  start: Point,
  end: Point,
): Point[] {
  const clear = (a: Point, b: Point) => {
    const count = Math.max(
      1,
      Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.12),
    );
    for (let i = 1; i <= count; i++)
      if (
        !canStand(
          city,
          a.x + ((b.x - a.x) * i) / count,
          a.z + ((b.z - a.z) * i) / count,
          room,
        )
      )
        return false;
    return true;
  };
  if (clear(start, end)) return [end];
  const step = 0.25,
    key = (x: number, z: number) => `${x}:${z}`,
    point = (x: number, z: number) => ({
      x: start.x + x * step,
      z: start.z + z * step,
    }),
    heuristic = (x: number, z: number) => {
      const p = point(x, z);
      return Math.hypot(p.x - end.x, p.z - end.z);
    },
    open = [{ x: 0, z: 0, g: 0, f: heuristic(0, 0) }],
    cost = new Map([[key(0, 0), 0]]),
    parents = new Map<string, { x: number; z: number }>();
  let found: { x: number; z: number } | undefined;
  for (let i = 0; open.length && i < 3000; i++) {
    open.sort((a, b) => b.f - a.f);
    const node = open.pop()!,
      at = point(node.x, node.z);
    if (heuristic(node.x, node.z) < 0.4 && clear(at, end)) {
      found = node;
      break;
    }
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const x = node.x + dx,
        z = node.z + dz,
        k = key(x, z),
        next = point(x, z),
        g = node.g + step;
      if (g >= (cost.get(k) ?? Infinity) || !clear(at, next)) continue;
      cost.set(k, g);
      parents.set(k, node);
      open.push({ x, z, g, f: g + heuristic(x, z) });
    }
  }
  if (!found) return [];
  const result: Point[] = [end];
  while (found) {
    result.unshift(point(found.x, found.z));
    found = parents.get(key(found.x, found.z));
  }
  return result.slice(1);
}
