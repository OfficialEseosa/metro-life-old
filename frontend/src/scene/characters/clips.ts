/** Activity clips baked by scripts/retarget-activities.mjs (binary, quantised). */
import * as THREE from "three";
import type { Sex } from "./kit";

export type ClipMeta = {
  hip: number[];
  head: number[];
  duration: number;
  once: boolean;
  source: string;
};
export type ActivityLibrary = {
  clips: Map<string, THREE.AnimationClip>;
  metadata: Record<string, ClipMeta>;
};
type Header = {
  sampleRate: number;
  metadata: Record<string, ClipMeta>;
  clips: {
    name: string;
    duration: number;
    frames: number;
    tracks: {
      bone: string;
      kind: "q" | "p";
      constant?: number[];
      offset?: number;
      scale?: number;
    }[];
  }[];
};

function parse(buffer: ArrayBuffer, rate?: number): ActivityLibrary {
  const view = new DataView(buffer),
    magic = String.fromCharCode(...new Uint8Array(buffer, 0, 4));
  if (magic !== "MLA1") throw Error("Unknown activity library format");
  const length = view.getUint32(4, true),
    header = JSON.parse(
      new TextDecoder().decode(new Uint8Array(buffer, 8, length)),
    ) as Header,
    data = new Int16Array(buffer, 8 + length),
    clips = new Map<string, THREE.AnimationClip>(),
    sampleRate = rate ?? header.sampleRate;
  for (const c of header.clips) {
    const times = new Float32Array(c.frames);
    for (let i = 0; i < c.frames; i++)
      times[i] = Math.min(c.duration, i / sampleRate);
    const tracks: THREE.KeyframeTrack[] = [];
    for (const t of c.tracks) {
      const width = t.kind === "q" ? 4 : 3,
        name = t.bone + (t.kind === "q" ? ".quaternion" : ".position");
      if (t.constant) {
        const values = new Float32Array(t.constant);
        tracks.push(
          t.kind === "q"
            ? new THREE.QuaternionKeyframeTrack(name, [0], values)
            : new THREE.VectorKeyframeTrack(name, [0], values),
        );
        continue;
      }
      const values = new Float32Array(c.frames * width),
        scale = t.kind === "q" ? 1 / 32767 : t.scale!;
      for (let i = 0; i < values.length; i++)
        values[i] = data[t.offset! + i] * scale;
      if (t.kind === "q")
        for (let f = 0; f < c.frames; f++) {
          const o = f * 4,
            len = Math.hypot(values[o], values[o + 1], values[o + 2], values[o + 3]) || 1;
          for (let k = 0; k < 4; k++) values[o + k] /= len;
        }
      tracks.push(
        t.kind === "q"
          ? new THREE.QuaternionKeyframeTrack(name, times, values)
          : new THREE.VectorKeyframeTrack(name, times, values),
      );
    }
    clips.set(c.name, new THREE.AnimationClip(c.name, c.duration, tracks));
  }
  return { clips, metadata: header.metadata };
}

const libraries = new Map<Sex, Promise<ActivityLibrary>>();
const ready = new Map<Sex, ActivityLibrary>();
export function loadActivities(sex: Sex) {
  let pending = libraries.get(sex);
  if (!pending) {
    pending = fetch(`/models/chars/activities-${sex}.bin`)
      .then((r) => {
        if (!r.ok) throw Error("Could not load character animations");
        return r.arrayBuffer();
      })
      .then((buffer) => {
        const library = parse(buffer);
        ready.set(sex, library);
        return library;
      });
    libraries.set(sex, pending);
    pending.catch(() => libraries.delete(sex));
  }
  return pending;
}
export function peekActivities(sex: Sex) {
  return ready.get(sex);
}
