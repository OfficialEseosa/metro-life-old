/* oxlint-disable react/immutability -- Composer resources belong to this renderer. */
import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { Pass } from "three/addons/postprocessing/Pass.js";
import { SMAAPass } from "three/addons/postprocessing/SMAAPass.js";
import { GentleBloom } from "./gentle-bloom";
import { N8AOPass } from "n8ao";
import { useStore } from "../store";
import { motion } from "../walking";
import { useNightLighting } from "../lighting";

class BeautyPass extends Pass {
  private scene: THREE.Scene;
  private camera: THREE.Camera;
  private target: THREE.WebGLRenderTarget;
  constructor(
    scene: THREE.Scene,
    camera: THREE.Camera,
    target: THREE.WebGLRenderTarget,
  ) {
    super();
    this.scene = scene;
    this.camera = camera;
    this.target = target;
    this.needsSwap = false;
  }
  render(renderer: THREE.WebGLRenderer) {
    renderer.setRenderTarget(this.target);
    renderer.clear();
    renderer.render(this.scene, this.camera);
  }
}

/** Full-resolution contact shading and SMAA; adapt only after sustained slow active play. */
export function ImageQuality({
  onDprChange,
}: {
  onDprChange?: (dpr: number) => void;
}) {
  const { gl, scene, camera, size, viewport, invalidate } = useThree(),
    quality = useStore((s) => s.sceneQuality),
    night = useNightLighting(),
    pipeline = useRef<EffectComposer | null>(null),
    adaptive = useRef({ seconds: 0, frames: 0, slowWindows: 0, recovery: 0 }),
    textures = useRef(new WeakSet<THREE.Texture>()),
    dpr = viewport.dpr,
    lastTextureScan = useRef(0);
  useEffect(() => {
    const composer = new EffectComposer(gl),
      ao =
        quality === "normal"
          ? new N8AOPass(
              scene,
              camera,
              Math.round(size.width * dpr),
              Math.round(size.height * dpr),
            )
          : null;
    if (ao) {
      ao.autoDetectTransparency = false;
      ao.setQualityMode("Medium");
      ao.configuration.halfRes = false;
      ao.configuration.depthAwareUpsampling = true;
      ao.configuration.gammaCorrection = false;
      ao.configuration.transparencyAware = false;
      ao.configuration.autoRenderBeauty = false;
      ao.configuration.aoRadius = 0.4;
      ao.configuration.distanceFalloff = 0.7;
      ao.configuration.intensity = 1.1;
      ao.configuration.denoiseIterations = 2;
      ao.configuration.denoiseRadius = 8;
      composer.addPass(new BeautyPass(scene, camera, ao.beautyRenderTarget));
      composer.addPass(ao);
    } else composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new SMAAPass());
    composer.addPass(new GentleBloom());
    composer.setPixelRatio(gl.getPixelRatio());
    composer.setSize(size.width, size.height);
    gl.toneMapping = THREE.NeutralToneMapping;
    gl.outputColorSpace = THREE.SRGBColorSpace;
    gl.info.autoReset = false;
    scene.userData.imageQuality = {
      quality,
      dpr: gl.getPixelRatio(),
      halfResolutionAO: false,
      depthAwareUpsampling: !!ao,
      passes: [
        "beauty",
        ...(ao ? ["N8AO full resolution + denoise"] : []),
        "SMAA",
        "gentle bloom",
        "warm grade",
        "Neutral output",
      ],
    };
    pipeline.current = composer;
    invalidate();
    return () => {
      pipeline.current = null;
      composer.passes.forEach((p) => p.dispose());
      composer.dispose();
      if (ao)
        for (const [key, value] of Object.entries(ao)) {
          if (key === "scene" || key === "camera") continue;
          if (
            value &&
            typeof value === "object" &&
            "dispose" in value &&
            typeof value.dispose === "function"
          )
            value.dispose();
        }
      delete scene.userData.imageQuality;
      gl.info.autoReset = true;
    };
  }, [gl, scene, camera, quality, size.width, size.height, dpr, invalidate]);
  useEffect(() => {
    gl.toneMappingExposure = night ? 0.92 : 1.06;
    invalidate();
  }, [night, gl, invalidate]);
  useFrame((_, dt) => {
    // Late GLB loads and generated room textures get the same grazing-angle clarity.
    const maximum = gl.capabilities.getMaxAnisotropy();
    if (performance.now() - lastTextureScan.current > 1000) {
      lastTextureScan.current = performance.now();
      scene.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        for (const material of Array.isArray(object.material)
          ? object.material
          : [object.material]) {
          for (const value of Object.values(material)) {
            if (
              !(value instanceof THREE.Texture) ||
              textures.current.has(value)
            )
              continue;
            textures.current.add(value);
            value.anisotropy = maximum;
            if (value.image && !("isCompressedTexture" in value)) {
              value.generateMipmaps = true;
              value.minFilter = THREE.LinearMipmapLinearFilter;
            }
            value.needsUpdate = true;
          }
        }
      });
    }
    const sample = adaptive.current,
      active = motion.moving || useStore.getState().cameraMoving;
    if (document.hidden || !active || dt > 1) {
      sample.seconds = sample.frames = 0;
      return;
    }
    sample.seconds += dt;
    sample.frames++;
    if (sample.seconds >= 4) {
      const fps = sample.frames / sample.seconds;
      sample.slowWindows = fps < 47 ? sample.slowWindows + 1 : 0;
      sample.recovery = fps > 58 ? sample.recovery + 1 : 0;
      sample.seconds = sample.frames = 0;
      if (sample.slowWindows >= 2) {
        sample.slowWindows = 0;
        if (quality === "normal") useStore.getState().setSceneQuality("low");
        else if (dpr > 1)
          onDprChange?.(Math.max(1, Math.round((dpr - 0.25) * 100) / 100));
      } else if (
        sample.recovery >= 6 &&
        dpr < Math.min(window.devicePixelRatio, 2)
      ) {
        sample.recovery = 0;
        onDprChange?.(
          Math.min(
            window.devicePixelRatio,
            2,
            Math.round((dpr + 0.25) * 100) / 100,
          ),
        );
      }
    }
  }, -90);
  useFrame(() => gl.info.reset(), -100);
  useFrame((_, dt) => {
    if (import.meta.env.DEV && scene.userData.withoutEffects) {
      gl.setRenderTarget(null);
      gl.render(scene, camera);
    } else pipeline.current?.render(dt);
  }, 1);
  return null;
}
