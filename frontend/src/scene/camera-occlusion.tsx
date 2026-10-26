/* oxlint-disable react/immutability -- Owned shader clones and uniforms are imperative GPU resources. */
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { motion } from "../walking";
import { useStore } from "../store";

/** Dither a blocking building/tree without another transparent pass or draw call. */
export function CameraOcclusion() {
  const { scene, invalidate } = useThree(),
    target = useMemo(() => ({ value: new THREE.Vector4() }), []);
  const sync = useRef<() => void>(() => {});
  const confirmSurfaces = useRef<(camera: THREE.Camera) => void>(() => {});
  useEffect(() => {
    const owned = new Map<
      THREE.Mesh,
      {
        original: THREE.Material | THREE.Material[];
        materials: THREE.Material[];
        surface: { value: number };
        box: THREE.Box3;
        loose: boolean;
      }
    >();
    const raycaster = new THREE.Raycaster(),
      origin = new THREE.Vector3(),
      end = new THREE.Vector3(),
      direction = new THREE.Vector3(),
      worldBox = new THREE.Box3(),
      boxHit = new THREE.Vector3(),
      probe = new THREE.Vector3(),
      back = new THREE.Ray(),
      exit = new THREE.Vector3(),
      reverse = new THREE.Vector3(),
      hits: THREE.Intersection[] = [];
    const lastCamera = new THREE.Matrix4(),
      lastTarget = new THREE.Vector4();
    let dirty = true;
    const scan = () => {
      for (const [object, entry] of owned) {
        let root: THREE.Object3D = object;
        while (root.parent) root = root.parent;
        if (root !== scene) {
          entry.materials.forEach((m) => m.dispose());
          owned.delete(object);
          dirty = true;
        }
      }
      scene.traverse((object) => {
        if (!(object instanceof THREE.Mesh) || owned.has(object)) return;
        let parent: THREE.Object3D | null = object,
          scenery = false,
          pad = 0;
        while (parent) {
          if (
            (parent.name.startsWith("kit:") &&
              /building|tree-|painted-row/.test(parent.name)) ||
            parent.userData.cameraOccluder
          ) {
            scenery = true;
            pad = Math.max(pad, parent.userData.cameraOccluderPad ?? 0);
          }
          if (
            parent.name === "controlled-player" ||
            parent.name.startsWith("room-")
          )
            return;
          parent = parent.parent;
        }
        if (!scenery) return;
        const geometry = object.geometry;
        geometry.computeBoundingSphere();
        geometry.computeBoundingBox();
        // Thin signage fades whenever the view passes near it, not only through it.
        const box = geometry.boundingBox!.clone().expandByScalar(pad);
        // A merged landmark can contain an open courtyard/entrance inside its
        // bounds. Its real triangles must block the player before we fade it.
        // Repeated kit instances retain the inexpensive per-instance slab test.
        const surface = {
          value: object instanceof THREE.InstancedMesh ? 1 : 0,
        };
        const originals: THREE.Material[] = Array.isArray(object.material)
          ? object.material
          : [object.material];
        const materials = originals.map((source) => {
          const material = source.clone(),
            compile = source.onBeforeCompile,
            key = source.customProgramCacheKey();
          material.onBeforeCompile = (shader, renderer) => {
            compile.call(material, shader, renderer);
            shader.uniforms.metroFadeTarget = target;
            shader.uniforms.metroFadeMin = { value: box.min.clone() };
            shader.uniforms.metroFadeMax = { value: box.max.clone() };
            shader.uniforms.metroFadeSurface = surface;
            // Thin signage drops out whole; anything bigger opens a clean hole around the player.
            shader.uniforms.metroFadeWhole = { value: pad > 0 ? 1 : 0 };
            shader.vertexShader =
              "uniform vec4 metroFadeTarget;varying vec3 vMetroLocalCamera;varying vec3 vMetroLocalTarget;varying vec3 vMetroWorld;\n" +
              shader.vertexShader;
            shader.vertexShader = shader.vertexShader.replace(
              "#include <project_vertex>",
              `#include <project_vertex>
       mat4 metroModel=modelMatrix;
       #ifdef USE_INSTANCING
       metroModel=modelMatrix*instanceMatrix;
       #endif
       vMetroWorld=(metroModel*vec4(transformed,1.)).xyz;
       vec3 metroCameraDelta=cameraPosition-metroModel[3].xyz;
       vec3 metroTargetDelta=metroFadeTarget.xyz-metroModel[3].xyz;
       vec3 metroScaleSquared=vec3(dot(metroModel[0].xyz,metroModel[0].xyz),dot(metroModel[1].xyz,metroModel[1].xyz),dot(metroModel[2].xyz,metroModel[2].xyz));
       vMetroLocalCamera=vec3(dot(metroCameraDelta,metroModel[0].xyz),dot(metroCameraDelta,metroModel[1].xyz),dot(metroCameraDelta,metroModel[2].xyz))/metroScaleSquared;
       vMetroLocalTarget=vec3(dot(metroTargetDelta,metroModel[0].xyz),dot(metroTargetDelta,metroModel[1].xyz),dot(metroTargetDelta,metroModel[2].xyz))/metroScaleSquared;`,
            );
            shader.fragmentShader =
              "uniform vec4 metroFadeTarget;uniform float metroFadeSurface;uniform float metroFadeWhole;uniform vec3 metroFadeMin;uniform vec3 metroFadeMax;varying vec3 vMetroLocalCamera;varying vec3 vMetroLocalTarget;varying vec3 vMetroWorld;\n" +
              shader.fragmentShader;
            shader.fragmentShader = shader.fragmentShader.replace(
              "#include <dithering_fragment>",
              `#include <dithering_fragment>
       if(metroFadeTarget.w>.5&&metroFadeSurface>.5){
        vec3 metroRay=vMetroLocalTarget-vMetroLocalCamera;
        vec3 metroSign=vec3(metroRay.x<0.?-1.:1.,metroRay.y<0.?-1.:1.,metroRay.z<0.?-1.:1.);
        vec3 metroInverse=metroSign/max(abs(metroRay),vec3(.00001));
        vec3 metroA=(metroFadeMin-vMetroLocalCamera)*metroInverse,metroB=(metroFadeMax-vMetroLocalCamera)*metroInverse;
        vec3 metroLow=min(metroA,metroB),metroHigh=max(metroA,metroB);
        float metroNear=max(metroLow.x,max(metroLow.y,metroLow.z));
        float metroFar=min(metroHigh.x,min(metroHigh.y,metroHigh.z));
        float metroEnd=1.-1.2/max(length(metroFadeTarget.xyz-cameraPosition),.001);
        float metroFade=step(max(metroNear,0.),metroFar)*step(metroNear,metroEnd);
        if(metroFade>.5){
         if(metroFadeWhole>.5)discard;
         vec3 metroAxis=metroFadeTarget.xyz-cameraPosition;
         float metroLength=max(length(metroAxis),.001);
         vec3 metroRelative=vMetroWorld-cameraPosition;
         float metroAlong=dot(metroRelative,metroAxis/metroLength);
         if(vMetroWorld.y>max(metroFadeTarget.y-.85,.35)&&metroAlong<metroLength-1.2&&length(metroRelative-metroAxis*(metroAlong/metroLength))<2.6)discard;
        }
       }`,
            );
          };
          material.customProgramCacheKey = () => key + "-metro-camera-fade-v7";
          material.needsUpdate = true;
          return material;
        });
        owned.set(object, {
          original: object.material,
          materials,
          surface,
          box: box.clone(),
          loose: pad > 0,
        });
        object.material = Array.isArray(object.material)
          ? materials
          : materials[0];
        dirty = true;
      });
      scene.userData.cameraOcclusion = {
        ...scene.userData.cameraOcclusion,
        meshes: owned.size,
        method: "cutout",
        remainingOpacity: 0,
      };
      invalidate();
    };
    sync.current = () => {
      for (const entry of owned.values()) {
        const sources = Array.isArray(entry.original)
          ? entry.original
          : [entry.original];
        entry.materials.forEach((material, i) => {
          const source = sources[i] as THREE.MeshStandardMaterial,
            dest = material as THREE.MeshStandardMaterial;
          if (source.color && dest.color) dest.color.copy(source.color);
          if (source.emissive && dest.emissive) {
            dest.emissive.copy(source.emissive);
            dest.emissiveIntensity = source.emissiveIntensity;
          }
          dest.opacity = source.opacity;
        });
      }
    };
    confirmSurfaces.current = (camera) => {
      camera.updateWorldMatrix(true, false);
      if (
        !dirty &&
        lastCamera.equals(camera.matrixWorld) &&
        lastTarget.equals(target.value)
      )
        return;
      dirty = false;
      lastCamera.copy(camera.matrixWorld);
      lastTarget.copy(target.value);
      origin.setFromMatrixPosition(camera.matrixWorld);
      end.set(target.value.x, target.value.y, target.value.z);
      direction.subVectors(end, origin);
      const distance = direction.length();
      direction.divideScalar(Math.max(distance, 0.001));
      raycaster.set(origin, direction);
      raycaster.near = 0.01;
      raycaster.far = Math.max(0, distance - 1.2);
      let tests = 0,
        confirmed = 0;
      for (const [object, entry] of owned) {
        if (object instanceof THREE.InstancedMesh) continue;
        entry.surface.value = 0;
        if (target.value.w < 0.5 || raycaster.far <= raycaster.near) continue;
        object.updateWorldMatrix(true, false);
        worldBox.copy(entry.box).applyMatrix4(object.matrixWorld);
        if (
          !worldBox.containsPoint(origin) &&
          (!raycaster.ray.intersectBox(worldBox, boxHit) ||
            boxHit.distanceTo(origin) > raycaster.far)
        )
          continue;
        hits.length = 0;
        tests++;
        if (entry.loose) {
          // Thin posts and boards hide a figure without crossing its centre line,
          // so probe the head, chest and feet on both shoulders.
          for (const lift of [-0.6, 0, 0.7])
            for (const side of [-0.3, 0, 0.3]) {
              if (hits.length) break;
              probe
                .set(-direction.z, 0, direction.x)
                .multiplyScalar(side)
                .add(end);
              probe.y += lift;
              const reach = probe.distanceTo(origin);
              raycaster.set(origin, probe.sub(origin).divideScalar(reach));
              raycaster.far = Math.max(0, reach - 0.3);
              THREE.Mesh.prototype.raycast.call(object, raycaster, hits);
            }
          raycaster.set(origin, direction);
          raycaster.far = Math.max(0, distance - 1.2);
          entry.surface.value = hits.length ? 1 : 0;
          confirmed += entry.surface.value;
          continue;
        }
        // A building the sight line crosses for metres hides the player even where
        // a thin wall seen edge-on slips between probe rays. Courtyards still need
        // their real triangles, because there the player stands inside the bounds.
        if (!worldBox.containsPoint(end)) {
          const inside = worldBox.containsPoint(origin) ? origin : boxHit;
          back.set(end, reverse.copy(direction).negate());
          if (back.intersectBox(worldBox, exit) && inside.distanceTo(exit) > 3) {
            entry.surface.value = 1;
            confirmed++;
            continue;
          }
        }
        // Scenery deliberately disables interaction picking; this internal check
        // calls Three's geometry raycast directly without changing input behavior.
        THREE.Mesh.prototype.raycast.call(object, raycaster, hits);
        // Keep the venue sign above the door readable too.
        for (const [side, lift] of [
          [0, 2.3],
          [-1.6, 2.3],
          [1.6, 2.3],
        ]) {
          if (hits.length) break;
          probe
            .set(-direction.z, 0, direction.x)
            .normalize()
            .multiplyScalar(side)
            .add(end);
          probe.y += lift;
          const reach = probe.distanceTo(origin);
          raycaster.set(origin, probe.sub(origin).divideScalar(reach));
          raycaster.far = Math.max(0, reach - 1.2);
          THREE.Mesh.prototype.raycast.call(object, raycaster, hits);
        }
        raycaster.set(origin, direction);
        raycaster.far = Math.max(0, distance - 1.2);
        entry.surface.value = hits.length ? 1 : 0;
        confirmed += entry.surface.value;
      }
      if (scene.userData.cameraOcclusion)
        Object.assign(scene.userData.cameraOcclusion, {
          surfaceTests: tests,
          confirmedLandmarkSurfaces: confirmed,
          landmarkPrecision: "triangle-confirmed",
        });
    };
    scan();
    const timer = setInterval(scan, 1500);
    return () => {
      clearInterval(timer);
      sync.current = () => {};
      confirmSurfaces.current = () => {};
      for (const [object, entry] of owned) {
        if (
          (Array.isArray(object.material)
            ? object.material[0]
            : object.material) === entry.materials[0]
        )
          object.material = entry.original;
        entry.materials.forEach((m) => m.dispose());
      }
      delete scene.userData.cameraOcclusion;
    };
  }, [scene, invalidate, target]);
  const playerRef = useRef<THREE.Object3D | null>(null);
  useFrame(({ camera }) => {
    sync.current();
    // Look the player group up only when the cached one has left the scene.
    let player = playerRef.current;
    if (!player || !player.parent) {
      player = playerRef.current = scene.getObjectByName("controlled-player") ?? null;
    }
    const state = useStore.getState(),
      p = motion.position,
      near =
        !!p &&
        Math.hypot(camera.position.x - p.x, camera.position.z - p.z) < 65;
    target.value.set(
      p?.x ?? 0,
      (player?.position.y ?? 0) + 1,
      p?.z ?? 0,
      p &&
        !p.room &&
        near &&
        state.sim?.city === state.city &&
        !scene.userData.cameraOcclusionDisabled
        ? 1
        : 0,
    );
    confirmSurfaces.current(camera);
    if (scene.userData.cameraOcclusion)
      scene.userData.cameraOcclusion.active = target.value.w > 0;
  });
  return null;
}
