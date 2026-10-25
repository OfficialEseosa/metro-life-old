/* oxlint-disable react/immutability -- Instance buffers and the wind uniform are owned renderer resources. */
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

export type TreeSpot = { x: number; y: number; z: number };
const noPick = () => {};
const wind = { value: 0 };
const reduced =
  typeof matchMedia === "function" &&
  matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * A rounded stylised tree: a tapered trunk and a crown of five clumps whose
 * normals point away from the crown centre, so light wraps it like a cloud.
 * `treeShade` carries bottom-to-top shading and `treeTrunk` marks the trunk.
 */
function treeGeometry() {
  const parts: THREE.BufferGeometry[] = [];
  const mark = (g: THREE.BufferGeometry, trunk: number, crown?: THREE.Vector3) => {
    const p = g.getAttribute("position"),
      n = g.getAttribute("normal"),
      shade = new Float32Array(p.count),
      trunkFlag = new Float32Array(p.count).fill(trunk),
      v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      shade[i] = THREE.MathUtils.clamp((p.getY(i) - 1.6) / 3.6, 0, 1);
      if (crown) {
        v.fromBufferAttribute(p, i).sub(crown).normalize();
        n.setXYZ(i, v.x, v.y, v.z);
      }
    }
    g.setAttribute("treeShade", new THREE.BufferAttribute(shade, 1));
    g.setAttribute("treeTrunk", new THREE.BufferAttribute(trunkFlag, 1));
    g.deleteAttribute("uv");
    parts.push(g);
  };
  const trunk = new THREE.CylinderGeometry(0.13, 0.2, 2.4, 7, 1);
  trunk.translate(0, 1.2, 0);
  mark(trunk.toNonIndexed(), 1);
  const crownCentre = new THREE.Vector3(0, 3.55, 0),
    clumps: [number, number, number, number][] = [
      [0, 3.5, 0, 1.45],
      [0.85, 3.05, 0.35, 1.0],
      [-0.8, 3.15, -0.3, 1.05],
      [0.2, 3.1, -0.9, 0.95],
      [-0.25, 4.35, 0.25, 1.0],
    ];
  const crown: THREE.BufferGeometry[] = [];
  for (const [x, y, z, r] of clumps) {
    const g = new THREE.IcosahedronGeometry(r, 1);
    g.translate(x, y, z);
    crown.push(g.toNonIndexed());
  }
  const merged = mergeGeometries(crown)!;
  crown.forEach((g) => g.dispose());
  mark(merged, 0, crownCentre);
  const geometry = mergeGeometries(parts)!;
  parts.forEach((g) => g.dispose());
  geometry.computeBoundingSphere();
  return geometry;
}

function treeMaterial() {
  const material = new THREE.MeshStandardMaterial({
    roughness: 0.85,
    color: "#ffffff",
  });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.treeWind = wind;
    shader.vertexShader =
      "attribute float treeShade;attribute float treeTrunk;uniform float treeWind;varying float vTreeShade;varying float vTreeTrunk;\n" +
      shader.vertexShader.replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        vTreeShade=treeShade;vTreeTrunk=treeTrunk;
        #ifdef USE_INSTANCING
        float treeSeed=instanceMatrix[3].x*.37+instanceMatrix[3].z*.23;
        #else
        float treeSeed=0.;
        #endif
        float treeSway=sin(treeWind*1.3+treeSeed)*.05*max(position.y-1.6,0.)*(1.-treeTrunk);
        transformed.x+=treeSway;transformed.z+=treeSway*.6;`,
      );
    shader.fragmentShader =
      "varying float vTreeShade;varying float vTreeTrunk;\n" +
      shader.fragmentShader.replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        vec3 treeTint=diffuseColor.rgb;
        vec3 leaf=mix(treeTint*vec3(.4,.5,.46),treeTint*1.05,smoothstep(0.,1.,vTreeShade));
        diffuseColor.rgb=mix(leaf,vec3(.42,.29,.18),vTreeTrunk);`,
      );
  };
  material.customProgramCacheKey = () => "metro-fluffy-tree-v1";
  return material;
}

// Species tints (the crown top colour): fresh green, olive, deep green and a blossom accent.
const tints = ["#86b85e", "#6fa250", "#8ea85a", "#5f9a58", "#e2a2b0"].map(
  (c) => new THREE.Color(c),
);
const hash = (x: number, z: number) => {
  const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
  return s - Math.floor(s);
};
const TILE = 64;

/** Instanced trees, split into map tiles so camera and shadow frusta can skip far ones. */
export function Trees({
  spots,
  density = 1,
}: {
  spots: TreeSpot[];
  density?: number;
}) {
  const geometry = useMemo(treeGeometry, []),
    material = useMemo(treeMaterial, []);
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );
  const tiles = useMemo(() => {
    const groups = new Map<string, TreeSpot[]>();
    spots.forEach((s, i) => {
      if (density < 1 && hash(s.x + 3, s.z - 7) > density) return;
      const key = `${Math.floor(s.x / TILE)}:${Math.floor(s.z / TILE)}`;
      const list = groups.get(key) ?? [];
      list.push(s);
      groups.set(key, list);
      void i;
    });
    return [...groups.values()];
  }, [spots, density]);
  useFrame(({ clock }) => {
    if (!reduced) wind.value = clock.elapsedTime;
  });
  return (
    <group name="fluffy-trees">
      {tiles.map((list, i) => (
        <TreeTile key={i} spots={list} geometry={geometry} material={material} />
      ))}
    </group>
  );
}
function TreeTile({
  spots,
  geometry,
  material,
}: {
  spots: TreeSpot[];
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current!,
      d = new THREE.Object3D(),
      colour = new THREE.Color();
    spots.forEach((s, i) => {
      const h = hash(s.x, s.z),
        size = 0.78 + h * 0.5,
        stretch = 0.9 + hash(s.z, s.x) * 0.35;
      d.position.set(s.x, s.y, s.z);
      d.rotation.set(0, h * Math.PI * 2, 0);
      d.scale.set(size, size * stretch, size);
      d.updateMatrix();
      mesh.setMatrixAt(i, d.matrix);
      const species =
        h > 0.92 ? 4 : Math.floor(hash(s.x * 1.7, s.z * 0.3) * 4) % 4;
      colour.copy(tints[species]).multiplyScalar(0.94 + hash(s.z, s.x * 2) * 0.12);
      mesh.setColorAt(i, colour);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
    mesh.updateMatrix();
    mesh.matrixAutoUpdate = false;
    mesh.userData.cameraOccluder = true;
  }, [spots]);
  return (
    <instancedMesh
      ref={ref}
      name="tree-tile"
      args={[geometry, material, spots.length]}
      castShadow
      receiveShadow
      raycast={noPick}
    />
  );
}
