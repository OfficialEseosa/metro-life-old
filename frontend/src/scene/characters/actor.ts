/* oxlint-disable react/immutability -- An actor owns imperative Three resources. */
/**
 * CharacterActor: one animated person built from the shared character kit.
 * Plain Three.js, so the game scene, the creator preview and portraits all use it.
 */
import * as THREE from "three";
import type { Look } from "../../api/types";
import {
  loadDonor,
  makeSkeleton,
  mergePieces,
  peekDonor,
  rigidPiece,
  weldNormals,
  type Donor,
  type DonorKit,
  type Sex,
} from "./kit";
import {
  cutOf,
  headFor,
  outfitColours,
  partsFor,
  slotFor,
  SLOTS,
  type Cut,
  type OutfitColours,
} from "./outfits";
import {
  facialDonors,
  facialGeometry,
  hairDonors,
  hairGeometry,
} from "./hair";
import {
  acquireFaceTexture,
  faceDecalGeometry,
  faceMaterial,
} from "./face";
import {
  clothMaterial,
  hairMaterial,
  propMaterial,
  skinMaterial,
} from "./materials";
import { loadActivities, peekActivities, type ActivityLibrary } from "./clips";
import { hashString, PASTELS, seeded } from "./palettes";

export type CharacterPose =
  | "Idle"
  | "Walk"
  | "Run"
  | "Wave"
  | "Interact"
  | "Sit"
  | "Lie"
  | "Sleep"
  | "Type"
  | "Eat"
  | "Dance"
  | "Cheer"
  | "Jog"
  | "Talk"
  | "Shower"
  | "Cook"
  | "Browse"
  | "Photo"
  | "Play"
  | "Listen"
  | "Celebrate"
  | "Read"
  | "React"
  | "Phone"
  | "Greet"
  | "Nod"
  | "Yes"
  | "FoldArms"
  | "SitTalk"
  | "Exercise"
  | "Yoga"
  | "Tired"
  | "Cold"
  | "Confused"
  | "Angry"
  | "Bow"
  | "Water"
  | "Fix"
  | "PickUp"
  | "Push"
  | "Carry"
  | "ShakeOff";

/** Poses that sit on a seat and use the activity slot's hip height. */
export const SEATED_POSES = new Set(["Sit", "Type", "Eat", "SitTalk"]);
const LYING = new Set(["Sleep", "Lie"]);
const LOCOMOTION = new Set(["Idle", "Walk", "Run", "Jog"]);

/** Which clip plays for a pose (the clip may carry procedural overlays on top). */
const CLIP_FOR: Partial<Record<CharacterPose, string>> = {
  Wave: "Greet",
  React: "Greet",
  Celebrate: "Celebrate",
  Browse: "IdleSubtle",
  Photo: "IdleSubtle",
  Play: "IdleSubtle",
  Read: "IdleSubtle",
  Shower: "Idle",
  Cook: "Idle",
};

type WardrobeLook = Look & {
  face?: string;
  outfits?: Partial<
    Record<
      "everyday" | "work" | "sleep",
      { top: string; bottom: string; style: string; shoeColor: string }
    >
  >;
};

export type ActorOptions = {
  /** Stable identity used for small differences; defaults to a hash of the look. */
  seed?: number;
  /** Residents get height, build, idle and walk personality from their seed. */
  personality?: boolean;
  /** Face atlas tile size in pixels. */
  faceSize?: number;
  /** Optional facial hair or glasses for residents. */
  accessories?: { facial?: "moustache" | "stubble"; glasses?: boolean };
};

export type ActorInput = {
  pose: CharacterPose;
  speed: number;
  hip?: number;
  tired?: boolean;
  hungry?: boolean;
  /** Server time (ms) when the current activity started, to keep loops in step. */
  startedAt?: number;
  /** World position of a head to glance toward. */
  lookAt?: THREE.Vector3;
  now: number;
};

export function sexOf(look: Look): Sex {
  return look.body === "f" ? "f" : "m";
}
function variantOf(look: Look) {
  return hashString(look.top + look.bottom);
}
export function lookSeed(look: Look) {
  return hashString(
    [look.body, look.skin, look.hair, look.hairColor, (look as WardrobeLook).face].join("|"),
  );
}

/** Every donor file a look needs (body parts, head, hair, facial hair). */
export function donorsFor(look: Look, options: ActorOptions = {}): Donor[] {
  const sex = sexOf(look),
    parts = partsFor(sex, cutOf(look.style), variantOf(look)),
    set = new Set<Donor>([
      parts.Body,
      parts.Legs,
      parts.Feet,
      headFor(sex, (look as WardrobeLook).face),
      ...hairDonors(look.hair),
      ...facialDonors(options.accessories?.facial),
    ]);
  return [...set];
}
export function lookReady(look: Look, options: ActorOptions = {}) {
  return (
    donorsFor(look, options).every((d) => peekDonor(d)) &&
    !!peekActivities(sexOf(look))
  );
}
const pendingLooks = new Map<string, Promise<void>>();
/** Load everything a look needs; resolves immediately when it is already cached. */
export function loadLook(look: Look, options: ActorOptions = {}): Promise<void> {
  const donors = donorsFor(look, options),
    key = donors.join(",") + sexOf(look);
  let pending = pendingLooks.get(key);
  if (!pending) {
    pending = Promise.all([
      ...donors.map(loadDonor),
      loadActivities(sexOf(look)),
    ]).then(() => undefined);
    pendingLooks.set(key, pending);
    pending.catch(() => pendingLooks.delete(key));
  }
  return pending;
}
/** Warm the cache with every body so creator swaps never wait. */
export function preloadAllBodies() {
  return Promise.all([
    ...(
      [
        "f_casual",
        "f_party",
        "f_smart",
        "f_street",
        "f_work",
        "m_casual",
        "m_casual2",
        "m_party",
        "m_smart",
        "m_street",
        "m_work",
      ] as Donor[]
    ).map(loadDonor),
    loadActivities("f"),
    loadActivities("m"),
  ]);
}

// ---------------------------------------------------------------- cached geometry

