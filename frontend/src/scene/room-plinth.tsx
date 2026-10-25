/* oxlint-disable react/immutability -- Surrounding materials follow the clock. */
import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { roomLayout, roomType } from "../navigation";
import { useStore } from "../store";
import { grassify, noiseChunk } from "./ground-material";
import { timeOfDay } from "../lighting";
import { Trees, type TreeSpot } from "./trees";
import { RoomStreet } from "./room-street";

const noPick = () => {};
const lawnShade = new THREE.Color("#6f8f5e"),
  paving = new THREE.Color("#b4ad9d"),
  pavingNight = new THREE.Color("#7b7a8c");

/**
 * The room stands on a foundation in its own small world: a lawn around homes,
 * a paved forecourt around venues, with neighbouring facades and a road so the
 * cutaway reads as a building on a street, not a box in a void.
 */
export function RoomPlinth({ room }: { room: string }) {
  const city = useStore((s) => s.city),
    type = roomType(room)!,
    layout = roomLayout(city, type),
    w = layout.bounds?.w ?? 12,
    d = layout.bounds?.d ?? 10,
    home = type === "home",
    dark = ["club", "theatre", "aquarium"].includes(type);
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
      depth: 0.5,
      bevelEnabled: true,
      bevelSize: 0.06,
      bevelThickness: 0.06,
      bevelSegments: 2,
      steps: 1,
    });
    g.rotateX(-Math.PI / 2);
    g.translate(0, -0.78, 0);
    return g;
  }, [layout.floor, w, d]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const radius = Math.max(w, d) * 2.4 + 18;
  const ground = useMemo(() => {
    const material = home
      ? grassify(new THREE.MeshStandardMaterial({ roughness: 1, transparent: true }), "room-lawn")
      : new THREE.MeshStandardMaterial({ roughness: 0.95, transparent: true });
    const compile = material.onBeforeCompile;
    const fade = { value: radius };
    material.onBeforeCompile = (shader, renderer) => {
      compile.call(material, shader, renderer);
      shader.uniforms.surroundRadius = fade;
      shader.vertexShader = shader.vertexShader.includes("vGrassWorld")
        ? shader.vertexShader
        : "varying vec3 vGrassWorld;\n" +
          shader.vertexShader.replace(
            "#include <project_vertex>",
            "#include <project_vertex>\nvGrassWorld=(modelMatrix*vec4(transformed,1.)).xyz;",
          );
      shader.fragmentShader =
        (shader.fragmentShader.includes("varying vec3 vGrassWorld")
          ? ""
          : "varying vec3 vGrassWorld;\n" + noiseChunk) +
        "uniform float surroundRadius;\n" +
        shader.fragmentShader.replace(
          "#include <dithering_fragment>",
          `#include <dithering_fragment>
          float edge=length(vGrassWorld.xz)/surroundRadius;
          gl_FragColor.a*=1.-smoothstep(.45,1.,edge);
          ${home ? "" : "vec2 tile=fract(vGrassWorld.xz/1.5);float joint=step(tile.x,.02)+step(tile.y,.02);gl_FragColor.rgb*=1.-min(joint,1.)*.1+(mlHash(floor(vGrassWorld.xz/1.5))-.5)*.05;"}`,
        );
    };
    material.customProgramCacheKey = () => `metro-room-surround-${home ? "lawn" : "paving"}`;
    material.depthWrite = false;
    return material;
  }, [home, radius]);
  useEffect(() => () => ground.dispose(), [ground]);
  useFrame(() => {
    // The room key light is strong; keep the lawn calmer than the street grass.
    if (home) ground.color.copy(timeOfDay.ground).lerp(lawnShade, 0.5).multiplyScalar(0.58);
    else ground.color.lerpColors(paving, pavingNight, dark ? 1 : timeOfDay.nightFactor * 0.7);
  });
  const trees = useMemo<TreeSpot[]>(() => {
    if (dark) return [];
    // A loose ring of trees behind and beside the building; the camera side stays open.
    const spots: TreeSpot[] = [],
      count = home ? 9 : 14;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + 0.35,
        out = 2.5 + (i % 3) * 2.2,
        x = Math.sin(a) * (w / 2 + out),
        z = -Math.abs(Math.cos(a)) * (d / 2 + out) - 1;
      if (Math.cos(a) > 0.25 && Math.abs(Math.sin(a)) < 0.9) continue;
      spots.push({ x, y: -0.55, z });
    }
    return spots;
  }, [home, dark, w, d]);
  return (
    <group name="room-surroundings">
      <mesh name="room-stage-plinth" geometry={geometry} receiveShadow raycast={noPick}>
        <meshStandardMaterial color={home ? "#cbbba3" : "#b9b2a6"} roughness={0.92} />
      </mesh>
      <mesh
        name="room-surround-ground"
        material={ground}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.56, 0]}
        receiveShadow
        raycast={noPick}
        renderOrder={-10}
      >
        <circleGeometry args={[radius, 48]} />
      </mesh>
      <RoomStreet w={w} d={d} home={home} />
      {trees.length > 0 && <Trees spots={trees} />}
    </group>
  );
}
