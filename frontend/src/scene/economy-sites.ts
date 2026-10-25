import type { CityId } from "../api/types";
import { sitesFor } from "./cities";
import { nycLand, nycEast } from "./cities/nyc";
import { bayWest, bayEast } from "./cities/bay";
export const plotSite = (city: CityId) =>
  city === "atl"
    ? { x: -65, z: 65, size: 38, height: 1 }
    : city === "nyc"
      ? { x: 43, z: -13, size: 30, height: 1 }
      : { x: 64, z: 73, size: 38, height: 1 };
function inside(x: number, z: number, poly: number[][]) {
  let yes = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i],
      b = poly[j];
    if (
      a[1] > z !== b[1] > z &&
      x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0]
    )
      yes = !yes;
  }
  return yes;
}
const cache: Partial<
  Record<CityId, { x: number; z: number; size: number; height: number }[]>
> = {};
export function boardSites(city: CityId, count: number) {
  if (!cache[city]) {
    const sites = Object.values(sitesFor(city)),
      polys = city === "nyc" ? [nycLand, nycEast] : [bayWest, bayEast],
      points: { x: number; z: number; size: number; height: number }[] = [];
    // Street-side spacing and landmark clearance keep ads in the neighbourhoods.
    const step = city === "atl" ? 20 : 16;
    for (let z = -70; z <= 110; z += step)
      for (let x = -76; x <= 108; x += step) {
        const px = x + 4,
          pz = z + 4;
        if (
          city === "atl"
            ? Math.abs(px) > 74 || pz > 64
            : !polys.some((poly) => inside(px, pz, poly))
        )
          continue;
        if (
          !outsidePlots(city, px, pz, 4) ||
          sites.some((s) => Math.hypot(px - s.x, pz - s.z) < s.size * 0.65 + 5)
        )
          continue;
        points.push({ x: px, z: pz, size: 4, height: 4 });
      }
    cache[city] = points;
  }
  const points = cache[city]!;
  return Array.from(
    { length: count },
    (_, i) => points[Math.floor((i * points.length) / count)],
  );
}
export function outsidePlots(city: CityId, x: number, z: number, pad = 0) {
  const site = plotSite(city),
    height = site.size * (city === "atl" ? 28 / 48 : 30 / 56);
  return (
    Math.abs(x - site.x) > site.size / 2 + pad ||
    Math.abs(z - site.z) > height / 2 + pad
  );
}
export function outsideBoards(city: CityId, x: number, z: number, pad = 0) {
  return boardSites(city, city === "atl" ? 20 : city === "nyc" ? 24 : 22).every(
    (s) => Math.abs(x - s.x) > 2.2 + pad || Math.abs(z - s.z) > 1 + pad,
  );
}
