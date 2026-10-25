import { useEffect, useMemo } from "react";
import * as THREE from "three";
import routes from "../shared-data/resident-routes.json";
import { navigation } from "../navigation";
import type { CityId } from "../api/types";
import { Builder } from "./geometry";
import { paveify } from "./ground-material";

/** Small paved lots and surveyed collision-free approaches anchor the close walking view. */
export function Walkways({ city }: { city: CityId }) {
  const geometry = useMemo(() => {
    const b = new Builder(),
      n = navigation[city];
    for (const box of n.boxes) {
      if (!("y" in box)) continue;
      const g = new THREE.PlaneGeometry(box.w + 1.4, box.d + 1.4);
      g.rotateX(-Math.PI / 2);
      g.rotateY(box.a);
      b.add(g, "#d0cdc1", box.x, (box.y ?? 0) + 0.018, box.z);
      if (!box.windows) continue;
      for (const side of [0, 1, 2])
        for (const col of [-0.23, 0.23])
          for (const row of [0.38, 0.66]) {
            const local =
              side === 0
                ? new THREE.Vector3(
                    col * box.w,
                    box.h * row,
                    -box.d / 2 - 0.012,
                  )
                : new THREE.Vector3(
                    (side === 1 ? -1 : 1) * (box.w / 2 + 0.012),
                    box.h * row,
                    col * box.d,
                  );
            const plane = new THREE.PlaneGeometry(
              Math.min(0.48, (side === 0 ? box.w : box.d) * 0.19),
              Math.min(0.78, box.h * 0.18),
            );
            plane.rotateY(
              side === 0 ? Math.PI : side === 1 ? -Math.PI / 2 : Math.PI / 2,
            );
            plane.translate(local.x, local.y, local.z);
            plane.rotateY(box.a);
            b.add(plane, "#7cabb7", box.x, box.y ?? 0, box.z);
          }
    }
    for (const d of Object.values(n.homes)) {
      const g = new THREE.PlaneGeometry(5.8, 5.2);
      g.rotateX(-Math.PI / 2);
      b.add(g, "#c9c8b6", d.x, 0.035, d.z - 4.1);
    }
    for (const path of n.paths)
      for (let i = 1; i < path.points.length; i++) {
        const a = path.points[i - 1],
          c = path.points[i],
          dx = c[0] - a[0],
          dz = c[1] - a[1],
          g = new THREE.PlaneGeometry(2, Math.hypot(dx, dz) + 0.18);
        g.rotateX(-Math.PI / 2);
        g.rotateY(Math.atan2(dx, dz));
        b.add(g, "#d6d1c3", (a[0] + c[0]) / 2, 0.045, (a[1] + c[1]) / 2);
      }
    for (const park of Object.values(routes.cities[city].parks))
      for (const [x, z] of park.benches) {
        b.box(x, 0.39, z, 1.75, 0.12, 0.65, "#986449");
        b.box(x, 0.85, z - 0.28, 1.75, 0.8, 0.12, "#986449");
        for (const dx of [-0.65, 0.65])
          b.box(x + dx, 0.18, z, 0.12, 0.36, 0.48, "#485358");
      }
    return b.build();
  }, [city]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const material = useMemo(
    () =>
      paveify(
        new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }),
        "walkways",
      ),
    [],
  );
  useEffect(() => () => material.dispose(), [material]);
  return (
    <mesh
      name="walking-paths"
      geometry={geometry}
      receiveShadow
      raycast={() => {}}
    >
      <primitive object={material} attach="material" />
    </mesh>
  );
}
