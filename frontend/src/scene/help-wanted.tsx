/* oxlint-disable react/immutability -- Owned sign positions follow loaded terrain. */
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { groundHeight } from "./ground";
import { useStore } from "../store";
import { inBox, navigation } from "../navigation";
import { WorldText } from "./world-text";
import type { CityId } from "../api/types";
function HiringSign({
  door,
  city,
}: {
  door: { x: number; z: number };
  city: CityId;
}) {
  const ref = useRef<THREE.Group>(null),
    placed = useRef(false),
    scene = useThree((s) => s.scene),
    // Stand beside the sign posts on whichever side has open pavement.
    x = useMemo(() => {
      const free = (x: number) =>
        navigation[city].boxes.every((b) => !inBox(x, door.z + 0.25, b, 0.8));
      return door.x + (free(door.x - 4.1) || !free(door.x + 4.1) ? -4.1 : 4.1);
    }, [city, door.x, door.z]);
  useFrame(() => {
    if (!ref.current || placed.current || !scene.getObjectByName("terrain"))
      return;
    ref.current.position.y = groundHeight(scene, city, x, door.z + 0.25);
    placed.current = true;
  });
  return (
    <group ref={ref} position={[x, 0, door.z + 0.25]}>
      <mesh
        position={[0, 0.65, -0.04]}
        userData={{ cameraOccluder: true, cameraOccluderPad: 0.7 }}
      >
        <boxGeometry args={[0.07, 1.3, 0.07]} />
        <meshStandardMaterial color="#674c3e" />
      </mesh>
      <mesh
        position={[0, 1.45, 0]}
        userData={{ cameraOccluder: true, cameraOccluderPad: 0.7 }}
      >
        <boxGeometry args={[2.2, 0.85, 0.1]} />
        <meshStandardMaterial color="#f5e6ca" />
      </mesh>
      <WorldText
        position={[0, 1.45, 0.065]}
        fontSize={0.29}
        maxWidth={2}
        color="#315d43"
        outlineColor="#fff5df"
      >
        We're hiring
      </WorldText>
    </group>
  );
}
export function HelpWanted() {
  const city = useStore((s) => s.city),
    world = useStore((s) => s.world),
    room = useStore((s) => s.sim?.position?.room),
    locations = useMemo(
      () =>
        world?.cities
          .find((c) => c.id === city)
          ?.landmarks.filter((l) => l.actions.some((a) => a.requires?.job)) ??
        [],
      [world, city],
    ),
    doors = navigation[city].doors as Record<string, { x: number; z: number }>;
  return room ? null : (
    <group name="help-wanted-signs">
      {locations
        .filter((l) => doors[l.id])
        .map((l) => (
          <HiringSign key={`${city}:${l.id}`} door={doors[l.id]} city={city} />
        ))}
    </group>
  );
}
