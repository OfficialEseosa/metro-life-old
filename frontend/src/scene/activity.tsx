/* oxlint-disable react/immutability -- Activity effects write pooled renderer buffers every frame. */
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { serverNow } from "../server-time";
import { livePlayers, useStore } from "../store";
import { lifePose, type VisibleLife } from "../life-actions";
import { Icon } from "../ui/primitives";
import { COOK_POT } from "./characters/actor";

// ---- shared atlas: 4 x 4 cells of 128 px, drawn once ------------------------
// 0 puff, 1 droplet, 2 note, 3 two notes, 4 Z, 5 dot, 6 sparkle, 7 heart,
// 8 pot, 9 shower, 10 moon, 11 laptop, 12 notes icon, 13 fork and knife, 14 dumbbell, 15 star
const CELL = 128;
type Painter = (c: CanvasRenderingContext2D) => void;
const outline = "rgba(46,36,51,.78)";
function glyph(c: CanvasRenderingContext2D, draw: () => void, line = 7) {
  c.lineJoin = "round";
  c.lineCap = "round";
  c.beginPath();
  draw();
  c.lineWidth = line;
  c.strokeStyle = outline;
  c.stroke();
  c.fillStyle = "#ffffff";
  c.fill();
}
const painters: Painter[] = [
  (c) => {
    const g = c.createRadialGradient(64, 64, 4, 64, 64, 60);
    g.addColorStop(0, "rgba(255,255,255,.95)");
    g.addColorStop(0.55, "rgba(255,255,255,.55)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = g;
    c.fillRect(0, 0, CELL, CELL);
  },
  (c) =>
    glyph(
      c,
      () => {
        c.moveTo(64, 14);
        c.bezierCurveTo(48, 50, 42, 70, 42, 84);
        c.arc(64, 84, 22, Math.PI, 0, true);
        c.bezierCurveTo(86, 70, 80, 50, 64, 14);
      },
      5,
    ),
  (c) =>
    glyph(c, () => {
      c.ellipse(48, 92, 20, 15, -0.45, 0, Math.PI * 2);
      c.moveTo(64, 90);
      c.lineTo(64, 20);
      c.lineTo(92, 34);
      c.lineTo(92, 50);
      c.lineTo(72, 40);
      c.lineTo(72, 90);
    }),
  (c) =>
    glyph(c, () => {
      c.ellipse(34, 96, 17, 13, -0.45, 0, Math.PI * 2);
      c.ellipse(88, 86, 17, 13, -0.45, 0, Math.PI * 2);
      c.moveTo(48, 94);
      c.lineTo(48, 28);
      c.lineTo(102, 16);
      c.lineTo(102, 84);
      c.lineTo(94, 84);
      c.lineTo(94, 34);
      c.lineTo(56, 42);
      c.lineTo(56, 94);
    }),
  (c) => {
    c.font = "900 104px Nunito, system-ui, sans-serif";
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.lineJoin = "round";
    c.lineWidth = 12;
    c.strokeStyle = outline;
    c.strokeText("Z", 64, 68);
    c.fillStyle = "#ffffff";
    c.fillText("Z", 64, 68);
  },
  (c) => glyph(c, () => c.arc(64, 64, 40, 0, Math.PI * 2), 10),
  (c) =>
    glyph(
      c,
      () => {
        for (let i = 0; i < 8; i++) {
          const r = i % 2 ? 18 : 54,
            a = (i / 8) * Math.PI * 2 - Math.PI / 2;
          c.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r);
        }
        c.closePath();
      },
      5,
    ),
  (c) =>
    glyph(c, () => {
      c.moveTo(64, 104);
      c.bezierCurveTo(8, 66, 30, 14, 64, 42);
      c.bezierCurveTo(98, 14, 120, 66, 64, 104);
    }),
];
// Badge icons: thick white strokes, tinted in the shader.
function icon(c: CanvasRenderingContext2D, draw: () => void, fill = false) {
  c.strokeStyle = "#ffffff";
  c.fillStyle = "#ffffff";
  c.lineWidth = 10;
  c.lineCap = "round";
  c.lineJoin = "round";
  c.beginPath();
  draw();
  if (fill) c.fill();
  c.stroke();
}
painters.push(
  (c) =>
    icon(c, () => {
      c.roundRect(26, 52, 76, 50, 12);
      c.moveTo(14, 60);
      c.lineTo(26, 60);
      c.moveTo(102, 60);
      c.lineTo(114, 60);
      c.moveTo(48, 40);
      c.quadraticCurveTo(42, 30, 48, 20);
      c.moveTo(70, 40);
      c.quadraticCurveTo(64, 30, 70, 20);
    }),
  (c) =>
    icon(c, () => {
      c.moveTo(30, 30);
      c.lineTo(84, 30);
      c.quadraticCurveTo(104, 30, 104, 50);
      c.moveTo(84, 30);
      c.arc(84, 48, 18, Math.PI, 0);
      for (const [x, y] of [
        [70, 80],
        [84, 92],
        [98, 80],
        [77, 106],
        [92, 108],
      ]) {
        c.moveTo(x, y);
        c.lineTo(x - 2, y + 6);
      }
    }),
  (c) =>
    icon(
      c,
      () => {
        c.arc(64, 64, 40, Math.PI * 0.32, Math.PI * 1.68);
        c.bezierCurveTo(60, 34, 56, 86, 98, 86);
      },
      true,
    ),
  (c) =>
    icon(c, () => {
      c.roundRect(28, 30, 72, 48, 6);
      c.moveTo(14, 96);
      c.lineTo(114, 96);
      c.lineTo(104, 80);
      c.lineTo(24, 80);
      c.closePath();
    }),
  (c) =>
    icon(c, () => {
      c.moveTo(48, 92);
      c.lineTo(48, 28);
      c.lineTo(96, 18);
      c.lineTo(96, 82);
      c.moveTo(48, 44);
      c.lineTo(96, 34);
      c.moveTo(48, 92);
      c.arc(38, 92, 10, 0, Math.PI * 2);
      c.moveTo(96, 82);
      c.arc(86, 82, 10, 0, Math.PI * 2);
    }),
  (c) =>
    icon(c, () => {
      c.moveTo(40, 18);
      c.lineTo(40, 110);
      c.moveTo(28, 18);
      c.lineTo(28, 46);
      c.quadraticCurveTo(40, 58, 52, 46);
      c.lineTo(52, 18);
      c.moveTo(88, 110);
      c.lineTo(88, 18);
      c.quadraticCurveTo(108, 34, 100, 66);
      c.lineTo(88, 66);
    }),
  (c) =>
    icon(c, () => {
      c.moveTo(36, 64);
      c.lineTo(92, 64);
      c.roundRect(18, 40, 16, 48, 5);
      c.roundRect(94, 40, 16, 48, 5);
      c.moveTo(10, 64);
      c.lineTo(18, 64);
      c.moveTo(110, 64);
      c.lineTo(118, 64);
    }),
  (c) =>
    icon(
      c,
      () => {
        for (let i = 0; i < 10; i++) {
          const r = i % 2 ? 22 : 48,
            a = (i / 10) * Math.PI * 2 - Math.PI / 2;
          c.lineTo(64 + Math.cos(a) * r, 66 + Math.sin(a) * r);
        }
        c.closePath();
      },
      true,
    ),
);
let atlas: THREE.CanvasTexture | null = null;
function activityAtlas() {
  if (atlas) return atlas;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = CELL * 4;
  const c = canvas.getContext("2d")!;
  painters.forEach((paint, i) => {
    c.save();
    c.translate((i % 4) * CELL, Math.floor(i / 4) * CELL);
    c.beginPath();
    c.rect(0, 0, CELL, CELL);
    c.clip();
    paint(c);
    c.restore();
  });
  atlas = new THREE.CanvasTexture(canvas);
  atlas.colorSpace = THREE.SRGBColorSpace;
  atlas.anisotropy = 2;
  return atlas;
}
const cellUv = /* glsl */ `
  vec2 atlasUv(vec2 uv, float cell) {
    float col = mod(cell, 4.0), row = floor(cell / 4.0);
    return vec2((col + uv.x) / 4.0, 1.0 - (row + 1.0 - uv.y) / 4.0);
  }`;

