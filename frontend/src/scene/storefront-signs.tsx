import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useStore } from "../store";
import { navigation } from "../navigation";
import { venueName } from "../content-names";
import { groundHeight } from "./ground";
import { WorldText } from "./world-text";
import type { CityId } from "../api/types";

function Fascia({
  id,
  name,
  door,
  city,
}: {
  id: string;
  name: string;
  door: { x: number; z: number };
  city: CityId;
}) {
  const ref = useRef<THREE.Group>(null),
    placed = useRef(false),
    scene = useThree((s) => s.scene),
    signPoint = useMemo(() => new THREE.Vector3(), []),
    title = name.trim();
  useFrame(({ camera }) => {
    if (!ref.current) return;
    if (!placed.current && scene.getObjectByName("terrain")) {
      ref.current.position.y = groundHeight(scene, city, door.x, door.z + 0.4);
      placed.current = true;
    }
    signPoint.set(door.x, ref.current.position.y + 3.15, door.z + 0.4);
    ref.current.visible = !!title && camera.position.distanceTo(signPoint) < 62;
  });
  if (!title) return null;
  return (
    <group
      ref={ref}
      name={`venue-sign:${id}`}
      position={[door.x, 0, door.z + 0.4]}
    >
      <mesh position={[0, 3.15, 0]} raycast={() => {}}>
        <boxGeometry args={[6.3, 1.05, 0.13]} />
        <meshStandardMaterial color="#315f57" roughness={0.7} />
      </mesh>
      <WorldText
        position={[0, 3.15, 0.08]}
        fontSize={name.length > 20 ? 0.36 : 0.46}
        maxWidth={6}
        distance={Infinity}
      >
        {name.length > 25 ? name.slice(0, 24) + "..." : name}
      </WorldText>
    </group>
  );
}
export function StorefrontSigns() {
  const city = useStore((s) => s.city),
    world = useStore((s) => s.world),
    locations = useMemo(
      () => world?.cities.find((c) => c.id === city)?.landmarks ?? [],
      [city, world],
    ),
    doors = navigation[city].doors as Record<string, { x: number; z: number }>;
  return (
    <group name="storefront-signs">
      {locations
        .filter((l) => doors[l.id])
        .map((l) => (
          <Fascia
            key={`${city}:${l.id}`}
            city={city}
            id={l.id}
            name={venueName(l.id, l.name)}
            door={doors[l.id]}
          />
        ))}
    </group>
  );
}
