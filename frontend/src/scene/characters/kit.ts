/* oxlint-disable react/immutability -- Geometry caches are imperative Three resources. */
/**
 * Character kit: loads the Quaternius Ultimate Modular bodies once, converts every primitive
 * into a shared "rest world" frame (Y up, +Z forward, metres) and exposes cached pieces that
 * any body of the same sex can wear. All 11 GLBs share one 62-joint rig, so pieces from
 * different files bind to the same skeleton.
 */
import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";

export type Sex = "f" | "m";
export const DONORS = [
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
] as const;
export type Donor = (typeof DONORS)[number];
export type PartName = "Head" | "Body" | "Legs" | "Feet";

/** One glTF primitive in rest-world space with standard attributes. */
export type Piece = {
  donor: Donor;
  part: PartName;
  material: string;
  geometry: THREE.BufferGeometry;
};
export type DonorKit = {
  name: Donor;
  sex: Sex;
  pieces: Piece[];
  /** Bone hierarchy template (bones plus their non-bone ancestors). */
  template: THREE.Object3D;
  boneNames: string[];
  /** Inverse bind matrices that map rest-world positions into joint space. */
  boneInverses: THREE.Matrix4[];
  animations: THREE.AnimationClip[];
  height: number;
  head: HeadInfo;
};
export type HeadInfo = {
  /** Head skin bounds in rest-world space. */
  bounds: THREE.Box3;
  eyeLeft: THREE.Vector3;
  eyeRight: THREE.Vector3;
  browY: number;
  headBone: number;
};

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const gltfs = new Map<string, Promise<GLTF>>();
export function loadGltf(url: string) {
  let pending = gltfs.get(url);
  if (!pending) {
    pending = loader.loadAsync(url);
    gltfs.set(url, pending);
    pending.catch(() => gltfs.delete(url));
  }
  return pending;
}

const kits = new Map<Donor, DonorKit>();
const kitPromises = new Map<Donor, Promise<DonorKit>>();
export function peekDonor(name: Donor) {
  return kits.get(name);
}
export function loadDonor(name: Donor): Promise<DonorKit> {
  let pending = kitPromises.get(name);
  if (!pending) {
    pending = loadGltf(`/models/chars/${name}.glb`).then((gltf) => {
      const kit = buildDonor(name, gltf);
      kits.set(name, kit);
      return kit;
    });
    kitPromises.set(name, pending);
    pending.catch(() => kitPromises.delete(name));
  }
  return pending;
}

function partOf(name: string): PartName {
  if (/Head/i.test(name)) return "Head";
  if (/Legs/i.test(name)) return "Legs";
  if (/Feet/i.test(name)) return "Feet";
  return "Body";
}

/** Copy a primitive into rest-world space as float attributes. */
function restPiece(mesh: THREE.SkinnedMesh, world: THREE.Matrix4) {
  const source = mesh.geometry,
    count = source.getAttribute("position").count,
    position = new Float32Array(count * 3),
    normal = new Float32Array(count * 3),
    skinIndex = new Uint16Array(count * 4),
    skinWeight = new Float32Array(count * 4),
    p = source.getAttribute("position"),
    n = source.getAttribute("normal"),
    si = source.getAttribute("skinIndex"),
    sw = source.getAttribute("skinWeight"),
    v = new THREE.Vector3(),
    normalMatrix = new THREE.Matrix3().getNormalMatrix(world);
  for (let i = 0; i < count; i++) {
    v.fromBufferAttribute(p, i).applyMatrix4(world).toArray(position, i * 3);
    if (n)
      v.fromBufferAttribute(n, i)
        .applyMatrix3(normalMatrix)
        .normalize()
        .toArray(normal, i * 3);
    let total = 0;
    for (let c = 0; c < 4; c++) {
      skinIndex[i * 4 + c] = si.getComponent(i, c);
      const w = sw.getComponent(i, c);
      skinWeight[i * 4 + c] = w;
      total += w;
    }
    if (total > 0)
      for (let c = 0; c < 4; c++) skinWeight[i * 4 + c] /= total;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(position, 3));
  geometry.setAttribute("normal", new THREE.BufferAttribute(normal, 3));
  geometry.setAttribute("skinIndex", new THREE.BufferAttribute(skinIndex, 4));
  geometry.setAttribute(
    "skinWeight",
    new THREE.BufferAttribute(skinWeight, 4),
  );
  const index = source.index;
  if (index) {
    const indices = new Uint32Array(index.count);
    for (let i = 0; i < index.count; i++) indices[i] = index.getX(i);
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  } else {
    const indices = new Uint32Array(count);
    for (let i = 0; i < count; i++) indices[i] = i;
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  }
  return geometry;
}

