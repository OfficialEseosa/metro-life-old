import type { CityId } from "../../api/types";
import { atlSites } from "./atl";
import { nycSites } from "./nyc";
import { baySites } from "./bay";
import type { Sim } from "../../api/types";
export const citySites = { atl: atlSites, nyc: nycSites, bay: baySites };
export const sitesFor = (city: CityId) => citySites[city];
const neighborhoods: Record<CityId, Record<string, [number, number]>> = {
  atl: {
    midtown: [-22, -63],
    buckhead: [15, -76],
    o4w: [47, -32],
    eastAtlanta: [58, 30],
    westEnd: [-49, 40],
    decatur: [65, -35],
  },
  nyc: {
    harlem: [-7, -73],
    uws: [-40, -46],
    soho: [-28, 19],
    williamsburg: [63, 0],
    bedstuy: [80, 12],
    astoria: [48, -20],
  },
  bay: {
    mission: [-35, 40],
    soma: [-12, 23],
    sunset: [-78, 10],
    oakland: [86, 17],
    berkeley: [94, -30],
    paloAlto: [15, 95],
  },
};
export const homeSitesFor = (city: CityId) =>
  Object.values(neighborhoods[city]).map(([x, z]) => ({ x, z }));
export const outsideHomes = (city: CityId, x: number, z: number, pad = 0) =>
  homeSitesFor(city).every(
    (s) => Math.abs(x - s.x) > 5 + pad || Math.abs(z - s.z) > 5 + pad,
  );
export function homeSite(city: CityId, home: Sim["home"] | undefined) {
  if (!home || home.city !== city) return null;
  const [x, z] = neighborhoods[city][home.neighborhood] ?? [0, 0];
  return { x, z, size: 6, height: 4 };
}
