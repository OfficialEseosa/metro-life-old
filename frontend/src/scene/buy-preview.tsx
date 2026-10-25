/* oxlint-disable react/immutability -- Buy mode owns the temporary camera, material previews and ghost transform. */
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { OrbitControls } from "three-stdlib";
import {
  useHomeDesign,
  placementReason,
  type FurnitureProduct,
} from "../home-design";
import { useBuyPreview } from "../buy-preview-state";
import { motion } from "../walking";
import { Builder } from "./geometry";

function ghostGeometry(p: FurnitureProduct) {
  const b = new Builder(),
    w = p.w,
    d = p.d,
    c = "#ffffff",
    legs = (height: number) => {
      for (const x of [-w * 0.38, w * 0.38])
        for (const z of [-d * 0.35, d * 0.35])
          b.box(x, height / 2, z, 0.07, height, 0.07, c);
    };
  if (p.kind === "bed") {
    b.box(0, 0.27, 0, w, 0.45, d, c);
    b.box(0, 0.56, 0, w, 0.16, d, c);
    b.box(w * 0.42, 0.75, 0, 0.12, 1, d, c);
    b.box(w * 0.28, 0.72, 0, w * 0.25, 0.17, d * 0.8, c);
  } else if (["chair", "sofa", "bench"].includes(p.kind)) {
    legs(0.35);
    b.box(0, 0.42, 0, w, 0.19, d, c);
    b.box(0, 0.85, -d * 0.42, w, 0.8, 0.15, c);
    for (const x of [-w * 0.44, w * 0.44]) b.box(x, 0.63, 0, 0.13, 0.3, d, c);
  } else if (["table", "desk"].includes(p.kind)) {
    legs(0.7);
    b.box(0, 0.75, 0, w, 0.1, d, c);
    if (p.kind === "desk") b.box(0, 1.06, -d * 0.28, w * 0.55, 0.5, 0.08, c);
  } else if (p.kind === "shower") {
    b.box(0, 0.07, 0, w, 0.14, d, c);
    b.box(0, 1.15, -d / 2, w, 2.3, 0.07, c);
    for (const x of [-w / 2, w / 2]) b.box(x, 1.1, 0, 0.06, 2.2, d, c);
  } else if (p.kind === "tub") {
    b.box(0, 0.3, 0, w, 0.6, d, c);
    b.box(0, 0.6, 0, w * 0.8, 0.06, d * 0.75, c);
  } else if (p.kind === "fridge") b.box(0, 1, 0, w, 2, d, c);
  else if (p.kind === "stove" || p.kind === "sink") {
    b.box(0, 0.43, 0, w, 0.86, d, c);
    b.box(0, 0.9, 0, w + 0.04, 0.07, d + 0.04, c);
    if (p.kind === "stove")
      for (const x of [-w * 0.25, w * 0.25])
        for (const z of [-d * 0.25, d * 0.25])
          b.cylinder(x, 0.96, z, 0.13, 0.04, c, 10);
  } else if (p.kind === "lamp") {
    b.cylinder(0, 0.05, 0, w * 0.4, 0.1, c, 10);
    b.cylinder(0, 0.8, 0, 0.035, 1.5, c, 6);
    b.cylinder(0, 1.55, 0, w * 0.55, 0.4, c, 10, w * 0.35);
  } else if (p.kind === "rug") b.box(0, 0.025, 0, w, 0.04, d, c);
  else if (p.kind === "shelf") {
    for (const x of [-w * 0.45, w * 0.45]) b.box(x, 0.85, 0, 0.07, 1.7, d, c);
    for (const y of [0.1, 0.6, 1.1, 1.6]) b.box(0, y, 0, w, 0.07, d, c);
  } else if (p.kind === "sculpture") {
    b.box(0, 0.15, 0, w, 0.3, d, c);
    b.torus(0, 0.85, 0, w * 0.45, 0.12, c);
  } else {
    b.cylinder(0, 0.2, 0, w * 0.4, 0.4, c, 10);
    b.cylinder(0, 0.65, 0, 0.035, 0.95, c, 6);
    b.sphere(0, 1.05, 0, w * 0.55, c, 0.8, 1, 0.8);
  }
  return b.build();
}

