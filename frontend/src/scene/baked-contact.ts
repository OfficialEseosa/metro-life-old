import * as THREE from "three";
import { MeshBVH } from "three-mesh-bvh";

/** Accurate, one-time contact bake for imported building surfaces. The source asset stays untouched. */
export function bakeBuildingContact(
  geometry: THREE.BufferGeometry,
  radius: number,
) {
  const start = performance.now(),
    position = geometry.getAttribute("position"),
    normals = geometry.getAttribute("normal"),
    bvh = new MeshBVH(geometry, { maxLeafTris: 8 }),
    existing = geometry.getAttribute("color"),
    colours = existing
      ? existing.clone()
      : new THREE.Float32BufferAttribute(
          new Float32Array(position.count * 3).fill(1),
          3,
        );
  const point = new THREE.Vector3(),
    normal = new THREE.Vector3(),
    tangent = new THREE.Vector3(),
    bitangent = new THREE.Vector3(),
    direction = new THREE.Vector3(),
    ray = new THREE.Ray(),
    cache = new Map<string, number>();
  let darkest = 1;
  for (let i = 0; i < position.count; i++) {
    normal.fromBufferAttribute(normals, i).normalize();
    point.fromBufferAttribute(position, i);
    const key = `${point.x.toFixed(3)},${point.y.toFixed(3)},${point.z.toFixed(3)}:${normal.x.toFixed(2)},${normal.y.toFixed(2)},${normal.z.toFixed(2)}`;
    let shade = cache.get(key);
    if (shade === undefined) {
      point.addScaledVector(normal, radius * 0.025);
      tangent
        .set(
          Math.abs(normal.y) < 0.9 ? 0 : 1,
          Math.abs(normal.y) < 0.9 ? 1 : 0,
          0,
        )
        .cross(normal)
        .normalize();
      bitangent.crossVectors(normal, tangent);
      let blocked = 0;
      for (let sample = 0; sample < 6; sample++) {
        const angle = (sample * Math.PI) / 3;
        direction
          .copy(normal)
          .multiplyScalar(0.7)
          .addScaledVector(tangent, Math.cos(angle) * 0.7)
          .addScaledVector(bitangent, Math.sin(angle) * 0.7)
          .normalize();
        ray.set(point, direction);
        const hit = bvh.raycastFirst(ray, THREE.DoubleSide, 0.001, radius);
        if (hit) blocked += 1 - hit.distance / radius;
      }
      shade = 1 - (0.4 * blocked) / 6;
      cache.set(key, shade);
    }
    darkest = Math.min(darkest, shade);
    colours.setXYZ(
      i,
      colours.getX(i) * shade,
      colours.getY(i) * shade,
      colours.getZ(i) * shade,
    );
  }
  geometry.setAttribute("color", colours);
  geometry.userData.bakedContact = true;
  geometry.userData.contactBake = {
    milliseconds: performance.now() - start,
    darkest,
    uniqueSamples: cache.size,
  };
}

/** Static contact bake into vertex colours. Six hemisphere rays against the authored solid bounds.
 * No lights, render targets or per-frame work. Segmented floors retain soft furniture contacts. */
export function bakeContact(parts: THREE.BufferGeometry[], radius = 0.55) {
  const boxes = parts.map((g) => {
      g.computeBoundingBox();
      return g.boundingBox!.clone();
    }),
    point = new THREE.Vector3(),
    normal = new THREE.Vector3(),
    tangent = new THREE.Vector3(),
    bitangent = new THREE.Vector3(),
    direction = new THREE.Vector3(),
    hit = new THREE.Vector3(),
    ray = new THREE.Ray();
  for (let part = 0; part < parts.length; part++) {
    const geometry = parts[part],
      position = geometry.getAttribute("position"),
      normals = geometry.getAttribute("normal"),
      colour = geometry.getAttribute("color"),
      region = boxes[part].clone().expandByScalar(radius);
    const neighbours = boxes.filter(
      (b, i) => i !== part && region.intersectsBox(b),
    );
    if (!neighbours.length) continue;
    for (let i = 0; i < position.count; i++) {
      normal.fromBufferAttribute(normals, i).normalize();
      point.fromBufferAttribute(position, i).addScaledVector(normal, 0.025);
      tangent
        .set(
          Math.abs(normal.y) < 0.9 ? 0 : 1,
          Math.abs(normal.y) < 0.9 ? 1 : 0,
          0,
        )
        .cross(normal)
        .normalize();
      bitangent.crossVectors(normal, tangent);
      let occlusion = 0;
      for (let sample = 0; sample < 6; sample++) {
        const angle = (sample * Math.PI) / 3;
        direction
          .copy(normal)
          .multiplyScalar(0.7)
          .addScaledVector(tangent, Math.cos(angle) * 0.7)
          .addScaledVector(bitangent, Math.sin(angle) * 0.7)
          .normalize();
        ray.set(point, direction);
        let nearest = radius;
        for (const box of neighbours) {
          if (box.distanceToPoint(point) > radius) continue;
          const intersection = ray.intersectBox(box, hit);
          if (intersection)
            nearest = Math.min(nearest, point.distanceTo(intersection));
        }
        occlusion += 1 - nearest / radius;
      }
      const shade = 1 - (0.36 * occlusion) / 6;
      colour.setXYZ(
        i,
        colour.getX(i) * shade,
        colour.getY(i) * shade,
        colour.getZ(i) * shade,
      );
    }
  }
}
