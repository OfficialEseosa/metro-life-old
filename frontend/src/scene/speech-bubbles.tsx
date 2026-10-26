/* oxlint-disable react/immutability -- Canvas textures and sprite positions are owned Three resources. */
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree, type RootState } from "@react-three/fiber";
import * as THREE from "three";
import { Billboard } from "@react-three/drei";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { WorldText } from "./world-text";
import { useStore } from "../store";
import { useInteractions } from "../interactions";
import { motion } from "../walking";
import { onFeedback, type FeedbackAnchor } from "../feedback";
import { feedbackHold } from "../ui/feedback-anchor";

function topicIcon(
  c: CanvasRenderingContext2D,
  topic: string,
  x: number,
  y: number,
) {
  c.save();
  c.translate(x, y);
  c.strokeStyle = "#47766c";
  c.fillStyle = "#47766c";
  c.lineWidth = 3.5;
  c.lineCap = "round";
  c.lineJoin = "round";
  c.beginPath();
  if (topic === "food") {
    c.moveTo(-12, -13);
    c.lineTo(-12, 13);
    c.moveTo(-17, -13);
    c.lineTo(-17, -3);
    c.lineTo(-7, -3);
    c.lineTo(-7, -13);
    c.moveTo(11, -13);
    c.quadraticCurveTo(2, -3, 11, 1);
    c.lineTo(11, 13);
  } else if (topic === "music") {
    c.moveTo(-7, 8);
    c.lineTo(-7, -12);
    c.lineTo(13, -16);
    c.lineTo(13, 4);
    c.moveTo(-7, -6);
    c.lineTo(13, -10);
    c.stroke();
    c.beginPath();
    c.ellipse(-12, 10, 6, 4, -0.4, 0, Math.PI * 2);
    c.ellipse(8, 6, 6, 4, -0.4, 0, Math.PI * 2);
    c.fill();
  } else if (topic === "sleep") {
    c.arc(0, 0, 14, 0.7, Math.PI * 1.7);
    c.quadraticCurveTo(-2, 6, 11, 9);
  } else if (topic === "water") {
    c.moveTo(0, -17);
    c.bezierCurveTo(-21, 5, -13, 16, 0, 16);
    c.bezierCurveTo(13, 16, 21, 5, 0, -17);
  } else if (topic === "work") {
    c.rect(-16, -10, 32, 22);
    c.moveTo(-6, -10);
    c.lineTo(-6, -16);
    c.lineTo(6, -16);
    c.lineTo(6, -10);
    c.moveTo(-16, 0);
    c.lineTo(16, 0);
  } else if (topic === "wave") {
    c.moveTo(-9, 16);
    c.lineTo(-9, -6);
    c.moveTo(-3, 14);
    c.lineTo(-3, -14);
    c.moveTo(3, 14);
    c.lineTo(3, -12);
    c.moveTo(9, 14);
    c.lineTo(9, -6);
    c.moveTo(-9, 4);
    c.lineTo(-16, -2);
    c.moveTo(14, -16);
    c.quadraticCurveTo(19, -12, 19, -6);
    c.moveTo(-16, -14);
    c.quadraticCurveTo(-20, -10, -20, -4);
  } else if (topic === "gift") {
    c.rect(-15, -4, 30, 20);
    c.rect(-17, -10, 34, 6);
    c.moveTo(0, -10);
    c.lineTo(0, 16);
    c.moveTo(0, -10);
    c.quadraticCurveTo(-12, -22, -9, -10);
    c.moveTo(0, -10);
    c.quadraticCurveTo(12, -22, 9, -10);
  } else if (topic === "friendship") {
    c.moveTo(0, 14);
    c.bezierCurveTo(-28, -2, -10, -24, 0, -10);
    c.bezierCurveTo(10, -24, 28, -2, 0, 14);
  } else {
    c.roundRect(-17, -13, 34, 23, 7);
    c.moveTo(-8, 10);
    c.lineTo(-12, 17);
    c.lineTo(1, 10);
    c.moveTo(-8, -2);
    c.lineTo(8, -2);
  }
  c.stroke();
  c.restore();
}
const topicTextures = new Map<string, THREE.CanvasTexture>(),
  topicMaterials = new Map<string, THREE.MeshBasicMaterial>();
