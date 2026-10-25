/**
 * Hair library. Nine sculpted hairstyles come from the shipped heads and are refitted onto any
 * head of either sex; afro, curls, bun, ponytail and braids are built procedurally around the
 * same head frame. Every style ends up as one rest-world geometry skinned to the Head bone.
 */
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { rigidPiece, weldNormals, type Donor, type DonorKit } from "./kit";

/** Sculpted styles: donor file and the material name of its hair primitive. */
const SCULPTED: Record<string, readonly [Donor, string]> = {
  short: ["m_casual", "Hair"],
  bob: ["f_casual", "Hair_Blond"],
  long: ["f_party", "Red"],
  mohawk: ["m_street", "Red"],
  quiff: ["m_smart", "Hair"],
  spiky: ["m_party", "Hair"],
  messy: ["m_casual2", "Hair"],
  sideshave: ["f_street", "Pink"],
  tucked: ["f_work", "DarkBrown"],
};
/** Procedural styles may grow from a sculpted base. */
const BASES: Record<string, string> = {
  bun: "tucked",
  ponytail: "tucked",
  braids: "bob",
};
export const HAIR_STYLES = [
  "short",
  "bob",
  "long",
  "curly",
  "afro",
  "bun",
  "ponytail",
  "braids",
  "mohawk",
  "bald",
  "quiff",
  "spiky",
  "messy",
  "sideshave",
] as const;

export function hairDonors(style: string): Donor[] {
  const base = SCULPTED[style] ?? SCULPTED[BASES[style] ?? ""];
  return base ? [base[0]] : [];
}
/** Facial hair pieces available as accessories. */
const FACIAL: Record<string, readonly [Donor, string]> = {
  moustache: ["m_work", "Moustache"],
  stubble: ["m_street", "Red_Dark"],
};
export function facialDonors(kind: string | undefined): Donor[] {
  const entry = kind ? FACIAL[kind] : undefined;
  return entry ? [entry[0]] : [];
}

function anchorOf(box: THREE.Box3) {
  return new THREE.Vector3(
    (box.min.x + box.max.x) / 2,
    box.max.y,
    (box.min.z + box.max.z) / 2,
  );
}
/** Map a donor head's piece onto another head by matching skin bounds. */
function refit(
  geometry: THREE.BufferGeometry,
  from: DonorKit,
  to: DonorKit,
  inflate: number,
) {
  const out = geometry.clone(),
    p = out.getAttribute("position") as THREE.BufferAttribute,
    a = anchorOf(from.head.bounds),
    b = anchorOf(to.head.bounds),
    fs = from.head.bounds.getSize(new THREE.Vector3()),
    ts = to.head.bounds.getSize(new THREE.Vector3()),
    same = from.name === to.name,
    s = same
      ? new THREE.Vector3(1, 1, 1)
      : new THREE.Vector3(
          THREE.MathUtils.clamp(ts.x / fs.x, 0.85, 1.2) * inflate,
          THREE.MathUtils.clamp(ts.y / fs.y, 0.85, 1.2) * inflate,
          THREE.MathUtils.clamp(ts.z / fs.z, 0.85, 1.2) * inflate,
        ),
    v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).sub(a).multiply(s).add(b);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  return out;
}

/**
 * Head frame used by the procedural pieces: a unit head 0.28 wide and 0.22 deep whose eyes sit
 * at y 0.148 and crown at y 0.27, mapped onto the real head's eyes and crown.
 */
function headFrame(head: DonorKit) {
  const box = head.head.bounds,
    centre = box.getCenter(new THREE.Vector3()),
    size = box.getSize(new THREE.Vector3()),
    eyeY = (head.head.eyeLeft.y + head.head.eyeRight.y) / 2,
    sy = (box.max.y - eyeY) / (0.27 - 0.148);
  return new THREE.Matrix4().compose(
    new THREE.Vector3(centre.x, eyeY - 0.148 * sy, centre.z),
    new THREE.Quaternion(),
    new THREE.Vector3(size.x / 0.28, sy, size.z / 0.22),
  );
}

