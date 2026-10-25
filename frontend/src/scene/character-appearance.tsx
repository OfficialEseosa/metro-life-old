import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { Look } from "../api/types";

type WardrobeLook = Look & {
  face?: string;
  outfits?: Partial<
    Record<
      "everyday" | "work" | "sleep",
      { top: string; bottom: string; style: string; shoeColor: string }
    >
  >;
};
/** Clothing is selected from the saved wardrobe; old browser lives retain their existing colours. */
export function dressedLook(look: Look, pose: string): Look {
  const wardrobe = (look as WardrobeLook).outfits;
  const outfit =
    wardrobe?.[
      pose === "Sleep" || pose === "Lie"
        ? "sleep"
        : pose === "Type"
          ? "work"
          : "everyday"
    ];
  return outfit ? { ...look, ...outfit } : look;
}

function makeAppearance(look: Look) {
  const group = new THREE.Group(),
    geometries: THREE.BufferGeometry[] = [],
    materials: THREE.Material[] = [];
  group.name = "saved-character-hair-and-face";
  const hair = new THREE.MeshStandardMaterial({
      color: look.hairColor,
      roughness: 0.9,
    }),
    eye = new THREE.MeshStandardMaterial({ color: "#292622", roughness: 0.8 }),
    white = new THREE.MeshStandardMaterial({ color: "#fff5e7" }),
    lip = new THREE.MeshStandardMaterial({
      color: new THREE.Color(look.skin).multiplyScalar(0.64),
    });
  materials.push(hair, eye, white, lip);
  const ball = (
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    mat = hair,
  ) => {
    const geometry = new THREE.SphereGeometry(1, 10, 7),
      mesh = new THREE.Mesh(geometry, mat);
    geometries.push(geometry);
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    mesh.castShadow = true;
    group.add(mesh);
    return mesh;
  };
  const strand = (
    x: number,
    y: number,
    z: number,
    length: number,
    width = 0.026,
  ) => ball(x, y, z, width, length, width);
  const style = look.hair || "short";
  // A continuous scalp cap follows the forehead and nape. Every style grows from it.
  const cap = (width = 0.145, rise = 0.135, depth = 0.118) => {
    const points: number[] = [],
      rings = 8,
      segments = 20;
    const point = (ring: number, segment: number) => {
      const az = (segment / segments) * Math.PI * 2,
        edge = 1.28 + (1 - Math.sin(az)) * 0.38,
        theta = (ring / rings) * edge;
      return [
        Math.sin(theta) * Math.cos(az) * width,
        0.15 + Math.cos(theta) * rise,
        Math.sin(theta) * Math.sin(az) * depth - 0.008,
      ];
    };
    for (let ring = 0; ring < rings; ring++)
      for (let segment = 0; segment < segments; segment++) {
        const a = point(ring, segment),
          b = point(ring + 1, segment),
          c = point(ring + 1, segment + 1),
          d = point(ring, segment + 1);
        points.push(...a, ...c, ...b, ...a, ...d, ...c);
      }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(points, 3),
    );
    geometry.computeVertexNormals();
    geometries.push(geometry);
    const mesh = new THREE.Mesh(geometry, hair);
    mesh.castShadow = true;
    group.add(mesh);
  };
  if (style !== "bald") {
    cap(
      style === "afro" ? 0.19 : 0.145,
      style === "afro" ? 0.185 : 0.135,
      style === "afro" ? 0.16 : 0.118,
    );
    if (style === "curly") {
      for (let row = 0; row < 3; row++)
        for (let i = 0; i < 9; i++) {
          const a = (i * Math.PI * 2) / 9;
          ball(
            Math.cos(a) * (0.105 - row * 0.028),
            0.218 + row * 0.025,
            Math.sin(a) * (0.085 - row * 0.02) - 0.015,
            0.043,
            0.045,
            0.04,
          );
        }
    }
    if (["bob", "long", "braids"].includes(style)) {
      ball(-0.115, 0.13, -0.035, 0.043, style === "long" ? 0.16 : 0.09, 0.085);
      ball(0.115, 0.13, -0.035, 0.043, style === "long" ? 0.16 : 0.09, 0.085);
      ball(0, 0.13, -0.1, 0.108, style === "long" ? 0.16 : 0.09, 0.033);
    }
    if (style === "bun") ball(0, 0.267, -0.077, 0.067, 0.067, 0.059);
    if (style === "ponytail") {
      ball(0, 0.192, -0.13, 0.055, 0.065, 0.055);
      strand(0, 0.075, -0.155, 0.135, 0.041);
    }
    if (style === "braids") {
      for (const x of [-0.13, 0.13])
        for (let i = 0; i < 5; i++)
          ball(x, 0.13 - i * 0.041, -0.025, 0.026, 0.03, 0.027);
    }
    if (style === "mohawk") {
      for (let i = 0; i < 5; i++)
        ball(0, 0.27, -0.1 + i * 0.044, 0.033, 0.065, 0.033);
    }
    if (style === "short") {
      ball(-0.055, 0.263, 0.02, 0.065, 0.025, 0.065);
      ball(0.045, 0.264, 0.025, 0.06, 0.025, 0.06);
    }
  }
  const face = (look as WardrobeLook).face ?? "soft",
    wide = face === "bright" ? 0.055 : face === "angular" ? 0.044 : 0.049,
    y = face === "angular" ? 0.142 : 0.148;
  for (const x of [-wide, wide]) {
    ball(x, y, 0.103, 0.022, face === "bright" ? 0.021 : 0.016, 0.009, white);
    ball(x, y, 0.111, 0.01, face === "bright" ? 0.014 : 0.011, 0.004, eye);
    const brow = ball(x, y + 0.033, 0.104, 0.025, 0.006, 0.007, hair);
    brow.rotation.z = (x < 0 ? 1 : -1) * (face === "angular" ? 0.25 : 0.08);
  }
  ball(0, 0.081, 0.109, face === "bright" ? 0.036 : 0.027, 0.007, 0.008, lip);
  if (face === "freckled")
    for (const sign of [-1, 1])
      for (let i = 0; i < 4; i++)
        ball(
          sign * (0.049 + i * 0.012),
          0.119 - (i % 2) * 0.012,
          0.105,
          0.003,
          0.003,
          0.003,
          lip,
        );
  // A hairstyle is one draw per palette material, rather than one draw per curl.
  const batches = new Map<THREE.Material, THREE.BufferGeometry[]>();
  for (const object of [...group.children])
    if (object instanceof THREE.Mesh) {
      object.updateMatrix();
      const geometry = object.geometry.index
        ? object.geometry.toNonIndexed()
        : object.geometry.clone();
      geometry.applyMatrix4(object.matrix);
      geometry.deleteAttribute("uv");
      const material = object.material as THREE.Material;
      const parts = batches.get(material) ?? [];
      parts.push(geometry);
      batches.set(material, parts);
    }
  group.clear();
  const merged: THREE.BufferGeometry[] = [];
  for (const [material, parts] of batches) {
    const geometry = mergeGeometries(parts, false);
    parts.forEach((part) => part.dispose());
    if (geometry) {
      merged.push(geometry);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name =
        material === hair
          ? "character-hair-" + style
          : material === eye
            ? "character-face-pupils"
            : material === white
              ? "character-face-eyes"
              : "character-face-details";
      mesh.userData.appearancePart = material === hair ? "hair" : "face";
      mesh.castShadow = true;
      group.add(mesh);
    }
  }
  geometries.forEach((geometry) => geometry.dispose());
  geometries.splice(0, geometries.length, ...merged);
  return {
    group,
    dispose: () => {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
    },
  };
}

