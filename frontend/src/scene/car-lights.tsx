/* oxlint-disable react/immutability -- These light instances follow the owned driving instance matrices. */
import { useEffect, useMemo, useRef } from "react";
import type { RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Builder } from "./geometry";
export function CarLights({
  source,
  count,
}: {
  source: RefObject<THREE.InstancedMesh | null>;
  count: number;
}) {
  const bulbs = useRef<THREE.InstancedMesh>(null),
    pools = useRef<THREE.InstancedMesh>(null),
    matrix = useMemo(() => new THREE.Matrix4(), []);
  const geometry = useMemo(() => {
    const b = new Builder();
    for (const x of [-0.62, 0.62]) {
      b.box(x, 0.68, 2.21, 0.36, 0.18, 0.025, "#fff1bc");
      b.box(x, 0.68, -2.21, 0.36, 0.18, 0.025, "#ff3524");
    }
    return b.build();
  }, []);
  const beam = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        [-0.6, -0.04, 2.2, -2, -0.04, 8, 2, -0.04, 8, 0.6, -0.04, 2.2],
        3,
      ),
    );
    g.setIndex([0, 2, 1, 0, 3, 2]);
    return g;
  }, []);
  useEffect(
    () => () => {
      geometry.dispose();
      beam.dispose();
    },
    [geometry, beam],
  );
  useFrame(() => {
    if (!source.current) return;
    for (let i = 0; i < count; i++) {
      source.current.getMatrixAt(i, matrix);
      bulbs.current!.setMatrixAt(i, matrix);
      pools.current!.setMatrixAt(i, matrix);
    }
    for (const mesh of [bulbs.current!, pools.current!]) {
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  }, 0.2);
  return (
    <>
      <instancedMesh
        ref={bulbs}
        name="car-head-and-tail-lights"
        args={[geometry, undefined, count]}
        raycast={() => {}}
      >
        <meshBasicMaterial vertexColors toneMapped={false} />
      </instancedMesh>
      <instancedMesh
        ref={pools}
        name="headlight-pools"
        args={[beam, undefined, count]}
        raycast={() => {}}
      >
        <meshBasicMaterial
          color="#ffdf9e"
          transparent
          opacity={0.055}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </instancedMesh>
    </>
  );
}