// ---- what each pose shows ----------------------------------------------------
type Effect =
  | "steam"
  | "shower"
  | "sleep"
  | "type"
  | "music"
  | "eat"
  | "sparkle";
const BADGE_ICON: Record<Effect, number> = {
  steam: 8,
  shower: 9,
  sleep: 10,
  type: 11,
  music: 12,
  eat: 13,
  sparkle: 15,
};
function effectFor(person: VisibleLife): Effect | null {
  const pose = lifePose(person),
    label = (person.busyLabel ?? person.activity ?? "").toLowerCase();
  if (pose === "Cook") return "steam";
  if (pose === "Shower") return "shower";
  if (pose === "Sleep") return "sleep";
  if (pose === "Type")
    return /gym|train|work ?out/.test(label) ? "sparkle" : "type";
  if (pose === "Dance" || pose === "Cheer") return "music";
  if (pose === "Eat") return "eat";
  if (/gym|train|work ?out|yoga|exercise/.test(label)) return "sparkle";
  return null;
}
const MUSIC = ["#2FA36B", "#F5B43C", "#E46A8E", "#5B8DEF"].map(
  (c) => new THREE.Color(c),
);
const WHITE = new THREE.Color("#ffffff"),
  WATER = new THREE.Color("#BFEAFF"),
  SLEEP = new THREE.Color("#8E9BEA"),
  CREAM = new THREE.Color("#FFF8EE"),
  GOLD = new THREE.Color("#F5B43C");