const softenedHeads = new WeakMap<THREE.BufferGeometry, THREE.BufferGeometry>();
function skinIndices(object: THREE.Mesh) {
  const palette = Array.isArray(object.material)
      ? object.material
      : [object.material],
    index = object.geometry.index,
    vertices = new Set<number>();
  for (const part of object.geometry.groups)
    if (/^Skin/.test(palette[part.materialIndex ?? 0]?.name ?? ""))
      for (let at = part.start; at < part.start + part.count; at++)
        vertices.add(index ? index.getX(at) : at);
  return vertices;
}
/** Keep the original skinned head, with a rounded ear silhouette and welded face normals. */
export function softenCharacterHeads(root: THREE.Object3D) {
  root.updateMatrixWorld(true);
  const rootInverse = root.matrixWorld.clone().invert(),
    point = new THREE.Vector3();
  root.traverse((object) => {
    if (!(object instanceof THREE.SkinnedMesh) || !/Head/i.test(object.name))
      return;
    const source = object.geometry,
      cached = softenedHeads.get(source);
    if (cached) {
      object.geometry = cached;
      return;
    }
    const vertices = skinIndices(object),
      coordinates = new Map<number, THREE.Vector3>(),
      xs: number[] = [];
    for (const vertex of vertices) {
      object.getVertexPosition(vertex, point);
      point.applyMatrix4(object.matrixWorld).applyMatrix4(rootInverse);
      coordinates.set(vertex, point.clone());
      xs.push(point.x);
    }
    const matrices = object.skeleton.boneMatrices;
    if (!xs.length || !matrices) return;
    xs.sort((a, b) => a - b);
    const left = xs[Math.floor(xs.length * 0.06)],
      right = xs[Math.floor(xs.length * 0.94)],
      centre = (left + right) / 2,
      half = (right - left) * 0.54,
      geometry = source.clone(),
      positions = geometry.getAttribute("position"),
      skinIndex = geometry.getAttribute("skinIndex"),
      skinWeight = geometry.getAttribute("skinWeight"),
      meshInverse = object.matrixWorld.clone().invert(),
      weighted = new THREE.Matrix4(),
      bone = new THREE.Matrix4();
    for (const [vertex, at] of coordinates) {
      if (Math.abs(at.x - centre) <= half) continue;
      at.x = THREE.MathUtils.clamp(at.x, centre - half, centre + half);
      weighted.elements.fill(0);
      for (let component = 0; component < 4; component++) {
        const i = skinIndex.getComponent(vertex, component),
          weight = skinWeight.getComponent(vertex, component);
        if (!weight) continue;
        bone.fromArray(matrices, i * 16);
        for (let k = 0; k < 16; k++)
          weighted.elements[k] += bone.elements[k] * weight;
      }
      weighted
        .premultiply(object.bindMatrixInverse)
        .multiply(object.bindMatrix);
      at.applyMatrix4(root.matrixWorld)
        .applyMatrix4(meshInverse)
        .applyMatrix4(weighted.invert());
      positions.setXYZ(vertex, at.x, at.y, at.z);
    }
    const index = geometry.index,
      count = index?.count ?? positions.count,
      sums = new Map<string, THREE.Vector3>(),
      keys = Array.from(
        { length: positions.count },
        (_, i) =>
          `${Math.round(positions.getX(i) * 100000)}:${Math.round(positions.getY(i) * 100000)}:${Math.round(positions.getZ(i) * 100000)}`,
      ),
      a = new THREE.Vector3(),
      b = new THREE.Vector3(),
      c = new THREE.Vector3(),
      normal = new THREE.Vector3();
    for (let face = 0; face < count; face += 3) {
      const ids = [0, 1, 2].map((j) =>
        index ? index.getX(face + j) : face + j,
      );
      a.fromBufferAttribute(positions, ids[0]);
      b.fromBufferAttribute(positions, ids[1]);
      c.fromBufferAttribute(positions, ids[2]);
      normal.subVectors(b, a).cross(c.sub(a));
      for (const vertex of ids) {
        const key = keys[vertex];
        if (!sums.has(key)) sums.set(key, new THREE.Vector3());
        sums.get(key)!.add(normal);
      }
    }
    const normals = new Float32Array(positions.count * 3);
    for (let i = 0; i < positions.count; i++)
      sums
        .get(keys[i])!
        .normalize()
        .toArray(normals, i * 3);
    geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    softenedHeads.set(source, geometry);
    object.geometry = geometry;
  });
}