function cloneBones(source: THREE.Object3D): THREE.Object3D | null {
  let hasBone = false;
  source.traverse((o) => {
    if ((o as THREE.Bone).isBone) hasBone = true;
  });
  if (!hasBone) return null;
  const copy = (source as THREE.Bone).isBone
    ? new THREE.Bone()
    : new THREE.Object3D();
  copy.name = source.name;
  copy.position.copy(source.position);
  copy.quaternion.copy(source.quaternion);
  copy.scale.copy(source.scale);
  for (const child of source.children) {
    const c = cloneBones(child);
    if (c) copy.add(c);
  }
  return copy;
}

function boundsOf(geometries: THREE.BufferGeometry[]) {
  const box = new THREE.Box3(),
    v = new THREE.Vector3();
  for (const g of geometries) {
    const p = g.getAttribute("position");
    for (let i = 0; i < p.count; i++) box.expandByPoint(v.fromBufferAttribute(p, i));
  }
  return box;
}

function buildDonor(name: Donor, gltf: GLTF): DonorKit {
  const scene = gltf.scene;
  scene.updateMatrixWorld(true);
  const pieces: Piece[] = [];
  let skeleton: THREE.Skeleton | undefined,
    world: THREE.Matrix4 | undefined;
  // A skin's inverse bind matrix is only meaningful for joints that skin actually uses, so
  // each joint takes its bind from a primitive that it really deforms.
  const binds: (THREE.Matrix4 | undefined)[] = [];
  scene.traverse((o) => {
    if (!(o instanceof THREE.SkinnedMesh)) return;
    // Quantised primitives fold their dequantisation into the inverse bind matrices, so a
    // mesh's rest transform is rootBone.world x inverseBind(root), per primitive.
    const rest = o.skeleton.bones[0].matrixWorld
      .clone()
      .multiply(o.skeleton.boneInverses[0]);
    if (!skeleton || partOf(o.name + " " + (o.parent?.name ?? "")) === "Body") {
      skeleton = o.skeleton;
      world = rest.clone();
    }
    const restInverse = rest.clone().invert(),
      si = o.geometry.getAttribute("skinIndex"),
      sw = o.geometry.getAttribute("skinWeight");
    for (let i = 0; i < si.count; i++)
      for (let c = 0; c < 4; c++)
        if (sw.getComponent(i, c) > 0.05) {
          const joint = si.getComponent(i, c);
          binds[joint] ??= o.skeleton.boneInverses[joint]
            .clone()
            .multiply(restInverse);
        }
    const material = Array.isArray(o.material) ? o.material[0] : o.material;
    pieces.push({
      donor: name,
      part: partOf(o.name + " " + (o.parent?.name ?? "")),
      material: material.name,
      geometry: restPiece(o, rest),
    });
  });
  if (!skeleton || !world) throw Error("Character model has no skin: " + name);
  const worldInverse = world.clone().invert(),
    boneInverses = skeleton.boneInverses.map(
      (m, i) => binds[i] ?? m.clone().multiply(worldInverse),
    ),
    boneNames = skeleton.bones.map((b) => b.name),
    template = cloneBones(scene)!,
    bodyBox = boundsOf(pieces.map((p) => p.geometry)),
    headSkin = pieces.filter((p) => p.part === "Head" && /^Skin/.test(p.material)),
    bounds = boundsOf(headSkin.map((p) => p.geometry)),
    eyes = pieces.find(
      (p) =>
        p.part === "Head" &&
        (p.material === "Eye" || (name.startsWith("f_") && p.material === "Brown")),
    ),
    brows = pieces.find(
      (p) =>
        p.part === "Head" &&
        (p.material === "Eyebrows" || p.material === "Hair_Brown"),
    );
  const centre = bounds.getCenter(new THREE.Vector3()),
    eyeLeft = new THREE.Vector3(),
    eyeRight = new THREE.Vector3();
  if (eyes) {
    const p = eyes.geometry.getAttribute("position"),
      v = new THREE.Vector3();
    let l = 0,
      r = 0;
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      if (v.x > centre.x) {
        eyeLeft.add(v);
        l++;
      } else {
        eyeRight.add(v);
        r++;
      }
    }
    eyeLeft.divideScalar(Math.max(1, l));
    eyeRight.divideScalar(Math.max(1, r));
  } else {
    const size = bounds.getSize(new THREE.Vector3());
    eyeLeft.set(centre.x + size.x * 0.17, centre.y + size.y * 0.05, bounds.max.z);
    eyeRight.set(centre.x - size.x * 0.17, eyeLeft.y, eyeLeft.z);
  }
  const browY = brows
    ? boundsOf([brows.geometry]).getCenter(new THREE.Vector3()).y
    : eyeLeft.y + eyeLeft.distanceTo(eyeRight) * 0.35;
  return {
    name,
    sex: name.startsWith("f_") ? "f" : "m",
    pieces,
    template,
    boneNames,
    boneInverses,
    animations: gltf.animations,
    height: bodyBox.max.y - bodyBox.min.y,
    head: {
      bounds,
      eyeLeft,
      eyeRight,
      browY,
      headBone: boneNames.indexOf("Head"),
    },
  };
}

