import * as THREE from "three";
import { Builder } from "./geometry";

export type BowlSeat = {
  x: number;
  y: number;
  z: number;
  face: number;
  phase: number;
};
export function bowlDimensions(type: string) {
  return type === "arena"
    ? { rx: 15.8, rz: 10.8, tiers: 2, rows: 7, height: 18 }
    : {
        rx: 22.2,
        rz: 16.5,
        tiers: 3,
        rows: 6,
        height: type === "ballpark" ? 20 : 24,
      };
}
/** A stepped elliptical bowl, with a central entrance portal and an east skyline opening. */
export function buildBowl(b: Builder, glow: Builder, type: string) {
  const arena = type === "arena",
    baseball = type === "ballpark",
    { rx, rz, tiers, rows, height } = bowlDimensions(type),
    seats: BowlSeat[] = [];
  const fieldWidth = arena ? 25 : 34,
    fieldDepth = arena ? 14 : 18;
  b.box(
    0,
    0.035,
    -3,
    fieldWidth,
    0.07,
    fieldDepth,
    arena ? "#d6ad74" : "#397e52",
  );
  if (arena) {
    for (const end of [-1, 1]) {
      b.box(end * 9, 0.08, -3, 4, 0.025, 5, "#c64d50");
      b.cylinder(end * 12.7, 1.65, -3, 0.07, 3.3, "#383d44", 8);
      b.box(end * 12.4, 3, -3, 0.12, 1.1, 1.8, "#e8e5da");
      b.torus(end * 11.9, 2.7, -3, 0.38, 0.045, "#ebac63", Math.PI / 2);
    }
    b.torus(0, 0.085, -3, 1.8, 0.035, "#fff1d7", Math.PI / 2);
    b.box(0, 0.09, -3, 0.04, 0.03, fieldDepth, "#fff1d7");
  } else if (baseball) {
    const dirt = new THREE.CircleGeometry(10, 48, 0, Math.PI / 2);
    dirt.rotateX(-Math.PI / 2);
    b.add(dirt, "#b1845b", -8, 0.08, 5, 0, Math.PI / 4);
    for (const [x, z] of [
      [-8, 4],
      [-1, -3],
      [-8, -10],
      [-15, -3],
    ])
      b.box(x, 0.13, z, 0.5, 0.08, 0.5, "#fff2d5", Math.PI / 4);
  } else {
    for (let yard = -8; yard <= 8; yard += 2)
      b.box(yard * 1.7, 0.08, -3, 0.07, 0.025, fieldDepth, "#e7ecd8");
    for (const end of [-1, 1]) {
      b.box(end * 15.1, 0.09, -3, 3, 0.03, fieldDepth, "#b64c52");
      for (const z of [-5, -1]) {
        b.cylinder(end * 18, 2.6, z, 0.05, 5.2, "#e9bf60", 8);
      }
      b.box(end * 18, 3.2, -3, 0.1, 0.12, 4.1, "#e9bf60");
    }
  }
  const segments = 72,
    total = tiers * rows;
  for (let row = 0; row < total; row++) {
    const tier = Math.floor(row / rows),
      offset = row * 0.42 + tier * 0.8,
      y = 0.22 + row * 0.36 + tier * 0.7;
    for (let section = 0; section < segments; section++) {
      const angle = (section / segments) * Math.PI * 2,
        front = Math.cos(angle) > 0.86 && Math.abs(Math.sin(angle)) < 0.16,
        east = type === "stadium" && Math.sin(angle) > 0.79 && row >= rows;
      if (front || east) continue;
      const x = Math.sin(angle) * (rx + offset),
        z = -3 + Math.cos(angle) * (rz + offset),
        tangent = Math.atan2(
          Math.cos(angle) * (rx + offset),
          -Math.sin(angle) * (rz + offset),
        ),
        length =
          (Math.hypot(
            (rx + offset) * Math.cos(angle),
            (rz + offset) * Math.sin(angle),
          ) *
            Math.PI *
            2) /
          segments;
      b.box(x, y / 2, z, length + 0.08, y, 0.52, "#42464c", -tangent);
      b.box(
        x,
        y + 0.08,
        z,
        length * 0.85,
        0.12,
        0.4,
        row % rows === 0 ? "#9c414a" : arena ? "#783f49" : "#303a43",
        -tangent,
      );
      if (section % 2 === 0 && row % 2 === 0)
        seats.push({
          x,
          y: y + 0.14,
          z,
          face: Math.atan2(-x, -3 - z),
          phase: angle,
        });
    }
    if (row % rows === rows - 1) {
      const ribbon = new THREE.TorusGeometry(1, 0.018, 4, 96);
      ribbon.scale(rx + offset + 1, rz + offset + 1, 1);
      ribbon.rotateX(Math.PI / 2);
      glow.add(ribbon, arena ? "#e293bd" : "#91d2d1", 0, y + 0.65, -3);
    }
  }
  if (arena) {
    b.box(0, height - 4, -3, 5.6, 3.4, 5.6, "#252833");
    for (const face of [-1, 1]) {
      glow.box(0, height - 4, -3 + face * 2.83, 5.2, 2.9, 0.05, "#5d9dba");
      glow.box(face * 2.83, height - 4, -3, 0.05, 2.9, 5.2, "#a9cf86");
    }
  } else {
    const outer = new THREE.CylinderGeometry(10.3, 10.3, 2.6, 64, 1, true),
      inner = new THREE.CylinderGeometry(10.15, 10.15, 2.6, 64, 1, true);
    inner.scale(-1, 1, 1);
    glow.add(outer, "#65a7c2", 0, height - 5, -3);
    glow.add(inner, "#d9b46b", 0, height - 5, -3);
    b.torus(0, height - 3.6, -3, 10.3, 0.16, "#c8cfd2", Math.PI / 2);
    b.torus(0, height - 6.4, -3, 10.3, 0.16, "#626a76", Math.PI / 2);
  }
  // The window is a painted skyline and local lighting, never the city leaking into the room.
  if (type === "stadium") {
    b.box(28, 9, -5, 0.22, 17, 26, "#7394a9");
    for (let i = 0; i < 9; i++) {
      const z = -16 + i * 2.7,
        h = 3 + ((i * 7) % 8);
      b.box(27.8, h / 2, z, 0.3, h, 1.8, i % 2 ? "#435d79" : "#597791");
      for (let y = 1; y < h; y += 1.1)
        glow.box(27.59, y, z, 0.015, 0.2, 1.1, "#f7c984");
    }
    for (let z = -17; z < 9; z += 3)
      b.box(27.4, 9, z, 0.18, 18, 0.12, "#c3c7c7");
  }
  return seats;
}
