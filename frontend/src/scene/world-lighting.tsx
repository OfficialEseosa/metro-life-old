/* oxlint-disable react/immutability -- Lights, fog and the environment map are imperative renderer resources driven by the clock. */
import { useEffect, useMemo, useRef } from "react";
import type { RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { OrbitControls as Controls } from "three-stdlib";
import { timeOfDay, updateTimeOfDay } from "../lighting";
import { motion } from "../walking";

const noPick = () => {};
const skyVertex =
  "varying vec3 vPosition;void main(){vPosition=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}";
// Gradient sky with a sun disc, a warm halo near the sun and stars that fade in after dusk.
const skyBody = `
uniform vec3 top;uniform vec3 bottom;uniform vec3 sunDir;uniform vec3 sunColor;uniform float sunDisc;uniform float stars;uniform float interiorVoid;
varying vec3 vPosition;
void main(){
  vec3 dir=normalize(vPosition);
  float h=clamp(dir.y*1.7,0.,1.);
  vec3 col=mix(bottom,top,pow(h,.65));
  float below=clamp(-dir.y*3.,0.,1.);
  col=mix(col,bottom*.92,below);
  float d=max(dot(dir,sunDir),0.);
  col+=sunColor*(smoothstep(.9994,.99975,d)*2.2+pow(d,64.)*.22+pow(d,6.)*.06)*sunDisc*(1.-interiorVoid);
  vec2 cell=floor(dir.xz/(abs(dir.y)+.3)*350.);
  float star=step(.9986,fract(sin(dot(cell,vec2(127.1,311.7)))*43758.5453))*smoothstep(.12,.3,h);
  col+=star*.75*stars*(1.-interiorVoid);
  gl_FragColor=vec4(col,1.);
`;
function skyMaterial(output: boolean) {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    uniforms: {
      top: { value: new THREE.Color() },
      bottom: { value: new THREE.Color() },
      sunDir: { value: new THREE.Vector3(0, 1, 0) },
      sunColor: { value: new THREE.Color() },
      sunDisc: { value: 1 },
      stars: { value: 0 },
      interiorVoid: { value: 0 },
    },
    vertexShader: skyVertex,
    fragmentShader:
      skyBody +
      (output
        ? "#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}"
        : "}"),
  });
}
const roomDay = {
    top: new THREE.Color("#efe3d3"),
    bottom: new THREE.Color("#d9c6b4"),
  },
  roomNight = {
    top: new THREE.Color("#2e2a3c"),
    bottom: new THREE.Color("#1d1a26"),
  };

/** The sky sphere follows the camera; in rooms it becomes a soft warm backdrop that still follows the clock. */
export function SkyDome({ room }: { room: boolean }) {
  const ref = useRef<THREE.Mesh>(null),
    material = useMemo(() => skyMaterial(true), []);
  useEffect(() => () => material.dispose(), [material]);
  useFrame(({ camera }) => {
    ref.current?.position.copy(camera.position);
    const u = material.uniforms,
      p = timeOfDay;
    u.interiorVoid.value = room ? 1 : 0;
    if (room) {
      (u.top.value as THREE.Color).lerpColors(
        roomDay.top,
        roomNight.top,
        p.nightFactor,
      );
      (u.bottom.value as THREE.Color).lerpColors(
        roomDay.bottom,
        roomNight.bottom,
        p.nightFactor,
      );
    } else {
      (u.top.value as THREE.Color).copy(p.skyTop);
      (u.bottom.value as THREE.Color).copy(p.skyBottom);
    }
    syncSkyUniforms(u);
  }, -40);
  return (
    <mesh
      ref={ref}
      renderOrder={-1000}
      material={material}
      raycast={noPick}
      frustumCulled={false}
    >
      <sphereGeometry args={[450, 32, 16]} />
    </mesh>
  );
}
const sunVisible = new THREE.Vector3();
function syncSkyUniforms(u: Record<string, THREE.IUniform>) {
  const p = timeOfDay,
    elevation = THREE.MathUtils.degToRad(p.sunElevation),
    azimuth = THREE.MathUtils.degToRad(p.sunAzimuth);
  // The visible disc uses the true elevation, not the clamped shadow elevation.
  sunVisible.set(
    Math.sin(azimuth) * Math.cos(elevation),
    Math.sin(elevation),
    -Math.cos(azimuth) * Math.cos(elevation),
  );
  (u.sunDir.value as THREE.Vector3).copy(sunVisible);
  (u.sunColor.value as THREE.Color).copy(p.sun);
  u.sunDisc.value = p.sunDisc;
  u.stars.value = p.nightFactor;
}

