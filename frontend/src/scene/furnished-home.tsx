import { useEffect, useMemo } from "react";
import { useHomeDesign } from "../home-design";
import { roomLayout } from "../navigation";
import { useStore } from "../store";
import { Builder } from "./geometry";
import { RoomWalls } from "./room-walls";
import { roomPalette, roomTexture } from "./room-surfaces";

/** Furniture pieces are local authored geometry; the same dimensions drive Buy mode and collision. */
export function FurnishedHome() {
  const city = useStore((s) => s.city),
    design = useHomeDesign((s) => s.design),
    open = useHomeDesign((s) => s.open),
    layout = roomLayout(city, "home"),
    bounds = layout.bounds ?? { w: 7, d: 6 },
    hw = bounds.w / 2,
    hd = bounds.d / 2;
  const palette = useMemo(
    () => ({
      ...roomPalette(city, "home"),
      wall: design?.wallColor ?? "#e5d8bf",
      floor: design?.floorColor ?? "#ad8b69",
    }),
    [city, design?.wallColor, design?.floorColor],
  );
  const textures = useMemo(
    () => ({
      floor: roomTexture("wood", palette, 28),
      paper: roomTexture("paper", palette, 17),
    }),
    [palette],
  );
  useEffect(
    () => () => {
      textures.floor.dispose();
      textures.paper.dispose();
    },
    [textures],
  );
  const pieces = useMemo(
    () =>
      layout.furniture.map((f) => {
        const b = new Builder(),
          colour = (f as typeof f & { color?: string }).color ?? palette.fabric,
          w = f.w,
          d = f.d;
        const legs = (h: number) => {
          for (const x of [-w * 0.38, w * 0.38])
            for (const z of [-d * 0.35, d * 0.35])
              b.box(x, h / 2, z, 0.075, h, 0.075, palette.wood);
        };
        if (f.kind === "bed") {
          b.box(0, 0.22, 0, w, 0.38, d, palette.wood);
          b.box(0, 0.48, 0, w - 0.05, 0.22, d - 0.06, "#f2eadb");
          b.box(-w * 0.14, 0.64, 0, w * 0.68, 0.13, d - 0.08, colour);
          b.box(w * 0.34, 0.66, 0, w * 0.23, 0.16, d * 0.8, "#fff4e2");
          b.box(w / 2, 0.62, 0, 0.1, 1.05, d + 0.06, palette.wood);
        } else if (["chair", "sofa", "bench"].includes(f.kind)) {
          legs(0.35);
          b.box(0, 0.4, 0, w, 0.18, d, colour);
          b.box(0, 0.83, -d * 0.43, w, 0.78, 0.16, colour);
          for (const x of [-w * 0.44, w * 0.44])
            b.box(x, 0.65, 0, 0.15, 0.35, d, colour);
          b.box(0, 0.53, 0, w * 0.8, 0.12, d * 0.8, "#d4ccb9");
        } else if (f.kind === "stove") {
          b.box(0, 0.43, 0, w, 0.86, d, colour);
          b.box(0, 0.89, 0, w + 0.04, 0.06, d + 0.04, "#384b4e");
          b.box(0, 0.45, d * 0.505, w * 0.7, 0.4, 0.03, "#253a42");
          for (const x of [-w * 0.25, w * 0.25])
            for (const z of [-d * 0.25, d * 0.25])
              b.cylinder(x, 0.94, z, 0.14, 0.025, "#1b2a30", 12);
          b.cylinder(w * 0.25, 1.03, -d * 0.25, 0.17, 0.18, "#b5a184", 12);
        } else if (f.kind === "fridge") {
          b.box(0, 1, 0, w, 2, d, colour);
          b.box(0, 1.45, d * 0.51, w * 0.95, 0.035, 0.025, "#6e7d7a");
          b.box(w * 0.34, 1.2, d * 0.53, 0.05, 0.5, 0.06, "#d7dad0");
        } else if (f.kind === "shower") {
          b.box(0, 0.08, 0, w, 0.16, d, "#dae3db");
          b.box(0, 1.15, -d / 2, w, 2.3, 0.08, colour);
          b.cylinder(0, 1.3, -d * 0.42, 0.035, 2.1, "#9caeaf", 8);
          b.box(0, 2.25, -d * 0.25, 0.42, 0.07, 0.4, "#9aa8a8");
          for (const x of [-w / 2, w / 2]) {
            b.box(x, 1.1, 0, 0.04, 2.2, d, "#b5d1cd");
            b.box(x, 2.2, 0, 0.07, 0.07, d, palette.trim);
          }
        } else if (f.kind === "tub") {
          b.box(0, 0.28, 0, w, 0.5, d, colour);
          b.box(0, 0.55, 0, w * 0.84, 0.06, d * 0.72, "#7fb4ba");
          for (const z of [-d * 0.46, d * 0.46])
            b.box(0, 0.5, z, w, 0.15, 0.08, "#e1e8dc");
          for (const x of [-w * 0.46, w * 0.46])
            b.box(x, 0.5, 0, 0.08, 0.15, d, "#e1e8dc");
          b.cylinder(w * 0.4, 0.8, -d * 0.3, 0.035, 0.6, "#a2b1b3", 8);
        } else if (f.kind === "sink") {
          b.box(0, 0.38, 0, w * 0.8, 0.76, d * 0.8, colour);
          b.box(0, 0.8, 0, w, 0.12, d, "#e5e9df");
          b.cylinder(0, 1, -d * 0.3, 0.03, 0.3, "#a1b0b0", 8);
        } else if (f.kind === "table" || f.kind === "desk") {
          legs(0.7);
          b.box(0, 0.75, 0, w, 0.09, d, colour);
          if (f.kind === "desk") {
            b.box(0, 1.05, -d * 0.3, w * 0.55, 0.48, 0.06, "#374e59");
            b.box(0, 1.05, -d * 0.24, w * 0.48, 0.4, 0.02, "#9bcbc6");
            b.box(0, 0.83, d * 0.2, w * 0.4, 0.04, 0.18, "#657a79");
          }
        } else if (f.kind === "lamp") {
          b.cylinder(0, 0.06, 0, w * 0.45, 0.12, "#7f8273", 12);
          b.cylinder(0, 0.85, 0, 0.028, 1.6, "#8c8c79", 8);
          b.cylinder(0, 1.55, 0, w * 0.55, 0.5, colour, 12, w * 0.35);
        } else if (f.kind === "rug") {
          b.box(0, 0.025, 0, w, 0.03, d, colour);
          b.box(0, 0.044, 0, w * 0.75, 0.006, d * 0.7, palette.trim);
        } else if (f.kind === "shelf") {
          for (const x of [-w * 0.45, w * 0.45])
            b.box(x, 0.8, 0, 0.06, 1.6, d, palette.wood);
          for (const y of [0.1, 0.55, 1, 1.45]) {
            b.box(0, y, 0, w, 0.06, d, palette.wood);
            for (let i = 0; i < 5; i++)
              b.box(
                -w * 0.35 + i * w * 0.17,
                y + 0.17,
                0,
                w * 0.12,
                0.27,
                d * 0.7,
                i % 2 ? colour : "#c8a675",
              );
          }
        } else if (f.kind === "sculpture") {
          b.box(0, 0.15, 0, w, 0.3, d, palette.wood);
          b.torus(0, 0.8, 0, w * 0.46, 0.1, colour);
          b.sphere(0, 1.35, 0, w * 0.25, colour);
        } else {
          b.cylinder(0, 0.2, 0, w * 0.37, 0.4, palette.wood, 10, w * 0.46);
          b.cylinder(0, 0.7, 0, 0.03, 1.2, "#63825a", 6);
          for (let i = 0; i < 7; i++) {
            const a = i * 2.4;
            b.sphere(
              Math.sin(a) * w * 0.35,
              0.65 + i * 0.09,
              Math.cos(a) * d * 0.35,
              w * 0.4,
              f.kind === "flowers" && i > 2 ? "#c98e9d" : colour,
              0.8,
              0.65,
              0.8,
            );
          }
        }
        return { f, geometry: b.build({ bakeAO: true }) };
      }),
    [layout, palette],
  );
  useEffect(() => () => pieces.forEach((p) => p.geometry.dispose()), [pieces]);
  return (
    <group name="furnished-home">
      <mesh position={[0, -0.13, 0]} receiveShadow>
        <boxGeometry args={[bounds.w, 0.25, bounds.d]} />
        <meshStandardMaterial
          color={palette.floor}
          map={textures.floor}
          roughness={0.9}
        />
      </mesh>
      <RoomWalls hw={hw} hd={hd} palette={palette} paper={textures.paper} />
      {pieces.map(({ f, geometry }) => (
        <mesh
          key={f.id}
          name={`home-furniture:${f.id}`}
          geometry={geometry}
          position={[f.x, 0, f.z]}
          rotation={[0, f.angle, 0]}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial vertexColors roughness={0.78} />
        </mesh>
      ))}
      <mesh position={[0, 0.012, hd - 0.22]}>
        <boxGeometry args={[1.4, 0.035, 0.3]} />
        <meshStandardMaterial color="#d4ad67" />
      </mesh>
      {open && (
        <gridHelper
          args={[
            Math.max(bounds.w, bounds.d),
            Math.round(Math.max(bounds.w, bounds.d) * 4),
            "#688477",
            "#b5b39a",
          ]}
          position={[0, 0.045, 0]}
        />
      )}
    </group>
  );
}