const skinCache = new Map<string, THREE.BufferGeometry>();
function skinGeometry(
  head: DonorKit,
  body: DonorKit,
  legs: DonorKit,
  feet: DonorKit,
) {
  const key = [head.name, body.name, legs.name, feet.name].join("|");
  let g = skinCache.get(key);
  if (!g) {
    const parts: { geometry: THREE.BufferGeometry; tag: number }[] = [];
    for (const [kit, part] of [
      [head, "Head"],
      [body, "Body"],
      [legs, "Legs"],
      [feet, "Feet"],
    ] as const)
      for (const piece of kit.pieces)
        if (piece.part === part) {
          const slot = slotFor(kit.name, piece.part, piece.material);
          if (slot === "skin" || slot === "skinDark")
            parts.push({
              geometry: piece.geometry,
              tag: slot === "skinDark" ? 0.82 : 1,
            });
        }
    g = weldNormals(mergePieces(parts, "tone"));
    const tone = g.getAttribute("tone"),
      colour = new Float32Array(tone.count * 3);
    for (let i = 0; i < tone.count; i++)
      colour.fill(tone.getX(i), i * 3, i * 3 + 3);
    g.setAttribute("color", new THREE.BufferAttribute(colour, 3));
    g.deleteAttribute("tone");
    skinCache.set(key, g);
  }
  return g;
}
const headSkinCache = new Map<string, THREE.BufferGeometry>();
function headSkin(head: DonorKit) {
  let g = headSkinCache.get(head.name);
  if (!g) {
    g = weldNormals(
      mergePieces(
        head.pieces
          .filter((p) => p.part === "Head" && /^Skin/.test(p.material))
          .map((p) => ({ geometry: p.geometry, tag: 0 })),
        "tone",
      ),
    );
    headSkinCache.set(head.name, g);
  }
  return g;
}

/** Glasses: two rings and a bridge in front of the eyes, skinned to Head. */
function glassesGeometry(head: DonorKit) {
  const { eyeLeft, eyeRight } = head.head,
    spacing = Math.abs(eyeLeft.x - eyeRight.x),
    r = spacing * 0.38,
    z = Math.max(eyeLeft.z, eyeRight.z) + spacing * 0.14,
    pieces: THREE.BufferGeometry[] = [];
  for (const eye of [eyeLeft, eyeRight]) {
    const ring = new THREE.TorusGeometry(r, r * 0.13, 6, 18);
    ring.translate(eye.x, eye.y, z);
    pieces.push(ring.toNonIndexed());
  }
  const bridge = new THREE.BoxGeometry(spacing - 2 * r, r * 0.22, r * 0.22);
  bridge.translate((eyeLeft.x + eyeRight.x) / 2, eyeLeft.y + r * 0.2, z);
  pieces.push(bridge.toNonIndexed());
  for (const side of [-1, 1]) {
    const arm = new THREE.BoxGeometry(r * 0.2, r * 0.2, spacing * 1.1);
    arm.translate(
      (eyeLeft.x + eyeRight.x) / 2 + side * (spacing / 2 + r * 0.95),
      eyeLeft.y + r * 0.1,
      z - spacing * 0.55,
    );
    pieces.push(arm.toNonIndexed());
  }
  const merged = new THREE.BufferGeometry(),
    positions: number[] = [],
    normals: number[] = [];
  for (const p of pieces) {
    positions.push(...(p.getAttribute("position").array as Float32Array));
    normals.push(...(p.getAttribute("normal").array as Float32Array));
    p.dispose();
  }
  merged.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  merged.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  const out = rigidPiece(merged, head.head.headBone);
  merged.dispose();
  return out;
}

const clothCache = new Map<string, THREE.BufferGeometry>();
function clothGeometry(
  head: DonorKit,
  body: DonorKit,
  legs: DonorKit,
  feet: DonorKit,
  glasses: boolean,
) {
  const key = [head.name, body.name, legs.name, feet.name, glasses].join("|");
  let g = clothCache.get(key);
  if (!g) {
    const parts: { geometry: THREE.BufferGeometry; tag: number }[] = [];
    for (const [kit, part] of [
      [body, "Body"],
      [legs, "Legs"],
      [feet, "Feet"],
    ] as const)
      for (const piece of kit.pieces)
        if (piece.part === part) {
          const slot = slotFor(kit.name, piece.part, piece.material);
          if (slot && slot !== "skin" && slot !== "skinDark")
            parts.push({ geometry: piece.geometry, tag: SLOTS.indexOf(slot) });
        }
    if (glasses)
      parts.push({ geometry: glassesGeometry(head), tag: SLOTS.indexOf("glasses") });
    g = weldNormals(mergePieces(parts, "slot"));
    clothCache.set(key, g);
  }
  return g;
}

const hairCache = new Map<string, THREE.BufferGeometry | null>();
function hairWithFacial(
  style: string,
  facial: string | undefined,
  head: DonorKit,
  donors: Map<Donor, DonorKit>,
) {
  const key = style + "|" + (facial ?? "") + "|" + head.name;
  if (hairCache.has(key)) return hairCache.get(key)!;
  const hair = hairGeometry(style, head, donors),
    extra = facial ? facialGeometry(facial, head, donors) : null;
  let result: THREE.BufferGeometry | null = hair;
  if (hair && extra)
    result = mergePieces(
      [
        { geometry: hair, tag: 0 },
        { geometry: extra, tag: 0 },
      ],
      "tone",
    );
  else if (extra) result = extra;
  hairCache.set(key, result);
  return result;
}

// ---------------------------------------------------------------- shared props

let blobTexture: THREE.CanvasTexture | undefined;
function footShadowTexture() {
  if (!blobTexture) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 128;
    const c = canvas.getContext("2d")!,
      g = c.createRadialGradient(64, 64, 6, 64, 64, 63);
    g.addColorStop(0, "rgba(35,26,30,.34)");
    g.addColorStop(0.45, "rgba(35,26,30,.2)");
    g.addColorStop(1, "rgba(35,26,30,0)");
    c.fillStyle = g;
    c.fillRect(0, 0, 128, 128);
    blobTexture = new THREE.CanvasTexture(canvas);
  }
  return blobTexture;
}
/** Where a cooking pot sits on the hob, in the cook's own frame. */
/** Exported for effects (steam): the pot centre in the cook's own frame, top at y + 0.06. */
export const COOK_POT = new THREE.Vector3(0.02, 0.94, 0.84);
const POT = COOK_POT;
/**
 * Furniture approach points sit 0.65 m in front of the furniture, so a cook steps this far
 * toward the hob while cooking (the body moves, the server position does not).
 */
