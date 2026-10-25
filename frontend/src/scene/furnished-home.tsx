/* oxlint-disable react/immutability -- Effect instances and window colours are imperative renderer resources. */
import { Suspense, useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useHomeDesign } from "../home-design";
import { roomLayout } from "../navigation";
import { useStore } from "../store";
import { Builder } from "./geometry";
import { RoomWalls, WallMounted } from "./room-walls";
import { roomPalette, roomTexture } from "./room-surfaces";
import { PropBatch } from "./kaykit-props";
import { furnitureProps, MODELLED_KINDS } from "./furniture-models";
import { timeOfDay } from "../lighting";

type Piece = ReturnType<typeof roomLayout>["furniture"][number] & {
  color?: string;
};

/** Pieces KayKit has no model for: built here, sized to the same footprint. */
function proceduralPiece(f: Piece, palette: ReturnType<typeof roomPalette>) {
  const b = new Builder(),
    colour = f.color ?? palette.fabric,
    w = f.w,
    d = f.d;
  if (f.kind === "shower") {
    b.box(0, 0.06, 0, w, 0.12, d, "#e9eee8");
    b.box(0, 0.125, 0, w * 0.86, 0.01, d * 0.86, "#cfdad6");
    b.box(0, 1.2, -d / 2 + 0.04, w, 2.4, 0.08, "#dfe8e4");
    // Tiles on the back wall.
    for (let y = 0.4; y < 2.3; y += 0.3)
      b.box(0, y, -d / 2 + 0.085, w * 0.98, 0.012, 0.01, "#c4d2cf");
    b.cylinder(0, 1.3, -d / 2 + 0.14, 0.025, 2.1, "#a9b6b7", 8);
    b.box(0, 2.28, -d * 0.28, 0.05, 0.05, d * 0.42, "#a9b6b7");
    b.cylinder(0, 2.22, -d * 0.08, 0.16, 0.05, "#c9d3d4", 16);
    for (const x of [-w / 2, w / 2]) b.box(x, 2.25, 0, 0.05, 0.05, d, palette.trim);
  } else if (f.kind === "tub") {
    b.box(0, 0.28, 0, w, 0.52, d, "#f1f3ee");
    b.box(0, 0.53, 0, w * 0.84, 0.03, d * 0.7, "#8fc3c8");
    for (const z of [-d * 0.46, d * 0.46]) b.box(0, 0.55, z, w, 0.06, 0.08, "#ffffff");
    for (const x of [-w * 0.46, w * 0.46]) b.box(x, 0.55, 0, 0.08, 0.06, d, "#ffffff");
    b.cylinder(w * 0.4, 0.75, -d * 0.32, 0.03, 0.45, "#a2b1b3", 8);
    b.box(w * 0.36, 0.95, -d * 0.32, 0.12, 0.03, 0.03, "#a2b1b3");
  } else if (f.kind === "sculpture") {
    b.box(0, 0.25, 0, w * 0.8, 0.5, d * 0.8, "#efe6d6");
    b.torus(0, 0.92, 0, w * 0.36, 0.08, colour);
    b.sphere(0, 1.36, 0, w * 0.22, colour);
  } else {
    // Plants and flowers: a glazed pot with a soft round crown.
    b.cylinder(0, 0.2, 0, w * 0.34, 0.4, "#c97a5a", 12, w * 0.42);
    b.cylinder(0, 0.41, 0, w * 0.36, 0.04, "#5b4636", 12);
    b.cylinder(0, 0.62, 0, 0.025, 0.5, "#5d7d52", 6);
    for (let i = 0; i < 7; i++) {
      const a = i * 2.4,
        r = i ? w * 0.26 : 0;
      b.sphere(
        Math.sin(a) * r,
        0.78 + (i ? 0 : 0.18) + (i % 2) * 0.1,
        Math.cos(a) * r,
        w * 0.3,
        f.kind === "flowers" && i > 2 ? ["#e48ea4", "#f4cf6c", "#ffffff"][i % 3] : colour,
        1,
        0.85,
        1,
      );
    }
  }
  return b.build({ bakeAO: true });
}

