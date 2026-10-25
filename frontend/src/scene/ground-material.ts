/* oxlint-disable react/immutability -- Shared ground materials are renderer resources updated from the clock. */
import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { timeOfDay } from "../lighting";

/** World-space value noise shared by grass, asphalt and paving shaders. */
export const noiseChunk = `
float mlHash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float mlNoise(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);
  return mix(mix(mlHash(i),mlHash(i+vec2(1,0)),u.x),mix(mlHash(i+vec2(0,1)),mlHash(i+vec2(1,1)),u.x),u.y);}
`;
/** Lighter, yellower dry patches and darker lush patches; the fine octave fades out with distance. */
export function grassify(material: THREE.MeshStandardMaterial, key: string) {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader =
      "varying vec3 vGrassWorld;\n" +
      shader.vertexShader.replace(
        "#include <project_vertex>",
        "#include <project_vertex>\nvGrassWorld=(modelMatrix*vec4(transformed,1.)).xyz;",
      );
    shader.fragmentShader =
      "varying vec3 vGrassWorld;\n" +
      noiseChunk +
      shader.fragmentShader.replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        vec2 gp=vGrassWorld.xz;
        float fine=1.-smoothstep(.15,.6,length(fwidth(gp))*2.1);
        float n=mlNoise(gp*.08)*.55+mlNoise(gp*.35+7.)*.3+(mlNoise(gp*2.1+3.)-.5)*.3*fine+.075;
        n=clamp((n-.5)*2.+.5,0.,1.);
        diffuseColor.rgb*=mix(vec3(.80,.89,.78),vec3(1.12,1.07,.9),n);`,
      );
  };
  material.customProgramCacheKey = () => "metro-grass-" + key;
  return material;
}
const shared: { material: THREE.MeshStandardMaterial | null; users: number } = {
  material: null,
  users: 0,
};
/** One grass material for the flat ground and the surrounding hills, coloured by the clock. */
export function useGrassMaterial() {
  const material = useMemo(() => {
    shared.material ??= grassify(
      new THREE.MeshStandardMaterial({ roughness: 1, color: "#86b86a" }),
      "plain",
    );
    return shared.material;
  }, []);
  useEffect(() => {
    shared.users++;
    return () => {
      if (--shared.users === 0) {
        shared.material?.dispose();
        shared.material = null;
      }
    };
  }, []);
  useFrame(() => {
    material.color.copy(timeOfDay.ground);
  });
  return material;
}
