/**
 * Painted faces. A canvas atlas holds the open-eye face on the left half and the blinking face
 * on the right half. The decal is the front of the head's own skin, so it follows every facet
 * of the sculpted head instead of floating on a separate shell.
 */
import * as THREE from "three";
import type { DonorKit } from "./kit";
import { IRISES, hashString, luminance, pickWeighted, seeded } from "./palettes";

export type FaceStyle = "soft" | "bright" | "angular" | "freckled";
export type FacePaint = {
  face: string;
  skin: string;
  hairColor: string;
  sex: "f" | "m";
  /** Seed for small per-person differences (iris colour, brow tilt, smile). */
  seed: number;
};

/** Texture-space layout shared by the painter and the decal UVs (tile units, y down). */
const EYE_SPACING = 0.34,
  EYE_Y = 0.43;

function mix(a: string, b: string, t: number) {
  const ca = new THREE.Color(a),
    cb = new THREE.Color(b);
  return "#" + ca.lerp(cb, t).getHexString();
}
function shade(hex: string, f: number) {
  const c = new THREE.Color(hex);
  c.r *= f;
  c.g *= f;
  c.b *= f;
  return "#" + c.getHexString();
}

function paintTile(
  x: CanvasRenderingContext2D,
  T: number,
  look: FacePaint,
  closed: boolean,
) {
  const style = (["soft", "bright", "angular", "freckled"].includes(look.face)
      ? look.face
      : "soft") as FaceStyle,
    random = seeded(look.seed ^ 0x9e3779b9),
    iris = pickWeighted(IRISES, random()),
    hairBrow = shade(look.hairColor, 0.55),
    skinLight = luminance(look.skin),
    browLight = luminance(hairBrow),
    brow =
      Math.abs(skinLight - browLight) >= 0.16
        ? hairBrow
        : "#" +
          new THREE.Color(look.skin)
            .multiplyScalar(skinLight > 0.5 ? 0.42 : 1)
            .lerp(
              new THREE.Color(skinLight > 0.5 ? "#000000" : "#f2d8b4"),
              skinLight > 0.5 ? 0.2 : 0.72,
            )
            .getHexString(),
    lash = "#1d1410",
    eyeW =
      T * (style === "bright" ? 0.112 : style === "angular" ? 0.098 : 0.104),
    eyeH = eyeW * (style === "bright" ? 0.78 : style === "angular" ? 0.64 : 0.72),
    browTilt = (style === "angular" ? 0.2 : style === "bright" ? -0.05 : 0.06) +
      (random() - 0.5) * 0.08,
    browLift = style === "bright" ? 1.2 : 1;
  x.lineCap = "round";
  x.lineJoin = "round";
  for (const side of [-1, 1]) {
    const cx = T * (0.5 + (side * EYE_SPACING) / 2),
      cy = T * EYE_Y;
    x.save();
    x.translate(cx, cy);
    x.scale(side, 1);
    if (!closed) {
      // Sclera with a soft shadow under the upper lid.
      x.fillStyle = "#fbf6ef";
      x.beginPath();
      x.ellipse(0, 0, eyeW, eyeH, 0, 0, Math.PI * 2);
      x.fill();
      x.save();
      x.clip();
      const r = eyeH * 0.78,
        g = x.createRadialGradient(-r * 0.15, -r * 0.1, r * 0.1, 0, r * 0.05, r);
      g.addColorStop(0, shade(iris, 1.6));
      g.addColorStop(0.55, iris);
      g.addColorStop(1, shade(iris, 0.55));
      x.fillStyle = g;
      x.beginPath();
      x.arc(eyeW * 0.04, eyeH * 0.08, r, 0, Math.PI * 2);
      x.fill();
      x.fillStyle = "#120c09";
      x.beginPath();
      x.arc(eyeW * 0.04, eyeH * 0.08, r * 0.46, 0, Math.PI * 2);
      x.fill();
      x.fillStyle = "rgba(60,30,20,.22)";
      x.fillRect(-eyeW, -eyeH, eyeW * 2, eyeH * 0.42);
      x.restore();
      // Catch-light, upper left.
      x.fillStyle = "#ffffff";
      x.beginPath();
      x.arc(-eyeW * 0.2 * side, -eyeH * 0.32, eyeH * 0.26, 0, Math.PI * 2);
      x.fill();
      // Upper lash line with a flick; heavier on the female heads.
      x.strokeStyle = lash;
      x.lineWidth = T * (look.sex === "f" ? 0.02 : 0.015);
      x.beginPath();
      x.ellipse(0, eyeH * 0.12, eyeW * 1.04, eyeH * 1.1, 0, Math.PI * 1.06, Math.PI * 1.96);
      x.stroke();
      x.lineWidth = T * (look.sex === "f" ? 0.026 : 0.022);
      x.beginPath();
      x.moveTo(-eyeW * 1.04, eyeH * 0.02);
      x.quadraticCurveTo(-eyeW * 0.12, -eyeH * 1.12, eyeW * 1.04, -eyeH * 0.02);
      x.stroke();
      if (look.sex === "f") {
        x.lineWidth = T * 0.011;
        x.beginPath();
        x.moveTo(eyeW * 0.92, -eyeH * 0.45);
        x.lineTo(eyeW * 1.28, -eyeH * 0.95);
        x.stroke();
      }
      x.strokeStyle = "rgba(70,35,25,.32)";
      x.lineWidth = T * 0.007;
      x.beginPath();
      x.ellipse(0, eyeH * 0.05, eyeW * 0.95, eyeH * 1.02, 0, Math.PI * 0.18, Math.PI * 0.82);
      x.stroke();
    } else {
      // Closed lid: a gentle downward curve with lashes.
      x.strokeStyle = lash;
      x.lineWidth = T * 0.016;
      x.beginPath();
      x.moveTo(-eyeW, 0);
      x.quadraticCurveTo(0, eyeH * 0.75, eyeW, 0);
      x.stroke();
    }
    // Brow in the hair colour.
    const by = -eyeH - T * 0.06 * browLift;
    x.fillStyle = brow;
    x.beginPath();
    x.save();
    x.translate(0, by);
    x.rotate(-browTilt);
    const bw = eyeW * 1.55,
      bh = T * (look.sex === "f" ? 0.022 : 0.03);
    x.moveTo(-bw, bh * 0.4);
    x.quadraticCurveTo(-bw * 0.1, -bh * 1.5, bw, -bh * 0.1);
    x.quadraticCurveTo(-bw * 0.1, bh * 0.6, -bw, bh * 0.4);
    x.fill();
    x.restore();
    x.restore();
  }
  // Nose shadow, cheeks and freckles.
  x.fillStyle = "rgba(110,55,35,.17)";
  x.beginPath();
  x.ellipse(T / 2, T * 0.6, T * 0.03, T * 0.014, 0, 0, Math.PI * 2);
  x.fill();
  for (const side of [-1, 1]) {
    const bx = T * (0.5 + side * 0.24),
      by = T * 0.6,
      g = x.createRadialGradient(bx, by, 0, bx, by, T * 0.085);
    g.addColorStop(0, "rgba(220,90,80,.2)");
    g.addColorStop(1, "rgba(220,90,80,0)");
    x.fillStyle = g;
    x.fillRect(bx - T * 0.1, by - T * 0.1, T * 0.2, T * 0.2);
    if (style === "freckled") {
      x.fillStyle = "rgba(120,62,38,.45)";
      for (let i = 0; i < 7; i++) {
        const fx = bx + (random() - 0.5) * T * 0.12,
          fy = by - T * 0.03 + (random() - 0.5) * T * 0.06;
        x.beginPath();
        x.arc(fx, fy, T * 0.0065, 0, Math.PI * 2);
        x.fill();
      }
    }
  }
  // Lips: a little darker and warmer than the skin; a small closed smile.
  const lip = mix(shade(look.skin, 0.72), "#b04a43", look.sex === "f" ? 0.45 : 0.22),
    mw = T * (style === "bright" ? 0.075 : 0.062),
    my = T * 0.71,
    smile = T * (style === "bright" ? 0.026 : style === "angular" ? 0.008 : 0.016);
  x.fillStyle = lip;
  x.beginPath();
  x.moveTo(T / 2 - mw, my);
  x.quadraticCurveTo(T / 2, my - T * 0.018, T / 2 + mw, my);
  x.quadraticCurveTo(T / 2, my + smile + T * 0.022, T / 2 - mw, my);
  x.fill();
  x.strokeStyle = shade(lip, 0.6);
  x.lineWidth = T * 0.007;
  x.beginPath();
  x.moveTo(T / 2 - mw * 1.02, my - T * 0.002);
  x.quadraticCurveTo(T / 2, my + smile, T / 2 + mw * 1.02, my - T * 0.002);
  x.stroke();
}

