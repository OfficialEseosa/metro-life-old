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
import { useEffectiveQuality, useRenderQuality } from "./render-quality";

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

// Development-only: keep the chosen quality while capturing comparison screenshots.
const lockedQuality =
  import.meta.env.DEV &&
  new URLSearchParams(location.search).has("lock-quality");
const aoColour = new THREE.Color("#2b2340");
/** Phones and small screens compute ambient occlusion at half resolution. */
const smallScreen = (width: number) =>
  width < 900 || matchMedia("(pointer: coarse)").matches;

/**
 * Beauty, N8AO contact shading, SMAA and a gentle graded bloom.
 * Slow play downgrades for this session only and recovers when frames are fast again.
 */
export function ImageQuality({
  onDprChange,
}: {
  onDprChange?: (dpr: number) => void;
}) {
  const { gl, scene, camera, size, viewport, invalidate } = useThree(),
    quality = useEffectiveQuality(),
    preference = useStore((s) => s.sceneQuality),
    pipeline = useRef<EffectComposer | null>(null),
    occlusion = useRef<N8AOPass | null>(null),
    aoState = useRef({ radius: 0, room: false }),
    adaptive = useRef({ seconds: 0, frames: 0, slowWindows: 0, recovery: 0 }),
    dpr = viewport.dpr;
  useEffect(() => {
    gl.toneMapping = THREE.NeutralToneMapping;
    gl.outputColorSpace = THREE.SRGBColorSpace;
    gl.info.autoReset = false;
    const composer = new EffectComposer(gl),
      halfRes = smallScreen(size.width),
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
      ao.setQualityMode(halfRes ? "Low" : "Medium");
      ao.configuration.halfRes = halfRes;
      ao.configuration.depthAwareUpsampling = true;
      ao.configuration.gammaCorrection = false;
      ao.configuration.transparencyAware = false;
      ao.configuration.autoRenderBeauty = false;
      ao.configuration.aoRadius = 1;
      ao.configuration.distanceFalloff = 0.5;
      ao.configuration.intensity = 1.3;
      ao.configuration.color = aoColour;
      ao.configuration.denoiseIterations = 2;
      ao.configuration.denoiseRadius = halfRes ? 6 : 8;
      composer.addPass(new BeautyPass(scene, camera, ao.beautyRenderTarget));
      composer.addPass(ao);
    } else composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new SMAAPass());
    composer.addPass(new GentleBloom());
    composer.setPixelRatio(gl.getPixelRatio());
    composer.setSize(size.width, size.height);
    aoState.current.radius = 0;
    scene.userData.imageQuality = {
      quality,
      preference,
      dpr: gl.getPixelRatio(),
      halfResolutionAO: !!ao && halfRes,
      passes: [
        "beauty",
        ...(ao ? [halfRes ? "N8AO half resolution" : "N8AO full resolution"] : []),
        "SMAA",
        "graded bloom",
        "Neutral output",
      ],
    };
    pipeline.current = composer;
    occlusion.current = ao;
    invalidate();
    return () => {
      pipeline.current = null;
      occlusion.current = null;
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
  }, [
    gl,
    scene,
    camera,
    quality,
    preference,
    size.width,
    size.height,
    dpr,
    invalidate,
  ]);
  useFrame(({ controls }) => {
    // Ambient occlusion radius follows the camera: wide in the overview, tight in rooms.
    const ao = occlusion.current;
    if (!ao) return;
    const target = (controls as unknown as { target?: THREE.Vector3 } | null)
        ?.target,
      distance = target ? camera.position.distanceTo(target) : 40,
      room = !!useStore.getState().sim?.position?.room,
      radius = THREE.MathUtils.clamp(distance * 0.025, 0.5, 4),
      state = aoState.current;
    if (
      room !== state.room ||
      Math.abs(radius - state.radius) > state.radius * 0.1
    ) {
      state.radius = radius;
      state.room = room;
      ao.configuration.aoRadius = radius;
      ao.configuration.distanceFalloff = radius * 0.5;
      ao.configuration.intensity = room ? 1.6 : 1.3;
    }
  }, -80);
  useFrame((_, dt) => {
    if (lockedQuality) return;
    const sample = adaptive.current,
      active = motion.moving || useStore.getState().cameraMoving;
    if (document.hidden || !active || dt > 1) {
      sample.seconds = sample.frames = 0;
      return;
    }
    sample.seconds += dt;
    sample.frames++;
    if (sample.seconds < 4) return;
    const fps = sample.frames / sample.seconds,
      auto = useRenderQuality.getState();
    sample.slowWindows = fps < 45 ? sample.slowWindows + 1 : 0;
    sample.recovery = fps > 57 ? sample.recovery + 1 : 0;
    sample.seconds = sample.frames = 0;
    if (sample.slowWindows >= 2) {
      sample.slowWindows = 0;
      if (quality === "normal") useRenderQuality.setState({ autoLow: true });
      else if (dpr > 1)
        onDprChange?.(Math.max(1, Math.round((dpr - 0.25) * 100) / 100));
    } else if (sample.recovery >= 6) {
      sample.recovery = 0;
      if (dpr < Math.min(window.devicePixelRatio, 2))
        onDprChange?.(
          Math.min(
            window.devicePixelRatio,
            2,
            Math.round((dpr + 0.25) * 100) / 100,
          ),
        );
      else if (auto.autoLow) useRenderQuality.setState({ autoLow: false });
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
