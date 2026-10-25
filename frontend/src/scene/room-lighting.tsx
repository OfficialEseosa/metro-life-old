/* oxlint-disable react/immutability -- Room-only light/environment resources are owned by this component. */
import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { motion } from "../walking";
import { useStore } from "../store";
import { timeOfDay, useNightLighting } from "../lighting";

const warm = new THREE.Color("#fff3df");
import { roomLayout, roomType } from "../navigation";

export function RoomLighting({ club }: { club: boolean }) {
  const night = useNightLighting(),
    roomId = useStore((s) => s.sim?.position?.room),
    city = useStore((s) => s.city),
    type = roomType(roomId ?? "") ?? "home",
    layout = roomLayout(city, type),
    extent = Math.max(layout.bounds?.w ?? 12, layout.bounds?.d ?? 10) / 2 + 2,
    height = layout.height ?? 3,
    museum = type === "museum",
    aquarium = type === "aquarium",
    theatre = type === "theatre",
    sports = ["stadium", "arena", "ballpark"].includes(type),
    environmentLevel = aquarium
      ? 0.16
      : club
        ? 0.24
        : museum
          ? 0.65
          : theatre
            ? 0.25
            : sports
              ? 0.55
              : night
                ? 0.38
                : 0.5;
  const { gl, scene, invalidate } = useThree(),
    key = useRef<THREE.DirectionalLight>(null),
    previous = useRef(0),
    fill = useRef<THREE.HemisphereLight>(null),
    lastUpdate = useRef(0);
  useEffect(() => {
    const room = new RoomEnvironment(),
      generator = new THREE.PMREMGenerator(gl),
      environment = generator.fromScene(room, 0.04),
      old = scene.environment,
      oldIntensity = scene.environmentIntensity;
    scene.environment = environment.texture;
    scene.environmentIntensity = environmentLevel;
    room.dispose();
    generator.dispose();
    gl.shadowMap.needsUpdate = true;
    invalidate();
    return () => {
      scene.environment = old;
      scene.environmentIntensity = oldIntensity;
      environment.dispose();
    };
  }, [gl, scene, invalidate, environmentLevel]);
  useFrame(({ clock }) => {
    // Re-render the room shadow when anyone in the room moves or acts; no strings per frame.
    const p = motion.position,
      state = useStore.getState(),
      sim = state.sim;
    let hash = (p ? p.x * 13.1 + p.z * 7.7 : 0) + (sim?.busyUntil ?? 0) * 1e-9,
      animated = !!sim?.busyUntil;
    for (const x of state.players) {
      if (x.position?.room !== p?.room) continue;
      hash += (x.position?.x ?? 0) * 3.3 + (x.position?.z ?? 0) * 5.9;
      if (x.activity && x.activity !== "idle") animated = true;
    }
    if (
      (Math.abs(hash - previous.current) > 1e-4 || animated) &&
      clock.elapsedTime - lastUpdate.current > 0.067
    ) {
      if (key.current) key.current.shadow.needsUpdate = true;
      gl.shadowMap.needsUpdate = true;
      previous.current = hash;
      lastUpdate.current = clock.elapsedTime;
    }
    // The fill drifts with the clock outside, so rooms visibly change through the day.
    if (fill.current && !aquarium && !club && !museum) {
      fill.current.color.copy(warm).lerp(timeOfDay.hemiSky, 0.3);
    }
  });
  return (
    <>
      <hemisphereLight
        ref={fill}
        args={[
          aquarium
            ? "#7ccce5"
            : museum
              ? "#ffffff"
              : night
                ? "#aec8dd"
                : "#fff3df",
          aquarium
            ? "#12334d"
            : club
              ? "#34304b"
              : museum
                ? "#b6bbb5"
                : "#8a7c78",
          aquarium ? 0.33 : club ? 0.32 : museum ? 0.72 : theatre ? 0.3 : 0.48,
        ]}
      />
      <directionalLight
        ref={key}
        name="room-shadow-key"
        position={[-extent * 0.45, Math.max(7, height + 2), extent * 0.6]}
        intensity={
          aquarium
            ? 1.1
            : club
              ? 1.3
              : museum
                ? 3.5
                : theatre
                  ? 1.4
                  : sports
                    ? 3.2
                    : night
                      ? 1.8
                      : 2.5
        }
        color={
          aquarium
            ? "#80cce4"
            : museum || sports
              ? "#fffaf0"
              : night
                ? "#b8cee1"
                : "#ffe1b3"
        }
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-radius={2.5}
        shadow-intensity={0.85}
        shadow-camera-left={-extent}
        shadow-camera-right={extent}
        shadow-camera-top={extent}
        shadow-camera-bottom={-extent}
        shadow-camera-near={0.5}
        shadow-camera-far={Math.max(24, height + extent * 2)}
        shadow-normalBias={0.035}
        shadow-bias={-0.00015}
      />
    </>
  );
}