type Entry = { texture: THREE.CanvasTexture; users: number };
const textures = new Map<string, Entry>();
export function faceKey(look: FacePaint, size: number) {
  return [look.face, look.skin, look.hairColor, look.sex, look.seed, size].join("|");
}
/** Shared, reference-counted face atlas (open | closed). */
export function acquireFaceTexture(look: FacePaint, size = 256) {
  const key = faceKey(look, size);
  let entry = textures.get(key);
  if (!entry) {
    const canvas = document.createElement("canvas");
    canvas.width = size * 2;
    canvas.height = size;
    const x = canvas.getContext("2d")!;
    paintTile(x, size, look, false);
    x.save();
    x.translate(size, 0);
    paintTile(x, size, look, true);
    x.restore();
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    texture.generateMipmaps = true;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    entry = { texture, users: 0 };
    textures.set(key, entry);
  }
  entry.users++;
  let released = false;
  return {
    texture: entry.texture,
    release() {
      if (released) return;
      released = true;
      const e = textures.get(key);
      if (!e) return;
      if (--e.users <= 0) {
        e.texture.dispose();
        textures.delete(key);
      }
    },
  };
}

const decals = new Map<string, THREE.BufferGeometry>();
/**
 * Front-facing triangles of the head skin, with UVs that put the painted eyes exactly where
 * the head's original eye pieces were.
 */
