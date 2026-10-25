import type { RoomLayout } from "../navigation";
import type { Prop } from "./kaykit-props";

/**
 * Visual-only dressing for public rooms. Every piece keeps clear of collision
 * boxes, use points and the door corridor, so walking and stations are unchanged.
 */
type Spot = { x: number; z: number; r: number };
function clearance(layout: RoomLayout) {
  const boxes = (layout as RoomLayout & {
      boxes?: { x: number; z: number; w: number; d: number }[];
    }).boxes ?? layout.furniture,
    stations = layout.stations,
    exit = layout.exit ?? { x: 0, z: (layout.bounds?.d ?? 10) / 2 },
    hw = (layout.bounds?.w ?? 12) / 2,
    hd = (layout.bounds?.d ?? 10) / 2;
  return (s: Spot) =>
    Math.abs(s.x) <= hw - 0.35 - s.r &&
    Math.abs(s.z) <= hd - 0.35 - s.r &&
    boxes.every(
      (b) =>
        Math.abs(s.x - b.x) > b.w / 2 + s.r + 0.7 ||
        Math.abs(s.z - b.z) > b.d / 2 + s.r + 0.7,
    ) &&
    stations.every((st) => Math.hypot(st.x - s.x, st.z - s.z) > s.r + 1.3) &&
    // Keep the walk from the door to the middle of the room free.
    !(Math.abs(s.x - exit.x) < 2.4 + s.r && s.z > -2);
}

export function venueDecor(type: string, layout: RoomLayout): Prop[] {
  const out: Prop[] = [],
    ok = clearance(layout),
    hw = (layout.bounds?.w ?? 12) / 2,
    hd = (layout.bounds?.d ?? 10) / 2;
  const add = (p: Prop, r = 0.6) => {
    if (ok({ x: p.x, z: p.z, r })) out.push(p);
  };
  const plant = (x: number, z: number, big = true) =>
    add(
      {
        pack: "furniture",
        name: big ? "cactus_medium_A" : "cactus_small_A",
        x,
        z,
        ry: x * 1.7,
        s: big ? 1.15 : 1.3,
      },
      0.5,
    );
  const roundSet = (x: number, z: number) => {
    if (!ok({ x, z, r: 1.4 })) return;
    out.push(
      { pack: "restaurant", name: "table_round_A_small_decorated", x, z, s: 0.62 },
      { pack: "restaurant", name: "chair_A", x: x - 0.95, z, ry: Math.PI / 2, s: 0.68 },
      { pack: "restaurant", name: "chair_A", x: x + 0.95, z, ry: -Math.PI / 2, s: 0.68 },
    );
  };
  // A row of seats spread perpendicular to the way they face.
  const seatRow = (x: number, z: number, count: number, ry = 0) => {
    const ax = Math.abs(Math.cos(ry)),
      az = Math.abs(Math.sin(ry));
    for (let i = 0; i < count; i++) {
      const t = (i - (count - 1) / 2) * 0.62;
      add({ pack: "furniture", name: "chair_C", x: x + t * ax, z: z + t * az, ry, s: 0.62 }, 0.35);
    }
  };
  if (type === "cafe" || type === "retail") {
    for (const x of [-4.6, -2.8, 2.8, 4.6, 10.2, 12])
      add({ pack: "restaurant", name: ["crate_tomatoes", "crate_carrots", "crate_lettuce"][Math.abs(Math.round(x * 3)) % 3], x, z: -hd + 1.7, ry: 0.1 * x, s: 0.42 }, 0.5);
    roundSet(11.2, 6.6);
    roundSet(7.4, 8.1);
    roundSet(-11.5, 7.2);
    for (const x of [-10.2, -9.2, -8])
      out.push({ pack: "restaurant", name: x < -9.5 ? "jar_A_medium" : x < -8.5 ? "jar_B_medium" : "menu", x, y: 0.92, z: -5.2, ry: 0.3, s: 0.55 });
    plant(-hw + 1, hd - 1);
    plant(hw - 1, -hd + 2.2, false);
  } else if (type === "club") {
    out.push(
      { pack: "furniture", name: "couch_pillows", x: hw - 1.1, z: 2.6, ry: -Math.PI / 2, s: [0.75, 0.62, 0.62], tint: "#d9a6c4" },
      { pack: "furniture", name: "couch_pillows", x: hw - 1.1, z: 9.0, ry: -Math.PI / 2, s: [0.75, 0.62, 0.62], tint: "#a7b6e6" },
      { pack: "furniture", name: "rug_oval_A", x: hw - 3.2, z: 6.2, s: [1.4, 0.5, 2.2], tint: "#c39ad2" },
      { pack: "furniture", name: "lamp_standing", x: hw - 0.9, z: 5.8, s: 0.6 },
      { pack: "furniture", name: "table_low", x: hw - 2.6, z: 2.6, ry: Math.PI / 2, s: 0.45 },
    );
    for (const z of [-3, 0, 3])
      add({ pack: "furniture", name: "chair_stool", x: -hw + 1.2, z, s: 0.66 }, 0.4);
    add({ pack: "furniture", name: "shelf_B_large_decorated", x: -hw + 0.3, y: 1.6, z: 5, ry: Math.PI / 2, s: 0.9 }, 0.3);
  } else if (type === "airport") {
    for (const z of [5.4, 7.2, 9.0]) {
      seatRow(-7.2, z, 5, Math.PI);
      seatRow(15.5, z, 6, Math.PI);
      seatRow(4.6, z + 1.2, 4, Math.PI);
    }
    // Waiting benches along the platform glass and a row facing the departures board.
    for (const z of [-10.5, -7.5, -4.5]) seatRow(8.6, z, 3, Math.PI / 2);
    seatRow(-15, 3.4, 6, Math.PI);
    for (const [x, z] of [
      [-hw + 1.2, -hd + 1.2],
      [-hw + 1.2, hd - 1.2],
      [hw - 1.2, hd - 1.2],
      [-3, hd - 1.3],
      [3.2, hd - 1.3],
      [-hw + 1.2, 0],
    ])
      plant(x, z);
    out.push(
      { pack: "restaurant", name: "kitchencounter_straight_A_decorated", x: -hw + 1.0, z: -6.5, ry: Math.PI / 2, s: 0.75 },
      { pack: "restaurant", name: "kitchencounter_straight_A", x: -hw + 1.0, z: -4.9, ry: Math.PI / 2, s: 0.75 },
      { pack: "restaurant", name: "papertowel", x: -hw + 0.9, y: 0.75, z: -4.6, s: 0.5 },
    );
    roundSet(-10.5, -9.5);
    roundSet(-16.5, -10);
  } else {
    // Quiet rooms: plants in free corners and a seat or two along the side walls.
    for (const [x, z] of [
      [-hw + 1.1, -hd + 1.1],
      [hw - 1.1, -hd + 1.1],
      [-hw + 1.1, hd - 1.1],
      [hw - 1.1, hd - 1.1],
    ])
      plant(x, z);
    if (!["stadium", "arena", "ballpark", "theatre"].includes(type)) {
      seatRow(-hw + 1.0, 1.5, 3, Math.PI / 2);
      seatRow(hw - 1.0, 1.5, 3, -Math.PI / 2);
    }
  }
  return out;
}
