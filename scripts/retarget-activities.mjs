// CC0 mesh2motion clips retargeted onto the shipped Quaternius character skeleton; original GLBs stay untouched.
// Usage: node scripts/retarget-activities.mjs [--only=Sit,Sleep]   (run from the repository root)
import fs from "node:fs";
import path from "node:path";
import * as THREE from "../frontend/node_modules/three/build/three.module.js";
import { GLTFLoader } from "../frontend/node_modules/three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "../frontend/node_modules/three/examples/jsm/libs/meshopt_decoder.module.js";

function withoutTextures(file) {
  const b = fs.readFileSync(file),
    length = b.readUInt32LE(12),
    json = JSON.parse(b.subarray(20, 20 + length).toString()),
    bin = b.subarray(20 + length);
  delete json.images;
  delete json.textures;
  delete json.samplers;
  delete json.materials;
  for (const m of json.meshes ?? [])
    for (const p of m.primitives) delete p.material;
  const raw = Buffer.from(JSON.stringify(json)),
    padding = (4 - (raw.length % 4)) % 4,
    j = Buffer.concat([raw, Buffer.alloc(padding, 32)]),
    header = Buffer.alloc(20);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(20 + j.length + bin.length, 8);
  header.writeUInt32LE(j.length, 12);
  header.writeUInt32LE(0x4e4f534a, 16);
  const result = Buffer.concat([header, j, bin]);
  return result.buffer.slice(
    result.byteOffset,
    result.byteOffset + result.byteLength,
  );
}
async function load(file) {
  return new Promise((resolve, reject) =>
    new GLTFLoader()
      .setMeshoptDecoder(MeshoptDecoder)
      .parse(withoutTextures(file), "", resolve, reject),
  );
}
const target = await load("frontend/public/models/chars/f_casual.glb");
if (process.argv.includes("--inspect")) {
  target.scene.updateMatrixWorld(true);
  const rig = [];
  target.scene.traverse((o) => {
    if (
      o instanceof THREE.Bone &&
      [
        "Root",
        "Body",
        "Hips",
        "Abdomen",
        "Chest",
        "Head",
        "UpperArmL",
        "UpperLegL",
        "FootL",
      ].includes(o.name)
    )
      rig.push({
        name: o.name,
        local: o.position.toArray(),
        world: o.getWorldPosition(new THREE.Vector3()).toArray(),
      });
  });
  const bounds = new THREE.Box3().setFromObject(target.scene);
  console.log("target", bounds.min.toArray(), bounds.max.toArray(), rig);
  let skin;
  target.scene.traverse((o) => {
    if (o.isSkinnedMesh) skin = o;
  });
  console.log(
    "bind",
    skin.skeleton.bones
      .slice(0, 9)
      .map((b, i) => ({
        name: b.name,
        bind: new THREE.Vector3()
          .setFromMatrixPosition(skin.skeleton.boneInverses[i].clone().invert())
          .toArray(),
      })),
  );
  const basis = new THREE.Matrix4().multiplyMatrices(
    skin.skeleton.bones[0].matrixWorld,
    skin.skeleton.boneInverses[0],
  );
  console.log(
    "recovered rest",
    skin.skeleton.bones
      .slice(0, 14)
      .map((b, i) => ({
        name: b.name,
        world: new THREE.Vector3()
          .setFromMatrixPosition(
            basis
              .clone()
              .multiply(skin.skeleton.boneInverses[i].clone().invert()),
          )
          .toArray(),
      })),
  );
  const mixer = new THREE.AnimationMixer(target.scene);
  mixer
    .clipAction(target.animations.find((a) => a.name.endsWith("|Idle")))
    .play();
  mixer.update(0.01);
  target.scene.updateMatrixWorld(true);
  console.log(
    "idle",
    rig.map((r) => ({
      name: r.name,
      world: target.scene
        .getObjectByName(r.name)
        .getWorldPosition(new THREE.Vector3())
        .toArray(),
    })),
  );
  process.exit(0);
}

