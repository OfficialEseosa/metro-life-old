/* oxlint-disable react/immutability -- Room animation resources belong to the renderer. */
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { RoomLayout } from "../navigation";
import { serverNow } from "../server-time";
import { useVenueMoment } from "../ui/venue-moments";
import { Builder } from "./geometry";
import type { BowlSeat } from "./bowl-builder";
import { WorldText } from "./world-text";

function BowlAudience({ seats }: { seats: BowlSeat[] }) {
  const ref = useRef<THREE.InstancedMesh>(null),
    dummy = useMemo(() => new THREE.Object3D(), []);
  const resource = useMemo(() => {
    const b = new Builder();
    b.box(0, 0.33, 0, 0.42, 0.64, 0.27, "#fff4dd");
    b.sphere(0, 0.88, 0, 0.2, "#d09c75", 1, 1.12, 1);
    b.sphere(0, 1.02, -0.04, 0.19, "#433539", 1, 0.52, 1);
    b.box(-0.29, 0.37, 0, 0.14, 0.53, 0.15, "#e9d9bc");
    b.box(0.29, 0.37, 0, 0.14, 0.53, 0.15, "#e9d9bc");
    b.box(-0.13, 0.04, 0.22, 0.2, 0.16, 0.5, "#334454");
    b.box(0.13, 0.04, 0.22, 0.2, 0.16, 0.5, "#334454");
    const geometry = b.build(),
      material = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.85,
      }),
      time = { value: 0 },
      wave = { value: 10000 },
      dance = { value: 10000 };
    material.onBeforeCompile = (shader) => {
      shader.uniforms.venueTime = time;
      shader.uniforms.waveAge = wave;
      shader.uniforms.danceAge = dance;
      shader.vertexShader =
        "uniform float venueTime;uniform float waveAge;uniform float danceAge;\n" +
        shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
   float seatAngle=atan(instanceMatrix[3].x,instanceMatrix[3].z+3.);
   float waveFront=waveAge-(seatAngle+3.14159)*.65;
   float cheer=(waveFront>0.&&waveFront<1.8)?sin(waveFront/1.8*3.14159):0.;
   if(abs(position.x)>.22&&position.y>.12){transformed.y+=cheer*.8;transformed.x+=sign(position.x)*cheer*.12;}
   transformed.y+=sin(venueTime*.9+seatAngle*8.)*.008;
   if(danceAge<12.)transformed.x+=sin(venueTime*5.+seatAngle)*.055;
  `,
      );
    };
    return { geometry, material, time, wave, dance };
  }, []);
  useEffect(() => {
    if (!ref.current) return;
    seats.forEach((seat, i) => {
      dummy.position.set(seat.x, seat.y, seat.z);
      dummy.rotation.set(0, seat.face, 0);
      dummy.scale.setScalar(0.78);
      dummy.updateMatrix();
      ref.current!.setMatrixAt(i, dummy.matrix);
      ref.current!.setColorAt(
        i,
        new THREE.Color(
          ["#8f4850", "#ead0a5", "#447c86", "#848bc1", "#b89165", "#5e8b72"][
            i % 6
          ],
        ),
      );
    });
    ref.current.instanceMatrix.needsUpdate = true;
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
    ref.current.computeBoundingSphere();
  }, [seats, dummy]);
  useEffect(
    () => () => {
      resource.geometry.dispose();
      resource.material.dispose();
    },
    [resource],
  );
  useFrame(() => {
    const now = serverNow(),
      shared = useVenueMoment.getState().data?.shared;
    resource.time.value = now / 1000;
    resource.wave.value = (now - (shared?.waveAt ?? 0)) / 1000;
    resource.dance.value = (now - (shared?.danceAt ?? 0)) / 1000;
  });
  return (
    <instancedMesh
      ref={ref}
      name="animated-bowl-audience"
      args={[resource.geometry, resource.material, seats.length]}
      raycast={() => {}}
    />
  );
}

function OceanLife() {
  const shark = useRef<THREE.Group>(null),
    tail = useRef<THREE.Group>(null),
    fish = useRef<THREE.InstancedMesh>(null),
    dummy = useMemo(() => new THREE.Object3D(), []);
  const geometry = useMemo(() => {
    const b = new Builder();
    b.sphere(0, 0, 0, 1, "#477f96", 3.1, 0.75, 0.42);
    b.sphere(2.6, -0.05, 0.02, 0.68, "#659aaa", 1.3, 0.65, 0.55);
    b.triangle([-1, 0, 0, -2.7, 1.4, 0, -2.8, -1.1, 0], "#376d87");
    b.triangle([0, 0.2, 0.05, -0.7, 1.35, 0.05, -1, 0.2, 0.05], "#376d87");
    b.triangle([0.4, -0.3, 0.1, -0.8, -1.4, 0.1, -1.4, -0.3, 0.1], "#416f82");
    for (let i = 0; i < 34; i++)
      b.sphere(
        -2.5 + (i % 9) * 0.55,
        0.08 + Math.floor(i / 9) * 0.14,
        0.35,
        0.055,
        "#d1e4df",
        1,
        0.7,
        0.25,
      );
    b.sphere(2.9, 0.12, 0.35, 0.07, "#1b3f51");
    return b.build();
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame(() => {
    const t = serverNow() / 1000;
    if (shark.current) {
      shark.current.position.set(
        Math.sin(t * 0.09) * 6,
        4.8 + Math.sin(t * 0.17) * 0.6,
        -12.1,
      );
      shark.current.rotation.z = Math.sin(t * 0.16) * 0.035;
      shark.current.scale.x = Math.cos(t * 0.09) > 0 ? 1 : -1;
    }
    if (tail.current) tail.current.rotation.y = Math.sin(t * 0.8) * 0.16;
    if (fish.current) {
      for (let i = 0; i < 26; i++) {
        dummy.position.set(
          Math.sin(t * 0.15 + i * 1.7) * 12,
          1.8 + (i % 7) * 0.75 + Math.sin(t * 0.3 + i) * 0.15,
          -12.02 + (i % 3) * 0.04,
        );
        dummy.rotation.set(0, 0, Math.sin(t * 0.3 + i) * 0.15);
        dummy.scale.set(0.25 + (i % 4) * 0.06, 0.12, 0.09);
        dummy.updateMatrix();
        fish.current.setMatrixAt(i, dummy.matrix);
      }
      fish.current.instanceMatrix.needsUpdate = true;
      fish.current.computeBoundingSphere();
    }
  });
  return (
    <>
      <group ref={shark}>
        <mesh geometry={geometry}>
          <meshStandardMaterial
            vertexColors
            roughness={0.55}
            emissive="#1d4761"
            emissiveIntensity={0.35}
          />
        </mesh>
        <group ref={tail} position={[-2.7, 0, 0]}>
          <mesh>
            <coneGeometry args={[0.7, 1.5, 3]} />
            <meshStandardMaterial color="#447c92" side={THREE.DoubleSide} />
          </mesh>
        </group>
      </group>
      <instancedMesh
        ref={fish}
        args={[undefined, undefined, 26]}
        raycast={() => {}}
      >
        <sphereGeometry args={[1, 8, 5]} />
        <meshStandardMaterial
          color="#c9d7a5"
          emissive="#719dba"
          emissiveIntensity={0.25}
        />
      </instancedMesh>
    </>
  );
}

/** Shared timestamps drive visible venue reactions consistently for every visitor. */
export function VenueLiveProps({
  type,
  loc,
  layout,
  crowd,
}: {
  type: string;
  loc: string;
  layout: RoomLayout;
  crowd: BowlSeat[];
}) {
  const data = useVenueMoment((s) => s.data),
    lift = useRef<THREE.Group>(null),
    train = useRef<THREE.Group>(null),
    curtains = useRef<THREE.Group>(null),
    ball = useRef<THREE.Mesh>(null),
    ray = useRef<THREE.Group>(null),
    roof = useRef<THREE.Group>(null),
    clockHand = useRef<THREE.Mesh>(null);
  const sports = ["stadium", "arena", "ballpark"].includes(type),
    petal = useMemo(() => {
      const b = new Builder();
      b.triangle(
        [13, 0, -3, 25, 1, -10, 25, 1, 10, 13, 0, -3, 25, 1, 10, 12, 0, 3],
        "#d4d6d0",
      );
      return b.build();
    }, []);
  useEffect(() => () => petal.dispose(), [petal]);
  useFrame(() => {
    const now = serverNow(),
      t = now / 1000,
      current = useVenueMoment.getState().data,
      shared = current?.shared,
      active =
        current?.moment?.phase === "active" ||
        current?.moment?.phase === "encore";
    if (lift.current)
      lift.current.position.y = 1.6 + (1 - Math.cos((t * Math.PI) / 15)) * 1.5;
    if (train.current) {
      const called = now - (shared?.trainAt ?? 0) < 18000,
        travel = (t % 70) / 70;
      train.current.position.z = called ? -5 : -35 + travel * 70;
      train.current.visible = called || (travel > 0.28 && travel < 0.72);
    }
    if (curtains.current) {
      const open = active || now - (shared?.curtainAt ?? 0) < 20000;
      curtains.current.children.forEach((child, i) => {
        child.position.x +=
          ((i < 8 ? -1 : 1) * ((i % 8) * 0.25 + (open ? 5 : 0.5)) -
            child.position.x) *
          0.08;
      });
    }
    if (ball.current) {
      const age = (now - (shared?.lastPlayAt ?? 0)) / 1000,
        putt = shared?.lastKind === "golf";
      if (type === "foodhall") {
        const a = THREE.MathUtils.clamp(age / 2.5, 0, 1);
        ball.current.position.set(
          putt ? 5 - a : 14,
          3.2 + (putt ? 0 : Math.sin(a * Math.PI) * 0.6),
          putt ? -8.3 - a * 3.7 : -7.8 - a * 4.4,
        );
        ball.current.visible = age < 4;
      } else if (type === "arena") {
        const a = THREE.MathUtils.clamp(age / 2.2, 0, 1);
        ball.current.position.set(9 + a * 3, 1 + Math.sin(a * Math.PI) * 3, -3);
        ball.current.visible = age < 3;
      }
    }
    if (ray.current) {
      ray.current.rotation.y = t * 0.27;
      ray.current.position.y = 1.17 + Math.sin(t * 0.8) * 0.025;
      ray.current.scale.x = 1 + Math.sin(t * 2) * 0.05;
    }
    if (roof.current)
      roof.current.children.forEach((p, i) => {
        p.rotation.z = Math.sin(t * 0.025 + (i * Math.PI) / 4) * 0.025;
      });
    if (clockHand.current)
      clockHand.current.rotation.z = (-t / 60) * Math.PI * 2;
  });
  const art = data?.shared?.art?.slice(-3) ?? [];
  return (
    <group
      name={"venue-life-" + loc}
      userData={{
        zones:
          (layout as RoomLayout & { zones?: unknown[] }).zones?.length ?? 0,
      }}
    >
      {crowd.length > 0 && <BowlAudience seats={crowd} />}
      {sports && type !== "arena" && (
        <group ref={roof} position={[0, (layout.height ?? 24) - 1, -3]}>
          {Array.from({ length: 8 }, (_, i) => (
            <group key={i} rotation={[0, (i * Math.PI) / 4, 0]}>
              <mesh geometry={petal}>
                <meshStandardMaterial
                  vertexColors
                  roughness={0.75}
                  side={THREE.DoubleSide}
                />
              </mesh>
            </group>
          ))}
        </group>
      )}
      {type === "aquarium" && (
        <>
          <OceanLife />
          <group ref={ray} position={[12, 1.17, -1]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[0.75, 4]} />
              <meshStandardMaterial color="#738b93" side={THREE.DoubleSide} />
            </mesh>
            <mesh position={[0, 0, -0.8]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.025, 0.045, 1.4, 6]} />
              <meshStandardMaterial color="#708991" />
            </mesh>
          </group>
          <pointLight
            position={[0, 5, -9]}
            color="#52b5d6"
            intensity={180}
            distance={32}
          />
        </>
      )}
      {type === "foodhall" && (
        <>
          <group ref={lift} position={[-3, 1.6, -10]}>
            <mesh>
              <boxGeometry args={[3.4, 0.18, 3.4]} />
              <meshStandardMaterial color="#9e9b80" />
            </mesh>
            {[-1, 1].map((side) => (
              <mesh key={side} position={[side * 1.6, 1.4, 0]}>
                <boxGeometry args={[0.07, 2.8, 3.4]} />
                <meshStandardMaterial
                  color="#abc6c0"
                  transparent
                  opacity={0.35}
                  depthWrite={false}
                />
              </mesh>
            ))}
            <WorldText position={[0, 2.7, 1.7]} fontSize={0.35} distance={500}>
              ROOF / HALL
            </WorldText>
          </group>
          <mesh ref={ball} position={[5, 3.2, -8.3]}>
            <sphereGeometry args={[0.11, 10, 7]} />
            <meshStandardMaterial color="#fff3d5" />
          </mesh>
          <WorldText
            position={[14, 5.4, -12.15]}
            fontSize={0.45}
            distance={500}
            color="#fbe4a6"
          >
            {data?.shared?.lastKind === "skee"
              ? "SCORE " + (data.shared.lastScore ?? 0)
              : "ROLL & RALLY"}
          </WorldText>
        </>
      )}
      {type === "arena" && (
        <>
          <mesh ref={ball}>
            <sphereGeometry args={[0.24, 14, 10]} />
            <meshStandardMaterial color="#dd9255" />
          </mesh>
          <WorldText
            position={[0, (layout.height ?? 18) - 3.8, 0.01]}
            fontSize={0.7}
            distance={500}
          >
            {data?.shared?.danceName
              ? "DANCE CAM · " + data.shared.danceName
              : "MAPLE STREET · HOME 24 · AWAY 21"}
          </WorldText>
        </>
      )}
      {type === "theatre" && (
        <group ref={curtains} position={[0, 3.8, -12.7]}>
          {Array.from({ length: 16 }, (_, i) => (
            <mesh
              key={i}
              position={[(i < 8 ? -1 : 1) * (0.5 + (i % 8) * 0.68), 0, 0]}
            >
              <cylinderGeometry args={[0.42, 0.42, 7.1, 8]} />
              <meshStandardMaterial color={i % 2 ? "#a13959" : "#762e4d"} />
            </mesh>
          ))}
        </group>
      )}
      {type === "airport" && (
        <>
          <group ref={train} position={[17, 1.5, -5]}>
            <mesh>
              <boxGeometry args={[3.2, 2.7, 7.5]} />
              <meshStandardMaterial color="#b7d0d1" roughness={0.38} />
            </mesh>
            {[-1, 1].map((side) => (
              <group key={side}>
                {[-2, 0, 2].map((z) => (
                  <mesh key={z} position={[side * 1.62, 0.25, z]}>
                    <boxGeometry args={[0.025, 1.3, 1.35]} />
                    <meshStandardMaterial
                      color="#31576c"
                      emissive="#31576c"
                      emissiveIntensity={0.25}
                    />
                  </mesh>
                ))}
              </group>
            ))}
            <WorldText
              position={[-1.65, 0.5, 0]}
              rotation={[0, -Math.PI / 2, 0]}
              fontSize={0.33}
              distance={500}
            >
              SKYTRAIN
            </WorldText>
          </group>
          {loc === "grandCentral" && (
            <mesh ref={clockHand} position={[0, 3.2, 4.67]}>
              <boxGeometry args={[0.045, 0.65, 0.03]} />
              <meshStandardMaterial color="#514d42" />
            </mesh>
          )}
        </>
      )}
      {type === "museum" &&
        art.map((work, i) => (
          <group key={work.id} position={[7 + i * 2, 1.8, -4.9]}>
            {work.cells.map((cell, j) => (
              <mesh
                key={j}
                position={[
                  ((j % 4) - 1.5) * 0.2,
                  (1.5 - Math.floor(j / 4)) * 0.2,
                  0.02,
                ]}
              >
                <planeGeometry args={[0.195, 0.195]} />
                <meshBasicMaterial
                  color={/^#[0-9a-f]{6}$/i.test(cell) ? cell : "#e4cb9e"}
                />
              </mesh>
            ))}
          </group>
        ))}
    </group>
  );
}