/** Fit in the body's upright frame, then convert the finished attachment into the animated bone frame. */
export function mountCharacterAppearance(
  root: THREE.Object3D,
  look: Look,
  _actorScale: number,
) {
  const head = root.getObjectByName("Head") ?? root.getObjectByName("head");
  if (!head) return () => {};
  root.updateMatrixWorld(true);
  const appearance = makeAppearance(look),
    rootInverse = root.matrixWorld.clone().invert(),
    point = new THREE.Vector3(),
    bounds = new THREE.Box3();
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh) || !/Head/i.test(object.name)) return;
    for (const vertex of skinIndices(object)) {
      object.getVertexPosition(vertex, point);
      bounds.expandByPoint(
        point.applyMatrix4(object.matrixWorld).applyMatrix4(rootInverse),
      );
    }
  });
  if (bounds.isEmpty()) {
    appearance.dispose();
    return () => {};
  }
  const centre = bounds.getCenter(new THREE.Vector3()),
    size = bounds.getSize(new THREE.Vector3()),
    frame = new THREE.Matrix4().compose(
      new THREE.Vector3(centre.x, bounds.min.y, centre.z),
      new THREE.Quaternion(),
      new THREE.Vector3(size.x / 0.28, size.y / 0.27, size.z / 0.22),
    ),
    attachment = head.matrixWorld
      .clone()
      .invert()
      .multiply(root.matrixWorld)
      .multiply(frame);
  attachment.decompose(
    appearance.group.position,
    appearance.group.quaternion,
    appearance.group.scale,
  );
  root.traverse((object) => {
    if (object instanceof THREE.Mesh && /Head/i.test(object.name))
      for (const material of Array.isArray(object.material)
        ? object.material
        : [object.material])
        if (!/^Skin/.test(material.name)) material.visible = false;
  });
  head.add(appearance.group);
  return () => {
    head.remove(appearance.group);
    appearance.dispose();
  };
}

/** Standalone head-local version for a procedural actor or editor. */
export function CharacterAppearance({ look }: { look: Look }) {
  const appearance = useMemo(
    () => makeAppearance(look),
    [look.hair, look.hairColor, look.skin, (look as WardrobeLook).face],
  );
  useEffect(() => () => appearance.dispose(), [appearance]);
  return <primitive object={appearance.group} />;
}
