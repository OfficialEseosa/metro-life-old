/* oxlint-disable react/immutability -- Celebration particles, ring pools and camera offsets are transient renderer state. */
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { OrbitControls } from "three-stdlib";
import { motion } from "../walking";
import {
  onFeedback,
  type FeedbackAnchor,
  type FeedbackEvent,
} from "../feedback";
import { feedbackHold, setFeedbackProjector } from "../ui/feedback-anchor";

const CONFETTI = 80,
  RINGS = 12;
const reducedMotion = () =>
  typeof matchMedia === "function" &&
  matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Soft expanding ground rings, one draw call for the whole pool. */
const ringMaterial = () =>
  new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    vertexShader: /* glsl */ `
      attribute float aAlpha;
      varying vec2 vUv;
      varying float vAlpha;
      varying vec3 vColor;
      void main() {
        vUv = uv;
        vAlpha = aAlpha;
        #ifdef USE_INSTANCING_COLOR
          vColor = instanceColor;
        #else
          vColor = vec3(1.0);
        #endif
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      varying float vAlpha;
      varying vec3 vColor;
      void main() {
        float d = length(vUv - 0.5) * 2.0;
        float band = smoothstep(0.6, 0.78, d) * (1.0 - smoothstep(0.86, 1.0, d));
        float fill = (1.0 - smoothstep(0.0, 0.85, d)) * 0.16;
        float a = (band + fill) * vAlpha;
        if (a < 0.01) discard;
        gl_FragColor = vec4(vColor, a);
        #include <colorspace_fragment>
      }`,
  });

type RingSlot = {
  start: number;
  x: number;
  y: number;
  z: number;
  size: number;
  life: number;
};
const tones = {
  good: new THREE.Color("#2FA36B"),
  money: new THREE.Color("#F5B43C"),
  bad: new THREE.Color("#E0564C"),
  social: new THREE.Color("#F08AB0"),
  calm: new THREE.Color("#8FB8D8"),
  arrive: new THREE.Color("#6ED19A"),
};
type ToneName = keyof typeof tones;

/**
 * In-world responses to the feedback bus: a confetti burst for big moments, soft rings where
 * things happen, a red pulse on errors. Also projects world anchors for the HUD feedback layer.
 */