/** Sky-matched image-based light: rebuilt only when the palette moves noticeably. */
export function SkyEnvironment({ room }: { room: boolean }) {
  const { gl, scene, invalidate } = useThree(),
    state = useRef<{
      generator: THREE.PMREMGenerator;
      envScene: THREE.Scene;
      sky: THREE.ShaderMaterial;
      ground: THREE.MeshBasicMaterial;
      texture: THREE.Texture | null;
      revision: number;
    } | null>(null);
  useEffect(() => {
    const envScene = new THREE.Scene(),
      sky = skyMaterial(false),
      ground = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), sky);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(9.5, 32), ground);
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = -0.5;
    envScene.add(dome, disc);
    state.current = {
      generator: new THREE.PMREMGenerator(gl),
      envScene,
      sky,
      ground,
      texture: null,
      revision: -1,
    };
    return () => {
      const s = state.current;
      state.current = null;
      if (!s) return;
      if (s.texture) {
        if (scene.environment === s.texture) scene.environment = null;
        s.texture.dispose();
      }
      s.generator.dispose();
      dome.geometry.dispose();
      disc.geometry.dispose();
      sky.dispose();
      ground.dispose();
    };
  }, [gl, scene]);
  useFrame(() => {
    const s = state.current,
      p = timeOfDay;
    // RoomLighting owns scene.environment indoors and restores ours on exit.
    if (!s || room) return;
    if (s.revision !== p.revision || !s.texture) {
      const u = s.sky.uniforms;
      (u.top.value as THREE.Color).copy(p.skyTop);
      (u.bottom.value as THREE.Color).copy(p.skyBottom);
      syncSkyUniforms(u);
      u.sunDisc.value = p.sunDisc * 0.6;
      u.stars.value = 0;
      s.ground.color.copy(p.hemiGround).lerp(p.ground, 0.5);
      const next = s.generator.fromScene(s.envScene, 0.02).texture,
        previous = s.texture;
      s.texture = next;
      s.revision = p.revision;
      if (scene.environment === previous || !scene.environment)
        scene.environment = next;
      previous?.dispose();
      invalidate();
    }
    if (scene.environment === s.texture) scene.environmentIntensity = p.env;
  }, -45);
  return null;
}

const center = new THREE.Vector3(),
  forward = new THREE.Vector3(),
  lightRight = new THREE.Vector3(),
  lightUp = new THREE.Vector3(),
  worldUp = new THREE.Vector3(0, 1, 0),
  shadowDirection = new THREE.Vector3(),
  quantised = { elevation: -1, azimuth: -1 };
const FOLLOW_EXTENT = 26,
  OVERVIEW_EXTENT = 112,
  FOLLOW_DISTANCE = 70;

/**
 * Hemisphere fill, one shadowed sun (or moon) and a weak camera-side fill at night.
 * Close to the player the shadow camera is a tight box re-rendered every frame,
 * so people and cars cast live shadows; in the overview it covers the city and
 * only re-renders when the sun moves.
 */
