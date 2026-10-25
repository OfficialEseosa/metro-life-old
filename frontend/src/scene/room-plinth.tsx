import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { roomLayout, roomType } from "../navigation";
import { useStore } from "../store";

/** The room stands on its own bevelled cutaway slab in a clear, quiet void. */
export function RoomPlinth({ room }: { room: string }) {
  const city = useStore((s) => s.city),
    layout = roomLayout(city, roomType(room)!),
    w = layout.bounds?.w ?? 12,
    d = layout.bounds?.d ?? 10;
  const geometry = useMemo(() => {
    const shape = new THREE.Shape(),
      points = layout.floor ?? [
        [-w / 2, -d / 2],
        [w / 2, -d / 2],
        [w / 2, d / 2],
        [-w / 2, d / 2],
      ];
    points.forEach((p, i) => {
      const x = p[0] + Math.sign(p[0]) * 0.25,
        z = p[1] + Math.sign(p[1]) * 0.25;
      if (i) shape.lineTo(x, -z);
      else shape.moveTo(x, -z);
    });
    shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, {
      depth: 0.22,
      bevelEnabled: true,
      bevelSize: 0.1,
      bevelThickness: 0.1,
      bevelSegments: 2,
      steps: 1,
    });
    g.rotateX(-Math.PI / 2);
    g.translate(0, -0.48, 0);
    return g;
  }, [layout.floor, w, d]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh name="room-stage-plinth" geometry={geometry} receiveShadow>
      <meshStandardMaterial color="#78665d" roughness={0.95} />
    </mesh>
  );
}