export function Celebration() {
  const { camera, invalidate, controls, scene, gl } = useThree(),
    get = useThree((s) => s.get),
    mesh = useRef<THREE.InstancedMesh>(null),
    rings = useRef<THREE.InstancedMesh>(null),
    started = useRef(-100_000),
    burstCount = useRef(CONFETTI),
    origin = useRef(new THREE.Vector3()),
    previousPush = useRef(new THREE.Vector3()),
    dummy = useMemo(() => new THREE.Object3D(), []),
    direction = useMemo(() => new THREE.Vector3(), []),
    scratch = useMemo(() => new THREE.Vector3(), []),
    reduced = useRef(false),
    nudge = useRef(false),
    slots = useMemo<RingSlot[]>(
      () =>
        Array.from({ length: RINGS }, () => ({
          start: -100_000,
          x: 0,
          y: 0,
          z: 0,
          size: 1,
          life: 1,
        })),
      [],
    ),
    nextRing = useRef(0),
    ringGeometry = useMemo(() => {
      const g = new THREE.PlaneGeometry(1, 1);
      g.rotateX(-Math.PI / 2);
      g.setAttribute(
        "aAlpha",
        new THREE.InstancedBufferAttribute(new Float32Array(RINGS), 1),
      );
      return g;
    }, []),
    ringShader = useMemo(() => ringMaterial(), []);
  const particles = useMemo(
    () =>
      Array.from({ length: CONFETTI }, (_, i) => ({
        angle: i * 2.39996,
        speed: 1.3 + ((i * 17) % 31) / 14,
        lift: 2.8 + ((i * 23) % 31) / 12,
        spin: i * 0.73,
        colour: new THREE.Color(
          ["#2fa36b", "#efb859", "#df8597", "#91b8c7", "#fff1cd"][i % 5],
        ),
      })),
    [],
  );
  useEffect(() => {
    // Create the colour buffer up front so the ring shader compiles once with it.
    const ringMesh = rings.current;
    if (ringMesh) {
      for (let i = 0; i < RINGS; i++) ringMesh.setColorAt(i, tones.good);
      if (ringMesh.instanceColor) ringMesh.instanceColor.needsUpdate = true;
    }
  }, []);
  useEffect(
    () => () => {
      ringGeometry.dispose();
      ringShader.dispose();
    },
    [ringGeometry, ringShader],
  );

  // The player's rendered group gives the true floor height inside rooms.
  const groundAt = useMemo(() => {
    let player: THREE.Object3D | null = null;
    return (anchor: FeedbackAnchor | undefined, out: THREE.Vector3) => {
      if (!player?.parent)
        player = scene.getObjectByName("controlled-player") ?? null;
      const at: FeedbackAnchor | undefined =
        anchor ??
        (motion.position
          ? { x: motion.position.x, z: motion.position.z }
          : undefined);
      if (player) player.getWorldPosition(out);
      else out.set(at?.x ?? 0, 0, at?.z ?? 0);
      if (at && (!player || Math.hypot(out.x - at.x, out.z - at.z) > 1.5)) {
        out.x = at.x;
        out.z = at.z;
        if (at.y !== undefined) out.y = at.y;
      }
      return out;
    };
  }, [scene]);

  useEffect(
    () =>
      setFeedbackProjector((anchor, lift, out) => {
        const { camera: cam, size } = get(),
          v = groundAt(anchor, scratch);
        v.y += lift;
        v.project(cam);
        const rect = gl.domElement.getBoundingClientRect();
        out.x = rect.left + ((v.x + 1) / 2) * size.width;
        out.y = rect.top + ((1 - v.y) / 2) * size.height;
        out.visible =
          v.z > -1 && v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1;
        return true;
      }),
    [get, gl, groundAt, scratch],
  );

  useEffect(() => {
    reduced.current = reducedMotion();
    const burst = (big: boolean) => {
      started.current = performance.now();
      burstCount.current = reduced.current ? 16 : big ? CONFETTI : 36;
      nudge.current = big && !reduced.current;
      groundAt(undefined, origin.current);
      origin.current.y += 2.2;
      particles.forEach((p, i) => mesh.current?.setColorAt(i, p.colour));
      if (mesh.current?.instanceColor)
        mesh.current.instanceColor.needsUpdate = true;
      invalidate();
    };
    const ring = (
      anchor: FeedbackAnchor | undefined,
      tone: ToneName,
      size = 1.4,
      life = 900,
      delay = 0,
    ) => {
      const index = nextRing.current++ % RINGS,
        slot = slots[index],
        at = groundAt(anchor, scratch);
      slot.start = performance.now() + delay;
      slot.x = at.x;
      slot.y = at.y + 0.04;
      slot.z = at.z;
      slot.size = size;
      slot.life = feedbackHold() ? life * 12 : life;
      rings.current?.setColorAt(index, tones[tone]);
      if (rings.current?.instanceColor)
        rings.current.instanceColor.needsUpdate = true;
      invalidate();
    };
    const react = (e: FeedbackEvent) => {
      const cash = e.amount ?? 0;
      switch (e.kind) {
        case "actionStart":
          ring(e.anchor, "calm", 1.1, 700);
          break;
        case "actionDone":
          ring(e.anchor, cash > 0 ? "money" : "good", 1.5);
          if (cash > 0) ring(e.anchor, "money", 2.1, 1000, 160);
          break;
        case "cancel":
          ring(e.anchor, "calm", 1, 600);
          break;
        case "error":
          ring(undefined, "bad", 1.2, 520);
          ring(undefined, "bad", 1.7, 520, 150);
          break;
        case "social":
          ring(e.anchor, "social", 1.4);
          break;
        case "socialReceived":
          ring(e.anchor, "social", 1.6, 1100);
          ring(undefined, "social", 1.3, 1000, 180);
          break;
        case "purchase":
        case "rent":
          ring(e.anchor, "money", 1.3, 800);
          break;
        case "goal":
          ring(e.anchor, "good", 1.8, 1000);
          burst(false);
          break;
        case "levelUp":
        case "promotion":
        case "milestone":
          ring(e.anchor, "money", 1.8, 1100);
          ring(e.anchor, "money", 2.8, 1300, 200);
          burst(true);
          break;
        case "arrival":
        case "travel":
          ring(e.anchor, "arrive", 1.7, 1000);
          ring(e.anchor, "arrive", 2.5, 1100, 180);
          break;
        case "chat":
          if (!e.data?.npc && e.anchor) ring(e.anchor, "calm", 1, 700);
          break;
      }
    };
    const legacy = () => burst(false);
    window.addEventListener("metro-celebrate", legacy);
    const off = onFeedback(react);
    return () => {
      off();
      window.removeEventListener("metro-celebrate", legacy);
    };
  }, [particles, invalidate, slots, groundAt, scratch]);

  useFrame(() => {
    if (previousPush.current.lengthSq()) {
      camera.position.add(previousPush.current);
      previousPush.current.set(0, 0, 0);
    }
  }, -80);

  useFrame((_, dt) => {
    const now = performance.now();
    // Rings
    const ringMesh = rings.current;
    if (ringMesh) {
      const alpha = ringGeometry.getAttribute(
        "aAlpha",
      ) as THREE.InstancedBufferAttribute;
      let any = false;
      for (let i = 0; i < RINGS; i++) {
        const slot = slots[i],
          t = (now - slot.start) / slot.life;
        if (t < 0 || t >= 1) {
          if (t < 0 && t > -1) any = true;
          alpha.setX(i, 0);
          dummy.position.set(0, -1000, 0);
          dummy.scale.setScalar(0.0001);
        } else {
          any = true;
          const grow = 1 - (1 - t) ** 3;
          dummy.position.set(slot.x, slot.y, slot.z);
          dummy.scale.setScalar(slot.size * (0.35 + grow * 0.75));
          alpha.setX(i, (1 - t) ** 1.4 * 0.9);
        }
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        ringMesh.setMatrixAt(i, dummy.matrix);
      }
      if (any || ringMesh.visible) {
        ringMesh.instanceMatrix.needsUpdate = true;
        alpha.needsUpdate = true;
      }
      ringMesh.visible = any;
      if (any) invalidate();
    }
    // Confetti
    // Dev captures on slow machines stretch the burst; production always runs at 1x.
    const t = (now - started.current) / 1000 / (feedbackHold() ? 12 : 1);
    if (!mesh.current) return;
    mesh.current.visible = t >= 0 && t < 2.4;
    if (!mesh.current.visible) return;
    const count = burstCount.current;
    for (let i = 0; i < CONFETTI; i++) {
      const p = particles[i],
        radius = p.speed * t * (count < CONFETTI ? 0.75 : 1);
      dummy.position.set(
        origin.current.x + Math.cos(p.angle) * radius,
        origin.current.y + p.lift * t - 2.5 * t * t,
        origin.current.z + Math.sin(p.angle) * radius,
      );
      dummy.rotation.set(p.spin + t * 4, p.spin + t * 2, p.spin + t * 3);
      dummy.scale.setScalar(i < count ? Math.max(0, 1 - t / 2.4) : 0);
      dummy.updateMatrix();
      mesh.current.setMatrixAt(i, dummy.matrix);
    }
    mesh.current.instanceMatrix.needsUpdate = true;
    const material = mesh.current.material as THREE.MeshBasicMaterial;
    material.opacity = Math.max(0, 1 - t / 2.4);
    if (t < 1.2 && nudge.current && controls) {
      const target = (controls as unknown as OrbitControls).target;
      if (target) {
        direction.copy(camera.position).sub(target).normalize();
        previousPush.current
          .copy(direction)
          .multiplyScalar(Math.sin((t / 1.2) * Math.PI) * 0.8);
        camera.position.sub(previousPush.current);
        camera.lookAt(target);
      }
    }
    if (dt < 1) invalidate();
  }, 0.5);

  return (
    <>
      <instancedMesh
        name="celebration-confetti"
        ref={mesh}
        args={[undefined, undefined, CONFETTI]}
        visible={false}
        frustumCulled={false}
        raycast={() => {}}
      >
        <planeGeometry args={[0.12, 0.2]} />
        <meshBasicMaterial
          side={THREE.DoubleSide}
          transparent
          opacity={1}
          depthWrite={false}
          toneMapped={false}
        />
      </instancedMesh>
      <instancedMesh
        name="feedback-rings"
        ref={rings}
        args={[ringGeometry, ringShader, RINGS]}
        visible={false}
        frustumCulled={false}
        renderOrder={5}
        raycast={() => {}}
      />
    </>
  );
}