const COOK_STEP = 0.36;
let blob: THREE.MeshBasicMaterial | undefined;
function blobMaterial() {
  blob ??= new THREE.MeshBasicMaterial({
    map: footShadowTexture(),
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  });
  return blob;
}
const shared = {
  blobGeometry: new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
  potGeometry: new THREE.CylinderGeometry(0.13, 0.11, 0.12, 18),
  soupGeometry: new THREE.CylinderGeometry(0.115, 0.115, 0.01, 18),
  spoonGeometry: new THREE.CylinderGeometry(0.008, 0.008, 1, 6).translate(0, 0.5, 0),
  phoneGeometry: new THREE.BoxGeometry(0.035, 0.075, 0.009),
  bookGeometry: new THREE.BoxGeometry(0.24, 0.025, 0.17),
  guitarBody: new THREE.CylinderGeometry(0.17, 0.17, 0.07, 20).rotateX(Math.PI / 2),
  guitarNeck: new THREE.BoxGeometry(0.05, 0.42, 0.03),
  blanketGeometry: (() => {
    const g = new THREE.BoxGeometry(1, 1, 1, 4, 2, 6),
      p = g.getAttribute("position"),
      v = new THREE.Vector3();
    // Pillow-soft: round the top edges and let the sides drape.
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const edge = Math.abs(v.x) * 2;
      if (v.y > 0) v.y -= edge * edge * 0.35;
      else v.x *= 1.04;
      p.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    return g;
  })(),
};

type PropName = "pot" | "spoon" | "phone" | "blanket" | "book" | "guitar";

// ---------------------------------------------------------------- locomotion analysis

const strideCache = new Map<string, number>();
/** Ground speed (rest-world metres per second) that a looping walk or run clip implies. */
function strideSpeed(
  key: string,
  clip: THREE.AnimationClip,
  root: THREE.Object3D,
  frame: THREE.Object3D,
  feet: THREE.Object3D[],
) {
  const cached = strideCache.get(key);
  if (cached) return cached;
  const mixer = new THREE.AnimationMixer(root),
    action = mixer.clipAction(clip).play(),
    samples = 40,
    dt = clip.duration / samples,
    track: { y: number; z: number }[][] = feet.map(() => []),
    v = new THREE.Vector3();
  for (let i = 0; i <= samples; i++) {
    mixer.setTime(i * dt);
    frame.updateMatrixWorld(true);
    feet.forEach((foot, f) => {
      foot.getWorldPosition(v);
      frame.worldToLocal(v);
      track[f].push({ y: v.y, z: v.z });
    });
  }
  const speeds: number[] = [];
  for (const t of track) {
    const low = Math.min(...t.map((s) => s.y));
    for (let i = 1; i < t.length; i++)
      if (t[i].y < low + 0.03 && t[i - 1].y < low + 0.03) {
        const s = -(t[i].z - t[i - 1].z) / dt;
        if (s > 0) speeds.push(s);
      }
  }
  speeds.sort((a, b) => a - b);
  const speed = speeds.length ? speeds[Math.floor(speeds.length / 2)] : 1.4;
  action.stop();
  mixer.uncacheRoot(root);
  strideCache.set(key, speed);
  return speed;
}

// ---------------------------------------------------------------- actor

let timeWarp = 1;
/** Development lab only: run character animation faster on slow software renderers. */
export function setActorTimeWarp(value: number) {
  timeWarp = value;
}

type Layer = { action: THREE.AnimationAction; weight: number; target: number };

/** Everything about a look that changes a built actor. */
export function lookKey(look: Look) {
  const l = look as WardrobeLook;
  return JSON.stringify([
    l.body,
    l.skin,
    l.hair,
    l.hairColor,
    l.face,
    l.style,
    l.top,
    l.bottom,
    l.shoeColor,
    l.outfits ?? null,
  ]);
}

export class CharacterActor {
  readonly root = new THREE.Group();
  /** React owners (StrictMode mounts effects twice). */
  owners = 0;
  readonly look: Look;
  readonly sex: Sex;
  readonly scale: number;
  private anchor = new THREE.Group();
  private scaled = new THREE.Group();
  private skeleton: THREE.Skeleton;
  private bones: Map<string, THREE.Bone>;
  private mixer: THREE.AnimationMixer;
  private library: ActivityLibrary;
  private layers = new Map<string, Layer>();

  private clothColours: THREE.BufferAttribute;
  private clothGeometry: THREE.BufferGeometry;
  /** Skin, cloth and hair: the meshes whose sun shadow is switched off at a distance. */
  private casters: THREE.SkinnedMesh[] = [];
  private castsShadow = true;
  private face?: { material: THREE.MeshStandardMaterial; release: () => void };
  private blob: THREE.Mesh;
  private props: Partial<Record<PropName, THREE.Object3D>> = {};
  private outfitKey = "";
  private mode: "move" | "act" | "enter" | "leave" = "move";
  private activityClip = "";
  private enterUntil = 0;
  private time = 0;
  private nextBlink = 2;
  private blinkUntil = 0;
  private yaw = new THREE.Quaternion();
  private turnRate = 0;
  /** World heading the feet are planted at while standing; the body lags the parent to it. */
  private footYaw = NaN;
  private stepUntil = 0;
  private lookYaw = 0;
  private lookPitch = 0;
  private lookWeight = 0;
  private idleSwapAt = 0;
  private overlay: THREE.Bone[] = [];
  private overlayRest: THREE.Quaternion[] = [];
  private ikTarget = new THREE.Vector3();
  private ikPole = new THREE.Vector3();
  private ikDir = new THREE.Vector3();
  private ikTmp = new THREE.Vector3();
  private ikU = new THREE.Vector3();
  private ikV = new THREE.Vector3();
  private ikQ = new THREE.Quaternion();
  private speeds: { walk: number; jog: number; run: number };
  private personality: {
    idle: string;
    idles: string[];
    walk: string;
    build: number;
    hips: number;
    phase: number;
    dance: string;
  };
  private random: () => number;
  private seated = false;
  private pyjamas: string;
  private scratch = {
    a: new THREE.Vector3(),
    b: new THREE.Vector3(),
    c: new THREE.Vector3(),
    q: new THREE.Quaternion(),
    q2: new THREE.Quaternion(),
    q3: new THREE.Quaternion(),
    q4: new THREE.Quaternion(),
    m: new THREE.Matrix4(),
  };

