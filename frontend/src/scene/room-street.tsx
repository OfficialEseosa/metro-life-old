/* oxlint-disable react/immutability -- Window glow follows the clock. */
import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Builder } from "./geometry";
import { lightUniforms, timeOfDay } from "../lighting";

const noPick = () => {};
const towns = ["#b9735a", "#d8c3a0", "#9d5f4c", "#c9b7a4", "#8e8a86", "#d9a679", "#a7b2b5", "#c58f6d"],
  houses = ["#e8dcc4", "#c9d6d2", "#e5c7a8", "#d4c0dc", "#cfd9b8", "#f0e3cf"],
  awnings = ["#2f6b5e", "#8c3b33", "#2d4f7c", "#c58b2b", "#4f3d63"];

const dusk = new THREE.Color("#5d6688");
const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/**
 * The block around a cutaway room: a road on the camera side and a row of neighbouring
 * facades behind and beside it, so a room reads as one building on a street. Two merged
 * meshes, built once per room size; the windows glow after dark.
 */
export function RoomStreet({
  w,
  d,
  home,
}: {
  w: number;
  d: number;
  home: boolean;
}) {
  const { body, glass } = useMemo(() => {
    const walls = new Builder(),
      panes = new Builder(),
      gap = home ? 11 : 8,
      reach = home ? 22 : 30,
      palette = home ? houses : towns;
    let seed = Math.round(w * 7 + d * 3);
    // A facade of width `span` whose front faces the room along `normal` (+1/-1 on x or z).
    const facade = (
      cx: number,
      cz: number,
      span: number,
      axis: "x" | "z",
      normal: number,
    ) => {
      const r1 = hash(seed++),
        r2 = hash(seed++),
        r3 = hash(seed++),
        floors = home ? 1 + Math.floor(r1 * 2) : 2 + Math.floor(r1 * 5),
        storey = home ? 3.1 : 3.4,
        height = floors * storey + 1.2,
        depth = 9,
        colour = palette[Math.floor(r2 * palette.length)],
        along = (offset: number) =>
          axis === "x" ? [cx + offset, cz] : [cx, cz + offset],
        // Front face sits on the side nearer the room; the block extends away from it.
        back = axis === "x" ? [0, -normal * depth / 2] : [-normal * depth / 2, 0],
        bw = axis === "x" ? span : depth,
        bd = axis === "x" ? depth : span;
      walls.box(cx + back[0], height / 2 - 0.55, cz + back[1], bw, height, bd, colour);
      walls.box(
        cx + back[0],
        height - 0.4,
        cz + back[1],
        bw + 0.3,
        0.5,
        bd + 0.3,
        "#6b6460",
      );
      if (home) {
        walls.box(cx + back[0], height + 0.15, cz + back[1], bw * 0.92, 0.6, bd * 0.92, "#7d5a4b");
      } else {
        const awning = awnings[Math.floor(r3 * awnings.length)],
          front = axis === "x" ? [0, normal * 0.6] : [normal * 0.6, 0];
        walls.box(
          cx + front[0],
          2.6,
          cz + front[1],
          axis === "x" ? span * 0.86 : 1.2,
          0.35,
          axis === "x" ? 1.2 : span * 0.86,
          awning,
        );
      }
      const columns = Math.max(2, Math.floor(span / 2.6)),
        face = 0.06;
      for (let row = home ? 0 : 1; row < floors; row++)
        for (let col = 0; col < columns; col++) {
          if (hash(seed++) < 0.12) continue;
          const offset = -span / 2 + ((col + 0.5) * span) / columns,
            [px, pz] = along(offset),
            y = row * storey + storey * 0.55 - 0.3,
            fx = axis === "x" ? px : px + normal * face,
            fz = axis === "x" ? pz + normal * face : pz;
          panes.box(
            fx,
            y,
            fz,
            axis === "x" ? 1.3 : 0.08,
            1.6,
            axis === "x" ? 0.08 : 1.3,
            hash(seed++) < 0.5 ? "#5e7f8c" : "#6f8f98",
          );
        }
      if (!home) {
        // Shopfront glazing on the ground floor.
        const [px, pz] = along(0),
          fx = axis === "x" ? px : px + normal * face,
          fz = axis === "x" ? pz + normal * face : pz;
        panes.box(fx, 1.1, fz, axis === "x" ? span * 0.7 : 0.08, 2.0, axis === "x" ? 0.08 : span * 0.7, "#55707a");
      }
    };
    const row = (
      from: number,
      to: number,
      fixed: number,
      axis: "x" | "z",
      normal: number,
    ) => {
      let at = from;
      while (at < to - 3) {
        const span = Math.min(to - at, (home ? 7 : 6) + hash(seed++) * (home ? 4 : 7));
        if (axis === "x") facade(at + span / 2, fixed, span - (home ? 2.5 : 0.15), "x", normal);
        else facade(fixed, at + span / 2, span - (home ? 2.5 : 0.15), "z", normal);
        at += span;
      }
    };
    const backZ = -(d / 2 + gap),
      sideX = w / 2 + gap;
    row(-(w / 2 + reach), w / 2 + reach, backZ, "x", 1);
    row(backZ + 1, d / 2 - 1, -sideX, "z", 1);
    row(backZ + 1, d / 2 - 1, sideX, "z", -1);
    // Pavement under the facades and the road on the camera side.
    const kerb = home ? "#a9a596" : "#aaa398";
    walls.box(0, -0.53, backZ + 1.5, w + reach * 2, 0.06, 6, kerb);
    walls.box(-sideX - 1.5, -0.53, (backZ + d / 2) / 2, 6, 0.06, d / 2 - backZ, kerb);
    walls.box(sideX + 1.5, -0.53, (backZ + d / 2) / 2, 6, 0.06, d / 2 - backZ, kerb);
    const roadZ = d / 2 + 6.5;
    walls.box(0, -0.535, roadZ, w + reach * 2 + 12, 0.05, 7, "#4c4f55");
    for (let x = -(w / 2 + reach); x < w / 2 + reach; x += 4)
      walls.box(x, -0.5, roadZ, 2, 0.02, 0.18, "#e9e4d2");
    walls.box(0, -0.52, roadZ - 4, w + reach * 2 + 12, 0.08, 1.2, kerb);
    return { body: walls.build(), glass: panes.build() };
  }, [w, d, home]);
  useEffect(
    () => () => {
      body.dispose();
      glass.dispose();
    },
    [body, glass],
  );
  const materials = useMemo(
    () => ({
      body: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 }),
      glass: new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.25,
        metalness: 0.2,
        emissive: new THREE.Color("#ffcf8f"),
        emissiveIntensity: 0,
      }),
    }),
    [],
  );
  useEffect(
    () => () => {
      materials.body.dispose();
      materials.glass.dispose();
    },
    [materials],
  );
  useFrame(() => {
    // Outside goes blue and dim after dark while the room keeps its own lamps.
    materials.body.color.setRGB(1, 1, 1).lerp(dusk, timeOfDay.nightFactor * 0.75);
    materials.glass.emissiveIntensity = 0.05 + lightUniforms.lights.value * 0.9;
  });
  return (
    <group name="room-street">
      <mesh geometry={body} material={materials.body} receiveShadow raycast={noPick} />
      <mesh geometry={glass} material={materials.glass} raycast={noPick} />
    </group>
  );
}