/** One small icon texture and material per topic, shared by every bubble and never rebuilt. */
function topicMaterial(topic: string) {
  let material = topicMaterials.get(topic);
  if (!material) {
    let texture = topicTextures.get(topic);
    if (!texture) {
      texture = topicTexture(topic);
      topicTextures.set(topic, texture);
    }
    material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    topicMaterials.set(topic, material);
  }
  return material;
}
/** Rounded plate with a 2 px style edge, merged into one geometry with vertex colours. */
const plateGeometries = new Map<string, THREE.BufferGeometry>(),
  plateMaterial = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.97,
    depthTest: false,
    depthWrite: false,
  });
function roundedRect(width: number, height: number, radius: number) {
  const shape = new THREE.Shape(),
    x = -width / 2,
    y = -height / 2,
    r = Math.min(radius, height / 2);
  shape.moveTo(x + r, y);
  shape.lineTo(x + width - r, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + r);
  shape.lineTo(x + width, y + height - r);
  shape.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  shape.lineTo(x + r, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);
  return shape;
}
function plateGeometry(height: number, real: boolean) {
  const key = `${height}:${real}`;
  let geometry = plateGeometries.get(key);
  if (geometry) return geometry;
  const paint = (g: THREE.BufferGeometry, colour: string) => {
    const c = new THREE.Color(colour),
      count = g.getAttribute("position").count,
      colours = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) c.toArray(colours, i * 3);
    g.setAttribute("color", new THREE.BufferAttribute(colours, 3));
    g.deleteAttribute("uv");
    g.deleteAttribute("normal");
    return g;
  };
  const edge = paint(
      new THREE.ShapeGeometry(roundedRect(3.98, height + 0.08, 0.15), 6),
      real ? "#8DBFA9" : "#CBB79A",
    ),
    fill = paint(
      new THREE.ShapeGeometry(roundedRect(3.9, height, 0.11), 6),
      real ? "#E3F3EA" : "#FFF7EA",
    );
  fill.translate(0, 0, 0.002);
  geometry = mergeGeometries([edge, fill]) ?? fill;
  plateGeometries.set(key, geometry);
  return geometry;
}
const iconGeometry = new THREE.PlaneGeometry(0.42, 0.42);

/** Short spoken lines by topic; each person keeps one line per topic so bubbles never flicker. */
const LINES: Record<string, string[]> = {
  chat: [
    "How's your day?",
    "Nice to see you!",
    "Love this place.",
    "What's new?",
    "Same time tomorrow?",
    "Did you hear?",
  ],
  friendship: ["Hey there!", "Hi, neighbour!", "Good to see you!", "Hello!"],
  music: ["What a tune!", "Encore!", "Love this song!", "Let's go!"],
  sleep: ["Zzz..."],
  food: ["Smells so good.", "Delicious!", "Just one more bite."],
  work: ["Almost done.", "Busy, busy.", "One more task."],
  water: ["Ahh, warm water.", "So refreshing."],
};
function lineFor(id: string, topic: string) {
  const lines = LINES[topic] ?? LINES.chat;
  let h = 7;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return lines[Math.abs(h) % lines.length];
}

function topicTexture(topic: string) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const c = canvas.getContext("2d")!;
  c.scale(2, 2);
  topicIcon(c, topic, 32, 32);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
type LabelKind = "npc" | "staff" | "player" | "self";
type LabelPosition = { x: number; y?: number; z: number };
type LabelEntry = {
  root: THREE.Group | null;
  id: string;
  kind: LabelKind;
  name: string;
  label: string;
  speaking: boolean;
  readPosition: () => LabelPosition | undefined;
  visible: () => boolean;
};
const labels = new Set<LabelEntry>(),
  layoutFrames = new WeakMap<THREE.Camera, number>();
