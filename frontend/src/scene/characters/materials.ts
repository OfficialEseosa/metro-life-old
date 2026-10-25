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

/**
 * Surface detail in metres of rest pose, so it sticks to the body while it animates. `vRest` is
 * the bind-pose position scaled by the mesh's world scale.
 */
const surface = {
  skin: `float sssEdge=pow(1.-clamp(dot(normal,normalize(vViewPosition)),0.,1.),2.);
reflectedLight.indirectDiffuse+=reflectedLight.indirectDiffuse*vec3(.16,-.01,-.05);
reflectedLight.directDiffuse+=reflectedLight.directDiffuse*vec3(.22,.02,-.06)*sssEdge;`,
  cloth: `vec3 weaveAt=vRest*240.;
float weave=sin(weaveAt.x+weaveAt.z)*sin(weaveAt.y*1.1)*.5+sin((weaveAt.x-weaveAt.z)*.7+weaveAt.y*.4)*.25;
float drape=sin(vRest.y*38.+sin(vRest.x*21.)*1.6)*.5+sin(vRest.x*27.+vRest.z*31.)*.3;
characterBump(normal,weave*.0016+drape*.004,clamp(1.-length(fwidth(weaveAt))*.35,0.,1.));
roughnessFactor=clamp(roughnessFactor+drape*.07-weave*.04,.45,1.);
diffuseColor.rgb*=.97+drape*.035;`,
  hair: `vec3 strandAt=vRest*vec3(520.,60.,520.);
float strand=sin(strandAt.x+sin(strandAt.y)*1.8)*.5+sin(strandAt.z*1.3+strandAt.y*.7)*.5;
characterBump(normal,strand*.0012,clamp(1.-length(fwidth(strandAt))*.3,0.,1.));
float underside=smoothstep(-.7,.35,inverseTransformDirection(normal,viewMatrix).y);
diffuseColor.rgb*=(.84+strand*.1)*mix(.68,1.,underside);
roughnessFactor=clamp(roughnessFactor+strand*.12,.3,.9);`,
};

const bump = `uniform float rimStrength;
uniform vec3 rimColour;
varying vec3 vRest;
void characterBump(inout vec3 n,float h,float strength){
  vec3 dpx=dFdx(-vViewPosition),dpy=dFdy(-vViewPosition);
  vec3 r1=cross(dpy,n),r2=cross(n,dpx);
  float det=dot(dpx,r1);
  vec3 grad=sign(det)*(dFdx(h)*r1+dFdy(h)*r2);
  n=normalize(mix(n,normalize(abs(det)*n-grad),strength));
}`;

function withRim(
  material: THREE.MeshPhysicalMaterial,
  key: string,
  kind: keyof typeof surface,
) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.rimStrength = characterRim.strength;
    shader.uniforms.rimColour = characterRim.colour;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vRest;")
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvRest=position*length(modelMatrix[0].xyz);",
      );
    const detail = surface[kind];
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\n" + (kind === "skin" ? bump.split("void")[0] : bump),
      )
      .replace(
        kind === "skin" ? "#include <lights_fragment_end>" : "#include <normal_fragment_maps>",
        (kind === "skin" ? "#include <lights_fragment_end>" : "#include <normal_fragment_maps>") +
          "\n" +
          detail,
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
/** Skin: a warm sheen plus light that reddens as it falls off stand in for subsurface scattering. */
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
      "metro-character-skin-v3",
      "skin",
    );
    skins.set(hex, m);
  }
  return m;
}

let cloth: THREE.MeshPhysicalMaterial | undefined;
/** Cloth: matte with a glancing fabric sheen, a fine weave and broad rumples in normal and roughness. */
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
    "metro-character-cloth-v3",
    "cloth",
  );
  return cloth;
}

const hairs = new Map<string, THREE.MeshPhysicalMaterial>();
/** Hair: a soft sheen broken into strands, darker underneath. */
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
      "metro-character-hair-v3",
      "hair",
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
