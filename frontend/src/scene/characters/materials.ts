/**
 * Shared physical materials. Skin and hair are cached per colour; cloth is one material for
 * every person because garment colours live in a per-person vertex colour attribute.
 * Colour is a uniform, so all of these compile to a handful of programs.
 */
import * as THREE from "three";

/** Rim light shared by every character material; the scene may tune it for night. */
export const characterRim = {
  strength: { value: 0.055 },
  colour: { value: new THREE.Color("#fff1dc") },
};
export function setCharacterRim(night: boolean) {
  characterRim.strength.value = night ? 0.12 : 0.055;
  characterRim.colour.value.set(night ? "#a9c4ff" : "#fff1dc");
}

function withRim(material: THREE.MeshPhysicalMaterial, key: string) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.rimStrength = characterRim.strength;
    shader.uniforms.rimColour = characterRim.colour;
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform float rimStrength;\nuniform vec3 rimColour;",
      )
      .replace(
        "#include <dithering_fragment>",
        "#include <dithering_fragment>\nfloat characterRim=pow(1.-clamp(dot(normal,normalize(vViewPosition)),0.,1.),3.);gl_FragColor.rgb+=rimColour*rimStrength*characterRim;",
      );
  };
  material.customProgramCacheKey = () => key;
  return material;
}

const skins = new Map<string, THREE.MeshPhysicalMaterial>();
/** Skin: soft warm sheen stands in for subsurface scattering. */
export function skinMaterial(hex: string) {
  let m = skins.get(hex);
  if (!m) {
    m = withRim(
      new THREE.MeshPhysicalMaterial({
        name: "character-skin",
        color: hex,
        vertexColors: true,
        roughness: 0.55,
        specularIntensity: 0.45,
        sheen: 0.35,
        sheenRoughness: 0.6,
        sheenColor: new THREE.Color("#ff8f73"),
      }),
      "metro-character-skin",
    );
    skins.set(hex, m);
  }
  return m;
}

let cloth: THREE.MeshPhysicalMaterial | undefined;
/** Cloth: matte with a glancing fabric sheen. */
export function clothMaterial() {
  cloth ??= withRim(
    new THREE.MeshPhysicalMaterial({
      name: "character-cloth",
      color: "#ffffff",
      vertexColors: true,
      roughness: 0.8,
      specularIntensity: 0.25,
      sheen: 0.6,
      sheenRoughness: 0.5,
      sheenColor: new THREE.Color(0.35, 0.35, 0.35),
    }),
    "metro-character-cloth",
  );
  return cloth;
}

const hairs = new Map<string, THREE.MeshPhysicalMaterial>();
/** Hair: the broad soft highlight of a stylised helmet of hair. */
export function hairMaterial(hex: string) {
  let m = hairs.get(hex);
  if (!m) {
    const colour = new THREE.Color(hex);
    m = withRim(
      new THREE.MeshPhysicalMaterial({
        name: "character-hair",
        color: colour,
        roughness: 0.45,
        specularIntensity: 0.4,
        sheen: 0.8,
        sheenRoughness: 0.35,
        sheenColor: colour.clone().lerp(new THREE.Color("#ffffff"), 0.4),
      }),
      "metro-character-hair",
    );
    hairs.set(hex, m);
  }
  return m;
}

const props = new Map<string, THREE.MeshStandardMaterial>();
/** Plain materials for small props held or used by characters. */
export function propMaterial(hex: string, roughness = 0.6, metalness = 0) {
  const key = hex + roughness + metalness;
  let m = props.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color: hex, roughness, metalness });
    props.set(key, m);
  }
  return m;
}
