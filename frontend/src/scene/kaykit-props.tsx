/* oxlint-disable react/only-export-components -- Prop helpers are shared by rooms and the buy preview. */
import { useEffect, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

export const FURNITURE_PACK = "/models/kaykit-furniture/furniture.glb";
export const RESTAURANT_PACK = "/models/kaykit-restaurant/restaurant.glb";
export type PackId = "furniture" | "restaurant";
const packUrl = (pack: PackId) =>
  pack === "furniture" ? FURNITURE_PACK : RESTAURANT_PACK;

/** One placed model from a KayKit pack, in room-local metres. */
export type Prop = {
  pack: PackId;
  name: string;
  x: number;
  y?: number;
  z: number;
  /** Rotation about Y. */
  ry?: number;
  /** Uniform scale, or [x, y, z] for pieces fitted to a collision footprint. */
  s?: number | [number, number, number];
  /** Optional multiply tint for upholstery. */
  tint?: string;
};

const matrix = new THREE.Matrix4(),
  quaternion = new THREE.Quaternion(),
  euler = new THREE.Euler(),
  position = new THREE.Vector3(),
  scale = new THREE.Vector3(),
  white = new THREE.Color("#ffffff");

/** Bake the named pack nodes into one geometry per material, so a whole room of props is one or two draws. */
function bake(
  roots: Record<PackId, THREE.Object3D | undefined>,
  props: Prop[],
) {
  const batches = new Map<
    THREE.Material,
    { parts: THREE.BufferGeometry[]; material: THREE.MeshStandardMaterial }
  >();
  for (const prop of props) {
    const root = roots[prop.pack],
      node = root?.getObjectByName(prop.name);
    if (!node) continue;
    node.updateWorldMatrix(true, true);
    const s = prop.s ?? 1;
    position.set(prop.x, prop.y ?? 0, prop.z);
    quaternion.setFromEuler(euler.set(0, prop.ry ?? 0, 0));
    if (Array.isArray(s)) scale.set(s[0], s[1], s[2]);
    else scale.setScalar(s);
    matrix.compose(position, quaternion, scale);
    const tint = prop.tint ? new THREE.Color(prop.tint) : white;
    node.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      const material = (Array.isArray(o.material) ? o.material[0] : o.material) as THREE.MeshStandardMaterial;
      const g = o.geometry.clone();
      for (const name of Object.keys(g.attributes))
        if (!["position", "normal", "uv"].includes(name)) g.deleteAttribute(name);
      // Pack nodes sit under the pack root; take the node's transform relative to that root.
      g.applyMatrix4(o.matrixWorld);
      g.applyMatrix4(new THREE.Matrix4().copy(root!.matrixWorld).invert());
      g.applyMatrix4(matrix);
      const count = g.getAttribute("position").count,
        colours = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        colours[i * 3] = tint.r;
        colours[i * 3 + 1] = tint.g;
        colours[i * 3 + 2] = tint.b;
      }
      g.setAttribute("color", new THREE.BufferAttribute(colours, 3));
      const entry = batches.get(material) ?? {
        parts: [],
        material: (() => {
          const m = material.clone();
          m.vertexColors = true;
          m.roughness = 0.7;
          m.metalness = 0;
          m.color.multiplyScalar(0.96);
          if (m.map) m.map.anisotropy = 8;
          return m;
        })(),
      };
      const indexed = g.index ? g : g;
      entry.parts.push(indexed);
      batches.set(material, entry);
    });
  }
  return [...batches.values()].flatMap(({ parts, material }) => {
    const nonIndexed = parts.some((p) => !p.index)
      ? parts.map((p) => (p.index ? p.toNonIndexed() : p))
      : parts;
    const geometry = mergeGeometries(nonIndexed);
    parts.forEach((p) => p.dispose());
    if (nonIndexed !== parts) nonIndexed.forEach((p) => p.dispose());
    if (!geometry) return [];
    geometry.computeBoundingSphere();
    return [{ geometry, material }];
  });
}

/** Static KayKit dressing for a room or shop front. Both packs load once and are cached. */
export function PropBatch({
  props,
  name,
  castShadow = true,
  override,
}: {
  props: Prop[];
  /** Names the group and its meshes, so picking by name works on any hit. */
  name?: string;
  castShadow?: boolean;
  /** Draw every batch with this material (Buy mode ghost). */
  override?: THREE.Material;
}) {
  const furniture = useGLTF(FURNITURE_PACK).scene,
    restaurant = useGLTF(RESTAURANT_PACK).scene;
  const batches = useMemo(
    () => bake({ furniture, restaurant }, props),
    [furniture, restaurant, props],
  );
  useEffect(
    () => () =>
      batches.forEach((b) => {
        b.geometry.dispose();
        b.material.dispose();
      }),
    [batches],
  );
  return (
    <group name={name ?? "kaykit-props"}>
      {batches.map((b, i) => (
        <mesh
          key={i}
          name={name}
          geometry={b.geometry}
          material={override ?? b.material}
          castShadow={castShadow}
          receiveShadow={!override}
          raycast={override ? () => {} : undefined}
        />
      ))}
    </group>
  );
}
export function preloadProps() {
  useGLTF.preload(FURNITURE_PACK);
  useGLTF.preload(RESTAURANT_PACK);
}
export { packUrl };
