/* oxlint-disable react/only-export-components -- Layout exports feed the shared navigation generator. */
import { Suspense, useEffect, useLayoutEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { grassify } from "./ground-material";
import { timeOfDay } from "../lighting";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { Builder } from "./geometry";
import { KitInstances } from "./kit-models";
import type { Placement } from "./fabric";
import { homeSitesFor, outsideHomes, sitesFor } from "./cities";
import { nycEast, nycLand } from "./cities/nyc";
import { bayWest, bayEast, bayMarin } from "./cities/bay";
import { suspension } from "./metropolitan-models";
import osm from "./city-osm.json";
import { metricPlacement } from "./world-scale";
import { fitMetricGroups } from "./metric-layout";
import { outsidePlots, outsideBoards } from "./economy-sites";
import { Trees } from "./trees";
import { navigation } from "../navigation";
import { useEffectiveQuality } from "./render-quality";
const noPick = () => {};
function inside(x: number, z: number, poly: number[][]) {
  let yes = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i],
      b = poly[j];
    if (
      a[1] > z !== b[1] > z &&
      x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0]
    )
      yes = !yes;
  }
  return yes;
}
function land(b: Builder, poly: number[][], color: string) {
  const s = new THREE.Shape();
  poly.forEach(([x, z], i) => (i ? s.lineTo(x, -z) : s.moveTo(x, -z)));
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, {
    depth: 0.8,
    bevelEnabled: true,
    bevelSize: 0.7,
    bevelThickness: 0.2,
    bevelSegments: 1,
  });
  g.rotateX(-Math.PI / 2);
  b.add(g, color, 0, -0.95, 0);
}
export function dataFor(city: "nyc" | "bay") {
  const b = new Builder(),
    shore = new Builder(),
    sites = Object.fromEntries(
      Object.entries(sitesFor(city)).filter(([id]) => !/Bus$/.test(id)),
    ),
    polys = city === "nyc" ? [nycLand, nycEast] : [bayWest, bayEast, bayMarin];
  let seed = city === "nyc" ? 57 : 89;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const p = (
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    color: string,
    angle = 0,
  ): Placement => ({ x, y, z, sx, sy, sz, color, angle });
  const homes: Placement[] = [],
    blocks: Placement[] = [],
    towers: Placement[] = [],
    brownstones: Placement[] = [],
    victorianRows: Placement[] = [],
    trees: Placement[] = [],
    cars: Placement[] = [],
    roads: Placement[] = [];
  const isLand = (x: number, z: number) =>
    polys.some((poly) => inside(x, z, poly));
  const footprints: Record<string, [number, number]> = {
    empire: [14, 11],
    oneWtc: [19, 19],
    grandCentral: [21, 15],
    met: [29, 20],
    cityHall: [18, 12],
    centralPark: [25, 34],
    brooklynBridge: [10, 43],
    goldenGate: [10, 64],
    ferryBuilding: [27, 12],
    salesforce: [15, 22],
    sfCityHall: [30, 18],
    paintedLadies: [20, 14],
    ggPark: [25, 13],
    dolores: [18, 14],
    highLine: [4, 21],
  };
  const clearSite = (x: number, z: number, pad: number) =>
    outsideHomes(city, x, z, pad) &&
    outsidePlots(city, x, z, pad) &&
    outsideBoards(city, x, z, pad) &&
    Object.entries(sites).every(([id, s]) => {
      const a = s.angle ?? 0,
        dx = x - s.x,
        dz = z - s.z,
        lx = dx * Math.cos(a) - dz * Math.sin(a),
        lz = dx * Math.sin(a) + dz * Math.cos(a),
        [w, d] = footprints[id] ?? [s.size * 0.9, s.size * 0.9];
      return Math.abs(lx) > w * 0.5 + pad || Math.abs(lz) > d * 0.5 + pad;
    });
  // The street camera sits behind the player at a door, so nothing stands in that view.
  const doors = Object.values(navigation[city].doors),
    inDoorView = (
      x: number,
      z: number,
      side: number,
      depth: number,
      hx = 0,
      hz = 0,
    ) =>
      doors.some(
        (d) =>
          Math.abs(x - d.x) < side + hx &&
          z - d.z + hz > -1 &&
          z - d.z - hz < depth,
      );
  const baseHill = (x: number, z: number) => {
    if (city !== "bay" || x > -30 || z < -43 || z > 70) return 0;
    let height =
      9 * Math.exp(-((x + 76) ** 2 + (z + 22) ** 2) / 600) +
      6 * Math.exp(-((x + 55) ** 2 + (z - 49) ** 2) / 500);
    for (const s of Object.values(sites))
      height *= Math.min(
        1,
        Math.max(0, (Math.hypot(x - s.x, z - s.z) - s.size * 0.53) / 10),
      );
    for (const s of homeSitesFor(city))
      height *= Math.min(
        1,
        Math.max(0, (Math.hypot(x - s.x, z - s.z) - 5) / 5),
      );
    return height;
  };
  if (city === "bay")
    for (const z of [-32, -20, -8, 4, 16, 28, 40, 52, 64])
      for (const x of [-81, -72, -63, -54, -45, -36]) {
        if (
          victorianRows.length >= 5 ||
          ![-1, 1].every((a) =>
            [-1, 1].every((c) => isLand(x + a * 6.5, z + c * 2.5)),
          ) ||
          !clearSite(x, z, 6.5) ||
          victorianRows.some((r) => Math.hypot(r.x - x, r.z - z) < 17)
        )
          continue;
        victorianRows.push(
          p(x, baseHill(x, z) + 0.1, z, 13, 4.8, 4.5, "#ffffff"),
        );
      }
  const hill = (x: number, z: number) => {
    let height = baseHill(x, z);
    for (const row of victorianRows) {
      const outside = Math.hypot(
          Math.max(0, Math.abs(x - row.x) - 7),
          Math.max(0, Math.abs(z - row.z) - 3),
        ),
        blend = Math.max(0, 1 - outside / 4);
      height = height * (1 - blend) + (row.y - 0.1) * blend;
    }
    for (const home of homeSitesFor(city))
      height *= THREE.MathUtils.smoothstep(
        Math.hypot(x - home.x, z - home.z),
        7,
        13,
      );
    return height;
  };
  if (city === "bay")
    for (let z = -44; z < 72; z += 4)
      for (let x = -94; x < -30; x += 4) {
        if (
          ![
            [0, 0],
            [4, 0],
            [0, 4],
            [4, 4],
          ].every(([dx, dz]) => isLand(x + dx, z + dz))
        )
          continue;
        const a = [x, hill(x, z) + 0.08, z],
          c = [x + 4, hill(x + 4, z) + 0.08, z],
          d = [x, hill(x, z + 4) + 0.08, z + 4],
          e = [x + 4, hill(x + 4, z + 4) + 0.08, z + 4];
        if (Math.max(a[1], c[1], d[1], e[1]) > 0.1)
          shore.triangle([...a, ...d, ...c, ...c, ...d, ...e], "#7fae80");
      }
  for (const poly of polys) {
    land(shore, poly, city === "nyc" ? "#91ab8d" : "#7fae80");
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i],
        c = poly[(i + 1) % poly.length];
      const length = Math.hypot(c[0] - a[0], c[1] - a[1]),
        steps = Math.max(1, Math.ceil(length / 2)),
        nx = (a[1] - c[1]) / length,
        nz = (c[0] - a[0]) / length;
      // Where land polygons overlap, an edge runs across dry ground: no kerb there.
      for (let k = 0; k < steps; k++) {
        const t0 = k / steps,
          t1 = (k + 1) / steps,
          mx = a[0] + ((c[0] - a[0]) * (t0 + t1)) / 2,
          mz = a[1] + ((c[1] - a[1]) * (t0 + t1)) / 2;
        if (
          isLand(mx + nx * 1.2, mz + nz * 1.2) &&
          isLand(mx - nx * 1.2, mz - nz * 1.2)
        )
          continue;
        shore.line(
          [a[0] + (c[0] - a[0]) * t0, 0.2, a[1] + (c[1] - a[1]) * t0],
          [a[0] + (c[0] - a[0]) * t1, 0.2, a[1] + (c[1] - a[1]) * t1],
          0.75,
          "#d7d9cd",
        );
      }
    }
  }
  // Separate island and hills: geometry, not a flat square edge.
  if (city === "nyc") {
    shore.sphere(-51, 0, 79, 1, "#a7c28e", 9, 0.7, 8);
    b.box(-20, 0.25, -45, 22, 0.1, 34, "#82b478");
  } else {
    for (const [x, z, s] of [
      [-75, -85, 19],
      [-42, -92, 17],
      [-65, 27, 12],
    ])
      shore.sphere(x, -1, z, 1, "#9db68d", s, 4, s);
    const bridge = suspension(new Builder(), "#9daeb2", 55, 14).build();
    bridge.rotateY(Math.PI / 2 + 0.1);
    bridge.translate(30, 0, -5.25);
    b.add(bridge, "#a4b2b3");
  }
  for (let z = -83; z < 118; z += 8)
    for (let x = -83; x < 114; x += 8) {
      if (
        !isLand(x, z) ||
        (city === "bay" && z < -49 && x < 40) ||
        (city === "nyc" && x > -33 && x < -7 && z > -65 && z < -27)
      )
        continue;
      const clear =
        clearSite(x, z, 2.4) &&
        !victorianRows.some(
          (r) => Math.abs(x - r.x) < 9 && Math.abs(z - r.z) < 6,
        );
      if (!clear) continue;
      const px = x + (rand() - 0.5),
        pz = z + (rand() - 0.5),
        downtown =
          city === "nyc"
            ? x < 9 && z > -27 && z < 53
            : x > -42 && x < 13 && z > -30 && z < 45;
      const brownstone = city === "nyc" && (x > 25 || z < -58),
        victorian = city === "bay" && x < -26 && z < 58;
      const type =
          downtown && rand() > 0.25
            ? towers
            : brownstone || (!victorian && rand() > 0.45)
              ? blocks
              : homes,
        h =
          type === towers
            ? 7 + rand() * (city === "bay" ? 9 : 17)
            : type === blocks
              ? 3 + rand() * 4
              : 2 + rand() * 1.5,
        w = 2.6 + rand() * 2.3,
        d = 2.5 + rand() * 2;
      const color =
        type === towers
          ? ["#98b4c1", "#b2c2c9", "#d0d6d1"][Math.floor(rand() * 3)]
          : brownstone
            ? ["#976c59", "#b88c6d", "#9f7968"][Math.floor(rand() * 3)]
            : victorian
              ? ["#d6c8b3", "#c9b8ba", "#adbec1", "#b6c3a7"][
                  Math.floor(rand() * 4)
                ]
              : "#cabfa9";
      const visibleHeight =
        type === towers &&
        Object.values(sites).some(
          (s) =>
            Math.abs(px - s.x) < s.size * 0.7 &&
            pz - s.z > s.size * 0.35 &&
            pz - s.z < s.size * 0.6 + 15,
        )
          ? Math.min(h, 5)
          : h;
      const ground = hill(px, pz);
      if (city === "nyc" && x < 18) {
        // Four narrow buildings occupy a buildable Manhattan block, sharing the street grid.
        for (const dx of [-1.45, 1.45])
          for (const dz of [-1.45, 1.45]) {
            if (!clearSite(x + dx, z + dz, 1.4)) continue;
            const tall = downtown && rand() > 0.18,
              group = tall ? towers : blocks,
              height = tall
                ? Math.max(visibleHeight, 8 + rand() * 10)
                : 4 + rand() * 5;
            group.push(
              p(
                x + dx,
                0,
                z + dz,
                2.5,
                height,
                2.5,
                tall ? color : "#b6a695",
                rand() > 0.5 ? Math.PI : 0,
              ),
            );
          }
      } else if (brownstone) {
        // Attached front-facing walk-ups, with shared cornice height and individual stoops.
        for (const dx of [-1.75, 0, 1.75]) {
          brownstones.push(
            p(px + dx, ground, pz, 1.7, 5 + rand(), 3.7, color, 0),
          );
        }
      } else type.push(p(px, ground, pz, w, visibleHeight, d, color));
      if (rand() > 0.6)
        cars.push(
          p(
            x - 4,
            0.5,
            z,
            0.65,
            0.4,
            1.2,
            ["#e6c98e", "#b0806f", "#b7cbc6"][Math.floor(rand() * 3)],
          ),
        );
    }
  for (const group of [homes, blocks, towers]) {
    const kept = group.filter(
      (b) => !inDoorView(b.x, b.z, 3.5, 14, b.sx / 2, b.sz / 2),
    );
    group.splice(0, group.length, ...kept);
  }
  const rowCount = brownstones.length / 3,
    selectedBrownstones = brownstones.filter((_, i) => {
      const row = Math.floor(i / 3);
      return (
        Math.floor(((row + 1) * 24) / rowCount) >
        Math.floor((row * 24) / rowCount)
      );
    });
  for (let i = 0; i < 470; i++) {
    const x = rand() * 210 - 95,
      z = rand() * 220 - 98;
    if (!isLand(x, z) || !clearSite(x, z, 0.8)) continue;
    const inPark = city === "nyc" && x > -33 && x < -7 && z > -65 && z < -27;
    if (city === "nyc" && !inPark && rand() > 0.22) continue;
    const s = 0.6 + rand() * 0.6,
      tint = ["#76946b", "#879d76", "#64866c"][Math.floor(rand() * 3)];
    if (inDoorView(x, z, 5.5, 17)) continue;
    trees.push(p(x, hill(x, z), z, s, s, s, tint));
  }
  // Retain surveyed bearings around the successful OSM extracts. Larger landmark
  // footprints require local clearance in this deliberately compressed city map.
  const mainRoads: Placement[] = [];
  for (const street of osm.cities[city].streets) {
    if (
      !(
        city === "nyc"
          ? /^(West Street|Church Street|Broadway)$/
          : /^(The Embarcadero|Market Street)$/
      ).test(street.name)
    )
      continue;
    for (let i = 1; i < street.points.length; i++) {
      const a = street.points[i - 1],
        c = street.points[i],
        dx = c[0] - a[0],
        dz = c[1] - a[1],
        length = Math.hypot(dx, dz),
        n = Math.max(1, Math.ceil(length / 3));
      for (let j = 0; j < n; j++) {
        const t = (j + 0.5) / n,
          x = a[0] + dx * t,
          z = a[1] + dz * t;
        if (
          !isLand(x, z) ||
          Object.values(sites).some(
            (s) => Math.hypot(x - s.x, z - s.z) < s.size * 0.48 + 1,
          ) ||
          mainRoads.some((r) => Math.hypot(r.x - x, r.z - z) < 1.2)
        )
          continue;
        mainRoads.push(
          p(
            x,
            0.05,
            z,
            2.3,
            0.1,
            length / n + 0.15,
            "#ffffff",
            Math.atan2(dx, dz),
          ),
        );
      }
    }
  }
  // Street network exists independently of buildable lots, so landmark clearings
  // do not leave disconnected strips of asphalt around every building.
  for (let z = -83; z < 118; z += 8)
    for (let x = -87; x < 114; x += 8) {
      if (
        !isLand(x, z) ||
        (city === "bay" && z < -49 && x < 40) ||
        (city === "nyc" && x > -33 && x < -7 && z > -65 && z < -27)
      )
        continue;
      if (!clearSite(x, z, 1.3)) continue;
      if (!roads.some((r) => Math.hypot(r.x - x, r.z - z) < 2))
        roads.push(p(x, 0.025, z, 2.3, 0.1, 8, "#ffffff"));
    }
  for (let z = -87; z < 118; z += 8)
    for (let x = -83; x < 114; x += 8) {
      if (
        !isLand(x, z) ||
        (city === "bay" && z < -49 && x < 40) ||
        (city === "nyc" && x > -33 && x < -7 && z > -65 && z < -27) ||
        !clearSite(x, z, 1.3)
      )
        continue;
      roads.push(p(x, 0.025, z, 2.3, 0.1, 8, "#ffffff", Math.PI / 2));
    }
  const connectedRoads = roads
    .filter((r) => !mainRoads.some((m) => Math.hypot(m.x - r.x, m.z - r.z) < 3))
    .concat(mainRoads);
  for (const road of connectedRoads) {
    const dx = Math.sin(road.angle) * road.sz * 0.5,
      dz = Math.cos(road.angle) * road.sz * 0.5;
    road.y += hill(road.x, road.z);
    road.pitch = -Math.atan2(
      hill(road.x + dx, road.z + dz) - hill(road.x - dx, road.z - dz),
      road.sz,
    );
  }
  for (const car of cars) car.y = hill(car.x, car.z) + 0.08;
  return {
    hill,
    land: shore.build(),
    streets: b.build(),
    homes,
    blocks,
    towers,
    brownstones: selectedBrownstones,
    victorianRows,
    trees,
    cars,
    roads: connectedRoads,
  };
}
const dayGround = new THREE.Color("#86b86a");
export function MetropolitanFabric({ city }: { city: "nyc" | "bay" }) {
  const landMaterial = useMemo(
    () =>
      grassify(
        new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }),
        "land",
      ),
    [],
  );
  useEffect(() => () => landMaterial.dispose(), [landMaterial]);
  // The authored land colours stay; the clock scales them like the flat grass.
  useFrame(() => {
    landMaterial.color.copy(timeOfDay.ground).multiply({
      r: 1 / dayGround.r,
      g: 1 / dayGround.g,
      b: 1 / dayGround.b,
    } as THREE.Color);
  });
  const data = useMemo(() => dataFor(city), [city]);
  useEffect(
    () => () => {
      data.land.dispose();
      data.streets.dispose();
    },
    [data],
  );
  const groups = useMemo(() => metropolitanGroups(data, city), [data, city]);
  const quality = useEffectiveQuality();
  const trees = useMemo(
    () =>
      Object.entries(groups)
        .filter(([url]) => url.includes("tree-"))
        .flatMap(([, list]) => list),
    [groups],
  );
  useLayoutEffect(() => {
    Object.keys(groups)
      .filter((url) => !url.includes("tree-"))
      .forEach((url) => useGLTF.preload(`/models/${url}`));
  }, [groups]);
  return (
    <group>
      <mesh
        name="terrain"
        geometry={data.land}
        material={landMaterial}
        matrixAutoUpdate={false}
        receiveShadow
        raycast={noPick}
      />
      <mesh
        geometry={data.streets}
        matrixAutoUpdate={false}
        receiveShadow
        castShadow
        raycast={noPick}
      >
        <meshStandardMaterial vertexColors roughness={0.85} />
      </mesh>
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
              url={"/models/" + url}
              placements={placements}
              shadow={/building_[DEFH]_|painted-row/.test(url)}
            />
          </Suspense>
        ))}
    </group>
  );
}

