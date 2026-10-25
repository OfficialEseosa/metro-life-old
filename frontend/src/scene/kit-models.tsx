import { bakeBuildingContact } from "./baked-contact";
import { CarLights } from "./car-lights";
import { windowMask } from "./window-mask";
import { skylineWindows } from "./skyline-windows";
import { NightPools } from "./night-pools";
/* oxlint-disable react/immutability -- shared Three.js buffers and instance matrices are renderer resources. */
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useGLTF } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { Placement } from "./fabric";
import { ATLANTA_BLENDER_LANDMARKS, ATLANTA_TOWERS } from "./atlanta-models";
import { atlSites } from "./cities/atl";
import { lightUniforms } from "../lighting";

export type DriveRoute = {
  x: number;
  z: number;
  ex: number;
  ez: number;
  y: number;
  ey: number;
};
const noPick = () => {};
/** Bake the glTF hierarchy once, keeping its atlas and normals, then instance each material batch. */
export function KitInstances({
  url,
  placements,
  shadow = true,
  drive,
}: {
  url: string;
  placements: Placement[];
  shadow?: boolean;
  drive?: DriveRoute[];
}) {
  const { scene } = useGLTF(url);
  const { gl, invalidate } = useThree();
  useLayoutEffect(() => {
    gl.shadowMap.needsUpdate = true;
    invalidate();
  }, [scene, gl, invalidate]);
  const batches = useMemo(() => {
    scene.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(scene),
      center = bounds.getCenter(new THREE.Vector3());
    const normalize = new THREE.Matrix4().makeTranslation(
      -center.x,
      -bounds.min.y,
      -center.z,
    );
    const groups = new Map<
      string,
      { parts: THREE.BufferGeometry[]; material: THREE.MeshStandardMaterial }
    >();
    scene.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      const source = (
        Array.isArray(o.material) ? o.material[0] : o.material
      ) as THREE.MeshStandardMaterial;
      const g = o.geometry.clone();
      g.applyMatrix4(o.matrixWorld);
      g.applyMatrix4(normalize);
      for (const name of Object.keys(g.attributes))
        if (!["position", "normal", "uv", "color"].includes(name))
          g.deleteAttribute(name);
      const group = groups.get(source.uuid) ?? {
        parts: [],
        material: source.clone(),
      };
      group.parts.push(g);
      groups.set(source.uuid, group);
    });
    return [...groups.values()].map(({ parts, material }) => {
      const geometry = mergeGeometries(parts);
      parts.forEach((p) => p.dispose());
      if (!geometry) throw Error(`Cannot merge kit ${url}`);
      material.roughness = 0.78;
      // Keep pure-white atlas texels from clipping under the bright sun.
      material.color.multiplyScalar(0.96);
      if (material.map) material.map.anisotropy = 8;
      // Streets meet the terrain at y=0; bias their coplanar faces to avoid distant green bands.
      if (/road_|\/streets\//.test(url)) {
        material.polygonOffset = true;
        material.polygonOffsetFactor = -1;
        material.polygonOffsetUnits = -2;
      }
      if (/building|painted-row/.test(url)) {
        windowMask(
          geometry,
          material.map,
          url.includes("/kaykit/") ? "kaykit" : "other",
          material.name,
        );
        bakeBuildingContact(geometry, 0.12);
        material.vertexColors = true;
        // Every lit window reads the shared clock-driven lights uniform.
        const windowNight = lightUniforms.lights;
        material.onBeforeCompile = (shader) => {
          shader.uniforms.windowNight = windowNight;
          shader.vertexShader =
            "attribute float windowMask;attribute float windowId;varying float vLitWindow;\n" +
            shader.vertexShader;
          shader.vertexShader = shader.vertexShader.replace(
            "#include <begin_vertex>",
            `#include <begin_vertex>
      float seed=windowId;
      #ifdef USE_INSTANCING
      seed+=floor(instanceMatrix[3].x)*13.+floor(instanceMatrix[3].z)*7.;
      #endif
      vLitWindow=windowMask*step(.22,fract(sin(seed*12.9898)*43758.5453));`,
          );
          shader.fragmentShader =
            "uniform float windowNight;varying float vLitWindow;\n" +
            shader.fragmentShader;
          shader.fragmentShader = shader.fragmentShader.replace(
            "#include <emissivemap_fragment>",
            "#include <emissivemap_fragment>\ntotalEmissiveRadiance+=windowNight*vLitWindow*vec3(3.1,1.6,.6);",
          );
        };
        material.customProgramCacheKey = () => "metro-actual-window-faces-v5";
      }
      return { geometry, material };
    });
  }, [scene, url]);
  useEffect(
    () => () => {
      for (const batch of batches) {
        batch.geometry.dispose();
        batch.material.dispose();
      }
    },
    [batches],
  );
  return (
    <group name={`kit:${url}`}>
      {url.includes("streetlight") && <NightPools placements={placements} />}
      {batches.map((batch, i) => (
        <KitBatch
          key={i}
          {...batch}
          placements={placements}
          shadow={shadow}
          drive={drive}
        />
      ))}
    </group>
  );
}
function KitBatch({
  geometry,
  material,
  placements,
  shadow,
  drive,
}: {
  geometry: THREE.BufferGeometry;
  material: THREE.MeshStandardMaterial;
  placements: Placement[];
  shadow: boolean;
  drive?: DriveRoute[];
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useFrame(({ clock }) => {
    if (!drive || !ref.current) return;
    drive.forEach((r, i) => {
      const dx = r.ex - r.x,
        dz = r.ez - r.z,
        length = Math.hypot(dx, dz),
        t =
          ((clock.elapsedTime * (2.4 + i * 0.15) + i * 7) % (2 * length)) /
          length,
        back = t > 1,
        f = back ? 2 - t : t,
        p = placements[i];
      dummy.position.set(r.x + dx * f, r.y + (r.ey - r.y) * f, r.z + dz * f);
      dummy.rotation.set(0, Math.atan2(dx, dz) + (back ? Math.PI : 0), 0);
      dummy.scale.setScalar(p.scale ?? 1);
      dummy.updateMatrix();
      ref.current!.setMatrixAt(i, dummy.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
    ref.current.computeBoundingSphere();
  });

  useLayoutEffect(() => {
    const m = ref.current!,
      d = new THREE.Object3D();
    placements.forEach((p, i) => {
      d.position.set(p.x, p.y, p.z);
      d.rotation.set(p.pitch ?? 0, p.angle, 0);
      d.scale.setScalar(p.scale ?? 1);
      d.updateMatrix();
      m.setMatrixAt(i, d.matrix);
      m.setColorAt(i, new THREE.Color(p.color));
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
    m.updateMatrix();
    m.matrixAutoUpdate = false;
  }, [placements]);
  return (
    <>
      {drive && <CarLights source={ref} count={placements.length} />}
      <instancedMesh
        name={drive ? "driving-cars" : undefined}
        ref={ref}
        args={[geometry, material, placements.length]}
        castShadow={shadow}
        receiveShadow
        raycast={noPick}
      />
    </>
  );
}

export function BlenderLandmark({
  id,
  x,
  z,
  angle = 0,
}: {
  id: string;
  x: number;
  z: number;
  angle?: number;
}) {
  const supplied = ATLANTA_BLENDER_LANDMARKS[id];
  return supplied ? (
    <SuppliedAtlantaModel
      id={id}
      x={x}
      z={z}
      angle={angle + Math.PI}
      asset={supplied}
      footprint={atlSites[id].size}
    />
  ) : (
    <LegacyBlenderLandmark id={id} x={x} z={z} angle={angle} />
  );
}

/** The five towers share one projection and exact relative tip-height scale. */
export function AtlantaSkyline() {
  return (
    <group name="atlanta-skyline">
      {ATLANTA_TOWERS.map((tower) => (
        <Suspense key={tower.id} fallback={null}>
          <SuppliedAtlantaModel
            id={tower.id}
            x={tower.x}
            z={tower.z}
            angle={tower.angle}
            asset={tower}
            scale={[
              tower.footprintScale,
              tower.heightScale,
              tower.footprintScale,
            ]}
          />
        </Suspense>
      ))}
    </group>
  );
}

type SuppliedAsset = {
  url: string;
  glowMesh: string | null;
  nightColour: string;
  name: string;
};
function SuppliedAtlantaModel({
  id,
  x,
  z,
  angle,
  asset,
  footprint,
  scale,
}: {
  id: string;
  x: number;
  z: number;
  angle: number;
  asset: SuppliedAsset;
  footprint?: number;
  scale?: [number, number, number];
}) {
  const { scene } = useGLTF(asset.url),
    { gl, invalidate } = useThree();
  const [scaleX, scaleY, scaleZ] = scale ?? [];
  const { model, materials, glowMaterial } = useMemo(() => {
    scene.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(scene),
      size = bounds.getSize(new THREE.Vector3()),
      center = bounds.getCenter(new THREE.Vector3());
    const root = new THREE.Group();
    root.name = id;
    root.userData.cameraOccluder = true;
    const batches = new Map<
      string,
      {
        parts: THREE.BufferGeometry[];
        material: THREE.MeshStandardMaterial;
        glow: boolean;
      }
    >();
    scene.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      const source = (
        Array.isArray(o.material) ? o.material[0] : o.material
      ) as THREE.MeshStandardMaterial;
      const glow = o.name === asset.glowMesh,
        key = glow
          ? asset.glowMesh!
          : JSON.stringify([
              source.roughness,
              source.metalness,
              source.color.getHex(),
              source.side,
            ]);
      const geometry = o.geometry.clone();
      geometry.applyMatrix4(o.matrixWorld);
      // Towers keep the authored real-world footprint origin. Hero sites retain
      // their pre-existing navigation envelopes, including asymmetric frontages.
      if (footprint) geometry.translate(-center.x, -bounds.min.y, -center.z);
      const batch = batches.get(key) ?? {
        parts: [],
        material: source.clone(),
        glow,
      };
      batch.parts.push(geometry);
      batches.set(key, batch);
    });
    for (const { parts, material, glow } of batches.values()) {
      const geometry = mergeGeometries(parts);
      parts.forEach((p) => p.dispose());
      if (!geometry)
        throw Error(`Cannot merge supplied Atlanta model: ${asset.url}`);
      if (scaleX !== undefined && !glow) skylineWindows(geometry, material);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = glow ? asset.glowMesh! : `${id}-body`;
      mesh.castShadow = !glow;
      mesh.receiveShadow = !glow;
      mesh.raycast = noPick;
      mesh.updateMatrix();
      mesh.matrixAutoUpdate = false;
      root.add(mesh);
    }
    if (asset.glowMesh && !root.getObjectByName(asset.glowMesh))
      throw Error(`Missing manifest glow mesh: ${asset.glowMesh}`);
    const factor = footprint
      ? Math.min((footprint * 0.75) / size.x, (footprint * 0.65) / size.z)
      : 1;
    root.scale.set(
      scaleX ?? factor,
      scaleY ?? factor * 1.125,
      scaleZ ?? factor,
    );
    root.position.set(x, 0, z);
    root.rotation.y = angle;
    root.updateMatrix();
    root.matrixAutoUpdate = false;
    root.userData.atlantaModel = {
      source: asset.url,
      name: asset.name,
      glowMesh: asset.glowMesh,
      scale: root.scale.toArray(),
      position: root.position.toArray(),
      triangles: root.children.reduce(
        (sum, o) =>
          sum +
          ((o as THREE.Mesh).geometry.index?.count ??
            (o as THREE.Mesh).geometry.getAttribute("position").count) /
            3,
        0,
      ),
      drawCalls: root.children.length,
    };
    // CameraOcclusion temporarily replaces mesh.material. Keep ownership and
    // lighting writes bound to the source materials its clones synchronize from.
    return {
      model: root,
      materials: [...batches.values()].map((batch) => batch.material),
      glowMaterial: [...batches.values()].find((batch) => batch.glow)?.material,
    };
  }, [scene, id, x, z, angle, asset, footprint, scaleX, scaleY, scaleZ]);
  useLayoutEffect(() => {
    if (glowMaterial) glowMaterial.emissive.set(asset.nightColour);
    gl.shadowMap.needsUpdate = true;
    invalidate();
  }, [glowMaterial, asset, gl, invalidate]);
  useFrame(() => {
    // Crowns and halos fade in with the street lights.
    if (glowMaterial)
      glowMaterial.emissiveIntensity = 2.2 * lightUniforms.lights.value;
  });
  useEffect(
    () => () => {
      model.traverse((o) => {
        if (o instanceof THREE.Mesh) o.geometry.dispose();
      });
      materials.forEach((material) => material.dispose());
    },
    [model, materials],
  );
  return <primitive object={model} />;
}

/**
 * The museum is authored all white. Give the facades an enamel-panel rhythm,
 * tint the sloped skylights like glass and warm the roof, so it reads as a
 * building in daylight instead of an untextured block.
 */
function panelWhiteFacade(mesh: THREE.Mesh) {
  const geometry = mesh.geometry.clone(),
    position = geometry.getAttribute("position"),
    normal = geometry.getAttribute("normal"),
    colour = geometry.getAttribute("color");
  if (!colour) return;
  const glass = new THREE.Color("#8fb4c4"),
    roof = new THREE.Color("#ded8cb"),
    c = new THREE.Color();
  for (let i = 0; i < position.count; i++) {
    c.fromBufferAttribute(colour, i);
    if (c.r + c.g + c.b < 2.6) continue;
    const ny = normal.getY(i),
      x = position.getX(i),
      y = position.getY(i),
      z = position.getZ(i);
    if (ny > 0.3 && ny < 0.97) c.copy(glass);
    else if (ny >= 0.97) c.copy(roof);
    else {
      const along = Math.abs(normal.getX(i)) > Math.abs(normal.getZ(i)) ? z : x,
        panel = (Math.floor(along / 1.2) + Math.floor(y / 1.2)) % 2;
      c.setRGB(0.93, 0.915, 0.885).multiplyScalar(panel ? 1 : 0.955);
      if (y < 0.6) c.multiplyScalar(0.86);
    }
    colour.setXYZ(i, c.r, c.g, c.b);
  }
  colour.needsUpdate = true;
  mesh.geometry = geometry;
}

/** Original authored scene-unit assets for the remaining cities and park sites. */
function LegacyBlenderLandmark({
  id,
  x,
  z,
  angle = 0,
}: {
  id: string;
  x: number;
  z: number;
  angle?: number;
}) {
  const { scene } = useGLTF(`/models/landmarks/${id}.glb`);
  const { gl, invalidate } = useThree(),
    fountainTime = useMemo(() => ({ value: 0 }), []);
  useFrame(({ clock }) => {
    fountainTime.value = clock.elapsedTime;
  });
  useLayoutEffect(() => {
    gl.shadowMap.needsUpdate = true;
    invalidate();
  }, [scene, gl, invalidate]);
  const model = useMemo(() => {
    const root = scene.clone(true);
    root.name = id;
    root.userData.cameraOccluder = !["centennial", "piedmont"].includes(id);
    root.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        const water = /lake|jets/.test(o.name);
        if (id === "centennial" && /jets/.test(o.name)) {
          const material = (o.material as THREE.MeshStandardMaterial).clone();
          material.transparent = true;
          material.opacity = 0.78;
          material.depthWrite = false;
          material.roughness = 0.18;
          material.onBeforeCompile = (shader) => {
            shader.uniforms.fountainTime = fountainTime;
            shader.vertexShader =
              "uniform float fountainTime;\n" + shader.vertexShader;
            shader.vertexShader = shader.vertexShader.replace(
              "#include <begin_vertex>",
              "#include <begin_vertex>\nfloat pulse=.82+.18*sin(fountainTime*2.4+position.x*1.7+position.z*2.1);transformed.y=.15+(position.y-.15)*pulse;transformed.x+=max(0.,position.y-.15)*.035*sin(fountainTime*4.+position.z);",
            );
          };
          material.customProgramCacheKey = () => "metro-fountain-pulse-v1";
          o.material = material;
        }
        if (id === "high") panelWhiteFacade(o);
        o.castShadow = !water;
        o.receiveShadow = !water;
        o.raycast = noPick;
        o.updateMatrix();
        o.matrixAutoUpdate = false;
      }
    });
    root.position.set(x, 0, z);
    root.rotation.y = angle;
    root.updateMatrix();
    root.matrixAutoUpdate = false;
    return root;
  }, [scene, id, x, z, angle, fountainTime]);
  useEffect(
    () => () => {
      if (id === "centennial")
        model.traverse((o) => {
          if (o instanceof THREE.Mesh && /jets/.test(o.name))
            (o.material as THREE.Material).dispose();
        });
    },
    [id, model],
  );
  return <primitive object={model} />;
}