  constructor(look: Look, options: ActorOptions = {}) {
    this.look = look;
    const wardrobe = look as WardrobeLook,
      sex = (this.sex = sexOf(look)),
      cut: Cut = cutOf(look.style),
      parts = partsFor(sex, cut, variantOf(look)),
      donors = new Map<Donor, DonorKit>();
    for (const d of donorsFor(look, options)) {
      const kit = peekDonor(d);
      if (!kit) throw Error("Character kit not loaded: " + d);
      donors.set(d, kit);
    }
    const library = peekActivities(sex);
    if (!library) throw Error("Character animations not loaded");
    this.library = library;
    this.pyjamas = PASTELS[lookSeed(look) % PASTELS.length];
    const seed = options.seed ?? lookSeed(look),
      random = (this.random = seeded(seed ^ 0x51ed270b)),
      head = donors.get(headFor(sex, wardrobe.face))!,
      body = donors.get(parts.Body)!,
      legs = donors.get(parts.Legs)!,
      feet = donors.get(parts.Feet)!;
    const height =
      (sex === "f" ? 1.74 : 1.8) *
      (options.personality ? 0.95 + random() * 0.1 : 1);
    this.scale = height / body.height;
    // Skeleton from the body donor; every piece binds to it with an identity bind matrix.
    const { root: skeletonRoot, skeleton, byName } = makeSkeleton(body);
    this.skeleton = skeleton;
    this.bones = byName;
    this.scaled.scale.setScalar(this.scale);
    this.scaled.add(skeletonRoot);
    this.anchor.add(this.scaled);
    this.root.add(this.anchor);
    this.root.name = "rigged-character";
    this.root.userData = {
      heightMetres: height,
      forward: "+Z",
      source: "Quaternius Modular + mesh2motion",
    };
    // One generous sphere (in the donor's units) covers every pose, lying and cheering
    // included, so the camera and the shadow camera can cull a person without
    // re-measuring skinned vertices each frame.
    const bounds = new THREE.Sphere(
      new THREE.Vector3(0, body.height * 0.5, 0),
      body.height * 0.8,
    );
    const bind = (geometry: THREE.BufferGeometry, material: THREE.Material, name: string) => {
      const mesh = new THREE.SkinnedMesh(geometry, material);
      mesh.name = name;
      mesh.bind(skeleton, new THREE.Matrix4());
      mesh.boundingSphere = bounds.clone();
      mesh.frustumCulled = true;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scaled.add(mesh);
      return mesh;
    };
    this.casters.push(
      bind(skinGeometry(head, body, legs, feet), skinMaterial(look.skin), "character-skin"),
    );
    const cloth = clothGeometry(head, body, legs, feet, !!options.accessories?.glasses);
    this.clothGeometry = new THREE.BufferGeometry();
    for (const name of ["position", "normal", "skinIndex", "skinWeight", "slot"])
      this.clothGeometry.setAttribute(name, cloth.getAttribute(name));
    this.clothGeometry.setIndex(cloth.index);
    this.clothColours = new THREE.BufferAttribute(
      new Float32Array(cloth.getAttribute("position").count * 3),
      3,
    );
    this.clothGeometry.setAttribute("color", this.clothColours);
    this.casters.push(bind(this.clothGeometry, clothMaterial(), "character-cloth"));
    const hair = hairWithFacial(look.hair, options.accessories?.facial, head, donors);
    if (hair) this.casters.push(bind(hair, hairMaterial(look.hairColor), "character-hair"));
    // Painted face on the front of the head skin.
    const faceTexture = acquireFaceTexture(
        {
          face: wardrobe.face ?? "soft",
          skin: look.skin,
          hairColor: look.hairColor,
          sex,
          seed,
        },
        options.faceSize ?? 256,
      ),
      material = faceMaterial(faceTexture.texture),
      faceMesh = bind(faceDecalGeometry(head, headSkin(head)), material, "character-face");
    faceMesh.castShadow = false;
    faceMesh.renderOrder = 1;
    this.face = { material, release: faceTexture.release };
    // Soft contact blob under the feet (the sun shadow is owned by the scene).
    this.blob = new THREE.Mesh(shared.blobGeometry, blobMaterial());
    this.blob.position.y = 0.014;
    this.blob.scale.setScalar(1.05);
    this.blob.raycast = () => {};
    this.blob.renderOrder = -1;
    this.root.add(this.blob);
    this.applyOutfit(this.colours("Idle"));
    // Animation.
    this.mixer = new THREE.AnimationMixer(skeletonRoot);
    for (const bone of [
      "Abdomen",
      "Chest",
      "Neck",
      "Head",
      "UpperArmL",
      "LowerArmL",
      "WristL",
      "UpperArmR",
      "LowerArmR",
      "WristR",
    ]) {
      const b = byName.get(bone);
      if (b) {
        this.overlay.push(b);
        this.overlayRest.push(b.quaternion.clone());
      }
    }
    const feetBones = ["FootL", "FootR"].map((n) => byName.get(n)!).filter(Boolean),
      clip = (name: string) => this.clip(name);
    this.root.updateMatrixWorld(true);
    const measure = (name: string) => {
      const c = clip(name);
      return c
        ? strideSpeed(sex + body.name + name, c, skeletonRoot, this.scaled, feetBones) *
            this.scale
        : 1.4;
    };
    const p = options.personality;
    this.personality = {
      idle: p ? (["Idle", "Idle", "IdleSubtle", "FoldArms", "Idle"][Math.floor(random() * 5)]) : "Idle",
      idles: p
        ? [["Idle", "IdleSubtle"], ["Idle", "IdleSubtle", "FoldArms"], ["IdleSubtle", "Idle"]][
            Math.floor(random() * 3)
          ]
        : ["Idle", "IdleSubtle"],
      walk: p
        ? sex === "f"
          ? random() < 0.6
            ? "WalkF"
            : "Walk"
          : random() < 0.25
            ? "WalkFormal"
            : "Walk"
        : sex === "f"
          ? "WalkF"
          : "Walk",
      build: p ? 0.96 + random() * 0.1 : 1,
      hips: p ? 0.97 + random() * 0.08 : 1,
      phase: random() * 10,
      dance: ["Dance", "Dance2", "Dance3", "Dance4"][Math.floor(random() * 4)],
    };
    this.speeds = {
      walk: measure(this.personality.walk),
      jog: measure("Jog"),
      run: measure(sex === "f" ? "RunF" : "Run"),
    };
    this.time = this.personality.phase;
    this.nextBlink = 1 + random() * 4;
    this.yaw.copy(this.root.quaternion);
  }

  /** A base clip from the body file or an activity clip from the library. */
  private clip(name: string): THREE.AnimationClip | undefined {
    const fromLibrary = this.library.clips.get(name);
    if (fromLibrary) return fromLibrary;
    const kit = peekDonor(this.bodyDonor());
    return kit?.animations.find((a) => a.name.split("|").at(-1) === name);
  }
  private bodyDonor(): Donor {
    return partsFor(this.sex, cutOf(this.look.style), variantOf(this.look)).Body;
  }

