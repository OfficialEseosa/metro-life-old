import { streetRoute } from "../street-network";
import {
  canStand,
  homeLayoutRevision,
  inBox,
  inPolygon,
  interiors,
  navigation,
  roomLayout,
  roomType,
} from "../navigation";
import type { CityId } from "../api/types";

type Point = { x: number; z: number };
type Obstacle = { x: number; z: number; w: number; d: number; a: number };
type Boundary = { a: Point; b: Point };
type Node = { x: number; z: number; key: number; g: number; f: number };
type Survey = {
  areas: number[][][];
  components: number[];
  adjacent: number[][];
  minX: number;
  minZ: number;
  maxX: number;
  maxZ: number;
  boxes: Obstacle[];
  buckets: Map<string, Obstacle[]>;
  edges: Map<string, Boundary[]>;
};
const bucketSize = 8,
  surveys = new Map<string, Survey>(),
  directions = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ] as const;
const key = (x: number, z: number) => `${x}:${z}`;

class MinHeap {
  private rows: Node[] = [];
  get length() {
    return this.rows.length;
  }
  push(node: Node) {
    let i = this.rows.push(node) - 1;
    while (i) {
      const parent = (i - 1) >> 1;
      if (this.rows[parent].f <= node.f) break;
      this.rows[i] = this.rows[parent];
      i = parent;
    }
    this.rows[i] = node;
  }
  pop() {
    const first = this.rows[0],
      last = this.rows.pop()!;
    if (this.rows.length) {
      let i = 0;
      while (i * 2 + 1 < this.rows.length) {
        let child = i * 2 + 1;
        if (
          child + 1 < this.rows.length &&
          this.rows[child + 1].f < this.rows[child].f
        )
          child++;
        if (this.rows[child].f >= last.f) break;
        this.rows[i] = this.rows[child];
        i = child;
      }
      this.rows[i] = last;
    }
    return first;
  }
}
function survey(city: CityId, room: string | null): Survey | undefined {
  const type = roomType(room),
    id = room
      ? `${city}:${type}:${type === "home" ? homeLayoutRevision() : 0}`
      : city,
    cached = surveys.get(id);
  if (cached) return cached;
  if (room && (!type || !Object.hasOwn(interiors, type))) return;
  const boxes = room ? roomLayout(city, type!).boxes : navigation[city].boxes,
    bounds = room ? roomLayout(city, type!).bounds : undefined,
    extent = room
      ? bounds
        ? [bounds.w / 2 - 0.25, bounds.d / 2 - 0.25]
        : type === "home"
          ? [3.25, 2.75]
          : [5.5, 4.5]
      : undefined;
  const areas: number[][][] = room ? [] : [...navigation[city].land],
    land = navigation[city].land.flat(),
    xs = land.map((p) => p[0]),
    zs = land.map((p) => p[1]),
    s: Survey = {
      minX: extent ? -extent[0] : Math.min(...xs) - 1,
      maxX: extent ? extent[0] : Math.max(...xs) + 1,
      minZ: extent ? -extent[1] : Math.min(...zs) - 1,
      maxZ: extent ? extent[1] : Math.max(...zs) + 1,
      boxes,
      buckets: new Map(),
      edges: new Map(),
      areas,
      components: [],
      adjacent: [],
    };
  for (const b of boxes) {
    const c = Math.abs(Math.cos(b.a)),
      sn = Math.abs(Math.sin(b.a)),
      rx = (b.w / 2 + 0.301) * c + (b.d / 2 + 0.301) * sn,
      rz = (b.w / 2 + 0.301) * sn + (b.d / 2 + 0.301) * c;
    for (
      let x = Math.floor((b.x - rx) / bucketSize);
      x <= Math.floor((b.x + rx) / bucketSize);
      x++
    )
      for (
        let z = Math.floor((b.z - rz) / bucketSize);
        z <= Math.floor((b.z + rz) / bucketSize);
        z++
      ) {
        const k = key(x, z),
          rows = s.buckets.get(k);
        if (rows) rows.push(b);
        else s.buckets.set(k, [b]);
      }
  }
  if (!room) {
    const n = navigation[city],
      polygons = [...n.land, ...n.water];
    for (const bridge of n.bridges) {
      const c = Math.cos(bridge.a),
        sn = Math.sin(bridge.a),
        w = bridge.w / 2 - 0.35,
        d = bridge.d / 2 - 0.35;
      const polygon = [
        [-w, -d],
        [w, -d],
        [w, d],
        [-w, d],
      ].map(([x, z]) => [bridge.x + x * c + z * sn, bridge.z - x * sn + z * c]);
      polygons.push(polygon);
      areas.push(polygon);
    }
    for (const polygon of polygons)
      for (let i = 0; i < polygon.length; i++) {
        const a = polygon[i],
          b = polygon[(i + 1) % polygon.length],
          edge = { a: { x: a[0], z: a[1] }, b: { x: b[0], z: b[1] } };
        for (
          let x = Math.floor(Math.min(a[0], b[0]) / bucketSize);
          x <= Math.floor(Math.max(a[0], b[0]) / bucketSize);
          x++
        )
          for (
            let z = Math.floor(Math.min(a[1], b[1]) / bucketSize);
            z <= Math.floor(Math.max(a[1], b[1]) / bucketSize);
            z++
          ) {
            const k = key(x, z),
              rows = s.edges.get(k);
            if (rows) rows.push(edge);
            else s.edges.set(k, [edge]);
          }
      }
  }

  // A cheap region graph rejects separate islands/water gaps before a grid search.
  // Ignoring blockers/water here can only overestimate connectivity, never authorize an edge.
  s.components = areas.map((_, i) => i);
  s.adjacent = areas.map(() => []);
  const component = (i: number): number =>
    s.components[i] === i ? i : component(s.components[i]);
  for (let i = 0; i < areas.length; i++)
    for (let j = 0; j < i; j++)
      if (polygonsMeet(areas[i], areas[j])) {
        s.components[component(i)] = component(j);
        s.adjacent[i].push(j);
        s.adjacent[j].push(i);
      }
  s.components = s.components.map((_, i) => component(i));

  surveys.set(id, s);
  return s;
}
function polygonsMeet(a: number[][], b: number[][]) {
  if (
    a.some((p) => inPolygon(p[0], p[1], b)) ||
    b.some((p) => inPolygon(p[0], p[1], a))
  )
    return true;
  for (let i = 0; i < a.length; i++)
    for (let j = 0; j < b.length; j++) {
      const p = a[i],
        q = a[(i + 1) % a.length],
        u = b[j],
        v = b[(j + 1) % b.length],
        dx = q[0] - p[0],
        dz = q[1] - p[1],
        ex = v[0] - u[0],
        ez = v[1] - u[1],
        den = dx * ez - dz * ex;
      if (Math.abs(den) < 1e-10) continue;
      const ox = u[0] - p[0],
        oz = u[1] - p[1],
        t = (ox * ez - oz * ex) / den,
        w = (ox * dz - oz * dx) / den;
      if (t >= 0 && t <= 1 && w >= 0 && w <= 1) return true;
    }
  return false;
}
/** Strict intersection with the same rotated, radius-expanded rectangle used by canStand. */
function crossesBox(a: Point, b: Point, box: Obstacle) {
  const c = Math.cos(box.a),
    s = Math.sin(box.a),
    ax = (a.x - box.x) * c - (a.z - box.z) * s,
    az = (a.x - box.x) * s + (a.z - box.z) * c,
    bx = (b.x - box.x) * c - (b.z - box.z) * s,
    bz = (b.x - box.x) * s + (b.z - box.z) * c;
  let lo = 0,
    hi = 1;
  for (const [at, delta, extent] of [
    [ax, bx - ax, box.w / 2 + 0.301],
    [az, bz - az, box.d / 2 + 0.301],
  ]) {
    if (Math.abs(delta) < 1e-10) {
      if (Math.abs(at) >= extent - 1e-9) return false;
      continue;
    }
    let from = (-extent - at) / delta,
      to = (extent - at) / delta;
    if (from > to) [from, to] = [to, from];
    lo = Math.max(lo, from);
    hi = Math.min(hi, to);
    if (hi - lo <= 1e-9) return false;
  }
  return hi > 0 && lo < 1;
}

