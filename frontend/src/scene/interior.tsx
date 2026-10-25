import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { roomLayout, roomType } from "../navigation";
import { useStore } from "../store";
import { Builder } from "./geometry";
import { buildVenueArchitecture } from "./venue-architecture";
import { VenueLiveProps } from "./venue-live-props";
import { WorldText } from "./world-text";
import { venueName } from "../content-names";
import { useNightLighting } from "../lighting";
import { roomPalette, roomTexture } from "./room-surfaces";
import { RoomWalls, WallMounted } from "./room-walls";
import { RoomStaff } from "./room-staff";
import { FurnishedHome, RoomWindow } from "./furnished-home";
import { PropBatch } from "./kaykit-props";
import { venueDecor } from "./venue-decor";
import { Suspense } from "react";

/** Room-specific furniture, collisions and use points come from one authored layout. */
export function Interior({ room }: { room: string }) {
  return roomType(room) === "home" ? (
    <FurnishedHome />
  ) : (
    <PublicInterior room={room} />
  );
}
function PublicInterior({ room }: { room: string }) {
  const night = useNightLighting(),
    type = roomType(room)!,
    world = useStore((s) => s.world),
    city = useStore((s) => s.city),
    layout = roomLayout(city, type),
    palette = roomPalette(city, type),
    hw = (layout.bounds?.w ?? 12) / 2,
    hd = (layout.bounds?.d ?? 10) / 2,
    height = layout.height ?? 3,
    windowed = [
      "work",
      "skyoffice",
      "campus",
      "cafe",
      "hospital",
      "airport",
    ].includes(type);
  const loc = room.split(":")[1],
    name = venueName(
      loc,
      world?.cities
        .find((c) => c.id === city)
        ?.landmarks.find((l) => l.id === loc)?.name ?? layout.name,
    );
  const surfaces = useMemo(
    () => ({
      floor: roomTexture(
        [
          "cafe",
          "foodhall",
          "hospital",
          "airport",
          "museum",
          "arena",
          "stadium",
        ].includes(type)
          ? "tile"
          : "wood",
        palette,
        city.length + type.length,
      ),
      paper: roomTexture("paper", palette, city.charCodeAt(0)),
    }),
    [type, palette, city],
  );
  useEffect(
    () => () => {
      surfaces.floor.dispose();
      surfaces.paper.dispose();
    },
    [surfaces],
  );
  const built = useMemo(() => {
    const b = new Builder(),
      glass = new Builder(),
      glow = new Builder(),
      back = new Builder(),
      front = new Builder(),
      wallglow = new Builder();
    const chair = (
      x: number,
      z: number,
      face: number,
      width = 0.65,
      baseY = 0,
    ) => {
      const c = new Builder();
      c.box(0, 0.405, 0, width, 0.09, 0.65, palette.fabric);
      c.box(0, 0.76, -0.29, width, 0.65, 0.08, palette.fabric);
      for (const dx of [-width * 0.38, width * 0.38])
        for (const dz of [-0.25, 0.25])
          c.box(dx, 0.2, dz, 0.065, 0.4, 0.065, palette.wood);
      const g = c.build();
      g.rotateY(face);
      const colour = g.getAttribute("color").clone();
      b.add(g, "#ffffff", x, baseY, z);
      b.parts.at(-1)!.setAttribute("color", colour);
    };
    const plant = (x: number, z: number, size = 1) => {
      b.cylinder(x, 0.22, z, 0.24 * size, 0.44, palette.fabric, 8, 0.32 * size);
      b.cylinder(x, 0.8 * size, z, 0.035, 1.2 * size, "#67845a", 6);
      for (let i = 0; i < 5; i++) {
        const a = i * 2.4;
        b.sphere(
          x + Math.sin(a) * 0.2 * size,
          (0.7 + i * 0.12) * size,
          z + Math.cos(a) * 0.2 * size,
          0.27 * size,
          "#68916b",
          0.6,
          1,
          0.6,
        );
      }
    };
    const shape = new THREE.Shape();
    (
      layout.floor ?? [
        [-hw, -hd],
        [hw, -hd],
        [hw, hd],
        [-hw, hd],
      ]
    ).forEach((p, i) =>
      i ? shape.lineTo(p[0], -p[1]) : shape.moveTo(p[0], -p[1]),
    );
    shape.closePath();
    const slab = new THREE.ExtrudeGeometry(shape, {
      depth: 0.25,
      bevelEnabled: false,
      steps: 1,
    });
    slab.rotateX(-Math.PI / 2);
    b.add(slab, palette.floor, 0, -0.27, 0);
    if (
      ![
        "stadium",
        "arena",
        "foodhall",
        "museum",
        "hospital",
        "airport",
      ].includes(type)
    )
      b.box(0, 0.012, 0.5, hw * 0.75, 0.024, hd * 0.72, palette.accent);
    for (const x of [-0.77, 0.77])
      front.box(x, 1.05, hd - 0.04, 0.1, 2.1, 0.2, palette.trim);
    front.box(0, 2.15, hd - 0.04, 1.64, 0.1, 0.2, palette.trim);
    if (windowed) {
      for (const x of [-1.6, 0.2])
        back.box(x, 1.85, -hd + 0.1, 0.08, 1.4, 0.13, palette.trim);
      for (const y of [1.17, 1.85, 2.53])
        back.box(-0.7, y, -hd + 0.1, 1.85, 0.07, 0.13, palette.trim);
    }
    for (const f of layout.furniture) {
      const { x, z } = f;
      if (
        ["stadium", "arena", "ballpark"].includes(type) &&
        ["stadium", "arena", "stands"].includes(f.kind)
      )
        continue;
      if (type === "aquarium" && f.id === "touch-pool") continue;
      if (f.kind === "bed") {
        b.box(x, 0.2, z, 2, 0.35, 1.5, palette.wood);
        b.box(x, 0.48, z, 1.96, 0.2, 1.46, "#f6edd9");
        const direction = f.angle ? -1 : 1;
        b.box(x - direction * 0.25, 0.79, z, 1.36, 0.16, 1.44, palette.fabric);
        b.box(x + direction * 0.68, 0.67, z, 0.46, 0.19, 1.16, "#fff5e2");
        b.box(x + direction * 0.98, 0.62, z, 0.1, 1.05, 1.6, palette.wood);
      } else if (f.kind === "chair")
        chair(
          x,
          z,
          f.angle,
          f.w,
          (f as typeof f & { baseY?: number }).baseY ??
            Math.max(0, (f.slots[0]?.y ?? 0.48) - 0.48),
        );
      else if (f.kind === "bench") chair(x, z, Math.PI, f.w);
      else if (f.kind === "stove") {
        b.box(x, 0.41, z, 0.9, 0.82, 1.1, palette.trim);
        b.box(x, 0.86, z, 1, 0.08, 1.2, "#435354");
        b.box(x + (x > 0 ? -0.46 : 0.46), 0.45, z, 0.035, 0.5, 0.75, "#34494b");
        for (const dz of [-0.28, 0.28])
          b.cylinder(x, 0.915, z + dz, 0.18, 0.025, "#24363a", 12);
        b.cylinder(x, 1.04, z + 0.28, 0.2, 0.22, palette.wood, 12);
      } else if (f.kind === "shower") {
        b.box(x, 0.08, z, 1.1, 0.16, 1.5, "#e8f0e7");
        b.box(x, 1.2, z - 0.75, 1.1, 2.4, 0.08, palette.accent);
        b.cylinder(x, 1.3, z - 0.65, 0.035, 2.1, "#7f9799", 8);
        b.box(x, 2.3, z - 0.35, 0.5, 0.07, 0.55, "#8da2a0");
        glass.box(x, 1.1, z + 0.72, 1.1, 2.2, 0.035, "#b8d6d1");
        for (const dx of [-0.55, 0.55])
          glass.box(x + dx, 1.1, z, 0.035, 2.2, 1.5, "#b8d6d1");
      } else if (f.kind === "desk") {
        b.box(x, 0.715, z, f.w, 0.07, f.d, palette.wood);
        for (const dx of [-f.w * 0.425, f.w * 0.425])
          b.box(x + dx, 0.35, z, 0.08, 0.7, 0.68, palette.accent);
        b.box(x, 1.04, z - 0.18, 0.9, 0.55, 0.07, "#32494e");
        glow.box(x, 1.04, z - 0.135, 0.79, 0.44, 0.012, "#a8d9d8");
        b.box(x, 0.77, z + 0.22, 0.7, 0.035, 0.24, palette.trim);
        b.box(x + 0.58, 0.78, z + 0.22, 0.12, 0.04, 0.2, "#557176");
        chair(x, z + 0.9, Math.PI);
        b.cylinder(x - 0.72, 0.84, z, 0.1, 0.16, palette.fabric, 10);
      } else if (f.kind === "table") {
        b.cylinder(x, 0.35, z, 0.08, 0.7, palette.wood, 8);
        b.box(x, 0.715, z, f.w, 0.07, f.d, palette.wood);
        b.cylinder(x, 0.77, z + 0.2, 0.29, 0.025, "#fff0d5", 16);
        b.sphere(x, 0.82, z + 0.2, 0.18, "#ca9154", 1, 0.25, 1);
        b.cylinder(x - 0.4, 0.83, z - 0.25, 0.075, 0.15, palette.trim, 10);
        chair(x, z + f.d / 2 + 0.5, Math.PI);
      } else if (f.kind === "counter" || f.kind === "stall") {
        b.box(x, 0.425, z, f.w, 0.85, f.d, palette.wood);
        b.box(x, 0.895, z, f.w + 0.15, 0.09, f.d + 0.1, palette.trim);
        b.box(x + 0.25, 1.1, z - 0.15, 0.4, 0.35, 0.32, palette.accent);
        b.box(x + 0.25, 1.3, z - 0.15, 0.48, 0.05, 0.38, "#435354");
        if (f.kind === "stall") {
          for (const dx of [-f.w / 2, f.w / 2])
            b.box(x + dx, 1.9, z, 0.08, 2.05, 0.08, palette.accent);
          b.box(x, 2.92, z, f.w + 0.2, 0.15, 1.4, palette.accent);
          for (let i = -2; i <= 2; i++)
            b.box(x + i * 0.55, 3.0, z, 0.25, 0.07, 1.4, palette.trim);
          for (const dx of [-0.6, 0.1, 0.8]) {
            b.cylinder(x + dx, 0.98, z + 0.2, 0.23, 0.07, "#f1d49d", 12);
            b.sphere(x + dx, 1.05, z + 0.2, 0.16, "#bd7955", 1, 0.5, 1);
          }
        }
      } else if (f.kind === "shelf") {
        for (const dx of [-0.6, 0.6])
          b.box(x + dx, 1.2, z, 0.08, 2.4, 0.7, palette.wood);
        for (const y of [0.2, 0.8, 1.4, 2]) {
          b.box(x, y, z, 1.2, 0.08, 0.7, palette.wood);
          for (let i = 0; i < 4; i++)
            b.box(
              x - 0.42 + i * 0.22,
              y + 0.19,
              z,
              0.13,
              0.3,
              0.35,
              i % 2 ? palette.accent : palette.fabric,
            );
        }
      } else if (f.kind === "plant") plant(x, z, 1.2);
      else if (f.kind === "dance") {
        b.box(x, 0.06, z, f.w, 0.12, f.d, palette.fabric);
        for (let i = -1; i <= 1; i++)
          for (let j = -1; j <= 1; j++)
            glow.box(
              x + i * 1.45,
              0.124,
              z + j * 1.15,
              1.3,
              0.006,
              1.02,
              (i + j) % 2 ? "#e3a8cd" : "#91d6d4",
            );
      } else if (f.kind === "stage") {
        b.box(x, 0.18, z, f.w, 0.36, f.d, palette.wood);
        for (const dx of [-2.8, 2.8]) {
          b.box(x + dx, 0.92, z - 0.5, 0.75, 1.1, 0.65, "#34464d");
          for (const y of [0.65, 1.05])
            b.sphere(x + dx, y, z - 0.16, 0.22, "#263038", 1, 1, 0.1);
        }
        b.cylinder(x + 0.8, 1.2, z + 0.5, 0.025, 1.7, "#a6b2ac", 8);
        b.sphere(x + 0.8, 2.05, z + 0.5, 0.08, palette.trim, 1.5, 0.8, 1);
      } else if (f.kind === "stadium" || f.kind === "arena") {
        b.box(
          x,
          0.035,
          z,
          f.w,
          0.07,
          f.d,
          f.kind === "stadium" ? "#548a61" : "#d1a66e",
        );
        b.box(x, 0.05, z, 0.04, 0.02, f.d - 0.15, "#f4f0d6");
        for (const dx of [-f.w / 2 + 0.12, f.w / 2 - 0.12])
          b.box(x + dx, 0.06, z, 0.05, 0.025, f.d - 0.1, "#f4f0d6");
        for (const dz of [-f.d / 2 + 0.1, f.d / 2 - 0.1])
          b.box(x, 0.06, z + dz, f.w - 0.15, 0.025, 0.04, "#f4f0d6");
        if (f.kind === "stadium") {
          for (let i = -3; i <= 3; i++)
            b.box(x + i * 0.85, 0.06, z, 0.035, 0.02, f.d - 0.25, "#e6f0d5");
          for (const dx of [-3.1, 3.1]) {
            b.cylinder(x + dx, 1, z, 0.035, 1.9, "#eecb78", 8);
            b.box(x + dx, 1.4, z, 0.05, 0.06, 1.2, "#eecb78");
          }
        } else {
          b.torus(x, 0.075, z, 0.65, 0.025, "#faf2d5", Math.PI / 2);
          for (const dx of [-2.9, 2.9]) {
            b.box(x + dx, 0.7, z, 0.07, 1.4, 0.07, palette.accent);
            b.box(x + dx, 1.5, z, 0.08, 0.7, 0.9, "#dbe6dc");
            b.torus(
              x + dx * 0.89,
              1.22,
              z,
              0.21,
              0.035,
              "#d37f51",
              Math.PI / 2,
            );
          }
        }
      } else if (f.kind === "stands") {
        for (let row = 0; row < 2; row++) {
          const zz = z - 0.6 + row * 0.65;
          b.box(x, 0.13 + row * 0.1, zz, f.w, 0.26 + row * 0.2, 0.6, "#b8c7c4");
          for (let col = -3; col <= 3; col++) {
            b.box(
              x + col * 0.7,
              0.35 + row * 0.1,
              zz,
              0.5,
              0.09,
              0.47,
              palette.fabric,
            );
            b.box(
              x + col * 0.7,
              0.55 + row * 0.1,
              zz + 0.2,
              0.5,
              0.38,
              0.07,
              palette.fabric,
            );
          }
        }
        for (const dx of [-f.w / 2, f.w / 2]) {
          b.cylinder(x + dx, 0.58, z, 0.035, 1.16, palette.trim, 6);
          b.box(x + dx, 1.12, z, 0.05, 0.05, f.d, palette.trim);
        }
      } else if (f.kind === "gallery") {
        for (let i = -1; i <= 1; i++) {
          const xx = x + (i * f.w) / 3;
          back.box(xx, 1.8, z, 2, 0.15, 0.18, palette.wood);
          back.box(xx, 1.85, z, 1.8, 1.45, 0.13, palette.wood);
          back.box(
            xx,
            1.85,
            z + 0.08,
            1.59,
            1.24,
            0.04,
            ["#d49e7d", "#688b9c", "#d3b66e"][i + 1],
          );
          back.sphere(xx - 0.28, 2.04, z + 0.12, 0.3, "#f3dfae", 1, 1, 0.1);
          back.box(xx + 0.25, 1.64, z + 0.12, 0.65, 0.6, 0.03, palette.accent);
          back.box(xx, 1.03, z + 0.03, 0.65, 0.1, 0.04, palette.trim);
        }
      } else if (f.kind === "games") {
        b.box(x, 0.5, z, 0.9, 1, 1, "#617a8c");
        b.box(x, 1.4, z - 0.15, 0.9, 0.8, 0.7, palette.accent);
        glow.box(x, 1.45, z + 0.22, 0.67, 0.5, 0.02, "#a8d9bd");
        b.box(x, 1.04, z + 0.33, 0.9, 0.12, 0.5, palette.trim);
        for (const dx of [-0.2, 0.2])
          b.cylinder(x + dx, 1.13, z + 0.4, 0.04, 0.1, palette.fabric, 6);
      }
    }
    if (["cafe", "hospital", "airport", "work", "pavilion"].includes(type))
      plant(hw - 0.7, hd - 1.1, city === "bay" ? 1.15 : 0.85);
    const architecture = buildVenueArchitecture(
      b,
      glow,
      glass,
      layout,
      type,
      loc,
    );
    const floor = new THREE.ShapeGeometry(shape).toNonIndexed();
    floor.rotateX(-Math.PI / 2);
    floor.translate(0, -0.016, 0);
    const pos = floor.getAttribute("position"),
      uv = floor.getAttribute("uv");
    for (let i = 0; i < uv.count; i++)
      uv.setXY(i, pos.getX(i) * 0.7, pos.getZ(i) * 0.7);
    floor.setAttribute(
      "color",
      new THREE.Float32BufferAttribute(
        new Float32Array(pos.count * 3).fill(1),
        3,
      ),
    );
    const props = b.build();
    return {
      props,
      floor,
      glass: glass.parts.length ? glass.build() : null,
      glow: glow.parts.length ? glow.build() : null,
      back: back.parts.length ? back.build() : null,
      front: front.build(),
      wallglow: wallglow.parts.length ? wallglow.build() : null,
      ...architecture,
    };
  }, [layout, palette, hw, hd, type, city, height, windowed, loc]);
  useEffect(
    () => () =>
      Object.values(built).forEach((g) => {
        if (g instanceof THREE.BufferGeometry) g.dispose();
      }),
    [built],
  );
  const decor = useMemo(() => venueDecor(type, layout), [type, layout]);
  const stove = layout.furniture.find((f) => f.kind === "stove"),
    desk = layout.furniture.find((f) => f.kind === "desk");
  return (
    <>
      <RoomWalls
        hw={hw}
        hd={hd}
        palette={palette}
        paper={surfaces.paper}
        open={["pavilion", "stadium", "arena", "ballpark"].includes(type)}
        height={height}
        floor={layout.floor}
        windows={windowed}
      />
      <mesh geometry={built.floor} receiveShadow>
        <meshStandardMaterial
          map={surfaces.floor}
          vertexColors
          roughness={0.88}
        />
      </mesh>
      <mesh
        name={`${type}-interior`}
        geometry={built.props}
        castShadow
        receiveShadow
        userData={{ template: type, stationCount: layout.stations.length }}
      >
        <meshStandardMaterial vertexColors roughness={0.82} />
      </mesh>
      <WallMounted side="front">
        <mesh geometry={built.front} castShadow>
          <meshStandardMaterial vertexColors roughness={0.85} />
        </mesh>
      </WallMounted>
      <WallMounted side="back">
        {built.wallglow && (
          <mesh geometry={built.wallglow}>
            <meshStandardMaterial
              vertexColors
              emissive="#ffe6b6"
              emissiveIntensity={1.5}
            />
          </mesh>
        )}
        {built.back && (
          <mesh name="room-wall-decor" geometry={built.back} castShadow>
            <meshStandardMaterial vertexColors roughness={0.85} />
          </mesh>
        )}
        {windowed && <RoomWindow hd={hd - 0.06} />}
        <WorldText
          position={[0, Math.min(height - 0.6, 8.5), -hd + 0.5]}
          fontSize={Math.max(0.6, Math.min(1.2, hw * 0.065))}
          maxWidth={hw * 1.6}
          distance={500}
          color={palette.trim}
        >
          {name}
        </WorldText>
      </WallMounted>
      {built.signs.map((sign, i) => (
        <WorldText
          key={i}
          position={[sign.x, sign.y, sign.z]}
          fontSize={0.5}
          maxWidth={7}
          distance={500}
          color={sign.color ?? "#f7e2b9"}
        >
          {sign.text}
        </WorldText>
      ))}
      {built.glass && (
        <mesh name="room-glass" geometry={built.glass}>
          <meshStandardMaterial
            vertexColors
            transparent
            opacity={type === "aquarium" ? 0.16 : 0.3}
            roughness={0.2}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
      {built.glow && (
        <mesh name="room-glowing-surfaces" geometry={built.glow}>
          <meshStandardMaterial
            vertexColors
            emissive="#ffe0cb"
            emissiveIntensity={
              type === "club"
                ? 1.7
                : type === "aquarium"
                  ? 0.75
                  : type === "museum"
                    ? 0.8
                    : night
                      ? 0.85
                      : 0.5
            }
          />
        </mesh>
      )}
      <pointLight
        position={[0, Math.min(height - 0.5, 7), 0]}
        intensity={
          type === "club"
            ? 35
            : type === "aquarium"
              ? 18
              : type === "museum"
                ? 110
                : night
                  ? 90
                  : 75
        }
        color={
          type === "aquarium"
            ? "#67b9ce"
            : type === "museum"
              ? "#fff9eb"
              : "#ffe2b5"
        }
        distance={Math.max(hw, hd) * 2.6}
        decay={2}
      />
      {stove && (
        <pointLight
          position={[stove.x, 1.5, stove.z]}
          intensity={4}
          color="#ffc57e"
          distance={4}
        />
      )}
      {desk && (
        <pointLight
          position={[desk.x, 1.35, desk.z + 0.25]}
          intensity={4}
          color="#bbd9ed"
          distance={5}
        />
      )}
      {type === "club" && (
        <>
          <pointLight
            position={[-6, 4, -2]}
            intensity={90}
            color="#ef65ad"
            distance={23}
          />
          <pointLight
            position={[6, 4, -2]}
            intensity={75}
            color="#6ca5f5"
            distance={23}
          />
        </>
      )}
      {type === "foodhall" && (
        <>
          <pointLight
            position={[-13, 4, 3]}
            intensity={90}
            color="#ffd798"
            distance={22}
          />
          <pointLight
            position={[11, 7, -9]}
            intensity={100}
            color="#ffd8a6"
            distance={21}
          />
        </>
      )}
      <Suspense fallback={null}>
        <PropBatch props={decor} name={`${type}-decor`} />
      </Suspense>
      <VenueLiveProps
        type={type}
        loc={loc}
        layout={layout}
        crowd={built.crowd}
      />
      <RoomStaff staff={layout.staff ?? []} />
    </>
  );
}