let hoveredLabel = "";
export function setLabelHover(id: string) {
  hoveredLabel = id;
  motion.wake();
}
export function clearLabelHover(id: string) {
  if (hoveredLabel === id) {
    hoveredLabel = "";
    motion.wake();
  }
}
type Candidate = {
  entry: LabelEntry;
  anchor: THREE.Vector3;
  projected: THREE.Vector3;
  distance: number;
  priority: number;
  focused: boolean;
};
type Box = { x: number; y: number; w: number; h: number };
// Pools reused every frame: the layout allocates nothing once warmed up.
const candidatePool: Candidate[] = [],
  candidates: Candidate[] = [],
  boxPool: Box[] = [],
  screen = new THREE.Vector3(),
  depthProbe = new THREE.Vector3(),
  offsetCache = new Map<
    number,
    { plain: number[][]; persistent: number[][] }
  >();
function offsetsFor(width: number) {
  let cached = offsetCache.get(width);
  if (!cached) {
    const plain = [
      [0, 0],
      [0, -48],
      [-width * 0.65, -16],
      [width * 0.65, -16],
      [0, -96],
      [-width * 0.7, -76],
      [width * 0.7, -76],
    ];
    cached = {
      plain,
      persistent: [...plain, [-width, -125], [width, -125], [0, -150]],
    };
    offsetCache.set(width, cached);
  }
  return cached;
}
const byPriority = (a: Candidate, b: Candidate) =>
  a.priority - b.priority || a.distance - b.distance;
/** Plates clear the head (and the player's chevron): lower for people sitting or lying down. */
function plateHeight(entry: LabelEntry) {
  const label = entry.label.toLowerCase(),
    base = /sleep|lying|\bnap/.test(label)
      ? 1.15
      : /sitting|seated|eating|typing|working at|reading|chatting at/.test(
            label,
          )
        ? 1.8
        : 2.3;
  return base + (entry.speaking ? 0.2 : 0);
}

/** Shortens text to whole words that fit, so a plate never ends mid-word. */
function clip(text: string, max: number) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1),
    space = cut.lastIndexOf(" ");
  return `${(space > max / 2 ? cut.slice(0, space) : cut).replace(/[\s·,]+$/, "")}…`;
}

/** One screen-space budget serves staff and street NPCs, with real players taking priority. */
/** Screen boxes of the walking controls, read a few times a second so plates never sit under them. */
const controlBoxes: Box[] = [];
let controlBoxesAt = -Infinity;
function readControlBoxes(canvas: HTMLCanvasElement) {
  const frame = canvas.getBoundingClientRect();
  controlBoxes.length = 0;
  for (const el of document.querySelectorAll(
    ".walk-more, .walk-social, .walk-interact",
  )) {
    const b = el.getBoundingClientRect();
    if (!b.width || !b.height) continue;
    controlBoxes.push({
      x: b.left - frame.left + b.width / 2,
      y: b.top - frame.top + b.height / 2,
      w: b.width,
      h: b.height,
    });
  }
}

