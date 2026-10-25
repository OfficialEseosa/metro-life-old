import * as THREE from "three";
import { lightUniforms } from "../lighting";

/** Occupied office windows follow the supplied glass faces; crowns retain their authored glow. */
export function skylineWindows(
  geometry: THREE.BufferGeometry,
  material: THREE.MeshStandardMaterial,
) {
  const position = geometry.getAttribute("position"),
    normal = geometry.getAttribute("normal"),
    color = geometry.getAttribute("color"),
    mask = new Float32Array(position.count);
  geometry.computeBoundingBox();
  const top = geometry.boundingBox!.max.y;
  for (let i = 0; i < position.count; i++) {
    const r = color?.getX(i) ?? material.color.r,
      g = color?.getY(i) ?? material.color.g,
      b = color?.getZ(i) ?? material.color.b,
      glass =
        (b > r * 1.06 && g > r * 0.85) ||
        (Math.max(r, g, b) < 0.19 && b >= r * 0.9 && g >= r * 0.85);
    mask[i] =
      glass &&
      Math.abs(normal.getY(i)) < 0.35 &&
      position.getY(i) > 12 &&
      position.getY(i) < top * 0.94
        ? 1
        : 0;
  }
  geometry.setAttribute("skylineGlass", new THREE.BufferAttribute(mask, 1));
  const night = lightUniforms.lights;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.skylineNight = night;
    shader.vertexShader =
      "attribute float skylineGlass;varying vec3 skylinePosition;varying vec3 skylineNormal;varying float skylineWindow;\n" +
      shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      "#include <begin_vertex>\nskylinePosition=position;skylineNormal=normal;skylineWindow=skylineGlass;",
    );
    shader.fragmentShader =
      "uniform float skylineNight;varying vec3 skylinePosition;varying vec3 skylineNormal;varying float skylineWindow;\n" +
      shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <emissivemap_fragment>",
      `#include <emissivemap_fragment>
   float along=abs(skylineNormal.x)>abs(skylineNormal.z)?skylinePosition.z:skylinePosition.x;
   vec2 cell=vec2(along/3.4,skylinePosition.y/3.6);
   vec2 pane=fract(cell);
   float occupied=step(.30,fract(sin(dot(floor(cell),vec2(12.9898,78.233)))*43758.5453));
   float windowFace=skylineWindow*step(.16,pane.x)*step(pane.x,.82)*step(.18,pane.y)*step(pane.y,.78)*occupied;
   totalEmissiveRadiance+=skylineNight*windowFace*vec3(3.0,1.62,.62);
  `,
    );
  };
  material.customProgramCacheKey = () => "metro-skyline-warm-office-windows-v1";
}
