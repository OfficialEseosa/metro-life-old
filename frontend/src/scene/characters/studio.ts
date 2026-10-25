/**
 * One shared off-screen renderer for every character picture outside the city: the creator's
 * turning preview and the HUD portraits. One WebGL context for all of them, created once and
 * kept, so swapping a look never tears down a context or flashes an empty frame.
 */
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import type { Look } from "../../api/types";
import { CharacterActor, loadLook, lookKey, lookReady } from "./actor";

type View = {
  canvas: HTMLCanvasElement;
  background: string;
  actor?: CharacterActor;
  key?: string;
  wanted?: Look;
  turn: number;
};
type Portrait = { key: string; look: Look; resolve: (url: string) => void };

class CharacterStudio {
  private renderer?: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(30, 1, 0.05, 50);
  private views = new Set<View>();
  private portraits: Portrait[] = [];
  private frame = 0;
  private last = 0;
  private drawnAt = 0;
  private failed = false;

  private ensure() {
    if (this.renderer || this.failed) return this.renderer;
    try {
      const canvas = document.createElement("canvas");
      const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true,
        preserveDrawingBuffer: true,
        powerPreference: "low-power",
      });
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.NeutralToneMapping;
      renderer.toneMappingExposure = 1.05;
      const pmrem = new THREE.PMREMGenerator(renderer),
        environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      pmrem.dispose();
      this.scene.environment = environment;
      this.scene.environmentIntensity = 0.35;
      const hemisphere = new THREE.HemisphereLight("#f3ead9", "#a08a70", 1.1),
        key = new THREE.DirectionalLight("#fff0d8", 2.4),
        fill = new THREE.DirectionalLight("#d8e6ff", 0.7),
        rim = new THREE.DirectionalLight("#ffe2c0", 1.4);
      key.position.set(2.5, 4, 4);
      fill.position.set(-3, 2, 2);
      rim.position.set(-1.5, 3, -4);
      this.scene.add(hemisphere, key, fill, rim);
      this.renderer = renderer;
    } catch {
      this.failed = true;
    }
    return this.renderer;
  }

  private schedule() {
    if (this.frame) return;
    this.frame = requestAnimationFrame((t) => this.tick(t));
  }

  private tick(now: number) {
    this.frame = 0;
    const dt = this.last ? Math.min((now - this.last) / 1000, 0.1) : 0.016;
    this.last = now;
    const renderer = this.ensure();
    if (!renderer) return;
    // Portraits first: one per frame keeps the preview smooth.
    const portrait = this.portraits[0];
    if (portrait && lookReady(portrait.look)) {
      this.portraits.shift();
      portrait.resolve(this.drawPortrait(renderer, portrait.look));
    } else if (portrait) void loadLook(portrait.look).then(() => this.schedule());
    // Turning previews at up to 30 frames a second.
    if (now - this.drawnAt > 30) {
      const step = this.drawnAt ? Math.min((now - this.drawnAt) / 1000, 0.1) : dt;
      this.drawnAt = now;
      for (const view of this.views) this.drawView(renderer, view, step);
    }
    if (this.views.size || this.portraits.length) this.schedule();
  }

  private place(actor: CharacterActor) {
    this.scene.add(actor.root);
  }

  private drawView(renderer: THREE.WebGLRenderer, view: View, dt: number) {
    const wanted = view.wanted;
    if (wanted) {
      const key = lookKey(wanted);
      if (key !== view.key) {
        if (lookReady(wanted)) {
          // Swap only when the new person is fully ready, so the preview never goes blank.
          const next = new CharacterActor(wanted, { faceSize: 512 });
          view.actor?.dispose();
          view.actor = next;
          view.key = key;
        } else void loadLook(wanted).then(() => this.schedule());
      }
    }
    const actor = view.actor,
      width = view.canvas.clientWidth,
      height = view.canvas.clientHeight;
    if (!actor || !width || !height) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2),
      w = Math.round(width * ratio),
      h = Math.round(height * ratio);
    if (view.canvas.width !== w || view.canvas.height !== h) {
      view.canvas.width = w;
      view.canvas.height = h;
    }
    view.turn += dt * 0.35;
    actor.root.rotation.y = Math.sin(view.turn) * 0.75;
    actor.update(dt, { pose: "Idle", speed: 0, now: Date.now() });
    this.place(actor);
    renderer.setPixelRatio(1);
    renderer.setSize(w, h, false);
    renderer.setClearColor(view.background, 1);
    // Full body, a little room above the head.
    const aspect = w / h,
      distance = Math.max(3.75, 1.75 / aspect);
    this.camera.fov = 30;
    this.camera.aspect = aspect;
    this.camera.position.set(0, 1.0, distance);
    this.camera.lookAt(0, 0.9, 0);
    this.camera.updateProjectionMatrix();
    renderer.render(this.scene, this.camera);
    this.scene.remove(actor.root);
    const ctx = view.canvas.getContext("2d");
    if (ctx) {
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(renderer.domElement, 0, 0, w, h);
    }
  }

  private drawPortrait(renderer: THREE.WebGLRenderer, look: Look) {
    const actor = new CharacterActor(look, { faceSize: 512 });
    // Settle into a relaxed idle before the picture.
    for (let i = 0; i < 6; i++) actor.update(0.1, { pose: "Idle", speed: 0, now: Date.now() });
    this.place(actor);
    const size = 192;
    renderer.setPixelRatio(1);
    renderer.setSize(size, size, false);
    renderer.setClearColor("#ead9bb", 1);
    const head = actor.headTop(new THREE.Vector3());
    this.camera.fov = 22;
    this.camera.aspect = 1;
    this.camera.position.set(0.18, head.y - 0.14, 1.55);
    this.camera.lookAt(0, head.y - 0.24, 0);
    this.camera.updateProjectionMatrix();
    renderer.render(this.scene, this.camera);
    const url = renderer.domElement.toDataURL("image/png");
    this.scene.remove(actor.root);
    actor.dispose();
    return url;
  }

  /** Attach a 2D canvas that shows a turning, full-body person. */
  attach(canvas: HTMLCanvasElement, background: string) {
    const view: View = { canvas, background, turn: 0 };
    this.views.add(view);
    this.schedule();
    return {
      setLook: (look: Look) => {
        view.wanted = look;
        this.schedule();
      },
      detach: () => {
        this.views.delete(view);
        view.actor?.dispose();
        view.actor = undefined;
      },
    };
  }

  /** A head-and-shoulders picture as a data URL. */
  portrait(key: string, look: Look) {
    return new Promise<string>((resolve) => {
      this.portraits.push({ key, look, resolve });
      this.schedule();
    });
  }
}

export const characterStudio = new CharacterStudio();