function layoutLabels(state: RootState) {
  const { camera, size, clock } = state;
  if (layoutFrames.get(camera) === clock.elapsedTime) return;
  layoutFrames.set(camera, clock.elapsedTime);
  const position = motion.position ?? useStore.getState().sim?.position,
    interaction = useInteractions.getState(),
    selected =
      interaction.menu?.target.kind === "person"
        ? interaction.menu.target.id
        : interaction.current?.targetId,
    // Wide enough that the name and role lines render at 16 px or more.
    width = 256,
    halfWidth = width / 2,
    // below the vitals, cue and event chip rows
    top = size.height <= 520 ? 124 : 88,
    bottom = size.height - (size.width < 600 ? 150 : 105);
  candidates.length = 0;
  for (const entry of labels) {
    if (!entry.root) continue;
    entry.root.visible = false;
    if (!entry.name.trim() || !entry.visible()) continue;
    // The player has their own marker; their plate would only cover them.
    if (entry.kind === "self") continue;
    const at = entry.readPosition();
    if (!at) continue;
    let candidate = candidatePool[candidates.length];
    if (!candidate) {
      candidate = {
        entry,
        anchor: new THREE.Vector3(),
        projected: new THREE.Vector3(),
        distance: 0,
        priority: 0,
        focused: false,
      };
      candidatePool.push(candidate);
    }
    candidate.anchor.set(at.x, (at.y ?? 0) + plateHeight(entry), at.z);
    candidate.projected.copy(candidate.anchor).project(camera);
    const projected = candidate.projected,
      distance = position
        ? Math.hypot(at.x - position.x, at.z - position.z)
        : Infinity,
      focused = entry.id === hoveredLabel || entry.id === selected,
      real = entry.kind === "player";
    if (
      projected.z < -1 ||
      projected.z > 1 ||
      Math.abs(projected.x) > 1.15 ||
      Math.abs(projected.y) > 1.15 ||
      (!real && !focused && distance > 6)
    )
      continue;
    candidate.entry = entry;
    candidate.distance = distance;
    candidate.focused = focused;
    candidate.priority = entry.kind === "player" ? 1 : focused ? 2 : 3;
    candidates.push(candidate);
  }
  candidates.sort(byPriority);
  const { plain, persistent } = offsetsFor(width);
  let ordinary = 0,
    boxes = 0;
  // The player's own figure is a box no plate may cover.
  if (position) {
    const ground = (position as { y?: number }).y ?? 0,
      feet = screen.set(position.x, ground, position.z).project(camera),
      feetX = ((feet.x + 1) * size.width) / 2,
      feetY = ((1 - feet.y) * size.height) / 2,
      feetZ = feet.z,
      head = screen.set(position.x, ground + 2, position.z).project(camera),
      headY = ((1 - head.y) * size.height) / 2;
    if (feetZ < 1 && head.z < 1 && feetY > headY) {
      const box = boxPool[0] ?? (boxPool[0] = { x: 0, y: 0, w: 0, h: 0 });
      box.x = feetX;
      box.y = (feetY + headY) / 2;
      box.w = Math.max(36, (feetY - headY) * 0.45);
      box.h = feetY - headY;
      boxes = 1;
    }
  }
  if (Math.abs(clock.elapsedTime - controlBoxesAt) > 0.4) {
    controlBoxesAt = clock.elapsedTime;
    readControlBoxes(state.gl.domElement);
  }
  for (const r of [...reactionBoxes.values(), ...controlBoxes]) {
    const box = boxPool[boxes] ?? (boxPool[boxes] = { x: 0, y: 0, w: 0, h: 0 });
    box.x = r.x;
    box.y = r.y;
    box.w = r.w;
    box.h = r.h;
    boxes++;
  }
  for (const candidate of candidates) {
    const { entry, anchor, projected, focused, priority } = candidate,
      root = entry.root!;
    if (priority === 3 && ordinary >= 3) continue;
    const height =
        ((entry.speaking ? 1.35 : entry.label.trim() ? 0.85 : 0.5) * width) /
        3.9,
      originalX = ((projected.x + 1) * size.width) / 2,
      originalY = ((1 - projected.y) * size.height) / 2;
    let placedX = 0,
      placedY = 0,
      placed = false;
    for (const [dx, dy] of priority < 3 ? persistent : plain) {
      const x = THREE.MathUtils.clamp(
          originalX + dx,
          halfWidth + 8,
          size.width - halfWidth - 8,
        ),
        y = THREE.MathUtils.clamp(
          originalY + dy,
          top + height / 2,
          bottom - height / 2,
        );
      if (
        priority > 1 &&
        Math.hypot(x - originalX, y - originalY) > 180 &&
        !focused
      )
        continue;
      let blocked = false;
      for (let b = 0; b < boxes; b++) {
        const box = boxPool[b];
        if (
          Math.abs(x - box.x) < (width + box.w) / 2 + 7 &&
          Math.abs(y - box.y) < (height + box.h) / 2 + 5
        ) {
          blocked = true;
          break;
        }
      }
      if (blocked) continue;
      placedX = x;
      placedY = y;
      placed = true;
      break;
    }
    if (!placed) continue;
    const box = boxPool[boxes] ?? (boxPool[boxes] = { x: 0, y: 0, w: 0, h: 0 });
    box.x = placedX;
    box.y = placedY;
    box.w = width;
    box.h = height;
    boxes++;
    if (priority === 3) ordinary++;
    screen
      .set(
        (placedX / size.width) * 2 - 1,
        1 - (placedY / size.height) * 2,
        projected.z,
      )
      .unproject(camera);
    root.position.copy(root.parent ? root.parent.worldToLocal(screen) : screen);
    const depth = Math.abs(
        depthProbe.copy(anchor).applyMatrix4(camera.matrixWorldInverse).z,
      ),
      perPixel =
        camera instanceof THREE.PerspectiveCamera
          ? (2 * depth * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)) /
            size.height
          : camera instanceof THREE.OrthographicCamera
            ? (camera.top - camera.bottom) / camera.zoom / size.height
            : 0.015;
    root.scale.setScalar((perPixel * width) / 3.9);
    root.visible = true;
  }
}

