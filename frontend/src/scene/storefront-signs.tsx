import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { useStore } from "../store";
import { navigation } from "../navigation";
import { venueName } from "../content-names";
import { groundHeight } from "./ground";
import { WorldText } from "./world-text";
import { sitesFor } from "./cities";
import type { CityId } from "../api/types";

const fasciaGeometry = (() => {
  const parts = [
    new THREE.BoxGeometry(6.3, 1.05, 0.13),
    new THREE.CylinderGeometry(0.08, 0.08, 2.625, 8).translate(
      -2.6,
      -1.8375,
      0,
    ),
    new THREE.CylinderGeometry(0.08, 0.08, 2.625, 8).translate(
      2.6,
      -1.8375,
      0,
    ),
  ];
  for (const [index, geometry] of parts.entries()) {
    const color = new THREE.Color(index ? "#2c3f3b" : "#315f57"),
      values = new Float32Array(
        geometry.getAttribute("position").count * 3,
      );
    for (let i = 0; i < values.length; i += 3) {
      values[i] = color.r;
      values[i + 1] = color.g;
      values[i + 2] = color.b;
    }
    geometry.setAttribute("color", new THREE.BufferAttribute(values, 3));
  }
  const merged = mergeGeometries(parts);
  parts.forEach((part) => part.dispose());
  if (!merged) throw Error("Could not merge storefront fascia");
  return merged;
})();

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
      <mesh
        position={[0, 3.15, 0]}
        geometry={fasciaGeometry}
        raycast={() => {}}
      >
        <meshStandardMaterial vertexColors roughness={0.7} />
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

function AirportWayfinding({
  city,
  id,
  x,
  z,
}: {
  city: CityId;
  id: string;
  x: number;
  z: number;
}) {
  const width = city === "atl" ? 30 : 17,
    faceZ = city === "atl" ? 9 : 4.53,
    canopyFront = Math.min(faceZ + 3, 9.7),
    curbZ = Math.min(canopyFront + 0.3, 9.65),
    taxiZ = Math.min(curbZ + 0.2, 9.84),
    taxiX = width / 2 + 1.2,
    canopySignZ = canopyFront + 0.04;
  return (
    <group name={`airport-wayfinding:${id}`} position={[x, 0, z]}>
      <WorldText
        position={[-width * 0.25, 3.2, canopySignZ]}
        fontSize={0.42}
        maxWidth={4.5}
      >
        Departures
      </WorldText>
      <WorldText
        position={[width * 0.25, 3.2, canopySignZ]}
        fontSize={0.42}
        maxWidth={4.5}
      >
        Arrivals
      </WorldText>
      <WorldText
        position={[taxiX, 1.8, taxiZ + 0.06]}
        fontSize={0.36}
        maxWidth={1.2}
        color="#2c3f3b"
        outlineColor="#fff7ea"
      >
        Taxi
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
    doors = navigation[city].doors as Record<string, { x: number; z: number }>,
    airports = Object.entries(sitesFor(city)).filter(([id]) =>
      id.endsWith("Airport"),
    );
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
      {airports.map(([id, site]) => (
        <AirportWayfinding
          key={`${city}:${id}:wayfinding`}
          city={city}
          id={id}
          x={site.x}
          z={site.z}
        />
      ))}
    </group>
  );
}