// mesh2motion human animation libraries (CC0), fetched into .runtime/mesh2motion (see docs/credits.md).
const sources = await Promise.all([
  load(".runtime/mesh2motion/human-base-animations.glb"),
  load(".runtime/mesh2motion/human-addon-animations.glb"),
]);
const canon = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
function skeleton(gltf) {
  let found;
  gltf.scene.traverse((o) => {
    if (
      o.isSkinnedMesh &&
      (!found || o.skeleton.bones.length > found.bones.length)
    )
      found = o.skeleton;
  });
  return found;
}
function rest(gltf) {
  gltf.scene.updateMatrixWorld(true);
  const s = skeleton(gltf),
    basis = s.bones[0].matrixWorld.clone().multiply(s.boneInverses[0]),
    map = new Map();
  s.bones.forEach((b, i) =>
    map.set(b.name, basis.clone().multiply(s.boneInverses[i].clone().invert())),
  );
  return map;
}
const sourceRests = sources.map(rest),
  sourceMixers = sources.map((g) => new THREE.AnimationMixer(g.scene)),
  sourceBones = sources.map(
    (g) => new Map(skeleton(g).bones.map((b) => [canon(b.name), b])),
  );
const maps = [
  {
    Body: "DEF-hips",
    Hips: "DEF-hips",
    Abdomen: "DEF-spine.001",
    Torso: "DEF-spine.002",
    Chest: "DEF-spine.003",
    Neck: "DEF-neck",
    Head: "DEF-head",
  },
  {
    Body: "pelvis",
    Hips: "pelvis",
    Abdomen: "spine_01",
    Torso: "spine_02",
    Chest: "spine_03",
    Neck: "neck_01",
    Head: "Head",
  },
];
for (const side of ["L", "R"]) {
  for (const [dst, src] of Object.entries({
    Shoulder: "shoulder",
    UpperArm: "upper_arm",
    LowerArm: "forearm",
    Wrist: "hand",
    UpperLeg: "thigh",
    LowerLeg: "shin",
    Foot: "foot",
  }))
    maps[0][dst + side] = "DEF-" + src + "." + side;
  for (const [dst, src] of Object.entries({
    Shoulder: "clavicle",
    UpperArm: "upperarm",
    LowerArm: "lowerarm",
    Wrist: "hand",
    UpperLeg: "thigh",
    LowerLeg: "calf",
    Foot: "foot",
  }))
    maps[1][dst + side] = src + "_" + side.toLowerCase();
  for (const [dst, src, src2] of [
    ["Index", "f_index", "index"],
    ["Middle", "f_middle", "middle"],
    ["Ring", "f_ring", "ring"],
    ["Pinky", "f_pinky", "pinky"],
    ["Thumb", "thumb", "thumb"],
  ])
    for (let i = 1; i <= 3; i++) {
      maps[0][dst + i + side] = "DEF-" + src + ".0" + i + "." + side;
      maps[1][dst + i + side] = src2 + "_0" + i + "_" + side.toLowerCase();
    }
}
// Both mesh2motion libraries share the Unreal-style rig, so one name map serves both.
maps[0] = maps[1];
function clipOf(library, name) {
  const clip = sources[library].animations.find((a) => a.name === name);
  if (!clip) throw Error(`Missing source clip ${name} in library ${library}`);
  return clip;
}
function sourcePose(library, clip, time) {
  const mixer = sourceMixers[library];
  mixer.stopAllAction();
  mixer.clipAction(clipOf(library, clip)).play();
  mixer.setTime(time);
  sources[library].scene.updateMatrixWorld(true);
  return sourceBones[library];
}
const BASE = 0,
  ADDON = 1;
