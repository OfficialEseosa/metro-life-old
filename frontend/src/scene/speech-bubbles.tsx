/* oxlint-disable react/immutability -- Canvas textures and sprite positions are owned Three resources. */
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree, type RootState } from "@react-three/fiber";
import * as THREE from "three";
import { Billboard } from "@react-three/drei";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { WorldText } from "./world-text";
import { useStore } from "../store";
import { useInteractions } from "../interactions";
import { motion } from "../walking";

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

/** One screen-space budget serves staff and street NPCs, with real players taking priority. */
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
    width = size.width < 500 ? 146 : 174,
    halfWidth = width / 2,
    top = 64,
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
          {cleanName.slice(0, 24)}
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
            {cleanLabel.slice(0, 28)}
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