/** Fixed screen size, shared collision avoidance, and no card without a nonempty name. */
export function LifeBubble({
  name,
  label,
  topic = "chat",
  speaking = false,
  readPosition,
  visible = () => true,
  id = name,
  kind = "npc",
}: {
  name: string;
  label: string;
  topic?: string;
  speaking?: boolean;
  readPosition: () => LabelPosition | undefined;
  visible?: () => boolean;
  id?: string;
  kind?: LabelKind;
}) {
  const ref = useRef<THREE.Group>(null),
    { invalidate } = useThree(),
    entry = useMemo<LabelEntry>(
      () => ({
        root: null,
        id,
        kind,
        name,
        label,
        speaking,
        readPosition,
        visible,
      }),
      [id, kind, name, label, speaking, readPosition, visible],
    ),
    real = kind === "player" || kind === "self",
    paper = real ? "#E3F3EA" : "#FFF7EA",
    ink = real ? "#224f45" : "#344c40",
    cleanName = name.trim(),
    cleanLabel = label.trim(),
    height = speaking ? 1.35 : cleanLabel ? 0.85 : 0.5;
  useEffect(() => {
    entry.root = ref.current;
    labels.add(entry);
    invalidate();
    return () => {
      labels.delete(entry);
    };
  }, [entry, invalidate]);
  useFrame((state) => layoutLabels(state));
  if (!cleanName) return null;
  return (
    <group ref={ref} visible={false} renderOrder={30}>
      <Billboard>
        <mesh
          geometry={plateGeometry(height, real)}
          material={plateMaterial}
          renderOrder={30}
          dispose={null}
          raycast={() => {}}
        />
        <WorldText
          position={[0, speaking ? 0.42 : cleanLabel ? 0.18 : 0, 0.04]}
          fontSize={0.28}
          maxWidth={3.62}
          color={ink}
          outlineColor={paper}
          distance={1000}
          depthTest={false}
          renderOrder={32}
        >
          {clip(cleanName, 24)}
        </WorldText>
        {cleanLabel && (
          <WorldText
            position={[0, speaking ? 0.08 : -0.18, 0.04]}
            fontSize={0.245}
            maxWidth={3.62}
            color={real ? "#436b5d" : "#5e6d5a"}
            outlineColor={paper}
            distance={1000}
            depthTest={false}
            renderOrder={32}
          >
            {clip(cleanLabel, 34)}
          </WorldText>
        )}
        {speaking && (
          <>
            <mesh
              position={[-1.37, -0.36, 0.045]}
              geometry={iconGeometry}
              material={topicMaterial(topic)}
              renderOrder={31}
              dispose={null}
              raycast={() => {}}
            />
            <WorldText
              position={[0.23, -0.36, 0.045]}
              fontSize={0.27}
              maxWidth={2.7}
              color="#47766c"
              outlineColor={paper}
              distance={1000}
              depthTest={false}
              renderOrder={32}
            >
              {lineFor(id, topic)}
            </WorldText>
          </>
        )}
      </Billboard>
    </group>
  );
}

