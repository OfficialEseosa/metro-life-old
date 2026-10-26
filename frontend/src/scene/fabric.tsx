/* oxlint-disable react/only-export-components -- Layout exports feed the shared navigation generator. */
import { Suspense, useLayoutEffect, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { outsideHomes } from "./cities";
import { atlSites } from "./cities/atl";
import { KitInstances } from "./kit-models";
import osm from "./atl-osm.json";
import { metricPlacement } from "./world-scale";
import { fitMetricGroups } from "./metric-layout";
import { outsidePlots, outsideBoards } from "./economy-sites";
import { outsideAtlantaTowers } from "./atlanta-models";
import { Trees } from "./trees";
import { navigation } from "../navigation";
import { useEffectiveQuality } from "./render-quality";

export type Placement = {
  x: number;
  y: number;
  z: number;
  sx: number;
  sy: number;
  sz: number;
  angle: number;
  color: string;
  pitch?: number;
  scale?: number;
};

function fabricData() {
  let seed = 421;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const homes: Placement[] = [],
    blocks: Placement[] = [],
    towers: Placement[] = [],
    trees: Placement[] = [],
    lamps: Placement[] = [],
    cars: Placement[] = [];
  const p = (
    x: number,
    z: number,
    sx = 1,
    sy = 1,
    sz = 1,
    color = "#ffffff",
    angle = 0,
  ): Placement => ({ x, y: 0, z, sx, sy, sz, color, angle });
  const clear = (x: number, z: number, margin = 3) =>
    outsideHomes("atl", x, z, margin) &&
    outsidePlots("atl", x, z, margin) &&
    outsideBoards("atl", x, z, margin) &&
    Object.values(atlSites).every(
      (s) => Math.hypot(s.x - x, s.z - z) > s.size * 0.5 + margin,
    );
  for (let z = -64; z <= 64; z += 9)
    for (let x = -63; x <= 63; x += 9) {
      const px = x + (rand() - 0.5) * 2,
        pz = z + (rand() - 0.5) * 2;
      if (
        !clear(px, pz) ||
        Math.abs(px) < 5 ||
        Math.abs(px % 20) < 3 ||
        Math.abs(pz % 20) < 3
      )
        continue;
      const central = Math.abs(px) < 20 && pz > -45 && pz < 40,
        buckhead = pz < -48 && px > -5 && px < 35,
        oldFourth = px > 22 && px < 45 && pz > -25 && pz < 35,
        west = px < -25 && pz > 10;
      const kind =
        (central && rand() > 0.3) || (buckhead && rand() > 0.45)
          ? towers
          : oldFourth || (rand() > 0.7 && !west)
            ? blocks
            : homes;
      const height =
        kind === towers
          ? 8 + rand() * 9
          : kind === blocks
            ? 3 + rand() * 3
            : 1.7 + rand() * 1.3;
      kind.push(
        p(
          px,
          pz,
          2.3 + rand() * 2.5,
          height,
          2.2 + rand() * 2,
          oldFourth
            ? "#e5c0b0"
            : west
              ? "#f0d6ba"
              : buckhead
                ? "#cce6ff"
                : "#e2f2d7",
        ),
      );
    }
  for (let i = 0; i < 420; i++) {
    const a = rand() * Math.PI * 2,
      r = Math.sqrt(rand()),
      x = Math.cos(a) * 110 * r,
      z = Math.sin(a) * 115 * r;
    // A wide clearing keeps trees out of the arrival plazas the camera looks across.
    if (clear(x, z, 8) && Math.abs(x) > 3) {
      const k = 0.7 + rand() * 0.9;
      trees.push(p(x, z, k, k, k));
    }
  }
  for (let z = -65; z <= 60; z += 8) {
    lamps.push(p(2.7, z), p(-2.7, z));
    cars.push(p(rand() > 0.5 ? -0.9 : 0.9, z + rand() * 5));
  }
  return { homes, blocks, towers, trees, lamps, cars };
}

export function kitFabric() {
  const source = fabricData(),
    groups: Record<string, Placement[]> = {};
  const add = (url: string, p: Placement) => {
    (groups[url] ??= []).push(metricPlacement(url, p));
  };
  const sample = (items: Placement[], n: number) =>
    items.filter(
      (_, i) =>
        Math.floor(((i + 1) * n) / items.length) >
        Math.floor((i * n) / items.length),
    );
  const gentle = (p: Placement) => ({
    ...p,
    color:
      "#" +
      new THREE.Color(p.color)
        .lerp(new THREE.Color("#ffffff"), 0.8)
        .getHexString(),
    angle: ((Math.round((p.x + p.z) / 9) % 4) * Math.PI) / 2,
  });
  sample(source.homes, 58).forEach((p, i) =>
    add(
      `kaykit/building_${["A", "B", "C"][i % 3]}_withoutBase.gltf`,
      gentle(p),
    ),
  );
  sample(source.blocks, 22).forEach((p, i) =>
    add(
      `kaykit/building_${["D", "E", "F"][i % 3]}_withoutBase.gltf`,
      gentle(p),
    ),
  );
  sample(
    source.towers.filter((p) => Math.hypot(p.x + 12, p.z - 4) > 29),
    16,
  ).forEach((p) => add("kaykit/building_H_withoutBase.gltf", gentle(p)));
  source.trees
    .filter(
      (p) =>
        !(p.x > 5 && p.x < 35 && p.z > -54 && p.z < -17) &&
        !(p.x > -27 && p.x < 0 && p.z > -12 && p.z < 23),
    )
    .forEach((p, i) =>
      add(`world/suburban/tree-${i % 2 ? "small" : "large"}.glb`, {
        ...p,
        sx: p.sx * 1.8,
        sy: p.sy * 3.2,
        sz: p.sz * 1.8,
        color: "#efffec",
      }),
    );
  source.lamps.forEach((p) =>
    add("kaykit/streetlight.gltf", {
      ...p,
      sx: 0.8,
      sy: 2.5,
      sz: 0.25,
      color: "#ffffff",
    }),
  );
  source.cars.forEach((p, i) =>
    add(`kaykit/car_${i % 2 ? "hatchback" : "sedan"}.gltf`, {
      ...p,
      sx: 0.7,
      sy: 0.6,
      sz: 1.3,
      color: "#ffffff",
      angle: i % 2 ? 0 : Math.PI,
    }),
  );
  const park = (x: number, z: number) =>
    (x > 5 && x < 35 && z > -55 && z < -16) ||
    (x > -28 && x < 0 && z > -15 && z < 23);
  const clearRoad = (x: number, z: number) =>
    outsideHomes("atl", x, z, 3) &&
    outsidePlots("atl", x, z, 3) &&
    !park(x, z) &&
    Object.entries(atlSites).every(
      ([id, s]) =>
        id === "beltline" || Math.hypot(x - s.x, z - s.z) > s.size * 0.47 + 1,
    );
  const tile = (x: number, z: number, angle: number, type = "straight") => {
    if (clearRoad(x, z) && !(x > -46 && x < 0 && z > -20 && z < 53))
      add(`kaykit/road_${type}.gltf`, {
        x,
        y: 0.02,
        z,
        sx: 3.4,
        sy: 0.1,
        sz: 4,
        angle,
        color: "#ffffff",
      });
  };
  for (let x = -60; x <= 60; x += 20)
    for (let z = -68; z <= 68; z += 4) if (z % 20 !== 0) tile(x, z, 0);
  for (let z = -60; z <= 60; z += 20)
    for (let x = -64; x <= 64; x += 4)
      if (x % 20 !== 0) tile(x, z, Math.PI / 2);
  for (let x = -60; x <= 60; x += 20)
    for (let z = -60; z <= 60; z += 20) tile(x, z, 0, "junction");
  // Real OSM street bearings around downtown, rendered with existing road kit tiles.
  for (const street of osm.streets.filter((s) =>
    /Marietta Street|Centennial Olympic Park Drive|Andrew Young International|Northside Drive|Martin Luther King/.test(
      s.name,
    ),
  ))
    for (let i = 1; i < street.points.length; i++) {
      const a = street.points[i - 1],
        b = street.points[i],
        length = Math.hypot(b[0] - a[0], b[1] - a[1]),
        angle = Math.atan2(b[0] - a[0], b[1] - a[1]);
      if (length < 0.15) continue;
      const count = Math.ceil(length / 3.4);
      for (let j = 0; j < count; j++) {
        const t = (j + 0.5) / count,
          x = a[0] + (b[0] - a[0]) * t,
          z = a[1] + (b[1] - a[1]) * t;
        if (Math.abs(x) < 46 && z > -20 && z < 53 && clearRoad(x, z))
          add("kaykit/road_straight.gltf", {
            x,
            y: 0.025,
            z,
            sx: 2,
            sy: 0.1,
            sz: length / count,
            angle,
            color: "#ffffff",
          });
      }
    }
  const fitted = fitMetricGroups("atl", groups),
    doors = Object.values(navigation.atl.doors),
    // The street camera sits behind the player at a door, so no tree stands in that view.
    inDoorView = (p: Placement) =>
      doors.some(
        (d) => Math.abs(p.x - d.x) < 5.5 && p.z - d.z > -1 && p.z - d.z < 17,
      );
  return Object.fromEntries(
    Object.entries(fitted).map(([url, placements]) => [
      url,
      placements.filter(
        (p) =>
          outsideAtlantaTowers(p.x, p.z, Math.hypot(p.sx, p.sz) / 2 + 0.5) &&
          !(url.includes("tree-") && inDoorView(p)),
      ),
    ]),
  );
}
export function Fabric() {
  const groups = useMemo(() => kitFabric(), []);
  const quality = useEffectiveQuality();
  const trees = useMemo(
    () =>
      Object.entries(groups)
        .filter(([url]) => url.includes("tree-"))
        .flatMap(([, list]) => list),
    [groups],
  );
  // Start every kit request together; one slow file cannot hold back the whole city.
  useLayoutEffect(() => {
    Object.keys(groups)
      .filter((url) => !url.includes("tree-"))
      .forEach((url) => useGLTF.preload(`/models/${url}`));
  }, [groups]);
  return (
    <group>
      <Trees spots={trees} density={quality === "low" ? 0.5 : 1} />
      {Object.entries(groups)
        .filter(
          ([url]) =>
            !url.includes("car_") &&
            !url.includes("road_") &&
            !url.includes("tree-"),
        )
        .map(([url, placements]) => (
          <Suspense key={url} fallback={null}>
            <KitInstances
              url={`/models/${url}`}
              placements={placements}
              shadow={!/road_|car_|building_[ABC]_|building-type/.test(url)}
            />
          </Suspense>
        ))}
    </group>
  );
}