/** Clone the bone hierarchy and bind a skeleton whose inverses expect rest-world geometry. */
export function makeSkeleton(kit: DonorKit) {
  const root = kit.template.clone(true),
    byName = new Map<string, THREE.Bone>();
  root.traverse((o) => {
    if ((o as THREE.Bone).isBone) byName.set(o.name, o as THREE.Bone);
  });
  const bones = kit.boneNames.map((n) => byName.get(n)!),
    skeleton = new THREE.Skeleton(
      bones,
      kit.boneInverses.map((m) => m.clone()),
    );
  return { root, skeleton, byName };
}

/** Weld normals across coincident positions (material seams and part seams). */
export function weldNormals(geometry: THREE.BufferGeometry, precision = 1e4) {
  const p = geometry.getAttribute("position"),
    index = geometry.index!,
    sums = new Map<string, THREE.Vector3>(),
    keys: string[] = new Array(p.count),
    a = new THREE.Vector3(),
    b = new THREE.Vector3(),
    c = new THREE.Vector3();
  for (let i = 0; i < p.count; i++)
    keys[i] =
      Math.round(p.getX(i) * precision) +
      ":" +
      Math.round(p.getY(i) * precision) +
      ":" +
      Math.round(p.getZ(i) * precision);
  for (let f = 0; f < index.count; f += 3) {
    const i0 = index.getX(f),
      i1 = index.getX(f + 1),
      i2 = index.getX(f + 2);
    a.fromBufferAttribute(p, i0);
    b.fromBufferAttribute(p, i1).sub(a);
    c.fromBufferAttribute(p, i2).sub(a);
    b.cross(c);
    for (const i of [i0, i1, i2]) {
      let sum = sums.get(keys[i]);
      if (!sum) sums.set(keys[i], (sum = new THREE.Vector3()));
      sum.add(b);
    }
  }
  const normal = geometry.getAttribute("normal") as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const n = sums.get(keys[i])!;
    if (n.lengthSq() > 0) {
      a.copy(n).normalize();
      normal.setXYZ(i, a.x, a.y, a.z);
    }
  }
  normal.needsUpdate = true;
  return geometry;
}

