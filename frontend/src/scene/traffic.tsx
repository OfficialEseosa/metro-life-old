/* oxlint-disable react/immutability -- Vehicle transforms belong to the Three instance batch. */
import { Suspense, useEffect, useMemo, useRef } from "react";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { timeOfDay } from "../lighting";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { CityId } from "../api/types";
import { streets } from "../street-network";
import { navigation } from "../navigation";

export function Traffic({ city }: { city: CityId }) {
  return (
    <Suspense fallback={null}>
      <StreetCars key={city} city={city} />
    </Suspense>
  );
}
function StreetCars({ city }: { city: CityId }) {
  const graph = streets[city],
    { scene } = useGLTF("/models/vehicles/sedan.glb"),
    meshes = useRef<(THREE.InstancedMesh | null)[]>([]),
    dummy = useMemo(() => new THREE.Object3D(), []);
  const batches = useMemo(() => {
    scene.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(scene),
      size = bounds.getSize(new THREE.Vector3()),
      center = bounds.getCenter(new THREE.Vector3()),
      matrix = new THREE.Matrix4().makeTranslation(
        -center.x,
        -bounds.min.y,
        -center.z,
      ),
      groups = new Map<
        string,
        { parts: THREE.BufferGeometry[]; material: THREE.MeshStandardMaterial }
      >();
    scene.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      const material = (
          Array.isArray(o.material) ? o.material[0] : o.material
        ) as THREE.MeshStandardMaterial,
        group = groups.get(material.uuid) ?? {
          parts: [],
          material: material.clone(),
        },
        g = o.geometry.clone();
      g.applyMatrix4(o.matrixWorld);
      g.applyMatrix4(matrix);
      g.scale(
        2.7 / Math.max(size.x, size.z),
        2.7 / Math.max(size.x, size.z),
        2.7 / Math.max(size.x, size.z),
      );
      group.parts.push(g);
      groups.set(material.uuid, group);
    });
    return [...groups.values()].map(({ parts, material }) => {
      const geometry = mergeGeometries(parts)!;
      parts.forEach((g) => g.dispose());
      return { geometry, material };
    });
  }, [scene]);
  // Cars keep off the streets just outside doors, where the camera looks.
  const nearDoor = useMemo(() => {
    const doors = Object.values(navigation[city].doors);
    return graph.nodes.map((n) =>
      doors.some((d) => Math.hypot(n[0] - d.x, n[2] - d.z) < 7),
    );
  }, [city, graph]);
  // Each door's access spur runs back to a junction; cars stay on the roads beyond it.
  const road = useMemo(() => {
    const keep = graph.links.map((l) => l.length > 1);
    for (const { node } of Object.values(graph.access)) {
      let prev = -1,
        cur = node;
      while (graph.links[cur].length <= 2) {
        keep[cur] = false;
        const next = graph.links[cur].find((n) => n !== prev);
        if (next === undefined) break;
        prev = cur;
        cur = next;
      }
    }
    return keep;
  }, [graph]);
  const cars = useMemo(() => {
    const candidates = graph.links.flatMap((_, i) =>
      road[i] && !nearDoor[i] ? [i] : [],
    );
    return Array.from({ length: Math.min(8, candidates.length) }, (_, i) => {
      const from = candidates[Math.floor((i * candidates.length) / 8)],
        to = graph.links[from].find((n) => road[n]) ?? graph.links[from][0];
      return { from, to, previous: -1, t: i / 11, yaw: 0, turn: i };
    });
  }, [graph, nearDoor, road]);
  useEffect(
    () => () =>
      batches.forEach((b) => {
        b.geometry.dispose();
        b.material.dispose();
      }),
    [batches],
  );
  useEffect(() => {
    for (const batch of batches) batch.material.emissive.set("#152126");
  }, [batches]);
  useFrame((_, dt) => {
    const glow = 0.18 * timeOfDay.nightFactor;
    for (const batch of batches) batch.material.emissiveIntensity = glow;
    for (let i = 0; i < cars.length; i++) {
      const car = cars[i];
      let a = graph.nodes[car.from],
        b = graph.nodes[car.to],
        length = Math.hypot(b[0] - a[0], b[2] - a[2]);
      car.t += (Math.min(dt, 0.05) * 2.8) / Math.max(0.1, length);
      if (car.t >= 1) {
        car.previous = car.from;
        car.from = car.to;
        const options = graph.links[car.from].filter((n) => n !== car.previous),
          through = options.filter((n) => road[n]),
          away = through.filter((n) => !nearDoor[n]),
          choices = away.length
            ? away
            : through.length
              ? through
              : car.previous >= 0
                ? [car.previous]
                : graph.links[car.from];
        car.to = choices[(++car.turn + i) % choices.length];
        car.t -= 1;
        a = graph.nodes[car.from];
        b = graph.nodes[car.to];
        length = Math.hypot(b[0] - a[0], b[2] - a[2]);
      }
      const dx = b[0] - a[0],
        dz = b[2] - a[2],
        target = Math.atan2(dx, dz),
        delta = Math.atan2(
          Math.sin(target - car.yaw),
          Math.cos(target - car.yaw),
        );
      car.yaw += delta * (1 - Math.exp(-dt * 12));
      dummy.position.set(
        a[0] + dx * car.t + Math.cos(target) * 0.55,
        a[1] + (b[1] - a[1]) * car.t + 0.09,
        a[2] + dz * car.t - Math.sin(target) * 0.55,
      );
      dummy.rotation.set(0, car.yaw, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      for (const mesh of meshes.current) mesh?.setMatrixAt(i, dummy.matrix);
    }
    for (const mesh of meshes.current)
      if (mesh) {
        mesh.instanceMatrix.needsUpdate = true;
        mesh.computeBoundingSphere();
      }
  });
  return (
    <group name="street-traffic">
      {batches.map((batch, i) => (
        <instancedMesh
          key={i}
          name="driving-cars"
          ref={(m) => {
            meshes.current[i] = m;
          }}
          args={[batch.geometry, batch.material, cars.length]}
          castShadow
          receiveShadow
          raycast={() => {}}
        />
      ))}
    </group>
  );
}