// ---- sprite batch: every particle of every nearby actor, one draw call ------
const MAX_SPRITES = 112;
const hash = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
type Actor = { x: number; y: number; z: number; face: number; seed: number };

function useSpriteBatch() {
  return useMemo(() => {
    const quad = new THREE.PlaneGeometry(1, 1),
      geometry = new THREE.InstancedBufferGeometry();
    geometry.index = quad.index;
    geometry.setAttribute("position", quad.getAttribute("position"));
    geometry.setAttribute("uv", quad.getAttribute("uv"));
    const offset = new Float32Array(MAX_SPRITES * 3),
      data = new Float32Array(MAX_SPRITES * 2),
      color = new Float32Array(MAX_SPRITES * 4);
    geometry.setAttribute(
      "iOffset",
      new THREE.InstancedBufferAttribute(offset, 3),
    );
    geometry.setAttribute("iData", new THREE.InstancedBufferAttribute(data, 2));
    geometry.setAttribute(
      "iColor",
      new THREE.InstancedBufferAttribute(color, 4),
    );
    geometry.instanceCount = 0;
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      toneMapped: false,
      uniforms: { uAtlas: { value: activityAtlas() } },
      vertexShader: /* glsl */ `
        attribute vec3 iOffset;
        attribute vec2 iData;
        attribute vec4 iColor;
        varying vec2 vUv;
        varying vec4 vColor;
        ${cellUv}
        void main() {
          vUv = atlasUv(uv, iData.y);
          vColor = iColor;
          vec4 mv = modelViewMatrix * vec4(iOffset, 1.0);
          mv.xy += position.xy * iData.x;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uAtlas;
        varying vec2 vUv;
        varying vec4 vColor;
        void main() {
          vec4 t = texture2D(uAtlas, vUv);
          float a = t.a * vColor.a;
          if (a < 0.02) discard;
          gl_FragColor = vec4(t.rgb * vColor.rgb, a);
          #include <colorspace_fragment>
        }`,
    });
    let count = 0;
    const api = {
      geometry,
      material,
      begin() {
        count = 0;
      },
      push(
        x: number,
        y: number,
        z: number,
        size: number,
        cell: number,
        c: THREE.Color,
        alpha: number,
      ) {
        if (count >= MAX_SPRITES || alpha <= 0.01 || size <= 0) return;
        offset[count * 3] = x;
        offset[count * 3 + 1] = y;
        offset[count * 3 + 2] = z;
        data[count * 2] = size;
        data[count * 2 + 1] = cell;
        color[count * 4] = c.r;
        color[count * 4 + 1] = c.g;
        color[count * 4 + 2] = c.b;
        color[count * 4 + 3] = alpha;
        count++;
      },
      end() {
        geometry.instanceCount = count;
        for (const name of ["iOffset", "iData", "iColor"]) {
          const attribute = geometry.getAttribute(
            name,
          ) as THREE.InstancedBufferAttribute;
          attribute.clearUpdateRanges();
          attribute.addUpdateRange(0, count * attribute.itemSize);
          attribute.needsUpdate = true;
        }
        return count;
      },
    };
    return api;
  }, []);
}

