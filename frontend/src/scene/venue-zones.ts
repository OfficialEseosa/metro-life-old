import { roomLayout, roomType, type RoomLayout } from "../navigation";
import type { CityId } from "../api/types";

export type VenueZone = {
  id: string;
  name: string;
  x: number;
  z: number;
  w: number;
  d: number;
  ambient: string;
  hero?: boolean;
  y?: number;
};
export function venueZones(layout: RoomLayout) {
  return (layout as RoomLayout & { zones?: VenueZone[] }).zones ?? [];
}
/** Smallest matching zone wins at a threshold, so a quiet nook has its own ambience. */
export function venueZoneAt(
  city: CityId,
  room: string | null | undefined,
  x: number,
  z: number,
) {
  const type = roomType(room);
  if (!type) return null;
  return (
    venueZones(roomLayout(city, type))
      .filter(
        (zone) =>
          Math.abs(x - zone.x) <= zone.w / 2 &&
          Math.abs(z - zone.z) <= zone.d / 2,
      )
      .sort((a, b) => a.w * a.d - b.w * b.d)[0] ?? null
  );
}
/** Stable zone identity for the audio scene; accepts a room ID or a template name. */
export function roomZone(city: CityId, type: string, x: number, z: number) {
  return (
    venueZoneAt(city, type.includes(":") ? type : type + ":venue", x, z)?.id ??
    "main"
  );
}
export function roomFloorHeight(
  _city: CityId,
  type: string,
  x: number,
  z: number,
) {
  if (type === "foodhall" && x > 1 && x < 21) {
    if (z < -5.5) return 3;
    if (x > 2 && x < 8 && z < -3.5)
      return Math.min(3, Math.max(0, (-z - 3.5) * 1.5));
  }
  if (type === "theatre" && Math.abs(x) < 5.5 && z > -4.5 && z < 3)
    return Math.max(0, Math.min(1.02, ((z + 4) * 0.17) / 1.2));
  if (["stadium", "arena", "ballpark"].includes(type)) {
    if (z > 5 && Math.abs(x) < 3.5) return 0;
    const rx = type === "arena" ? 15.8 : 22.2,
      rz = type === "arena" ? 10.8 : 16.5,
      r = Math.hypot(x / rx, (z + 3) / rz);
    return Math.max(
      0,
      Math.min(type === "arena" ? 7 : 10, (r - 1) * (rx + rz) * 0.4),
    );
  }
  return 0;
}
