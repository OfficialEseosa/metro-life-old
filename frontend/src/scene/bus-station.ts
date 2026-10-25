import { Builder } from "./geometry";
import type { CityId } from "../api/types";

/** Small open-air regional station, owned geometry and a single merged material batch. */
export function busStationGeometry(city: CityId) {
  const b = new Builder(),
    accent =
      city === "atl" ? "#437c6b" : city === "nyc" ? "#55718d" : "#6b8b81",
    roof = city === "atl" ? "#d8c6a7" : city === "nyc" ? "#adb9bc" : "#c0cab8",
    metal = "#596e72",
    pale = "#eee6cf";
  b.box(0, 0.06, 0, 10, 0.12, 5.4, "#c4cbbd");
  // Paved platform, low kerb and painted boarding edge. No enclosing room or doorway.
  b.box(0, 0.13, 2.55, 10, 0.14, 0.24, pale);
  for (let x = -4.5; x < 5; x += 1)
    b.box(x, 0.208, 2.55, 0.65, 0.015, 0.15, "#caab66");
  for (const x of [-4.2, 4.2])
    for (const z of [-1.6, 1.6]) b.cylinder(x, 1.5, z, 0.085, 3, metal, 8);
  b.box(0, 3.04, 0, 9.4, 0.18, 4.2, roof)
    .box(0, 2.89, -1.85, 9.1, 0.14, 0.14, accent)
    .box(0, 2.89, 1.85, 9.1, 0.14, 0.14, accent);
  // Two continuous benches and open aisle; a low rear rail reads as a shelter.
  for (const x of [-2.25, 2.25]) {
    b.box(x, 0.48, -0.85, 3.25, 0.15, 0.7, accent).box(
      x,
      0.85,
      -1.15,
      3.25,
      0.68,
      0.12,
      accent,
    );
    for (const dx of [-1.1, 1.1])
      b.box(x + dx, 0.26, -0.85, 0.1, 0.43, 0.55, metal);
  }
  for (const x of [-4.2, 4.2]) b.box(x, 1, -1.6, 0.1, 1.8, 0.1, metal);
  b.box(0, 1.3, -1.6, 8.4, 0.08, 0.08, metal);
  // Tall bus-stop flag and a departure/map board, legible without external logos.
  b.cylinder(4.55, 1.9, 1.7, 0.065, 3.8, metal, 8).box(
    4.55,
    3.35,
    1.7,
    1.05,
    0.85,
    0.16,
    accent,
  );
  b.box(4.55, 3.35, 1.8, 0.66, 0.34, 0.025, pale);
  for (const dx of [-0.23, 0.23])
    b.sphere(4.55 + dx, 3.14, 1.83, 0.075, metal, 1, 1, 0.25);
  b.box(-4.1, 1.65, 0.1, 0.14, 1.8, 1.15, accent);
  for (let i = 0; i < 5; i++)
    b.box(-4.01, 1.14 + i * 0.2, 0.1, 0.025, 0.06, 0.8, pale);
  b.box(0, 2.4, -1.7, 4.5, 0.7, 0.13, accent);
  // A compact timetable case on the front rail supplies a human-scale focal point.
  b.box(2.9, 1.45, 1.5, 0.85, 1.2, 0.16, metal).box(
    2.9,
    1.45,
    1.6,
    0.7,
    1.04,
    0.035,
    pale,
  );
  for (let i = 0; i < 5; i++)
    b.box(2.9, 1.08 + i * 0.16, 1.63, 0.5, 0.035, 0.02, accent);
  return b.build();
}