// once: plays a single time and holds its last frame (LoopOnce + clampWhenFinished at runtime).
// seated: the lower body comes from Sitting_Idle so hips stay on the seat.
// freeze: a held pose sampled at `at` seconds.
const specs = [
  { name: "Sit", lib: BASE, clip: "Sitting_Idle" },
  { name: "SitDown", lib: BASE, clip: "Sitting_Enter", once: true },
  { name: "StandUp", lib: BASE, clip: "Sitting_Exit", once: true },
  { name: "SitTalk", lib: BASE, clip: "Sitting_Talking" },
  { name: "Talk", lib: BASE, clip: "Idle_Talking" },
  { name: "Phone", lib: BASE, clip: "Idle_TalkingPhone" },
  { name: "Listen", lib: ADDON, clip: "Idle Listening" },
  { name: "Nod", lib: ADDON, clip: "Head Nod", once: true },
  { name: "Yes", lib: BASE, clip: "Yes" },
  { name: "Greet", lib: ADDON, clip: "Greeting" },
  { name: "IdleSubtle", lib: ADDON, clip: "Idle_Subtle" },
  { name: "FoldArms", lib: BASE, clip: "Idle_FoldArms" },
  { name: "Jog", lib: BASE, clip: "Jog" },
  { name: "WalkF", lib: ADDON, clip: "Walk_Female" },
  { name: "RunF", lib: ADDON, clip: "Run_Female" },
  { name: "WalkFormal", lib: BASE, clip: "Walk_Formal" },
  { name: "Carry", lib: BASE, clip: "Walk_Carry" },
  { name: "Dance", lib: BASE, clip: "Dance_Simple" },
  { name: "Dance2", lib: ADDON, clip: "Dance Charleston" },
  { name: "Dance3", lib: ADDON, clip: "Dance Body Roll" },
  { name: "Dance4", lib: ADDON, clip: "Dance Reach Hip" },
  { name: "Cheer", lib: ADDON, clip: "Victory Fist Pump" },
  { name: "Celebrate", lib: ADDON, clip: "Victory" },
  { name: "Type", lib: BASE, clip: "Driving", seated: true, typing: true },
  { name: "Eat", lib: BASE, clip: "Consume", seated: true },
  { name: "Lie", lib: BASE, clip: "LayToIdle", freeze: true, at: 0 },
  { name: "Sleep", lib: ADDON, clip: "Sleeping" },
  { name: "PickUp", lib: BASE, clip: "PickUp_Table", once: true },
  { name: "Push", lib: BASE, clip: "Push" },
  { name: "Water", lib: BASE, clip: "Farm_Watering" },
  { name: "Fix", lib: BASE, clip: "Fixing_Kneeling" },
  { name: "Exercise", lib: ADDON, clip: "Jumping Jacks" },
  { name: "Yoga", lib: ADDON, clip: "Meditate" },
  { name: "Tired", lib: ADDON, clip: "Tired Hunched" },
  { name: "Cold", lib: ADDON, clip: "Shivering" },
  { name: "Confused", lib: ADDON, clip: "Confused" },
  { name: "Angry", lib: ADDON, clip: "Angry" },
  { name: "Bow", lib: ADDON, clip: "Bow", once: true },
  { name: "ShakeOff", lib: BASE, clip: "Idle_ShakeOff" },
  { name: "Interact2", lib: BASE, clip: "Interact" },
];
const only = process.argv.find((a) => a.startsWith("--only="))?.slice(7);
const SITTING = clipOf(BASE, "Sitting_Idle").duration;
const output = path.resolve("frontend/public/models/chars");
fs.mkdirSync(output, { recursive: true });
const RATE = 24;
for (const body of ["f", "m"]) {
  const g =
      body === "f"
        ? target
        : await load("frontend/public/models/chars/m_casual.glb"),
    skel = skeleton(g),
    base = rest(g),
    boneMap = new Map(skel.bones.map((b) => [b.name, b])),
    clips = [],
    metadata = {};
  const position = (m) => new THREE.Vector3().setFromMatrixPosition(m),
    rotation = (m) =>
      new THREE.Quaternion().setFromRotationMatrix(
        new THREE.Matrix4().extractRotation(m),
      );
  const restore = () => {
    for (const b of skel.bones) {
      const local = b.parent.matrixWorld
        .clone()
        .invert()
        .multiply(base.get(b.name));
      local.decompose(b.position, b.quaternion, b.scale);
      b.updateMatrixWorld(true);
    }
  };
  for (const spec of specs) {
    if (only && !only.split(",").includes(spec.name)) continue;
    const seconds = spec.freeze ? 1 : clipOf(spec.lib, spec.clip).duration,
      frameCount = Math.max(1, Math.round(seconds * RATE)),
      times = Array.from({ length: frameCount + 1 }, (_, i) =>
        Math.min(seconds, i / RATE),
      ),
      values = new Map(skel.bones.map((b) => [b.name, { q: [], p: [] }]));
    const ratio =
      (position(base.get("Body")).y - position(base.get("FootL")).y) /
      (position(
        sourceRests[spec.lib].get(
          sourceBones[spec.lib].get(canon(maps[spec.lib].Body)).name,
        ),
      ).y -
        position(
          sourceRests[spec.lib].get(
            sourceBones[spec.lib].get(canon(maps[spec.lib].FootL)).name,
          ),
        ).y);
    for (const time of times) {
      restore();
      // Seated lower bodies are sampled first and kept, because both samples share one mixer per library.
      const sampleAt = spec.freeze
        ? (spec.at ?? 0)
        : spec.once
          ? Math.min(time, seconds - 1e-4)
          : time % seconds;
      let sit = null,
        sitWorld = null;
      if (spec.seated) {
        sit = sourcePose(BASE, "Sitting_Idle", time % SITTING);
        sitWorld = new Map();
        for (const [key, bone] of sit)
          sitWorld.set(key, {
            q: bone.getWorldQuaternion(new THREE.Quaternion()),
            p: bone.getWorldPosition(new THREE.Vector3()),
            name: bone.name,
          });
      }
      const src = sourcePose(spec.lib, spec.clip, sampleAt);
      for (const bone of skel.bones) {
        if (bone.name === "Root" || bone.name.startsWith("PT")) continue;
        const lower = /^(Body|Hips|UpperLeg|LowerLeg|Foot)/.test(bone.name),
          useSit = spec.seated && lower,
          lib = useSit ? BASE : spec.lib,
          mapped = maps[lib][bone.name],
          key = mapped ? canon(mapped) : null,
          sb = key ? src.get(key) : null,
          sat = key && useSit ? sitWorld.get(key) : null;
        const restWorld = base.get(bone.name),
          qRest = rotation(restWorld);
        let q = qRest.clone(),
          at;
        if (sat || sb) {
          const sr = sourceRests[lib].get(sat ? sat.name : sb.name),
            world = sat
              ? sat.q.clone()
              : sb.getWorldQuaternion(new THREE.Quaternion()),
            delta = world.multiply(rotation(sr).invert());
          q = delta.multiply(qRest);
        }
        if (
          spec.typing &&
          /^(UpperArm|LowerArm|Wrist|Index|Middle|Ring|Pinky|Thumb)/.test(
            bone.name,
          )
        )
          q.premultiply(
            new THREE.Quaternion().setFromAxisAngle(
              new THREE.Vector3(1, 0, 0),
              0.45,
            ),
          );
        if (spec.typing && /^Wrist[LR]$/.test(bone.name))
          q.multiply(
            new THREE.Quaternion().setFromAxisAngle(
              new THREE.Vector3(1, 0, 0),
              Math.sin(time * 15 + (bone.name.endsWith("L") ? 0 : Math.PI)) *
                0.12,
            ),
          );
        if (spec.freeze && bone.name === "Abdomen")
          q.multiply(
            new THREE.Quaternion().setFromAxisAngle(
              new THREE.Vector3(1, 0, 0),
              Math.sin((time * Math.PI * 2) / seconds) * 0.012,
            ),
          );
        if (bone.name === "Body") {
          const sr = sourceRests[lib].get(sat ? sat.name : sb.name),
            delta = (sat ? sat.p.clone() : sb.getWorldPosition(new THREE.Vector3()))
              .sub(position(sr))
              .multiplyScalar(ratio);
          if (!spec.freeze && !spec.loose) {
            delta.x = THREE.MathUtils.clamp(delta.x, -0.12, 0.12);
            delta.z = THREE.MathUtils.clamp(delta.z, -0.12, 0.12);
          }
          at = position(restWorld).add(delta);
        } else {
          const parent = bone.name.startsWith("Foot")
            ? boneMap.get("LowerLeg" + bone.name.at(-1))
            : bone.parent;
          if (parent.isBone) {
            const localOffset = position(restWorld)
              .sub(position(base.get(parent.name)))
              .applyQuaternion(rotation(base.get(parent.name)).invert())
              .applyQuaternion(
                parent.getWorldQuaternion(new THREE.Quaternion()),
              );
            at = parent.getWorldPosition(new THREE.Vector3()).add(localOffset);
          } else at = position(restWorld);
        }
        const scale = new THREE.Vector3();
        restWorld.decompose(new THREE.Vector3(), new THREE.Quaternion(), scale);
        const world = new THREE.Matrix4().compose(at, q, scale),
          local = bone.parent.matrixWorld.clone().invert().multiply(world);
        local.decompose(bone.position, bone.quaternion, bone.scale);
        bone.updateMatrixWorld(true);
      }
      for (const bone of skel.bones) {
        values.get(bone.name).q.push(...bone.quaternion.toArray());
        values.get(bone.name).p.push(...bone.position.toArray());
      }
      if (time === 0) {
        const hip = boneMap.get("Body").getWorldPosition(new THREE.Vector3()),
          head = boneMap.get("Head").getWorldPosition(new THREE.Vector3());
        metadata[spec.name] = {
          hip: hip.toArray().map((v) => +v.toFixed(5)),
          head: head.toArray().map((v) => +v.toFixed(5)),
          duration: +times.at(-1).toFixed(5),
          once: !!spec.once,
          source: spec.clip,
        };
      }
    }
    clips.push({ name: spec.name, times, values });
  }
  writeBinary(body, clips, metadata);
}