export function metropolitanGroups(
  data: ReturnType<typeof dataFor>,
  city: "nyc" | "bay",
) {
  const result: Record<string, Placement[]> = {},
    add = (url: string, p: Placement) => {
      (result[url] ??= []).push(metricPlacement(url, p));
    },
    sample = (p: Placement[], n: number) =>
      p.filter(
        (_, i) =>
          Math.floor(((i + 1) * n) / p.length) > Math.floor((i * n) / p.length),
      ),
    soft = (p: Placement) => ({
      ...p,
      color:
        "#" +
        new THREE.Color(p.color)
          .lerp(new THREE.Color("#ffffff"), 0.4)
          .getHexString(),
      angle: ((Math.round((p.x + p.z) / 8) % 4) * Math.PI) / 2,
    });
  sample(data.homes, city === "bay" ? 60 : 20).forEach((p, i) =>
    add("kaykit/building_" + ["A", "B"][i % 2] + "_withoutBase.gltf", soft(p)),
  );
  sample(data.blocks, city === "bay" ? 54 : 40).forEach((p, i) =>
    add(
      "kaykit/building_" +
        (city === "bay" ? ["A", "C", "D"] : ["C", "D", "E"])[i % 3] +
        "_withoutBase.gltf",
      soft(p),
    ),
  );
  sample(data.towers, city === "bay" ? 14 : 42).forEach((p) =>
    add("kaykit/building_H_withoutBase.gltf", {
      ...soft(p),
      sy: Math.min(p.sy, 24),
      angle: p.angle,
    }),
  );
  data.brownstones.forEach((p) =>
    add("kaykit/building_C_withoutBase.gltf", {
      ...p,
      color:
        "#" +
        new THREE.Color(p.color)
          .lerp(new THREE.Color("#ffffff"), 0.15)
          .getHexString(),
    }),
  );
  data.victorianRows.forEach((p) => {
    (result["landmarks/painted-row-lod.glb"] ??= []).push({ ...p, scale: 1 });
  });
  data.trees
    .filter((_, i) => city === "nyc" || i % 2 === 0)
    .forEach((p, i) =>
      add("world/suburban/tree-" + (i % 2 ? "small" : "large") + ".glb", {
        ...p,
        sx: p.sx * 2,
        sy: p.sy * 3,
        sz: p.sz * 2,
        color: "#f0ffe9",
      }),
    );
  data.cars
    .filter((_, i) => i % (city === "bay" ? 30 : 12) === 0)
    .forEach((p, i) =>
      add("kaykit/car_" + (i % 2 ? "sedan" : "hatchback") + ".gltf", {
        ...p,
        sx: 0.7,
        sy: 0.55,
        sz: 1.3,
        color: "#ffffff",
      }),
    );
  data.roads.forEach((p, i) => {
    add("kaykit/road_straight.gltf", p);
    if (i % 28 === 0)
      add("kaykit/streetlight.gltf", {
        ...p,
        x: p.x + 1.5,
        sx: 0.8,
        sy: 2.5,
        sz: 0.25,
        pitch: 0,
      });
  });
  return fitMetricGroups(city, result, data.hill);
}
