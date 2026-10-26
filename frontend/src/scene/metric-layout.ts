import type { CityId } from "../api/types";
import type { Placement } from "./fabric";
import nav from "../shared-data/navigation.json";
import { metricPlacement, METRES, KAYKIT_SCALE } from "./world-scale";
import { outsidePlots, outsideBoards } from "./economy-sites";
import { homeSitesFor } from "./cities";

function inside(x: number, z: number, p: number[][]) {
  let yes = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const a = p[i],
      b = p[j];
    if (
      a[1] > z !== b[1] > z &&
      x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0]
    )
      yes = !yes;
  }
  return yes;
}
function contains(
  x: number,
  z: number,
  b: { x: number; z: number; w: number; d: number; a?: number },
  pad: number,
) {
  const dx = x - b.x,
    dz = z - b.z,
    c = Math.cos(b.a ?? 0),
    s = Math.sin(b.a ?? 0);
  return (
    Math.abs(dx * c - dz * s) < b.w / 2 + pad &&
    Math.abs(dx * s + dz * c) < b.d / 2 + pad
  );
}
/** Metre-sized baseline streets/lots. V6 replaces tiled surfaces with a junction mesh. */
export function fitMetricGroups(
  city: CityId,
  input: Record<string, Placement[]>,
  height: (x: number, z: number) => number = () => 0,
) {
  const n = nav.cities[city],
    land = (x: number, z: number) => n.land.some((p) => inside(x, z, p)),
    heroes = n.boxes.filter((b) => "id" in b),
    homes = homeSitesFor(city).map((s) => ({
      x: s.x,
      z: s.z + 2,
      w: 8,
      d: 10,
    })),
    reserved = (x: number, z: number, pad: number) =>
      heroes.some((b) => contains(x, z, b, pad)) ||
      homes.some((b) => contains(x, z, b, pad)) ||
      !outsidePlots(city, x, z, pad) ||
      !outsideBoards(city, x, z, pad),
    result: Record<string, Placement[]> = {},
    roads: Placement[] = [],
    taken: Placement[] = [];
  const pitch = city === "atl" ? 38.4 : city === "nyc" ? 25.6 : 32,
    tile = 6.4,
    start = -96;
  const road = (x: number, z: number, angle: number) => {
    if (
      ![-1, 1].every((a) =>
        [-1, 1].every((b) => land(x + a * 3.2, z + b * 3.2)),
      ) ||
      reserved(x, z, 5.3) ||
      n.water.some((p) => inside(x, z, p))
    )
      return;
    const dy =
      height(x + Math.sin(angle) * 3.2, z + Math.cos(angle) * 3.2) -
      height(x - Math.sin(angle) * 3.2, z - Math.cos(angle) * 3.2);
    roads.push(
      metricPlacement("streets/road_straight.glb", {
        x,
        z,
        y: height(x, z) - 0.08,
        sx: 1,
        sy: 1,
        sz: 1,
        angle,
        pitch: -Math.atan2(dy, 6.4),
        color: "#ffffff",
      }),
    );
  };
  for (let a = -3; a <= 3; a++)
    for (let i = 0; i < 33; i++) {
      const t = start + i * tile;
      road(a * pitch, t, 0);
      if (Math.abs(t / pitch - Math.round(t / pitch)) > 0.01)
        road(t, a * pitch, Math.PI / 2);
    }
  result["streets/road_straight.glb"] = roads;
  for (const [url, ps] of Object.entries(input)) {
    if (/road_|streetlight|car_/.test(url)) continue;
    if (/building|painted-row/.test(url))
      for (const p of ps) {
        const radius = Math.hypot(p.sx, p.sz) / 2;
        if (
          reserved(p.x, p.z, radius) ||
          ![-1, 1].every((a) =>
            [-1, 1].every((b) =>
              land(p.x + (a * p.sx) / 2, p.z + (b * p.sz) / 2),
            ),
          ) ||
          n.water.some((w) => inside(p.x, p.z, w)) ||
          roads.some(
            (r) =>
              Math.abs(r.x - p.x) < (p.sx + 6.4) / 2 + METRES.sidewalk &&
              Math.abs(r.z - p.z) < (p.sz + 6.4) / 2 + METRES.sidewalk,
          ) ||
          taken.some(
            (q) =>
              Math.abs(q.x - p.x) < (q.sx + p.sx) / 2 + 0.5 &&
              Math.abs(q.z - p.z) < (q.sz + p.sz) / 2 + 0.5,
          )
        )
          continue;
        (result[url] ??= []).push(p);
        taken.push(p);
      }
    else
      result[url] = ps.filter(
        (p) =>
          !taken.some(
            (q) =>
              Math.hypot(q.x - p.x, q.z - p.z) < Math.hypot(q.sx, q.sz) / 2 + 1,
          ),
      );
  }
  const doors = Object.values(n.doors);
  result["kaykit/streetlight.gltf"] = roads
    .filter((_, i) => i % 5 === 0)
    .map((p) =>
      metricPlacement("kaykit/streetlight.gltf", {
        ...p,
        x: p.x + Math.cos(p.angle) * 4.5,
        z: p.z - Math.sin(p.angle) * 4.5,
        y: height(p.x, p.z),
        angle: p.angle + Math.PI / 2,
        pitch: 0,
      }),
    )
    // A lamp post in the street camera's view at a door cuts through its sign.
    .filter(
      (p) =>
        !reserved(p.x, p.z, 0.5) &&
        !doors.some(
          (d) => Math.abs(p.x - d.x) < 3.5 && p.z - d.z > -1 && p.z - d.z < 15,
        ),
    );
  // Street dressing between the lamps: a bench, a planter or bush and a hydrant
  // per stretch of sidewalk, on the kerb side so the walking lane stays clear.
  const dressing: [string, number, number, number][] = [
    // url, metric factor, road tile index modulo 5, lateral offset
    ["kaykit/bench.gltf", KAYKIT_SCALE, 2, 4.6],
    ["world/suburban/planter.glb", 4.2, 3, -4.6],
    ["kaykit/firehydrant.gltf", KAYKIT_SCALE * 0.8, 4, 4.3],
    ["kaykit/bush.gltf", KAYKIT_SCALE * 1.5, 1, -4.7],
  ];
  roads.forEach((p, i) => {
    for (const [url, factor, slot, lateral] of dressing) {
      if (i % 5 !== slot) continue;
      const x = p.x + Math.cos(p.angle) * lateral,
        z = p.z - Math.sin(p.angle) * lateral;
      if (
        reserved(x, z, 1.2) ||
        !land(x, z) ||
        taken.some(
          (q) =>
            Math.abs(q.x - x) < q.sx / 2 + 0.8 &&
            Math.abs(q.z - z) < q.sz / 2 + 0.8,
        )
      )
        continue;
      (result[url] ??= []).push(
        metricPlacement(
          url,
          {
            ...p,
            x,
            z,
            y: height(x, z),
            // Benches face the street.
            angle: p.angle + (lateral > 0 ? -Math.PI / 2 : Math.PI / 2),
            pitch: 0,
          },
          factor,
        ),
      );
    }
  });
  return result;
}