/** Exact goals only: invalid clicks, disconnected land or a bounded-out search return [].
 * Paths omit the start. Every edge is sampled at <=.125m and checked analytically
 * against rotated furniture/building boxes; the final result is rechecked by canStand.
 */
export function navigationRoute(
  city: CityId,
  room: string | null,
  start: Point,
  end: Point,
): Point[] {
  const deadline = performance.now() + 480;
  if (!room && Math.hypot(start.x - end.x, start.z - end.z) > 16) {
    const shared = streetRoute(city, start, end);
    if (shared.length > 1) {
      const first = route(city, null, start, shared[0], deadline),
        last = route(city, null, shared[shared.length - 1], end, deadline);
      if (first.length && last.length)
        return [...first, ...shared.slice(1), ...last];
    }
  }
  return route(city, room, start, end, deadline);
}
function route(
  city: CityId,
  room: string | null,
  start: Point,
  end: Point,
  overallDeadline: number,
): Point[] {
  if (![start.x, start.z, end.x, end.z].every(Number.isFinite)) return [];
  const s = survey(city, room);
  if (
    !s ||
    !canStand(city, start.x, start.z, room) ||
    !canStand(city, end.x, end.z, room)
  )
    return [];
  if (!room) {
    const from = s.areas.flatMap((p, i) =>
        inPolygon(start.x, start.z, p) ? [i] : [],
      ),
      to = s.areas.flatMap((p, i) => (inPolygon(end.x, end.z, p) ? [i] : []));
    if (
      from.length &&
      to.length &&
      !from.some((i) => to.some((j) => s.components[i] === s.components[j]))
    )
      return [];
    if (from.length && to.length && !from.some((i) => to.includes(i))) {
      const queue = [...from],
        parents = new Map<number, number | null>(from.map((i) => [i, null]));
      let target: number | undefined;
      for (let at = 0; at < queue.length; at++) {
        const i = queue[at];
        if (to.includes(i)) {
          target = i;
          break;
        }
        for (const next of s.adjacent[i])
          if (!parents.has(next)) {
            parents.set(next, i);
            queue.push(next);
          }
      }
      const areas: number[] = [];
      while (target !== undefined) {
        areas.unshift(target);
        target = parents.get(target) ?? undefined;
      }
      const centres = areas
        .filter((i) => i >= navigation[city].land.length)
        .map((i) => {
          const p = s.areas[i];
          return {
            x: p.reduce((sum, q) => sum + q[0], 0) / p.length,
            z: p.reduce((sum, q) => sum + q[1], 0) / p.length,
          };
        })
        .filter(
          (p) =>
            Math.hypot(p.x - start.x, p.z - start.z) > 1 &&
            Math.hypot(p.x - end.x, p.z - end.z) > 1,
        );
      if (centres.length) {
        const result: Point[] = [];
        let previous = start;
        for (const goal of [...centres, end]) {
          if (performance.now() > overallDeadline) return [];
          const part = route(city, null, previous, goal, overallDeadline);
          if (!part.length) return [];
          result.push(...part);
          previous = goal;
        }
        return result;
      }
    }
  }

  const started = performance.now(),
    deadline = Math.min(started + (room ? 120 : 220), overallDeadline - 15),
    step = room ? 0.25 : 0.6,
    maxNodes = room ? 40000 : 50000,
    navigationCity = navigation[city];
  const stand = (x: number, z: number) => {
    if (x <= s.minX || x >= s.maxX || z <= s.minZ || z >= s.maxZ) return false;
    const boxes = s.buckets.get(
      key(Math.floor(x / bucketSize), Math.floor(z / bucketSize)),
    );
    if (boxes?.some((b) => inBox(x, z, b))) return false;
    if (room) return canStand(city, x, z, room);
    return (
      (navigationCity.land.some((p) => inPolygon(x, z, p)) ||
        navigationCity.bridges.some((b) => inBox(x, z, b, -0.35))) &&
      !navigationCity.water.some((p) => inPolygon(x, z, p))
    );
  };
  const clear = (a: Point, b: Point, authority = false) => {
    const seen = new Set<Obstacle>(),
      seenEdges = new Set<Boundary>(),
      cuts = [0, 1],
      dx = b.x - a.x,
      dz = b.z - a.z;
    for (
      let x = Math.floor(Math.min(a.x, b.x) / bucketSize);
      x <= Math.floor(Math.max(a.x, b.x) / bucketSize);
      x++
    )
      for (
        let z = Math.floor(Math.min(a.z, b.z) / bucketSize);
        z <= Math.floor(Math.max(a.z, b.z) / bucketSize);
        z++
      ) {
        const bucket = key(x, z);
        for (const box of s.buckets.get(bucket) ?? []) {
          if (seen.has(box)) continue;
          seen.add(box);
          if (crossesBox(a, b, box)) return false;
        }
        for (const edge of s.edges.get(bucket) ?? []) {
          if (seenEdges.has(edge)) continue;
          seenEdges.add(edge);
          const ex = edge.b.x - edge.a.x,
            ez = edge.b.z - edge.a.z,
            den = dx * ez - dz * ex;
          if (Math.abs(den) < 1e-10) continue;
          const ox = edge.a.x - a.x,
            oz = edge.a.z - a.z,
            t = (ox * ez - oz * ex) / den,
            u = (ox * dz - oz * dx) / den;
          if (t > 0 && t < 1 && u >= 0 && u <= 1) cuts.push(t);
        }
      }
    const test = (t: number) =>
      authority
        ? canStand(city, a.x + dx * t, a.z + dz * t, room)
        : stand(a.x + dx * t, a.z + dz * t);
    // Water/land/bridge boundary crossings divide the edge into constant-validity intervals.
    cuts.sort((x, y) => x - y);
    for (let i = 1; i < cuts.length; i++)
      if (cuts[i] - cuts[i - 1] > 1e-10 && !test((cuts[i] + cuts[i - 1]) / 2))
        return false;
    const count = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.125));
    for (let i = 1; i <= count; i++) if (!test(i / count)) return false;
    return true;
  };
  if (clear(start, end, true)) return [{ ...end }];
  const minX = Math.floor((s.minX - start.x) / step),
    minZ = Math.floor((s.minZ - start.z) / step),
    width = Math.ceil((s.maxX - start.x) / step) - minX + 1,
    height = Math.ceil((s.maxZ - start.z) / step) - minZ + 1;
  const nodeKey = (x: number, z: number) => x - minX + (z - minZ) * width,
    point = (x: number, z: number) => ({
      x: start.x + x * step,
      z: start.z + z * step,
    }),
    decode = (k: number) =>
      point((k % width) + minX, Math.floor(k / width) + minZ),
    heuristic = (x: number, z: number) =>
      Math.hypot(start.x + x * step - end.x, start.z + z * step - end.z);
  const open = new MinHeap(),
    first = nodeKey(0, 0),
    cost = new Map([[first, 0]]),
    parents = new Map<number, number>(),
    visited = new Set<number>();
  open.push({ x: 0, z: 0, key: first, g: 0, f: heuristic(0, 0) * 1.5 });
  let found: Node | undefined;
  for (let expanded = 0; open.length && expanded < maxNodes;) {
    const node = open.pop();
    if (node.g !== cost.get(node.key) || visited.has(node.key)) continue;
    visited.add(node.key);
    if ((++expanded & 127) === 0 && performance.now() > deadline) return [];
    const at = point(node.x, node.z);
    if (heuristic(node.x, node.z) <= step * 1.5 && clear(at, end)) {
      found = node;
      break;
    }
    for (const [dx, dz] of directions) {
      const x = node.x + dx,
        z = node.z + dz,
        k = nodeKey(x, z);
      if (
        k < 0 ||
        k >= width * height ||
        x < minX ||
        x >= minX + width ||
        z < minZ ||
        z >= minZ + height ||
        visited.has(k)
      )
        continue;
      const g = node.g + step * (dx && dz ? Math.SQRT2 : 1);
      if (g >= (cost.get(k) ?? Infinity)) continue;
      const next = point(x, z);
      if (!clear(at, next)) continue;
      cost.set(k, g);
      parents.set(k, node.key);
      open.push({ x, z, key: k, g, f: g + heuristic(x, z) * 1.5 });
    }
  }
  if (!found) return [];
  const raw: Point[] = [{ ...end }];
  let current: number | undefined = found.key;
  while (current !== undefined) {
    raw.push(decode(current));
    current = parents.get(current);
  }
  raw.reverse();
  // Exponential lookahead/binary refinement avoids quadratic smoothing along a long street.
  const path: Point[] = [];
  let anchor = 0;
  while (anchor < raw.length - 1) {
    if (performance.now() > deadline + 15) return [];
    let far = anchor + 1;
    if (clear(raw[anchor], raw[raw.length - 1])) far = raw.length - 1;
    else {
      let stride = 2;
      while (
        anchor + stride < raw.length &&
        clear(raw[anchor], raw[anchor + stride])
      ) {
        far = anchor + stride;
        stride *= 2;
      }
      let low = far + 1,
        high = Math.min(raw.length - 1, anchor + stride);
      while (low <= high) {
        const mid = (low + high) >> 1;
        if (clear(raw[anchor], raw[mid])) {
          far = mid;
          low = mid + 1;
        } else high = mid - 1;
      }
    }
    path.push(raw[far]);
    anchor = far;
  }
  let previous = start;
  for (const p of path) {
    if (!clear(previous, p, true)) return [];
    previous = p;
  }
  return path;
}