export function BuyPreview() {
  const open = useHomeDesign((s) => s.open),
    design = useHomeDesign((s) => s.design),
    catalog = useHomeDesign((s) => s.catalog),
    product = useBuyPreview((s) => s.product),
    preview = useRef<THREE.Group>(null),
    { camera, controls, gl, size, scene, invalidate } = useThree(),
    saved = useRef<{
      eye: THREE.Vector3;
      up: THREE.Vector3;
      target: THREE.Vector3;
      enabled: boolean;
      follow: boolean;
      fov: number;
      view: THREE.PerspectiveCamera["view"];
    } | null>(null),
    pointer = useMemo(() => new THREE.Vector2(), []),
    raycaster = useMemo(() => new THREE.Raycaster(), []),
    floor = useMemo(
      () => new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.08),
      [],
    ),
    hit = useMemo(() => new THREE.Vector3(), []),
    paint = useRef(new Map<THREE.MeshStandardMaterial, THREE.Color>());
  useEffect(() => useBuyPreview.subscribe(() => invalidate()), [invalidate]);
  const geometry = useMemo(
    () => (product ? ghostGeometry(product) : null),
    [product],
  );
  useEffect(() => () => geometry?.dispose(), [geometry]);
  useEffect(() => {
    if (!open) return;
    const control = controls as unknown as OrbitControls | undefined,
      perspective = camera as THREE.PerspectiveCamera;
    saved.current = {
      eye: camera.position.clone(),
      up: camera.up.clone(),
      target: control?.target.clone() ?? new THREE.Vector3(),
      enabled: control?.enabled ?? true,
      follow: motion.follow,
      fov: perspective.fov,
      view: perspective.view ? { ...perspective.view } : null,
    };
    motion.follow = false;
    if (control) control.enabled = false;
    invalidate();
    return () => {
      for (const [material, color] of paint.current) material.color.copy(color);
      paint.current.clear();
      scene.getObjectByName("furnished-home")?.children.forEach((child) => {
        if (child.name.startsWith("home-furniture:")) child.visible = true;
      });
      const old = saved.current;
      if (old) {
        camera.position.copy(old.eye);
        camera.up.copy(old.up);
        perspective.fov = old.fov;
        if (old.view)
          perspective.setViewOffset(
            old.view.fullWidth,
            old.view.fullHeight,
            old.view.offsetX,
            old.view.offsetY,
            old.view.width,
            old.view.height,
          );
        else perspective.clearViewOffset();
        perspective.updateProjectionMatrix();
        if (control) {
          control.target.copy(old.target);
          control.enabled = old.enabled;
          control.update();
        }
        motion.follow = old.follow;
        saved.current = null;
      }
      useBuyPreview.getState().clear();
      invalidate();
    };
  }, [open, camera, controls, invalidate, scene]);
  useEffect(() => {
    if (!open) return;
    const canvas = gl.domElement;
    let down: { x: number; y: number } | null = null;
    const point = (e: PointerEvent) => {
      const current = useHomeDesign.getState().design;
      if (!current) return false;
      const rect = canvas.getBoundingClientRect();
      pointer.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        (-(e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      camera.updateMatrixWorld(true);
      raycaster.setFromCamera(pointer, camera);
      if (!raycaster.ray.intersectPlane(floor, hit)) return false;
      const inside =
          Math.abs(hit.x) <= current.width / 2 &&
          Math.abs(hit.z) <= current.depth / 2,
        x = Math.round(hit.x * 4) / 4,
        z = Math.round(hit.z * 4) / 4,
        s = useBuyPreview.getState();
      if (s.point.x !== x || s.point.z !== z || s.inside !== inside) {
        useBuyPreview.setState({ point: { x, z }, inside });
        invalidate();
      }
      return inside;
    };
    const move = (e: PointerEvent) => {
      if (e.isPrimary && !useBuyPreview.getState().busy) point(e);
    };
    const start = (e: PointerEvent) => {
      if (e.button !== 0 || !e.isPrimary) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      down = { x: e.clientX, y: e.clientY };
      point(e);
    };
    const end = (e: PointerEvent) => {
      if (!down || e.button !== 0 || !e.isPrimary) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      const click = Math.hypot(e.clientX - down.x, e.clientY - down.y) < 7;
      down = null;
      if (!click || !point(e) || useBuyPreview.getState().busy) return;
      const state = useBuyPreview.getState(),
        home = useHomeDesign.getState();
      if (state.product) {
        window.dispatchEvent(new CustomEvent("metro-buy-place"));
        return;
      }
      const root = scene.getObjectByName("furnished-home");
      if (!root) return;
      const found = raycaster
        .intersectObjects(root.children, true)
        .find((row) => row.object.name.startsWith("home-furniture:"));
      if (!found) return;
      const item = home.design?.items.find(
          (row) => row.id === found.object.name.slice("home-furniture:".length),
        ),
        p = home.catalog?.items.find((row) => row.id === item?.catalogId);
      if (item && p) {
        state.choose(p, item);
        invalidate();
      }
    };
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerdown", start, true);
    canvas.addEventListener("pointerup", end, true);
    return () => {
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerdown", start, true);
      canvas.removeEventListener("pointerup", end, true);
    };
  }, [open, gl, camera, pointer, raycaster, floor, hit, scene, invalidate]);
  // OrbitControls updates at -1. Disable follow before Walking's 0 callback;
  // the composer (or R3F's normal render) still owns the actual draw.
  useFrame(() => {
    if (!open || !design) return;
    const control = controls as unknown as OrbitControls | undefined,
      perspective = camera as THREE.PerspectiveCamera,
      phone = size.width < 700,
      panel = document.querySelector(".buy-mode--3d")?.getBoundingClientRect(),
      left = phone ? 10 : (panel?.right ?? 345) + 18,
      right = phone ? 10 : 25,
      top = phone ? 50 : 75,
      bottom = phone
        ? size.height - (panel?.top ?? size.height * 0.52) + 12
        : 35,
      availableW = Math.max(120, size.width - left - right),
      availableH = Math.max(120, size.height - top - bottom),
      tan = Math.tan(THREE.MathUtils.degToRad(40) / 2),
      height = Math.max(
        (design.width + 1.8) /
          ((2 * tan * (size.width / size.height) * availableW) / size.width),
        (design.depth + 1.8) / ((2 * tan * availableH) / size.height),
      );
    motion.follow = false;
    if (control) {
      control.enabled = false;
      control.target.set(0, 0, 0);
    }
    perspective.fov = 40;
    perspective.setViewOffset(
      size.width,
      size.height,
      (right - left) / 2,
      (bottom - top) / 2,
      size.width,
      size.height,
    );
    perspective.updateProjectionMatrix();
    camera.up.set(0, 0, -1);
    camera.position.set(0, height, 0.001);
    camera.lookAt(0, 0, 0);
    const state = useBuyPreview.getState(),
      reason =
        state.product && catalog
          ? placementReason(
              design,
              catalog,
              state.product,
              state.point.x,
              state.point.z,
              state.rotation,
              state.moving?.id,
            )
          : "",
      valid = state.inside && !reason;
    if (preview.current) {
      preview.current.visible = !!state.product && state.inside;
      preview.current.position.set(state.point.x, 0.07, state.point.z);
      preview.current.rotation.y = (state.rotation * Math.PI) / 2;
      preview.current.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          const m = o.material as THREE.MeshStandardMaterial;
          m.color.set(valid ? "#64c98b" : "#e57c72");
          m.emissive?.set(valid ? "#244a32" : "#6d2725");
        }
      });
    }
    // Paint is a reversible preview until the catalogue's Apply button is pressed.
    const root = scene.getObjectByName("furnished-home");
    if (root) {
      for (const child of root.children)
        if (child.name.startsWith("home-furniture:"))
          child.visible = child.name !== `home-furniture:${state.moving?.id}`;
      const wall = state.wallPreview,
        floorColor = state.floorPreview;
      for (const [material, color] of paint.current) material.color.copy(color);
      if (!wall && !floorColor) paint.current.clear();
      root.traverse((o) => {
        if (!(o instanceof THREE.Mesh)) return;
        let at: THREE.Object3D | null = o,
          isWall = false;
        while (at && at !== root) {
          if (at.name.startsWith("room-wall-")) isWall = true;
          at = at.parent;
        }
        const isFloor =
            o.parent === root && Math.abs(o.position.y + 0.13) < 0.01,
          newColor = isWall ? wall : isFloor ? floorColor : null;
        if (!newColor) return;
        const material = o.material as THREE.MeshStandardMaterial;
        if (!paint.current.has(material))
          paint.current.set(material, material.color.clone());
        const desired = new THREE.Color(newColor),
          old = new THREE.Color(isWall ? design.wallColor : design.floorColor);
        material.color
          .copy(paint.current.get(material)!)
          .multiply(
            new THREE.Color().setRGB(
              desired.r / Math.max(0.001, old.r),
              desired.g / Math.max(0.001, old.g),
              desired.b / Math.max(0.001, old.b),
            ),
          );
      });
    }
    invalidate();
  }, -0.1);
  if (!open || !geometry || !product) return null;
  return (
    <group name="buy-placement-ghost" ref={preview}>
      <mesh geometry={geometry} raycast={() => {}}>
        <meshStandardMaterial
          color="#64c98b"
          emissive="#244a32"
          emissiveIntensity={0.25}
          transparent
          opacity={0.86}
          depthWrite={false}
        />
      </mesh>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.025, 0]}
        raycast={() => {}}
      >
        <planeGeometry args={[product.w, product.d]} />
        <meshStandardMaterial
          color="#64c98b"
          transparent
          opacity={0.33}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