/** Furniture is KayKit models fitted to the same footprints Buy mode and collision use. */
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
  const furniture = layout.furniture as Piece[];
  const cooking = useCooking();
  const modelled = useMemo(
    () =>
      furniture
        .filter((f) => MODELLED_KINDS.has(f.kind))
        .map((f) => ({
          f,
          props: furnitureProps(f).filter(
            (p) => !(cooking && p.name === "pot_A_stew"),
          ),
        })),
    [furniture, cooking],
  );
  const pieces = useMemo(
    () =>
      furniture
        .filter((f) => !MODELLED_KINDS.has(f.kind))
        .map((f) => ({ f, geometry: proceduralPiece(f, palette) })),
    [furniture, palette],
  );
  useEffect(() => () => pieces.forEach((p) => p.geometry.dispose()), [pieces]);
  const desks = furniture.filter((f) => f.kind === "desk");
  return (
    <group name="furnished-home">
      <mesh position={[0, -0.13, 0]} receiveShadow>
        <boxGeometry args={[bounds.w, 0.25, bounds.d]} />
        <meshStandardMaterial color={palette.floor} map={textures.floor} roughness={0.82} />
      </mesh>
      <RoomWalls hw={hw} hd={hd} palette={palette} paper={textures.paper} />
      <WallMounted side="back">
        <RoomWindow hd={hd} />
      </WallMounted>
      <Suspense fallback={null}>
        {modelled.map(({ f, props }) => (
          <PropBatch key={f.id} props={props} name={`home-furniture:${f.id}`} />
        ))}
      </Suspense>
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
          <meshStandardMaterial vertexColors roughness={0.6} />
        </mesh>
      ))}
      {desks.map((f) => (
        <DeskScreen key={f.id} piece={f} />
      ))}
      <mesh position={[0, 0.012, hd - 0.22]} receiveShadow>
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

const warmNight = new THREE.Color("#ffcf8a");
/** Glass in the back-wall opening: the sky by day, a warm reflection after dark. */
export function RoomWindow({ hd }: { hd: number }) {
  const material = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(() => {
    const m = material.current;
    if (!m) return;
    m.emissive.copy(timeOfDay.skyBottom).lerp(timeOfDay.skyTop, 0.35);
    m.emissiveIntensity = 0.9 - timeOfDay.nightFactor * 0.55;
    m.color.copy(timeOfDay.skyTop).lerp(warmNight, timeOfDay.nightFactor * 0.25);
  });
  return (
    <group position={[-0.7, 1.85, -hd]}>
      <mesh name="room-window" position={[0, 0, 0.02]}>
        <planeGeometry args={[1.7, 1.3]} />
        <meshStandardMaterial ref={material} roughness={0.15} metalness={0.1} />
      </mesh>
      {[-0.85, 0.85].map((x) => (
        <mesh key={x} position={[x, 0, 0.06]} castShadow>
          <boxGeometry args={[0.07, 1.36, 0.1]} />
          <meshStandardMaterial color="#fff6e6" />
        </mesh>
      ))}
      {[-0.65, 0, 0.65].map((y) => (
        <mesh key={y} position={[0, y, 0.06]} castShadow>
          <boxGeometry args={[1.76, 0.07, y ? 0.1 : 0.06]} />
          <meshStandardMaterial color="#fff6e6" />
        </mesh>
      ))}
      <mesh position={[0, -0.7, 0.14]} castShadow>
        <boxGeometry args={[1.9, 0.06, 0.22]} />
        <meshStandardMaterial color="#fff6e6" />
      </mesh>
    </group>
  );
}

/** A monitor on the desk whose screen softly glows. */
function DeskScreen({ piece }: { piece: Piece }) {
  const back = -piece.d * 0.28;
  return (
    <group position={[piece.x, 0.76, piece.z]} rotation={[0, piece.angle, 0]}>
      <mesh position={[0, 0.06, back]} castShadow>
        <boxGeometry args={[0.24, 0.12, 0.16]} />
        <meshStandardMaterial color="#3b4a52" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.36, back]} castShadow>
        <boxGeometry args={[Math.min(0.9, piece.w * 0.55), 0.46, 0.05]} />
        <meshStandardMaterial color="#2c3a42" roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.36, back + 0.027]}>
        <planeGeometry args={[Math.min(0.82, piece.w * 0.5), 0.38]} />
        <meshStandardMaterial color="#1b2a30" emissive="#9fd8e6" emissiveIntensity={1.15} toneMapped />
      </mesh>
      <mesh position={[0, 0.012, back + 0.38]}>
        <boxGeometry args={[0.55, 0.02, 0.18]} />
        <meshStandardMaterial color="#e9e4da" />
      </mesh>
    </group>
  );
}

/** The decorative pot on the hob steps aside while the cook's own pot is in use. */
function useCooking() {
  const label = useStore((s) => s.sim?.busyLabel ?? "");
  return /cook|meal|kitchen/i.test(label);
}
