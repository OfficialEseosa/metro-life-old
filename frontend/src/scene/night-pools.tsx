/* oxlint-disable react/immutability -- Instance buffers are owned Three.js resources. */
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Placement } from "./fabric";
import { lightUniforms } from "../lighting";

/** Warm pools under street lamps; they fade in with the clock and stay below the bloom threshold. */
export function NightPools({ placements }: { placements: Placement[] }) {
  const ref = useRef<THREE.InstancedMesh>(null),
    material = useRef<THREE.MeshBasicMaterial>(null),
    texture = useMemo(() => {
      const c = document.createElement("canvas");
      c.width = c.height = 64;
      const ctx = c.getContext("2d")!,
        g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, "rgba(255,210,130,.55)");
      g.addColorStop(0.45, "rgba(255,195,112,.26)");
      g.addColorStop(1, "rgba(255,195,112,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 64, 64);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    }, []);
  useLayoutEffect(() => {
    const d = new THREE.Object3D();
    placements.forEach((p, i) => {
      d.position.set(p.x, p.y + 0.022, p.z);
      d.rotation.set(-Math.PI / 2, 0, 0);
      d.scale.set(10, 10, 1);
      d.updateMatrix();
      ref.current!.setMatrixAt(i, d.matrix);
    });
    ref.current!.instanceMatrix.needsUpdate = true;
    ref.current!.computeBoundingSphere();
  }, [placements]);
  useEffect(() => () => texture.dispose(), [texture]);
  useFrame(() => {
    const lights = lightUniforms.lights.value;
    if (ref.current) ref.current.visible = lights > 0.01;
    if (material.current) material.current.opacity = lights;
  });
  return (
    <instancedMesh
      name="street-light-pools"
      ref={ref}
      args={[undefined, undefined, placements.length]}
      raycast={() => {}}
    >
      <planeGeometry />
      <meshBasicMaterial
        ref={material}
        map={texture}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </instancedMesh>
  );
}