/** Emit the particles of one effect for one actor; stateless, driven by time. */
function emit(
  batch: ReturnType<typeof useSpriteBatch>,
  effect: Effect,
  a: Actor,
  t: number,
  reduced: boolean,
) {
  const sin = Math.sin(a.face),
    cos = Math.cos(a.face),
    // Actor-relative offset (x right, z forward) to world, without allocating.
    localX = (lx: number, lz: number) => a.x + lx * cos + lz * sin,
    localZ = (lx: number, lz: number) => a.z - lx * sin + lz * cos;
  const slow = reduced ? 0.35 : 1;
  switch (effect) {
    case "steam": {
      // Steam leaves the rim of the characters' cooking pot (COOK_POT is in the cook's own frame).
      const px = localX(COOK_POT.x, COOK_POT.z),
        pz = localZ(COOK_POT.x, COOK_POT.z);
      for (let i = 0; i < 7; i++) {
        const f = (t * 0.42 * slow + i / 7) % 1,
          drift = Math.sin(a.seed + i * 1.7 + f * 3) * 0.1;
        batch.push(
          px + drift,
          a.y + COOK_POT.y + 0.08 + f * 0.95,
          pz + Math.cos(a.seed + i * 2.3 + f * 2) * 0.08,
          0.16 + f * 0.36,
          0,
          WHITE,
          Math.sin(f * Math.PI) * 0.62,
        );
      }
      break;
    }
    case "shower": {
      for (let i = 0; i < 16; i++) {
        const phase = t * 1.7 * slow + i / 16,
          f = phase % 1,
          cycle = Math.floor(phase),
          r = 0.12 + hash(cycle * 31 + i + a.seed) * 0.26,
          ang = hash(cycle * 17 + i * 3 + a.seed) * Math.PI * 2;
        batch.push(
          a.x + Math.cos(ang) * r,
          a.y + 2.3 - f * 2.05,
          a.z + Math.sin(ang) * r,
          0.11,
          1,
          WATER,
          0.85 * (1 - f ** 4),
        );
      }
      for (let i = 0; i < 4; i++) {
        const f = (t * 0.25 * slow + i / 4) % 1;
        batch.push(
          a.x + Math.sin(a.seed + i * 2) * 0.35,
          a.y + 1.0 + f * 1.4,
          a.z + Math.cos(a.seed + i * 2) * 0.35,
          0.4 + f * 0.4,
          0,
          WHITE,
          Math.sin(f * Math.PI) * 0.32,
        );
      }
      break;
    }
    case "sleep":
      for (let i = 0; i < 3; i++) {
        const f = (t * 0.32 * slow + i / 3) % 1;
        batch.push(
          a.x + 0.15 + f * 0.35 + Math.sin(f * 6 + i) * 0.05,
          a.y + 1.05 + f * 0.95,
          a.z,
          0.16 + f * 0.2,
          4,
          SLEEP,
          Math.sin(f * Math.PI) * 0.95,
        );
      }
      break;
    case "type": {
      for (let i = 0; i < 3; i++) {
        const px = localX((i - 1) * 0.11, 0.42),
          pz = localZ((i - 1) * 0.11, 0.42),
          bob = reduced ? 0 : Math.max(0, Math.sin(t * 7 - i * 0.9)) * 0.05;
        batch.push(px, a.y + 1.42 + bob, pz, 0.085, 5, CREAM, 0.95);
      }
      break;
    }
    case "music":
      for (let i = 0; i < 6; i++) {
        const f = (t * 0.45 * slow + i / 6) % 1,
          ang = (i / 6) * Math.PI * 2 + t * 0.7 * slow,
          radius = 0.45 + f * 0.2;
        batch.push(
          a.x + Math.cos(ang) * radius,
          a.y + 1.2 + f * 1.25,
          a.z + Math.sin(ang) * radius,
          0.2,
          i % 2 ? 3 : 2,
          MUSIC[i % 4],
          Math.sin(f * Math.PI) * 0.95,
        );
      }
      break;
    case "eat":
      for (let i = 0; i < 2; i++) {
        const f = (t * 0.35 * slow + i / 2) % 1,
          side = (i ? 0.22 : -0.22) + Math.sin(f * 5) * 0.04,
          px = localX(side, 0.2),
          pz = localZ(side, 0.2);
        batch.push(
          px,
          a.y + 1.55 + f * 0.6,
          pz,
          0.14,
          7,
          MUSIC[2],
          Math.sin(f * Math.PI) * 0.9,
        );
      }
      break;
    case "sparkle":
      for (let i = 0; i < 4; i++) {
        const f = (t * 0.5 * slow + i / 4) % 1,
          ang = a.seed + i * 1.57;
        batch.push(
          a.x + Math.cos(ang) * 0.5,
          a.y + 0.9 + f * 1.2,
          a.z + Math.sin(ang) * 0.5,
          0.13 * Math.sin(f * Math.PI) + 0.04,
          6,
          GOLD,
          Math.sin(f * Math.PI),
        );
      }
      break;
  }
}