/** Merge indexed rest-world pieces, adding a per-vertex float attribute. */
export function mergePieces(
  parts: { geometry: THREE.BufferGeometry; tag: number }[],
  tagName: string,
) {
  let vertices = 0,
    indices = 0;
  for (const { geometry } of parts) {
    vertices += geometry.getAttribute("position").count;
    indices += geometry.index!.count;
  }
  const position = new Float32Array(vertices * 3),
    normal = new Float32Array(vertices * 3),
    skinIndex = new Uint16Array(vertices * 4),
    skinWeight = new Float32Array(vertices * 4),
    clothBand = parts.length && parts.every(({ geometry }) => geometry.getAttribute("clothBand"))
      ? new Float32Array(vertices * 2)
      : undefined,
    tag = new Float32Array(vertices),
    index = new Uint32Array(indices);
  let v = 0,
    k = 0;
  for (const part of parts) {
    const g = part.geometry,
      count = g.getAttribute("position").count;
    position.set(g.getAttribute("position").array as Float32Array, v * 3);
    normal.set(g.getAttribute("normal").array as Float32Array, v * 3);
    skinIndex.set(g.getAttribute("skinIndex").array as Uint16Array, v * 4);
    skinWeight.set(g.getAttribute("skinWeight").array as Float32Array, v * 4);
    if (clothBand)
      clothBand.set(g.getAttribute("clothBand").array as Float32Array, v * 2);
    tag.fill(part.tag, v, v + count);
    const source = g.index!;
    for (let i = 0; i < source.count; i++) index[k + i] = source.getX(i) + v;
    v += count;
    k += source.count;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(position, 3));
  geometry.setAttribute("normal", new THREE.BufferAttribute(normal, 3));
  geometry.setAttribute("skinIndex", new THREE.BufferAttribute(skinIndex, 4));
  geometry.setAttribute("skinWeight", new THREE.BufferAttribute(skinWeight, 4));
  geometry.setAttribute(tagName, new THREE.BufferAttribute(tag, 1));
  if (clothBand)
    geometry.setAttribute("clothBand", new THREE.BufferAttribute(clothBand, 2));
  geometry.setIndex(new THREE.BufferAttribute(index, 1));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

/** Rigid piece (built in rest-world space) skinned entirely to one bone. */
export function rigidPiece(
  geometry: THREE.BufferGeometry,
  bone: number,
): THREE.BufferGeometry {
  const g = geometry.index ? geometry : geometry.setIndex(
    Array.from({ length: geometry.getAttribute("position").count }, (_, i) => i),
  );
  const count = g.getAttribute("position").count,
    skinIndex = new Uint16Array(count * 4),
    skinWeight = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    skinIndex[i * 4] = bone;
    skinWeight[i * 4] = 1;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute(
    "position",
    new THREE.BufferAttribute(
      Float32Array.from(g.getAttribute("position").array as ArrayLike<number>),
      3,
    ),
  );
  if (!g.getAttribute("normal")) g.computeVertexNormals();
  out.setAttribute(
    "normal",
    new THREE.BufferAttribute(
      Float32Array.from(g.getAttribute("normal").array as ArrayLike<number>),
      3,
    ),
  );
  out.setAttribute("skinIndex", new THREE.BufferAttribute(skinIndex, 4));
  out.setAttribute("skinWeight", new THREE.BufferAttribute(skinWeight, 4));
  out.setIndex(
    new THREE.BufferAttribute(
      Uint32Array.from(g.index!.array as ArrayLike<number>),
      1,
    ),
  );
  return out;
}