/**
 * activities-<body>.bin: "MLA1", uint32 header length, JSON header, padding to 4 bytes,
 * then Int16 samples. Constant tracks are stored in the header only. Quaternions are
 * stored as value*32767; positions as value/scale with a per-track scale.
 */
function writeBinary(body, clips, metadata) {
  const samples = [],
    header = {
      licence: "CC0-1.0",
      source: "mesh2motion human base and addon animation libraries",
      sampleRate: RATE,
      metadata,
      clips: [],
    };
  for (const clip of clips) {
    const frames = clip.times.length,
      entry = {
        name: clip.name,
        duration: +clip.times.at(-1).toFixed(5),
        frames,
        tracks: [],
      };
    for (const [bone, v] of clip.values)
      for (const [kind, data, width] of [
        ["q", v.q, 4],
        ["p", v.p, 3],
      ]) {
        let varies = false;
        for (let f = 1; f < frames && !varies; f++)
          for (let c = 0; c < width; c++)
            if (Math.abs(data[f * width + c] - data[c]) > 2e-4) varies = true;
        if (!varies) {
          entry.tracks.push({
            bone,
            kind,
            constant: data.slice(0, width).map((x) => +x.toFixed(5)),
          });
          continue;
        }
        let scale = 1 / 32767;
        if (kind === "p")
          scale = Math.max(1e-6, ...data.map((x) => Math.abs(x))) / 32767;
        entry.tracks.push({
          bone,
          kind,
          offset: samples.length,
          scale: kind === "p" ? scale : undefined,
        });
        for (const x of data) samples.push(Math.round(x / scale));
      }
    header.clips.push(entry);
  }
  const json = Buffer.from(JSON.stringify(header)),
    pad = (4 - ((8 + json.length) % 4)) % 4,
    prefix = Buffer.alloc(8);
  prefix.write("MLA1", 0, "ascii");
  prefix.writeUInt32LE(json.length + pad, 4);
  const data = Buffer.from(new Int16Array(samples).buffer),
    file = path.join(output, `activities-${body}.bin`),
    temporary = file + ".tmp";
  fs.writeFileSync(
    temporary,
    Buffer.concat([prefix, json, Buffer.alloc(pad, 32), data]),
  );
  fs.renameSync(temporary, file);
  console.log("RETARGET", body, fs.statSync(file).size, Object.keys(metadata).length, "clips");
}