function proceduralPieces(style: string) {
  const parts: THREE.BufferGeometry[] = [];
  const ball = (
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    segments = 12,
  ) => {
    const g = new THREE.SphereGeometry(1, segments, Math.round(segments * 0.7));
    g.scale(sx, sy, sz);
    g.translate(x, y, z);
    parts.push(g.toNonIndexed());
    g.dispose();
  };
  // A scalp cap that follows the forehead and nape; the other shapes grow from it.
  const cap = (width: number, rise: number, depth: number) => {
    const points: number[] = [],
      rings = 9,
      segments = 24;
    const point = (ring: number, segment: number) => {
      const az = (segment / segments) * Math.PI * 2,
        edge = 1.28 + (1 - Math.sin(az)) * 0.38,
        theta = (ring / rings) * edge;
      return [
        Math.sin(theta) * Math.cos(az) * width,
        0.15 + Math.cos(theta) * rise,
        Math.sin(theta) * Math.sin(az) * depth - 0.008,
      ];
    };
    for (let ring = 0; ring < rings; ring++)
      for (let segment = 0; segment < segments; segment++) {
        const a = point(ring, segment),
          b = point(ring + 1, segment),
          c = point(ring + 1, segment + 1),
          d = point(ring, segment + 1);
        points.push(...a, ...c, ...b, ...a, ...d, ...c);
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
    parts.push(g);
  };
  if (style === "afro") {
    cap(0.152, 0.142, 0.124);
    // Puffs on a rounded shell above and behind the face; the face stays clear.
    const cy = 0.215,
      cz = -0.035;
    for (let ring = 0; ring < 6; ring++) {
      const polar = (ring / 5) * 1.9,
        count = Math.max(1, Math.round(Math.sin(polar) * 14));
      for (let i = 0; i < count; i++) {
        const az = (i / count) * Math.PI * 2 + ring * 0.35,
          x = Math.sin(polar) * Math.cos(az) * 0.165,
          y = cy + Math.cos(polar) * 0.13,
          z = cz + Math.sin(polar) * Math.sin(az) * 0.15;
        // Skip anything that would hang in front of the eyes or cheeks.
        if (z > 0.03 && y < 0.25) continue;
        ball(x, y, z, 0.062, 0.06, 0.058);
      }
    }
  }
  if (style === "curly") {
    cap(0.148, 0.138, 0.12);
    for (let row = 0; row < 3; row++)
      for (let i = 0; i < 10; i++) {
        const a = (i * Math.PI * 2) / 10 + row * 0.3;
        ball(
          Math.cos(a) * (0.112 - row * 0.03),
          0.215 + row * 0.03,
          Math.sin(a) * (0.09 - row * 0.022) - 0.015,
          0.045,
          0.047,
          0.042,
        );
      }
  }
  if (style === "bun") ball(0, 0.262, -0.088, 0.064, 0.062, 0.058);
  if (style === "ponytail") {
    ball(0, 0.2, -0.128, 0.05, 0.05, 0.05);
    for (let i = 0; i < 5; i++)
      ball(0, 0.165 - i * 0.04, -0.15 - i * 0.008, 0.036 - i * 0.003, 0.034, 0.034);
  }
  if (style === "braids")
    for (const x of [-0.128, 0.128])
      for (let i = 0; i < 6; i++)
        ball(x, 0.1 - i * 0.038, -0.02, 0.024, 0.026, 0.024, 8);
  return parts;
}

const cache = new Map<string, THREE.BufferGeometry | null>();
/**
 * Hair for one style on one head, in rest-world space, skinned to Head.
 * `donors` must contain every donor that `hairDonors(style)` lists.
 */
export function hairGeometry(
  style: string,
  head: DonorKit,
  donors: Map<Donor, DonorKit>,
): THREE.BufferGeometry | null {
  const key = style + "|" + head.name;
  if (cache.has(key)) return cache.get(key)!;
  const pieces: THREE.BufferGeometry[] = [],
    base = SCULPTED[style] ? style : BASES[style];
  if (base) {
    const [donorName, material] = SCULPTED[base],
      donor = donors.get(donorName),
      piece = donor?.pieces.find(
        (p) => p.part === "Head" && p.material === material,
      );
    if (donor && piece) {
      const g = refit(piece.geometry, donor, head, 1.04);
      pieces.push(rigidPiece(g, head.head.headBone));
      g.dispose();
    }
  }
  if (style !== "bald" && !SCULPTED[style]) {
    const frame = headFrame(head),
      parts = proceduralPieces(style);
    if (parts.length) {
      const merged = mergeGeometries(
        parts.map((p) => {
          p.deleteAttribute("uv");
          p.deleteAttribute("normal");
          return p;
        }),
        false,
      );
      parts.forEach((p) => p.dispose());
      if (merged) {
        merged.applyMatrix4(frame);
        merged.computeVertexNormals();
        pieces.push(rigidPiece(merged, head.head.headBone));
        merged.dispose();
      }
    }
  }
  let result: THREE.BufferGeometry | null = null;
  if (pieces.length) {
    result = pieces.length === 1 ? pieces[0] : mergeGeometries(pieces, false);
    if (pieces.length > 1) pieces.forEach((p) => p.dispose());
    if (result && base && SCULPTED[style]) weldNormals(result);
  }
  cache.set(key, result);
  return result;
}

const facialCache = new Map<string, THREE.BufferGeometry | null>();
export function facialGeometry(
  kind: string,
  head: DonorKit,
  donors: Map<Donor, DonorKit>,
) {
  const key = kind + "|" + head.name;
  if (facialCache.has(key)) return facialCache.get(key)!;
  const entry = FACIAL[kind];
  let result: THREE.BufferGeometry | null = null;
  if (entry) {
    const donor = donors.get(entry[0]),
      piece = donor?.pieces.find(
        (p) => p.part === "Head" && p.material === entry[1],
      );
    if (donor && piece) {
      const g = refit(piece.geometry, donor, head, 1.02);
      result = rigidPiece(g, head.head.headBone);
      g.dispose();
    }
  }
  facialCache.set(key, result);
  return result;
}