export function faceDecalGeometry(head: DonorKit, skin: THREE.BufferGeometry) {
  const cached = decals.get(head.name);
  if (cached) return cached;
  const { eyeLeft, eyeRight } = head.head,
    spacing = Math.abs(eyeLeft.x - eyeRight.x),
    tile = spacing / EYE_SPACING,
    midX = (eyeLeft.x + eyeRight.x) / 2,
    eyeY = (eyeLeft.y + eyeRight.y) / 2,
    p = skin.getAttribute("position"),
    n = skin.getAttribute("normal"),
    index = skin.index!,
    uv = new Float32Array(p.count * 2),
    keep: number[] = [],
    v = new THREE.Vector3(),
    a = new THREE.Vector3(),
    b = new THREE.Vector3(),
    c = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const u = 0.5 + (v.x - midX) / tile,
      t = 1 - (EYE_Y - (v.y - eyeY) / tile);
    uv[i * 2] = u;
    uv[i * 2 + 1] = t;
  }
  for (let f = 0; f < index.count; f += 3) {
    const i0 = index.getX(f),
      i1 = index.getX(f + 1),
      i2 = index.getX(f + 2);
    a.fromBufferAttribute(p, i0);
    b.fromBufferAttribute(p, i1).sub(a);
    c.fromBufferAttribute(p, i2).sub(a);
    const normal = b.cross(c).normalize();
    if (normal.z < 0.2) continue;
    let inside = true;
    for (const i of [i0, i1, i2]) {
      const u = uv[i * 2],
        t = uv[i * 2 + 1];
      if (u < 0.01 || u > 0.99 || t < 0.01 || t > 0.99) inside = false;
    }
    if (inside) keep.push(i0, i1, i2);
  }
  // Remap the open tile into the left half of the atlas.
  for (let i = 0; i < p.count; i++) uv[i * 2] *= 0.5;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", p);
  geometry.setAttribute("normal", n);
  geometry.setAttribute("skinIndex", skin.getAttribute("skinIndex"));
  geometry.setAttribute("skinWeight", skin.getAttribute("skinWeight"));
  geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  geometry.setIndex(keep);
  decals.set(head.name, geometry);
  return geometry;
}

/** Per-person face material: shared atlas, own blink uniform. */
export function faceMaterial(texture: THREE.Texture) {
  const blink = { value: 0 },
    material = new THREE.MeshStandardMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      roughness: 0.55,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -6,
    });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.faceBlink = blink;
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform float faceBlink;")
      .replace(
        "#include <map_fragment>",
        "vec4 sampledDiffuseColor = texture2D( map, vMapUv + vec2( faceBlink * 0.5, 0.0 ) );\ndiffuseColor *= sampledDiffuseColor;",
      );
  };
  material.customProgramCacheKey = () => "metro-face-v1";
  material.userData.blink = blink;
  return material;
}

export function faceSeed(text: string) {
  return hashString(text);
}