  private layer(name: string): Layer | undefined {
    let layer = this.layers.get(name);
    if (!layer) {
      const clip = this.clip(name);
      if (!clip) return undefined;
      const action = this.mixer.clipAction(clip),
        meta = this.library.metadata[name];
      if (meta?.once) {
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
      }
      layer = { action, weight: 0, target: 0 };
      this.layers.set(name, layer);
    }
    return layer;
  }
  private setTargets(targets: Record<string, number>) {
    for (const [name, layer] of this.layers) layer.target = targets[name] ?? 0;
    for (const [name, weight] of Object.entries(targets)) {
      const layer = this.layer(name);
      if (layer) layer.target = weight;
    }
  }

  /** Outfit colours for a pose: sleepwear in bed, a towel in the shower, work clothes at a desk. */
  private colours(pose: CharacterPose): OutfitColours {
    const wardrobe = (this.look as WardrobeLook).outfits,
      cut = cutOf(this.look.style);
    // Showering: wrapped in a towel (a bare chest for men), barefoot.
    if (pose === "Shower")
      return outfitColours(
        this.sex === "f" ? "#f4f1ea" : this.look.skin,
        "#f4f1ea",
        this.look.skin,
        "casual",
      );
    const outfit =
      wardrobe?.[
        LYING.has(pose) ? "sleep" : pose === "Type" ? "work" : "everyday"
      ];
    const o = outfit ?? (LYING.has(pose) ? { ...this.look, top: this.pyjamas } : this.look);
    return outfitColours(o.top, o.bottom, LYING.has(pose) ? this.look.skin : o.shoeColor, cut);
  }
  private applyOutfit(colours: OutfitColours) {
    const key = SLOTS.map((s) => colours[s]).join("");
    if (key === this.outfitKey) return;
    this.outfitKey = key;
    const slot = this.clothGeometry.getAttribute("slot"),
      out = this.clothColours,
      table = SLOTS.map((s) => new THREE.Color(colours[s]));
    for (let i = 0; i < slot.count; i++) {
      const c = table[Math.round(slot.getX(i))] ?? table[0];
      out.setXYZ(i, c.r, c.g, c.b);
    }
    out.needsUpdate = true;
  }

  private bone(name: string) {
    return this.bones.get(name);
  }
  private bend(name: string, x: number, z = 0, y = 0) {
    const b = this.bones.get(name);
    if (!b) return;
    if (x) b.rotateX(x);
    if (z) b.rotateZ(z);
    if (y) b.rotateY(y);
  }

  update(dt: number, input: ActorInput) {
    dt = Math.min(dt * timeWarp, 0.1 * timeWarp);
    this.time += dt;
    const pose = input.pose,
      // Turn rate from the parent's facing, for turn-in-place steps.
      world = this.root.getWorldQuaternion(this.scratch.q);
    const turn = this.yaw.angleTo(world) / Math.max(dt, 1e-3);
    this.turnRate += (turn - this.turnRate) * (1 - Math.exp(-dt * 10));
    this.yaw.copy(world);
    this.applyOutfit(this.colours(pose));
    const forward = this.scratch.c.set(0, 0, 1).applyQuaternion(world),
      heading = Math.atan2(forward.x, forward.z);

    const speed = input.speed,
      moving =
        speed > 0.12 ||
        ((pose === "Walk" || pose === "Run" || pose === "Jog") && speed > 0.04),
      seatedPose = SEATED_POSES.has(pose),
      lying = LYING.has(pose),
      activity = !moving && !LOCOMOTION.has(pose);
    if (activity) {
      const clipName =
        pose === "Dance"
          ? this.personality.dance
          : (CLIP_FOR[pose] ?? (this.clip(pose) ? pose : "Interact"));
      if (seatedPose && !this.seated && input.hip !== undefined) {
        this.seated = true;
        const enter = this.layer("SitDown");
        if (enter && this.mode === "move") {
          this.mode = "enter";
          enter.action.reset().play();
          this.enterUntil = this.time + enter.action.getClip().duration - 0.3;
        }
      }
      if (!seatedPose) this.seated = false;
      if (this.mode === "enter" && (!seatedPose || this.time >= this.enterUntil))
        this.mode = "act";
      if (this.mode !== "enter" && (clipName !== this.activityClip || this.mode !== "act")) {
        const layer = this.layer(clipName);
        if (layer) {
          layer.action.reset().play();
          if (input.startedAt && !this.library.metadata[clipName]?.once)
            layer.action.time =
              (Math.max(0, input.now - input.startedAt) / 1000) %
              layer.action.getClip().duration;
        }
        this.mode = "act";
        this.activityClip = clipName;
      }
      this.setTargets(
        this.mode === "enter" ? { SitDown: 1 } : { [this.activityClip]: 1 },
      );
    } else {
      if (this.seated && !moving) {
        const up = this.layer("StandUp");
        if (up) {
          up.action.reset().play();
          this.mode = "leave";
          this.enterUntil = this.time + up.action.getClip().duration - 0.3;
        }
      }
      this.seated = false;
      if (this.mode !== "leave" || moving || this.time >= this.enterUntil)
        this.mode = "move";
      if (this.mode === "leave") this.setTargets({ StandUp: 1 });
      else this.locomotion(speed, moving);
      this.activityClip = "";
    }

    // Blend weights toward their targets.
    const rate = 1 - Math.exp(-dt * (this.mode === "move" ? 7 : 5));
    for (const [name, layer] of this.layers) {
      layer.weight += (layer.target - layer.weight) * rate;
      if (layer.target === 0 && layer.weight < 0.01) {
        layer.weight = 0;
        if (layer.action.enabled && layer.action.isScheduled()) layer.action.stop();
        continue;
      }
      if (!layer.action.isScheduled()) {
        layer.action.play();
        // Crowds never march in step: each person starts loops at their own phase.
        if (!this.library.metadata[name]?.once)
          layer.action.time =
            (this.personality.phase * 0.37) % layer.action.getClip().duration;
      }
      layer.action.setEffectiveWeight(layer.weight);
    }

    // Restore overlay bones so procedural bends never accumulate.
    for (let i = 0; i < this.overlay.length; i++)
      this.overlay[i].quaternion.copy(this.overlayRest[i]);
    this.mixer.update(dt);
    for (let i = 0; i < this.overlay.length; i++)
      this.overlayRest[i].copy(this.overlay[i].quaternion);
    this.overlays(pose, input, moving);
    this.shape();
    this.root.userData.animation = {
      mode: this.mode,
      clip: this.activityClip,
      layers: [...this.layers]
        .filter(([, l]) => l.weight > 0)
        .map(([n, l]) => n + ":" + l.weight.toFixed(2) + "@" + l.action.time.toFixed(2)),
    };
    this.plantFeet(heading, pose === "Idle" && !moving && this.mode === "move", dt);
    this.lookToward(input.lookAt, pose, moving, dt);
    this.anchorHip(pose, input, dt);
    this.updateProps(pose);
    this.blink(lying);
  }

