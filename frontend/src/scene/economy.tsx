/* oxlint-disable react/immutability -- Imperative Three.js buffers and canvas texture resources. */
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useStore } from "../store";
import type { CityId, PlotAd } from "../api/types";
import { plotRectangle } from "../plot-selection";
import { KitInstances } from "./kit-models";
import { Builder } from "./geometry";
import { WorldText } from "./world-text";
import { fictionalText } from "../content-names";
import { apiFetch, apiUrl } from "../api/base";

import { plotSite, boardSites } from "./economy-sites";
const noPick = () => {};
const LOCAL_ADS = [
  {
    name: "PEACH & PINE",
    line: "Coffee, pie, a place to stay awhile",
    tag: "NEIGHBOURHOOD COFFEE",
    ink: "#fff2d5",
    paper: "#31594a",
  },
  {
    name: "NIGHT OWL",
    line: "Good records. Better company.",
    tag: "RECORDS & LISTENING ROOM",
    ink: "#fff0d7",
    paper: "#514260",
  },
  {
    name: "SUNROOM",
    line: "Fresh bowls. Made around the corner.",
    tag: "KITCHEN & MARKET",
    ink: "#fff5d9",
    paper: "#a6573c",
  },
  {
    name: "MAPLE CYCLE",
    line: "Take the long way home.",
    tag: "REPAIRS • RIDES • RENTALS",
    ink: "#fff2cf",
    paper: "#3c6175",
  },
] as const;
function BookingPosters({
  ads,
  texture,
  width,
  height,
  cols,
  rows,
  night,
}: {
  ads: PlotAd[];
  texture: THREE.Texture;
  width: number;
  height: number;
  cols: number;
  rows: number;
  night: boolean;
}) {
  const mesh = useRef<THREE.InstancedMesh>(null),
    dirty = useRef(true),
    lastCamera = useRef(new THREE.Matrix4()),
    invalidate = useThree((s) => s.invalidate);
  const resources = useMemo(() => {
    const geometry = new THREE.PlaneGeometry(1.5, 1);
    geometry.setAttribute(
      "plotUv",
      new THREE.InstancedBufferAttribute(
        Float32Array.from(
          ads.flatMap((a) => [
            a.x / cols,
            1 - (a.y + a.h) / rows,
            a.w / cols,
            a.h / rows,
          ]),
        ),
        4,
      ),
    );
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      side: THREE.DoubleSide,
      color: night ? "#91a6be" : "#ffffff",
    });
    material.onBeforeCompile = (shader) => {
      shader.vertexShader = "attribute vec4 plotUv;\n" + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        "#include <uv_vertex>",
        "#include <uv_vertex>\n#ifdef USE_MAP\nvMapUv=plotUv.xy+vMapUv*plotUv.zw;\n#endif",
      );
    };
    material.customProgramCacheKey = () => "metro-plot-posters";
    return { geometry, material };
  }, [ads, texture, cols, rows, night]);
  useEffect(() => {
    dirty.current = true;
    invalidate();
    return () => {
      resources.geometry.dispose();
      resources.material.dispose();
    };
  }, [resources, invalidate]);
  useFrame(({ camera, size }) => {
    if (
      !mesh.current ||
      (!dirty.current && lastCamera.current.equals(camera.matrixWorld))
    )
      return;
    dirty.current = false;
    lastCamera.current.copy(camera.matrixWorld);
    const dummy = new THREE.Object3D();
    ads.forEach((a, i) => {
      dummy.position.set(
        -width / 2 + ((a.x + a.w / 2) / cols) * width,
        0,
        -height / 2 + ((a.y + a.h / 2) / rows) * height,
      );
      const world = dummy.position.clone();
      mesh.current!.parent!.localToWorld(world);
      const scale = Math.max(
        3,
        (camera.position.distanceTo(world) *
          2 *
          Math.tan(
            THREE.MathUtils.degToRad(
              (camera as THREE.PerspectiveCamera).fov / 2,
            ),
          ) *
          18) /
          size.height,
      );
      dummy.scale.setScalar(scale);
      dummy.position.y = scale * 0.55;
      dummy.rotation.y = Math.atan2(
        camera.position.x - world.x,
        camera.position.z - world.z,
      );
      dummy.updateMatrix();
      mesh.current!.setMatrixAt(i, dummy.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
    mesh.current.computeBoundingSphere();
  });
  return ads.length ? (
    <instancedMesh
      name="plot-booking-posters"
      ref={mesh}
      args={[resources.geometry, resources.material, ads.length]}
      raycast={noPick}
    />
  ) : null;
}
function PlotField({ city, night }: { city: CityId; night: boolean }) {
  const plots = useStore((s) => s.plots),
    world = useStore((s) => s.world),
    selection = useStore((s) => s.plotSelection),
    username = useStore((s) => s.sim?.username),
    invalidate = useThree((s) => s.invalidate),
    site = plotSite(city),
    cfg = world?.cities.find((c) => c.id === city)?.plots,
    down = useRef<[number, number]>([0, 0]),
    drag = useRef<[number, number] | null>(null),
    dragged = useRef(false);
  const texture = useMemo(() => new THREE.Texture(), []);
  useLayoutEffect(() => {
    const abort = new AbortController(),
      image = new Image();
    let objectUrl = "";
    image.onload = () => {
      if (!abort.signal.aborted) {
        texture.image = image;
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = 16;
        texture.needsUpdate = true;
        invalidate();
      }
    };
    if (plots?.atlas)
      void apiFetch(plots.atlas, { signal: abort.signal })
        .then((r) => (r.ok ? r.blob() : null))
        .then((blob) => {
          if (blob && !abort.signal.aborted) {
            objectUrl = URL.createObjectURL(blob);
            image.src = objectUrl;
          }
        })
        .catch(() => {});
    return () => {
      abort.abort();
      image.onload = null;
      image.removeAttribute("src");
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [plots?.atlas, texture, invalidate]);
  useEffect(() => () => texture.dispose(), [texture]);
  if (!cfg) return null;
  const width = site.size,
    height = (site.size * cfg.rows) / cfg.cols;
  const cellAt = (e: ThreeEvent<PointerEvent>): [number, number] | null => {
    const hit = e.ray.intersectPlane(
      new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.3),
      new THREE.Vector3(),
    );
    return hit
      ? [
          THREE.MathUtils.clamp(
            Math.floor(((hit.x - site.x + width / 2) / width) * cfg.cols),
            0,
            cfg.cols - 1,
          ),
          THREE.MathUtils.clamp(
            Math.floor(((hit.z - site.z + height / 2) / height) * cfg.rows),
            0,
            cfg.rows - 1,
          ),
        ]
      : null;
  };
  return (
    <group position={[site.x, 0.3, site.z]}>
      <BookingPosters
        ads={plots?.ads ?? []}
        texture={texture}
        width={width}
        height={height}
        cols={cfg.cols}
        rows={cfg.rows}
        night={night}
      />
      <KitInstances
        url="/models/kaykit/bench.gltf"
        shadow={false}
        night={night}
        placements={[-1, 1].flatMap((side) =>
          [-0.3, 0.3].map((t) => ({
            x: side * (width / 2 + 1.6),
            y: 0,
            z: height * t,
            sx: 2.4,
            sy: 1.2,
            sz: 1,
            angle: (side * Math.PI) / 2,
            color: "#ffffff",
          })),
        )}
      />
      <KitInstances
        url="/models/world/suburban/planter.glb"
        shadow={false}
        night={night}
        placements={[-1, 1].flatMap((side) =>
          [-0.35, 0, 0.35].map((t) => ({
            x: width * t,
            y: 0,
            z: side * (height / 2 + 1.4),
            sx: 2,
            sy: 1,
            sz: 1.5,
            angle: 0,
            color: "#ffffff",
          })),
        )}
      />
      <mesh position={[0, -0.2, 0]} raycast={noPick}>
        <boxGeometry args={[width + 1, 0.3, height + 1]} />
        <meshStandardMaterial color="#536857" />
      </mesh>
      <mesh
        name="plots-field"
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerDown={(e) => {
          down.current = [e.clientX, e.clientY];
          dragged.current = false;
          const cell = cellAt(e);
          if (useStore.getState().panel === "plots" && cell) {
            e.stopPropagation();
            drag.current = cell;
            useStore
              .getState()
              .setPlotSelection(plotRectangle(cell, cell, cfg.cols, cfg.rows));
            (e.target as Element).setPointerCapture(e.pointerId);
          }
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          const cell = cellAt(e);
          if (!cell) return;
          e.stopPropagation();
          if (cell[0] !== drag.current[0] || cell[1] !== drag.current[1])
            dragged.current = true;
          useStore
            .getState()
            .setPlotSelection(
              plotRectangle(drag.current, cell, cfg.cols, cfg.rows),
            );
        }}
        onPointerUp={(e) => {
          if (drag.current) {
            const cell = cellAt(e);
            if (cell)
              useStore
                .getState()
                .setPlotSelection(
                  plotRectangle(drag.current, cell, cfg.cols, cfg.rows),
                );
            drag.current = null;
            (e.target as Element).releasePointerCapture(e.pointerId);
          }
        }}
        onPointerCancel={(e) => {
          drag.current = null;
          dragged.current = true;
          (e.target as Element).releasePointerCapture(e.pointerId);
        }}
        onClick={(e) => {
          if (
            dragged.current ||
            Math.hypot(
              e.clientX - down.current[0],
              e.clientY - down.current[1],
            ) > 8 ||
            !e.uv
          )
            return;
          e.stopPropagation();
          const current = useStore.getState().plotSelection ?? {
              x: 0,
              y: 0,
              w: 2,
              h: 2,
            },
            x = Math.min(
              cfg.cols - current.w,
              Math.max(0, Math.floor(e.uv.x * cfg.cols)),
            ),
            y = Math.min(
              cfg.rows - current.h,
              Math.max(0, Math.floor((1 - e.uv.y) * cfg.rows)),
            );
          useStore.getState().setPlotSelection({ ...current, x, y });
          useStore.getState().openPanel("plots");
          useStore.getState().setFocus("plots");
        }}
      >
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial
          map={texture}
          color={night ? "#7187a5" : "#ffffff"}
          toneMapped={false}
        />
      </mesh>
      {selection &&
        !plots?.ads.some(
          (a) =>
            a.owner === username &&
            a.x === selection.x &&
            a.y === selection.y &&
            a.w === selection.w &&
            a.h === selection.h,
        ) && (
          <mesh
            position={[
              -width / 2 + ((selection.x + selection.w / 2) / cfg.cols) * width,
              0.04,
              -height / 2 +
                ((selection.y + selection.h / 2) / cfg.rows) * height,
            ]}
            rotation={[-Math.PI / 2, 0, 0]}
            raycast={noPick}
          >
            <planeGeometry
              args={[
                (selection.w / cfg.cols) * width,
                (selection.h / cfg.rows) * height,
              ]}
            />
            <meshBasicMaterial
              color="#5faaff"
              transparent
              opacity={0.55}
              depthWrite={false}
            />
          </mesh>
        )}
    </group>
  );
}
function AdImage({ url }: { url: string }) {
  const texture = useMemo(() => new THREE.Texture(), []),
    invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    let active = true;
    const image = new Image();
    image.onload = () => {
      if (active) {
        texture.image = image;
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.needsUpdate = true;
        invalidate();
      }
    };
    image.crossOrigin = "anonymous";
    image.src = apiUrl(url);
    return () => {
      active = false;
      image.onload = null;
      image.removeAttribute("src");
    };
  }, [url, texture, invalidate]);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <mesh position={[0, 5, 0.17]} raycast={noPick}>
      <planeGeometry args={[6, 3.375]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
}
function Boards({ city }: { city: CityId; night: boolean }) {
  const world = useStore((s) => s.world),
    boards = useStore((s) => s.billboards),
    selected = useStore((s) => s.selectedSlot),
    count = world?.cities.find((c) => c.id === city)?.billboardSlots ?? 0,
    sites = useMemo(() => boardSites(city, count), [city, count]),
    down = useRef<[number, number]>([0, 0]);
  const frame = useMemo(
    () =>
      new Builder()
        .box(-1.8, 2.5, 0, 0.25, 5, 0.25, "#566b60")
        .box(1.8, 2.5, 0, 0.25, 5, 0.25, "#566b60")
        .box(0, 5, 0, 6.3, 3.6, 0.3, "#263f37")
        .build(),
    [],
  );
  useEffect(() => () => frame.dispose(), [frame]);
  return (
    <group name="billboards">
      {sites.map((site, i) => {
        const ad = boards?.slots.find((b) => b.slot === i + 1)?.ad,
          local = LOCAL_ADS[i % LOCAL_ADS.length];
        if (!ad && i >= 3 && selected !== i + 1) return null;
        const title = fictionalText(ad?.title ?? local.name);
        return (
          <group
            key={i}
            position={[site.x, 0, site.z]}
            scale={0.65}
            name={`billboard-${i + 1}`}
          >
            <mesh geometry={frame} raycast={noPick}>
              <meshStandardMaterial vertexColors roughness={0.8} />
            </mesh>
            <mesh
              position={[0, 5, 0.16]}
              onPointerDown={(e) => {
                down.current = [e.clientX, e.clientY];
              }}
              onClick={(e) => {
                if (
                  Math.hypot(
                    e.clientX - down.current[0],
                    e.clientY - down.current[1],
                  ) > 8
                )
                  return;
                e.stopPropagation();
                useStore.getState().selectSlot(i + 1);
                useStore.getState().setFocus("billboard-" + (i + 1));
              }}
            >
              <planeGeometry args={[6, 3.375]} />
              <meshBasicMaterial
                color={ad ? "#294c42" : local.paper}
                toneMapped={false}
              />
            </mesh>
            {ad && <AdImage url={ad.image} />}
            <mesh position={[0, ad ? 3.7 : 5, 0.19]} raycast={noPick}>
              <planeGeometry args={[5.8, ad ? 0.85 : 1.9]} />
              <meshBasicMaterial
                color={local.paper}
                transparent
                opacity={0.96}
                toneMapped={false}
              />
            </mesh>
            <WorldText
              position={[0, ad ? 3.7 : 5, 0.205]}
              fontSize={ad ? 0.4 : 0.61}
              maxWidth={5.4}
              color={local.ink}
              distance={80}
            >
              {title.length > 24 ? title.slice(0, 23) + "..." : title}
            </WorldText>
          </group>
        );
      })}
    </group>
  );
}
export function EconomyScene({ night }: { night: boolean }) {
  const city = useStore((s) => s.city),
    worldId = useStore((s) => s.worldInfo?.id);
  return (
    <group key={`${city}:${worldId ?? "public"}`}>
      <Suspense fallback={null}>
        <PlotField city={city} night={night} />
      </Suspense>
      <Boards city={city} night={night} />
    </group>
  );
}