export function StinkCloud({
  readPosition,
}: {
  readPosition: () => { x: number; y?: number; z: number } | undefined;
}) {
  const ref = useRef<THREE.InstancedMesh>(null),
    dummy = useMemo(() => new THREE.Object3D(), []),
    { invalidate } = useThree();
  useFrame(({ clock }) => {
    const p = readPosition();
    if (!p || !ref.current) return;
    for (let i = 0; i < 7; i++) {
      const t = (clock.elapsedTime * 0.27 + i / 7) % 1,
        a = i * 2.4 + clock.elapsedTime * 0.4;
      dummy.position.set(
        p.x + Math.sin(a) * (0.25 + t * 0.17),
        (p.y ?? 0) + 0.6 + t * 1.8,
        p.z + Math.cos(a) * 0.25,
      );
      dummy.scale.setScalar(Math.sin(t * Math.PI) * 0.16);
      dummy.updateMatrix();
      ref.current.setMatrixAt(i, dummy.matrix);
    }
    ref.current.instanceMatrix.needsUpdate = true;
    // The cloud drifts continuously; keep the demand loop alive while it is mounted.
    if (!document.hidden) invalidate();
  });
  return (
    <instancedMesh
      ref={ref}
      args={[undefined, undefined, 7]}
      frustumCulled={false}
      raycast={() => {}}
    >
      <sphereGeometry args={[1, 6, 4]} />
      <meshBasicMaterial
        color="#91a65f"
        transparent
        opacity={0.26}
        depthWrite={false}
      />
    </instancedMesh>
  );
}

// ---- social reactions: the person a wave, hang-out or gift reached answers over their head ----

type SocialKind = "wave" | "hangout" | "gift";
type Reaction = {
  key: number;
  kind: SocialKind;
  /** Rendered object name of the person who answers. */
  target: string;
  anchor?: FeedbackAnchor;
};
const REACTION_LINES: Record<SocialKind, string> = {
  wave: "Hi there!",
  hangout: "Good times!",
  gift: "Thank you!",
};
const REACTION_TOPICS: Record<SocialKind, string> = {
  wave: "wave",
  hangout: "friendship",
  gift: "gift",
};
const REACTION_MS = 2800,
  REACTION_WIDTH = 2.7;
/** Screen boxes of the social reactions on show, so name plates step around them. */
const reactionBoxes = new Map<
  number,
  { x: number; y: number; w: number; h: number }
>();
const lineGeometry = new THREE.PlaneGeometry(2.1, 0.525),
  lineMaterials = new Map<SocialKind, THREE.MeshBasicMaterial>();