  private locomotion(speed: number, moving: boolean) {
    const { walk, jog, run } = this.speeds,
      p = this.personality,
      targets: Record<string, number> = {};
    if (!moving) {
      // Idle variety: every so often settle into another of this person's idles.
      if (this.time >= this.idleSwapAt) {
        this.idleSwapAt = this.time + 9 + this.random() * 10;
        const pool = p.idles.filter((name) => name !== p.idle && this.clip(name));
        if (pool.length) p.idle = pool[Math.floor(this.random() * pool.length)];
      }
      targets[p.idle] = 1;
      // Turning on the spot: one short step while the planted feet catch up with the body.
      if (this.time < this.stepUntil) {
        targets[p.idle] = 0.45;
        targets[p.walk] = 0.55;
        const layer = this.layer(p.walk);
        if (layer) layer.action.timeScale = 1;
      }
      this.setTargets(targets);
      return;
    }
    const runClip = this.sex === "f" ? "RunF" : "Run",
      walkTop = walk * 1.3,
      jogStart = Math.max(walkTop, jog * 0.7),
      runStart = Math.max(jog * 1.25, run * 0.75);
    if (speed <= walkTop) {
      const w = THREE.MathUtils.clamp(speed / 0.5, 0, 1);
      targets[p.walk] = w;
      if (w < 1) targets[p.idle] = 1 - w;
    } else if (speed <= jogStart + 0.6) {
      const w = THREE.MathUtils.clamp((speed - walkTop) / 0.6, 0, 1);
      targets[p.walk] = 1 - w;
      targets.Jog = w;
    } else if (speed <= runStart) {
      targets.Jog = 1;
    } else {
      const w = THREE.MathUtils.clamp((speed - runStart) / 0.8, 0, 1);
      targets.Jog = 1 - w;
      targets[runClip] = w;
    }
    // Match cadence to ground speed so feet stay planted.
    const scale = (name: string, natural: number, lo: number, hi: number) => {
      const layer = this.layer(name);
      if (layer) layer.action.timeScale = THREE.MathUtils.clamp(speed / natural, lo, hi);
    };
    scale(p.walk, walk, 0.55, 1.45);
    scale("Jog", jog, 0.6, 1.5);
    scale(runClip, run, 0.6, 1.7);
    this.setTargets(targets);
  }

  private overlays(pose: CharacterPose, input: ActorInput, moving: boolean) {
    const t = this.time,
      upright = !SEATED_POSES.has(pose) && !LYING.has(pose);
    if (input.tired && upright) {
      this.bend("Abdomen", 0.14);
      this.bend("Chest", 0.1);
      this.bend("Neck", 0.12);
    }
    if (input.hungry && upright && !moving && pose === "Idle") {
      this.bend("UpperArmL", -0.55, 0.3);
      this.bend("LowerArmL", -1.1);
      this.bend("Abdomen", 0.06);
    }
    if (moving) return;
    switch (pose) {
      case "Shower": {
        // Hands work shampoo through the hair, head tipped back a little.
        this.bend("Neck", -0.12 + Math.sin(t * 1.3) * 0.05);
        const top = this.headTop(this.scratch.a).y,
          s = Math.sin(t * 6) * 0.03,
          c = Math.cos(t * 6) * 0.03;
        this.reach("L", 0.075 + s, top - 0.09 + c, -0.01, 1, 0.3, -0.4);
        this.reach("R", -0.075 - s, top - 0.09 - c, -0.01, -1, 0.3, -0.4);
        break;
      }
      case "Cook": {
        // Right hand stirs the pot in small circles; left hand steadies the handle.
        this.bend("Abdomen", 0.06);
        this.bend("Neck", 0.3);
        this.reach("R", POT.x - 0.02 + Math.cos(t * 4.5) * 0.045, POT.y + 0.16, POT.z - 0.03 + Math.sin(t * 4.5) * 0.045, -0.6, -1, -0.4);
        this.reach("L", POT.x + 0.2, POT.y + 0.05, POT.z, 0.8, -1, -0.3);
        break;
      }
      case "Photo":
        this.reach("L", 0.06, 1.48, 0.32, 0.6, -1, -0.2);
        this.reach("R", -0.06, 1.48, 0.32, -0.6, -1, -0.2);
        break;
      case "Read":
        this.bend("Neck", 0.3);
        this.reach("L", 0.08, 1.12, 0.3, 0.6, -1, -0.3);
        this.reach("R", -0.08, 1.12, 0.3, -0.6, -1, -0.3);
        break;
      case "Play":
        // A guitar-sized strum: left hand on the neck, right hand brushing the strings.
        this.reach("L", 0.3, 1.22, 0.22, 0.6, -1, -0.3);
        this.reach("R", -0.05, 1.0 + Math.sin(t * 9) * 0.05, 0.2, -0.6, -1, -0.3);
        break;
      case "Browse":
      case "Listen":
        this.bend("Neck", Math.sin(t * 0.8) * 0.08, Math.sin(t * 0.5) * 0.1);
        break;
      default:
        if (pose === "Idle") {
          // A slow weight shift from foot to foot, the head staying level.
          const shift = Math.sin(t * 0.42 + this.personality.phase) * 0.6 + Math.sin(t * 0.17) * 0.4;
          this.bend("Abdomen", 0, shift * 0.035);
          this.bend("Chest", 0, shift * 0.02);
          this.bend("Neck", Math.sin(t * 0.55) * 0.025, Math.sin(t * 0.3) * 0.035 - shift * 0.04);
        }
    }
    void input;
  }