// ---- progress badge above the player: ring + activity icon, one draw call ----
function badgeMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    uniforms: {
      uAtlas: { value: activityAtlas() },
      uProgress: { value: 0 },
      uIcon: { value: 8 },
      uOpacity: { value: 0 },
      uPaper: { value: new THREE.Color("#FFF8EE") },
      uEdge: { value: new THREE.Color("#CEBCA4") },
      uTrack: { value: new THREE.Color("#E3D3BE") },
      uRing: { value: new THREE.Color("#2FA36B") },
      uInk: { value: new THREE.Color("#2E2433") },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        vec3 scale = vec3(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz), 1.0);
        mv.xy += position.xy * scale.xy;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uAtlas;
      uniform float uProgress, uIcon, uOpacity;
      uniform vec3 uPaper, uEdge, uTrack, uRing, uInk;
      varying vec2 vUv;
      ${cellUv}
      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float d = length(p), aa = fwidth(d) * 1.2;
        float disc = 1.0 - smoothstep(1.0 - aa, 1.0, d);
        if (disc < 0.01) discard;
        float band = smoothstep(0.68 - aa, 0.68, d) * (1.0 - smoothstep(0.86, 0.86 + aa, d));
        float edge = smoothstep(0.91 - aa, 0.91, d);
        float angle = atan(p.x, p.y);
        float fraction = (angle < 0.0 ? angle + 6.2831853 : angle) / 6.2831853;
        float done = step(fraction, uProgress);
        vec3 colour = mix(uPaper, uEdge, edge);
        colour = mix(colour, mix(uTrack, uRing, done), band);
        vec2 iconUv = p / 1.08 + 0.5;
        float inside = step(0.0, iconUv.x) * step(iconUv.x, 1.0) * step(0.0, iconUv.y) * step(iconUv.y, 1.0);
        float ink = texture2D(uAtlas, atlasUv(clamp(iconUv, 0.0, 1.0), uIcon)).a * inside * (1.0 - band);
        colour = mix(colour, uInk, ink);
        gl_FragColor = vec4(colour, disc * uOpacity);
        #include <colorspace_fragment>
      }`,
  });
}

/**
 * Makes activities read in the world: a progress badge with the activity's icon above the
 * player, and steam, shower spray, sleep Zs, typing dots or music notes around anyone
 * doing something nearby. Reads the store and live players each frame; never re-renders.
 */
export function WorldActivity() {
  const { scene, invalidate } = useThree(),
    batch = useSpriteBatch(),
    badge = useMemo(() => badgeMaterial(), []),
    badgeMesh = useRef<THREE.Mesh>(null),
    sprites = useRef<THREE.Mesh>(null),
    player = useRef<THREE.Object3D | null>(null),
    actor = useMemo<Actor>(() => ({ x: 0, y: 0, z: 0, face: 0, seed: 0 }), []),
    world = useMemo(() => new THREE.Vector3(), []),
    shown = useRef(0),
    reduced = useRef(false);

  useEffect(() => {
    reduced.current = matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Wake the frame loop when an activity starts or someone nearby changes what they do.
    const offStore = useStore.subscribe((s, previous) => {
      if (
        s.sim?.busyUntil !== previous.sim?.busyUntil ||
        s.players !== previous.players
      )
        invalidate();
    });
    return () => {
      offStore();
      batch.geometry.dispose();
      batch.material.dispose();
      badge.dispose();
    };
  }, [batch, badge, invalidate]);

  useFrame((state) => {
    const store = useStore.getState(),
      sim = store.sim,
      now = serverNow(),
      t = state.clock.elapsedTime;
    batch.begin();
    let busyBadge = false;
    if (sim && !sim.trip && sim.city === store.city) {
      if (!player.current?.parent)
        player.current = scene.getObjectByName("controlled-player") ?? null;
      const p = player.current;
      if (p) {
        p.getWorldPosition(world);
        actor.x = world.x;
        actor.y = world.y;
        actor.z = world.z;
        actor.face = p.rotation.y;
        actor.seed = 1;
        const busy = !!sim.busyUntil && sim.busyUntil > now,
          effect = busy || sim.lifeAction ? effectFor(sim) : null;
        if (effect) emit(batch, effect, actor, t, reduced.current);
        if (busy && badgeMesh.current) {
          busyBadge = true;
          const until = sim.busyUntil!,
            start = sim.busyStartedAt ?? until - 3000,
            u = badge.uniforms;
          u.uProgress.value = Math.max(
            0.02,
            Math.min(1, (now - start) / Math.max(1, until - start)),
          );
          u.uIcon.value = BADGE_ICON[effect ?? "sparkle"];
          // Constant on-screen size (about 46 px on a phone, 56 px on a laptop).
          const camera = state.camera as THREE.PerspectiveCamera,
            lift = effect === "sleep" ? 1.9 : 2.6;
          badgeMesh.current.position.set(world.x, world.y + lift, world.z);
          const distance = camera.position.distanceTo(
              badgeMesh.current.position,
            ),
            pixels = state.size.height < 500 ? 46 : 56,
            worldSize =
              (pixels *
                2 *
                distance *
                Math.tan(THREE.MathUtils.degToRad((camera.fov ?? 40) / 2))) /
              Math.max(1, state.size.height);
          badgeMesh.current.scale.setScalar(worldSize);
        }
      }
      // Other real players nearby, same room.
      const room = sim.position?.room ?? null;
      let others = 0;
      for (const other of livePlayers.byId.values()) {
        if (others >= 4) break;
        if (
          other.npc ||
          !other.online ||
          other.id === sim.userId ||
          other.city !== sim.city
        )
          continue;
        const at = other.position;
        if (!at || (at.room ?? null) !== room) continue;
        const busy = !!other.busyLabel || !!other.lifeAction,
          effect = busy ? effectFor(other) : null;
        if (!effect) continue;
        const x = other.activitySlot?.x ?? at.x,
          z = other.activitySlot?.z ?? at.z;
        if (Math.hypot(x - world.x, z - world.z) > 30) continue;
        actor.x = x;
        actor.z = z;
        actor.y = world.y;
        actor.face = other.activitySlot?.face ?? at.face ?? 0;
        actor.seed = 2 + others * 3.7;
        emit(batch, effect, actor, t, reduced.current);
        others++;
      }
    }
    const count = batch.end();
    if (sprites.current) sprites.current.visible = count > 0;
    // Fade the badge in and out instead of popping.
    shown.current += ((busyBadge ? 1 : 0) - shown.current) * 0.2;
    if (shown.current < 0.01) shown.current = 0;
    badge.uniforms.uOpacity.value = shown.current;
    if (badgeMesh.current) badgeMesh.current.visible = shown.current > 0;
    if (count > 0 || shown.current > 0) invalidate();
  });

  return (
    <>
      <mesh
        name="activity-effects"
        ref={sprites}
        geometry={batch.geometry}
        material={batch.material}
        frustumCulled={false}
        renderOrder={6}
        visible={false}
        raycast={() => {}}
      />
      <mesh
        name="activity-badge"
        ref={badgeMesh}
        material={badge}
        frustumCulled={false}
        renderOrder={31}
        visible={false}
        raycast={() => {}}
      >
        <planeGeometry args={[1, 1]} />
      </mesh>
    </>
  );
}

/** Legacy overlay for a sim without a street position; positions are always present now. */
export function PlayerMarker() {
  const low = useStore((s) => {
    const sim = s.sim;
    if (!sim || sim.city !== s.city || sim.position) return null;
    const entry = Object.entries(sim.needs).sort((a, b) => a[1] - b[1])[0];
    return entry && entry[1] < 25 ? entry[0] : "";
  });
  if (low === null) return null;
  return (
    <div className="world-activity" aria-hidden="true">
      <svg viewBox="0 0 44 44">
        <circle cx="22" cy="22" r="18" stroke="#c3d1bd" />
        <circle
          className="player-ring"
          cx="22"
          cy="22"
          r="18"
          fill="none"
          pathLength="100"
        />
      </svg>
      <span className="marker-dot" />
      {low && (
        <span className="thought-bubble">
          <Icon
            name={
              low === "energy"
                ? "zap"
                : low === "hunger"
                  ? "utensils"
                  : low === "fun"
                    ? "sparkles"
                    : "users"
            }
          />
        </span>
      )}
    </div>
  );
}