/** The answer is painted once per kind in the interface's display face, so it reads at any size. */
function reactionLine(kind: SocialKind) {
  let material = lineMaterials.get(kind);
  if (material) return material;
  const canvas = document.createElement("canvas"),
    c = canvas.getContext("2d");
  canvas.width = 512;
  canvas.height = 128;
  if (c) {
    const face =
      getComputedStyle(document.documentElement)
        .getPropertyValue("--font-display")
        .trim() || "sans-serif";
    c.font = `600 84px ${face}`;
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.lineJoin = "round";
    c.lineWidth = 12;
    c.strokeStyle = "#FFF7EA";
    c.strokeText(REACTION_LINES[kind], 256, 66, 496);
    c.fillStyle = "#7A2E4D";
    c.fillText(REACTION_LINES[kind], 256, 66, 496);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  lineMaterials.set(kind, material);
  return material;
}
let bubbleGeometry: THREE.BufferGeometry | null = null;
/** Sorted with the name plates so the answer draws over them. */
const reactionPlate = new THREE.MeshBasicMaterial({
  vertexColors: true,
  transparent: true,
  depthTest: false,
  depthWrite: false,
});
/** A speech bubble with a tail, pink edge for social moments; one geometry for every reaction. */
function reactionGeometry() {
  if (bubbleGeometry) return bubbleGeometry;
  const paint = (g: THREE.BufferGeometry, colour: string, z: number) => {
    const c = new THREE.Color(colour),
      count = g.getAttribute("position").count,
      colours = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) c.toArray(colours, i * 3);
    g.setAttribute("color", new THREE.BufferAttribute(colours, 3));
    g.deleteAttribute("uv");
    g.deleteAttribute("normal");
    g.translate(0, 0, z);
    return g;
  };
  const tail = (grow: number) => {
    const shape = new THREE.Shape();
    shape.moveTo(-0.22 - grow, -0.38);
    shape.lineTo(0.18 + grow, -0.38);
    shape.lineTo(-0.12, -0.7 - grow * 1.6);
    shape.closePath();
    return shape;
  };
  bubbleGeometry =
    mergeGeometries([
      paint(
        new THREE.ShapeGeometry(
          roundedRect(REACTION_WIDTH + 0.1, 0.86, 0.3),
          6,
        ),
        "#D9668F",
        0,
      ),
      paint(new THREE.ShapeGeometry(tail(0.06), 1), "#D9668F", 0),
      paint(
        new THREE.ShapeGeometry(roundedRect(REACTION_WIDTH, 0.76, 0.26), 6),
        "#FFF7EA",
        0.002,
      ),
      paint(new THREE.ShapeGeometry(tail(0), 1), "#FFF7EA", 0.002),
    ]) ?? new THREE.PlaneGeometry(REACTION_WIDTH, 0.76);
  return bubbleGeometry;
}