  /**
   * Two-bone arm IK toward a point in the actor's own frame (x left, y up, z forward).
   * The pole (px, py, pz) says where the elbow should point.
   */
  private reach(
    side: "L" | "R",
    x: number,
    y: number,
    z: number,
    px: number,
    py: number,
    pz: number,
  ) {
    const upper = this.bones.get("UpperArm" + side),
      lower = this.bones.get("LowerArm" + side),
      wrist = this.bones.get("Wrist" + side);
    if (!upper || !lower || !wrist || !upper.parent || !lower.parent) return;
    const { a: S, b: E, c: H } = this.scratch,
      T = this.ikTarget.set(x, y, z),
      pole = this.ikPole.set(px, py, pz);
    this.root.updateMatrixWorld(true);
    this.root.localToWorld(T);
    pole.transformDirection(this.root.matrixWorld);
    upper.getWorldPosition(S);
    lower.getWorldPosition(E);
    wrist.getWorldPosition(H);
    const la = S.distanceTo(E),
      lb = E.distanceTo(H),
      dir = this.ikDir.subVectors(T, S),
      d = THREE.MathUtils.clamp(dir.length(), Math.abs(la - lb) + 1e-3, la + lb - 1e-3);
    dir.normalize();
    const cosA = THREE.MathUtils.clamp((la * la + d * d - lb * lb) / (2 * la * d), -1, 1),
      bend = pole.sub(this.ikTmp.copy(dir).multiplyScalar(pole.dot(dir))).normalize(),
      elbow = this.ikTmp
        .copy(S)
        .addScaledVector(dir, la * cosA)
        .addScaledVector(bend, la * Math.sqrt(1 - cosA * cosA));
    const u = this.ikU,
      v = this.ikV,
      parent = this.ikQ;
    const rotate = (bone: THREE.Bone, from: THREE.Vector3, to: THREE.Vector3, origin: THREE.Vector3) => {
      const q = this.scratch.q2.setFromUnitVectors(
        u.subVectors(from, origin).normalize(),
        v.subVectors(to, origin).normalize(),
      );
      const world = bone.getWorldQuaternion(this.scratch.q).premultiply(q);
      bone.parent!.getWorldQuaternion(parent).invert();
      bone.quaternion.copy(parent.multiply(world));
      bone.updateMatrixWorld(true);
    };
    rotate(upper, E, elbow, S);
    lower.getWorldPosition(E);
    wrist.getWorldPosition(H);
    rotate(lower, H, T, E);
  }

  private anchorHip(pose: CharacterPose, input: ActorInput, dt: number) {
    const meta =
        this.library.metadata[
          this.mode === "enter" || this.mode === "leave"
            ? "Sit"
            : this.activityClip && this.library.metadata[this.activityClip]
              ? this.activityClip
              : SEATED_POSES.has(pose)
                ? "Sit"
                : "Lie"
        ],
      target = this.scratch.c.set(0, 0, 0);
    if (input.hip !== undefined && meta && (SEATED_POSES.has(pose) || LYING.has(pose) || this.mode === "act")) {
      const s = this.scale;
      target.set(-meta.hip[0] * s, input.hip - meta.hip[1] * s, -meta.hip[2] * s);
    } else if (pose === "Cook" && this.mode === "act") target.z = COOK_STEP;
    this.anchor.position.lerp(
      target,
      1 - Math.exp(-dt * (this.mode === "enter" ? 2.5 : 10)),
    );
    // A wider, softer contact when seated or lying.
    const spread = LYING.has(pose) ? 2.1 : SEATED_POSES.has(pose) ? 1.5 : 1.05;
    this.blob.scale.x += (spread - this.blob.scale.x) * 0.2;
    this.blob.scale.z += ((LYING.has(pose) ? 1.6 : spread) - this.blob.scale.z) * 0.2;
  }

  private prop(name: PropName) {
    let object = this.props[name];
    if (!object) {
      if (name === "pot") {
        const pot = new THREE.Group(),
          body = new THREE.Mesh(shared.potGeometry, propMaterial("#3a4248", 0.4, 0.4)),
          soup = new THREE.Mesh(shared.soupGeometry, propMaterial("#d9a441", 0.5));
        soup.position.y = 0.05;
        pot.add(body, soup);
        object = pot;
      } else if (name === "spoon")
        object = new THREE.Mesh(shared.spoonGeometry, propMaterial("#8a6a48", 0.7));
      else if (name === "phone")
        object = new THREE.Mesh(shared.phoneGeometry, propMaterial("#22262b", 0.3, 0.2));
      else if (name === "book")
        object = new THREE.Mesh(shared.bookGeometry, propMaterial("#b8503f", 0.7));
      else if (name === "guitar") {
        const guitar = new THREE.Group(),
          body = new THREE.Mesh(shared.guitarBody, propMaterial("#c98a4b", 0.5)),
          neck = new THREE.Mesh(shared.guitarNeck, propMaterial("#5a3b26", 0.6));
        body.scale.set(1, 1.15, 1);
        neck.position.set(0, 0.36, 0);
        guitar.add(body, neck);
        object = guitar;
      }
      else {
        const colour = PASTELS[Math.floor(this.random() * PASTELS.length)];
        object = new THREE.Mesh(shared.blanketGeometry, propMaterial(colour, 0.9));
        object.castShadow = true;
        object.receiveShadow = true;
      }
      object.name = "character-" + name;
      object.raycast = () => {};
      if (!this.castsShadow && object instanceof THREE.Mesh) object.castShadow = false;
      this.root.add(object);
      this.props[name] = object;
    }
    return object;
  }