export function WorldLights({
  room,
  controls,
  quality,
}: {
  room: string | null | undefined;
  controls: RefObject<Controls | null>;
  quality: "normal" | "low";
}) {
  const { gl, scene, camera } = useThree(),
    hemi = useRef<THREE.HemisphereLight>(null),
    sun = useRef<THREE.DirectionalLight>(null),
    fill = useRef<THREE.DirectionalLight>(null),
    mode = useRef<"follow" | "overview" | "">(""),
    frame = useRef(0);
  useEffect(() => {
    const light = sun.current;
    if (!light) return;
    scene.add(light.target);
    return () => {
      scene.remove(light.target);
    };
  }, [scene]);
  useEffect(() => {
    if (fill.current) {
      camera.add(fill.current);
      fill.current.position.set(-2, 3, 6);
      fill.current.target.position.set(0, 0, -10);
      camera.add(fill.current.target);
    }
    scene.add(camera);
    const light = fill.current;
    return () => {
      if (light) {
        camera.remove(light);
        camera.remove(light.target);
      }
    };
  }, [camera, scene]);
  useEffect(() => {
    gl.shadowMap.needsUpdate = true;
    mode.current = "";
  }, [gl, room]);
  useFrame(() => {
    updateTimeOfDay();
    const p = timeOfDay,
      h = hemi.current,
      s = sun.current,
      f = fill.current;
    gl.toneMappingExposure = room ? (p.nightFactor > 0.5 ? 1.0 : 1.04) : p.exposure;
    if (h) {
      h.color.copy(p.hemiSky);
      h.groundColor.copy(p.hemiGround);
      h.intensity = room ? 0 : p.hemiIntensity;
    }
    if (f) {
      f.color.set("#ffd9b0");
      f.intensity = room ? 0 : 0.55 * p.nightFactor;
      f.visible = f.intensity > 0.01;
    }
    const fog = scene.fog as THREE.Fog | null;
    if (fog) fog.color.copy(p.fog);
    if (!s) return;
    s.visible = !room;
    s.castShadow = !room && !scene.userData.noSunShadow;
    if (room) return;
    s.color.copy(p.sun);
    s.intensity = p.sunIntensity;
    s.shadow.intensity = p.shadowIntensity;
    // Quantise the shadow direction so the map is not re-rendered for invisible sun steps.
    const qe = Math.round(Math.max(12, p.sunElevation) * 2) / 2,
      qa = Math.round(p.sunAzimuth * 2) / 2;
    let moved = false;
    if (qe !== quantised.elevation || qa !== quantised.azimuth) {
      quantised.elevation = qe;
      quantised.azimuth = qa;
      const e = THREE.MathUtils.degToRad(qe),
        az = THREE.MathUtils.degToRad(qa);
      shadowDirection.set(
        Math.sin(az) * Math.cos(e),
        Math.sin(e),
        -Math.cos(az) * Math.cos(e),
      );
      moved = true;
    }
    const target = controls.current?.target,
      distance = target ? camera.position.distanceTo(target) : 200,
      player = motion.position,
      forced = scene.userData.shadowMode as string | undefined,
      follow = forced
        ? forced === "follow"
        : distance <= 60 && (!!player || !!target),
      nextMode = follow ? "follow" : "overview",
      extent = follow ? FOLLOW_EXTENT : OVERVIEW_EXTENT,
      shadowCamera = s.shadow.camera;
    if (nextMode !== mode.current) {
      mode.current = nextMode;
      shadowCamera.left = shadowCamera.bottom = -extent;
      shadowCamera.right = shadowCamera.top = extent;
      shadowCamera.near = 1;
      shadowCamera.far = follow ? FOLLOW_DISTANCE * 2 + 40 : 420;
      shadowCamera.updateProjectionMatrix();
      // PCF taps sit `radius` texels away at the receiver's own depth, so the normal
      // offset must cover texel x radius or lit surfaces self-shadow into a grey wash.
      const texel = (extent * 2) / s.shadow.mapSize.x,
        radius = follow ? 2 : 1.5;
      s.shadow.radius = radius;
      s.shadow.normalBias = texel * (radius + 0.6);
      s.shadow.bias = -0.0004;
      moved = true;
    }
    if (follow) {
      // Centre the box a little ahead of the player, towards what the camera sees.
      if (player && !player.room && motion.follow) center.set(player.x, 0, player.z);
      else if (target) center.copy(target).setY(0);
      forward.copy(target ?? center).sub(camera.position).setY(0);
      if (forward.lengthSq() > 1e-4) center.addScaledVector(forward.normalize(), 7);
      // Snap the centre to the shadow texel grid in light space; without it shadows shimmer.
      lightRight.crossVectors(worldUp, shadowDirection).normalize();
      lightUp.crossVectors(shadowDirection, lightRight).normalize();
      const texel = (extent * 2) / s.shadow.mapSize.x,
        u = Math.round(center.dot(lightRight) / texel) * texel,
        v = Math.round(center.dot(lightUp) / texel) * texel,
        w = center.dot(shadowDirection);
      center
        .copy(lightRight)
        .multiplyScalar(u)
        .addScaledVector(lightUp, v)
        .addScaledVector(shadowDirection, w);
      s.target.position.copy(center);
      s.position.copy(center).addScaledVector(shadowDirection, FOLLOW_DISTANCE);
      // Live shadows for people and cars; Low quality refreshes at a third of the rate.
      frame.current++;
      if (quality === "normal" || frame.current % 3 === 0 || moved)
        gl.shadowMap.needsUpdate = true;
    } else if (moved) {
      s.target.position.set(8, 0, 6);
      s.position.copy(s.target.position).addScaledVector(shadowDirection, 200);
      gl.shadowMap.needsUpdate = true;
    }
    s.target.updateMatrixWorld();
  }, -50);
  return (
    <>
      <hemisphereLight ref={hemi} />
      <directionalLight
        ref={sun}
        name="sun"
        castShadow
        shadow-mapSize={[2048, 2048]}
      />
      <directionalLight ref={fill} name="night-character-fill" />
    </>
  );
}

/** Linear haze coloured like the horizon; it starts further out the higher the camera. */
export function RangeFog({
  room,
  controls,
}: {
  room: boolean;
  controls: RefObject<Controls | null>;
}) {
  const { scene, camera } = useThree();
  useEffect(() => {
    scene.fog = room ? null : new THREE.Fog(timeOfDay.fog.getHex(), 120, 600);
    return () => {
      scene.fog = null;
    };
  }, [scene, room]);
  useFrame(() => {
    const fog = scene.fog as THREE.Fog | null;
    if (!fog) return;
    const target = controls.current?.target,
      range = target ? camera.position.distanceTo(target) : 200;
    fog.near = Math.max(60, range * 0.8);
    fog.far = Math.max(420, range * 3);
  }, -40);
  return null;
}