function ReactionBubble({
  reaction,
  onDone,
}: {
  reaction: Reaction;
  onDone: (key: number) => void;
}) {
  const ref = useRef<THREE.Group>(null),
    started = useRef(0),
    person = useRef<THREE.Object3D | null>(null),
    lookups = useRef(0),
    at = useMemo(() => new THREE.Vector3(), []),
    probe = useMemo(() => new THREE.Vector3(), []),
    { scene, invalidate } = useThree(),
    finished = useRef(false);
  useEffect(
    () => () => void reactionBoxes.delete(reaction.key),
    [reaction.key],
  );
  useFrame(({ camera, size }) => {
    const group = ref.current;
    if (!group || finished.current) return;
    if (!started.current) started.current = performance.now();
    const life = feedbackHold() ? REACTION_MS * 12 : REACTION_MS,
      t = (performance.now() - started.current) / life;
    if (t >= 1) {
      finished.current = true;
      group.visible = false;
      reactionBoxes.delete(reaction.key);
      onDone(reaction.key);
      return;
    }
    if (!person.current?.parent && lookups.current++ % 20 === 0)
      person.current = scene.getObjectByName(reaction.target) ?? null;
    if (person.current?.parent && person.current.visible !== false)
      person.current.getWorldPosition(at);
    else if (reaction.anchor)
      at.set(reaction.anchor.x, reaction.anchor.y ?? 0, reaction.anchor.z);
    else {
      group.visible = false;
      reactionBoxes.delete(reaction.key);
      invalidate();
      return;
    }
    const pop =
        t < 0.08
          ? THREE.MathUtils.smootherstep(t / 0.08, 0, 1) * 1.15
          : t < 0.14
            ? 1.15 - ((t - 0.08) / 0.06) * 0.15
            : t > 0.9
              ? Math.max(0, 1 - (t - 0.9) / 0.1)
              : 1,
      bob = Math.sin(t * Math.PI * 6) * 0.04 * (1 - t);
    at.y += 3.3 + t * 0.3 + bob;
    const depth = Math.abs(
        probe.copy(at).applyMatrix4(camera.matrixWorldInverse).z,
      ),
      perPixel =
        camera instanceof THREE.PerspectiveCamera
          ? (2 * depth * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)) /
            size.height
          : camera instanceof THREE.OrthographicCamera
            ? (camera.top - camera.bottom) / camera.zoom / size.height
            : 0.015,
      pixels = size.width < 700 ? 170 : 210;
    // Keep the bubble below the HUD's top rows, sliding it down at the same depth.
    probe.copy(at).project(camera);
    const minY = (size.height <= 520 ? 124 : 88) + pixels * 0.17;
    if (((1 - probe.y) * size.height) / 2 < minY) {
      probe.y = 1 - (minY / size.height) * 2;
      at.copy(probe.unproject(camera));
    }
    group.position.copy(group.parent ? group.parent.worldToLocal(at) : at);
    group.scale.setScalar(
      Math.max(0.0001, (perPixel * pixels * pop) / REACTION_WIDTH),
    );
    probe.copy(at).project(camera);
    reactionBoxes.set(reaction.key, {
      x: ((probe.x + 1) * size.width) / 2,
      y: ((1 - probe.y) * size.height) / 2 + pixels * 0.06,
      w: pixels,
      h: pixels * 0.45,
    });
    group.visible = true;
    invalidate();
  });
  return (
    <group ref={ref} visible={false} renderOrder={34}>
      <Billboard>
        <mesh
          geometry={reactionGeometry()}
          material={reactionPlate}
          renderOrder={34}
          dispose={null}
          raycast={() => {}}
        />
        <mesh
          position={[-0.92, 0, 0.045]}
          geometry={iconGeometry}
          material={topicMaterial(REACTION_TOPICS[reaction.kind])}
          renderOrder={35}
          dispose={null}
          raycast={() => {}}
        />
        <mesh
          position={[0.22, 0, 0.05]}
          geometry={lineGeometry}
          material={reactionLine(reaction.kind)}
          renderOrder={36}
          dispose={null}
          raycast={() => {}}
        />
      </Billboard>
    </group>
  );
}

/**
 * When a wave, hang-out or gift lands, the person it reached answers in a speech bubble.
 * The sender sees it over the friend they chose; the receiver sees it over themselves.
 */
export function SocialReactions() {
  const [reactions, setReactions] = useState<Reaction[]>([]),
    next = useRef(0);
  useEffect(
    () =>
      onFeedback((e) => {
        if (e.kind !== "social" && e.kind !== "socialReceived") return;
        const word = String(e.data?.social ?? "wave"),
          kind: SocialKind =
            word === "gift" || word === "hangout" ? word : "wave",
          targetId = e.data?.targetId;
        if (e.kind === "social" && !targetId && !e.anchor) return;
        const reaction: Reaction = {
          key: ++next.current,
          kind,
          target:
            e.kind === "socialReceived"
              ? "controlled-player"
              : "resident-" + String(targetId ?? ""),
          anchor:
            e.kind === "socialReceived"
              ? motion.position
                ? { x: motion.position.x, z: motion.position.z }
                : undefined
              : e.anchor,
        };
        setReactions((list) => [
          ...list.filter((r) => r.target !== reaction.target).slice(-2),
          reaction,
        ]);
      }),
    [],
  );
  return (
    <>
      {reactions.map((r) => (
        <ReactionBubble
          key={r.key}
          reaction={r}
          onDone={(key) =>
            setReactions((list) => list.filter((item) => item.key !== key))
          }
        />
      ))}
    </>
  );
}