  private updateProps(pose: CharacterPose) {
    const { a, b, c } = this.scratch,
      cooking = pose === "Cook",
      lying = LYING.has(pose),
      phone = pose === "Phone",
      reading = pose === "Read",
      playing = pose === "Play";
    for (const [name, object] of Object.entries(this.props))
      object.visible =
        (cooking && (name === "pot" || name === "spoon")) ||
        (lying && name === "blanket") ||
        (phone && name === "phone") ||
        (reading && name === "book") ||
        (playing && name === "guitar");
    if (!cooking && !lying && !phone && !reading && !playing) return;
    this.root.updateMatrixWorld(true);
    const local = (bone: string, out: THREE.Vector3) => {
      const b = this.bones.get(bone);
      if (!b) return out.set(0, 0, 0);
      b.getWorldPosition(out);
      return this.root.worldToLocal(out);
    };
    if (cooking) {
      // The pot sits on the hob in front; the spoon runs from the right hand into it.
      const pot = this.prop("pot"),
        spoon = this.prop("spoon");
      pot.position.copy(POT);
      local("WristR", a);
      b.set(
        POT.x + Math.cos(this.time * 4.5) * 0.04,
        POT.y + 0.04,
        POT.z + Math.sin(this.time * 4.5) * 0.04,
      );
      c.subVectors(a, b);
      spoon.position.copy(b);
      spoon.scale.set(1, c.length() + 0.04, 1);
      spoon.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), c.normalize());
    }
    if (reading) {
      const book = this.prop("book");
      local("WristL", a);
      local("WristR", b);
      book.position.addVectors(a, b).multiplyScalar(0.5);
      book.position.y += 0.04;
      book.rotation.set(-0.5, 0, 0);
    }
    if (playing) {
      // Held across the body, neck toward the left hand.
      const guitar = this.prop("guitar");
      guitar.position.set(0.02, 1.02, 0.17);
      guitar.rotation.set(0, 0, -1.05);
    }
    if (phone) {
      const p = this.prop("phone");
      local("WristR", p.position);
      p.position.y += 0.03;
    }
    if (lying) {
      // A duvet from the feet to the chest, following wherever the body lies.
      const blanket = this.prop("blanket");
      local("Chest", a);
      local("FootL", b);
      local("FootR", c);
      const feetTop = Math.max(b.y, c.y) + 0.1;
      b.add(c).multiplyScalar(0.5);
      const length = a.distanceTo(b) + 0.4,
        mid = c.addVectors(a, b).multiplyScalar(0.5);
      blanket.position.set(mid.x, Math.max(a.y + 0.05, feetTop), mid.z);
      blanket.scale.set(0.78, 0.24, length);
      blanket.rotation.set(0, Math.atan2(a.x - b.x, a.z - b.z), 0);
    }
  }

  private blink(asleep: boolean) {
    if (!this.face) return;
    const u = this.face.material.userData.blink as { value: number };
    if (asleep) {
      u.value = 1;
      return;
    }
    if (this.time >= this.nextBlink) {
      this.blinkUntil = this.time + 0.13;
      this.nextBlink = this.time + 2.5 + this.random() * 3.5;
    }
    u.value = this.time < this.blinkUntil ? 1 : 0;
  }

  /** Friendlier proportions and per-person build, re-applied after the mixer each frame. */
  private shape() {
    const head = this.bone("Head"),
      p = this.personality;
    if (head) head.scale.setScalar(1.06);
    for (const w of ["WristL", "WristR"]) this.bone(w)?.scale.setScalar(1.08);
    const chest = this.bone("Chest");
    if (chest) chest.scale.set(p.build, 1, p.build);
    const hips = this.bone("Hips");
    if (hips) hips.scale.set(p.hips, 1, p.hips);
  }

  /** Eyes open and no blink due for a while (for still pictures). */
  openEyes() {
    this.nextBlink = this.time + 10;
    this.blinkUntil = 0;
    if (this.face) (this.face.material.userData.blink as { value: number }).value = 0;
  }

  /**
   * Whether this person is drawn into the sun's shadow map. Far people keep their
   * contact blob and still receive shadows; only their own cast is dropped, which
   * is the largest single cost of a shadow refresh in a busy street.
   */
  setCastShadow(on: boolean) {
    if (on === this.castsShadow) return;
    this.castsShadow = on;
    for (const mesh of this.casters) mesh.castShadow = on;
    for (const object of Object.values(this.props))
      if (object instanceof THREE.Mesh) object.castShadow = on;
  }

  /**
   * Turns a bone about the character's own up (yaw) and side (pitch, positive looks down) axes,
   * independent of how the rig orients its bones.
   */
  private turnBone(name: string, yaw: number, pitch: number) {
    const bone = this.bones.get(name);
    if (!bone?.parent || (!yaw && !pitch)) return;
    const parent = bone.parent.getWorldQuaternion(this.scratch.q3),
      body = this.root.getWorldQuaternion(this.scratch.q4),
      axis = this.scratch.b;
    const delta = this.scratch.q2.setFromAxisAngle(axis.set(0, 1, 0).applyQuaternion(body), yaw);
    delta.multiply(this.scratch.q.setFromAxisAngle(axis.set(1, 0, 0).applyQuaternion(body), pitch));
    // local' = parent^-1 * delta * parent * local
    delta.premultiply(this.scratch.q.copy(parent).invert()).multiply(parent);
    bone.quaternion.premultiply(delta);
  }

  /**
   * Standing still, the feet stay where they are while the parent turns: the body lags behind,
   * the upper body twists toward the new heading, and one short step catches the feet up.
   */
  private plantFeet(heading: number, standing: boolean, dt: number) {
    if (!standing || Number.isNaN(this.footYaw)) this.footYaw = heading;
    let lag = Math.atan2(Math.sin(this.footYaw - heading), Math.cos(this.footYaw - heading));
    // A big turn steps at once; a small leftover settles once the parent has stopped turning.
    if (
      this.time >= this.stepUntil &&
      (Math.abs(lag) > 0.55 || (Math.abs(lag) > 0.3 && this.turnRate < 0.2))
    )
      this.stepUntil = this.time + 0.45;
    if (this.time < this.stepUntil) {
      lag *= Math.exp(-dt * 9);
      this.footYaw = heading + lag;
    }
    this.anchor.rotation.y = lag;
    if (lag) {
      this.turnBone("Abdomen", -lag * 0.2, 0);
      this.turnBone("Chest", -lag * 0.25, 0);
      this.turnBone("Neck", -lag * 0.3, 0);
    }
  }

  /** Eases the head toward a nearby person, within what a neck can comfortably turn. */
  private lookToward(at: THREE.Vector3 | undefined, pose: CharacterPose, moving: boolean, dt: number) {
    const free = !LYING.has(pose) && (moving || pose === "Idle" || pose === "Talk" || pose === "Wave" || pose === "Listen" || SEATED_POSES.has(pose));
    let yaw = 0,
      pitch = 0,
      want = 0;
    if (at && free) {
      const local = this.root.worldToLocal(this.scratch.a.copy(at)),
        eye = this.headTop(this.scratch.b).y - 0.17;
      yaw = Math.atan2(local.x, local.z);
      pitch = -Math.atan2(local.y - eye, Math.hypot(local.x, local.z));
      if (Math.abs(yaw) < 1.6) want = 1;
      yaw = THREE.MathUtils.clamp(yaw, -1.05, 1.05);
      pitch = THREE.MathUtils.clamp(pitch, -0.35, 0.45);
    }
    const ease = 1 - Math.exp(-dt * 4);
    this.lookWeight += (want - this.lookWeight) * ease;
    if (want) {
      this.lookYaw += (yaw - this.lookYaw) * ease;
      this.lookPitch += (pitch - this.lookPitch) * ease;
    }
    const w = this.lookWeight * (moving ? 0.6 : 1);
    if (w < 0.01) return;
    this.turnBone("Neck", this.lookYaw * w * 0.45, this.lookPitch * w * 0.4);
    this.turnBone("Head", this.lookYaw * w * 0.45, this.lookPitch * w * 0.6);
  }

  /** Top of the head in the actor's own frame (for markers and labels). */
  headTop(out: THREE.Vector3) {
    const head = this.bones.get("Head");
    if (!head) return out.set(0, 1.8, 0);
    head.getWorldPosition(out);
    this.root.worldToLocal(out);
    out.y += 0.27;
    return out;
  }

  dispose() {
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.mixer.getRoot());
    this.face?.material.dispose();
    this.face?.release();
    this.face = undefined;
    this.clothGeometry.dispose();
    this.skeleton.dispose();
    this.root.removeFromParent();
  }
}
