import { useHomeDesign } from "../home-design";
import { RiggedCharacter, type CharacterPose } from "./character";
import { groundHeight } from "./ground";
/* oxlint-disable react/immutability -- Three instances and motion refs are imperative animation resources. */
import { Suspense, useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { OrbitControls } from "three-stdlib";
import type { RefObject } from "react";
import { api } from "../api/client";
import { useStore } from "../store";
import {
  doorsFor,
  slide,
  navigation,
  inBox,
  roomLayout,
  roomType,
} from "../navigation";
import { activityRoute } from "./activity-route";
import { interactionSteering } from "../interactions";
import { friendlyMessage, motion, useWalking, interact } from "../walking";
import { nearbyPerson } from "../ui/walking-actions";
import { activeLifeAction, lifeLabel, lifeTopic } from "../life-actions";
import { bodyCondition, visiblePose, velocityFacing } from "./character-life";
import { LifeBubble, StinkCloud } from "./speech-bubbles";
import { roomFloorHeight } from "./venue-zones";
import { roomView, streetView } from "./room-camera";

export function Walking({
  controls,
  cancelFlight,
}: {
  controls: RefObject<OrbitControls | null>;
  cancelFlight: () => void;
}) {
  const sim = useStore((s) => s.sim),
    city = useStore((s) => s.city),
    { invalidate, camera, gl, size, scene } = useThree(),
    ref = useRef<THREE.Group>(null),
    doorRef = useRef<THREE.InstancedMesh>(null);
  const visual = useRef(new THREE.Vector3()),
    renderedSpeed = useRef(0),
    stagedPose = useRef<CharacterPose>("Idle"),
    hip = useRef<number | undefined>(undefined),
    socialUntil = useRef(0);
  const activityPath = useRef<{ x: number; z: number }[]>([]),
    lastSlot = useRef(""),
    releasePoint = useRef<{ x: number; z: number } | null>(null);
  const visualRevision = useRef(motion.teleport);
  const pending = useRef(false),
    sent = useRef(0),
    lastContext = useRef(0),
    lastPosition = useRef(""),
    cameraAngle = useRef(0),
    lastHeading = useRef(0),
    lastTarget = useRef(0),
    groundY = useRef(0),
    phase = useRef(0),
    key = sim ? `${sim.worldId}:${sim.city}:${sim.position?.room ?? ""}` : "";
  // oxlint-disable-next-line react-hooks/exhaustive-deps -- Recompute layout on the primitive home/city identity, without subscribing to 5Hz positions.
  const doors = useMemo(() => {
    const current = useStore.getState().sim;
    return current && !current.position?.room && current.city === city
      ? Object.entries(doorsFor(current))
      : [];
  }, [
    sim?.home.city,
    sim?.home.neighborhood,
    sim?.city,
    sim?.position?.room,
    city,
  ]);
  const social = useStore((s) => s.socialNotice);
  useEffect(() => {
    socialUntil.current = performance.now() + 3200;
    invalidate();
  }, [social, invalidate]);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useEffect(() => {
    motion.flush = async () => {
      while (pending.current) await new Promise((r) => setTimeout(r, 30));
      const state = useStore.getState(),
        p = motion.position;
      if (!state.sim || !p) return;
      pending.current = true;
      const revision = motion.revision,
        user = state.sim.userId,
        world = state.sim.worldId;
      const via = motion.trail.splice(0);
      try {
        // A lost answer is retried once before the action that needs this position gives up.
        const r = await api
          .move(state.sim.city, { ...p }, via)
          .catch((e: { status?: number }) => {
            if (e?.status) throw e;
            return api.move(state.sim!.city, { ...p }, via);
          });
        // The request layer never hands back an empty answer, but stay safe if one slips through.
        if (!r?.position)
          throw Error("Could not confirm where you are standing. Try again.");
        const live = useStore.getState().sim;
        if (
          live?.userId !== user ||
          live.worldId !== world ||
          revision !== motion.revision
        )
          return;
        useStore.setState((s) => ({
          sim: s.sim
            ? {
                ...s.sim,
                position: r.position,
                loc: r.position.place,
                activitySlot: null,
              }
            : null,
        }));
      } finally {
        pending.current = false;
      }
    };
    return () => {
      motion.flush = async () => {};
    };
  }, []);
  useEffect(() => {
    motion.wake = invalidate;
    return () => {
      motion.wake = () => {};
      motion.position = null;
      useWalking.setState({ position: null });
    };
  }, [invalidate]);
  useEffect(() => {
    const current = useStore.getState().sim;
    if (current?.position && city === current.city) {
      motion.position = { ...current.position };
      visual.current.set(current.position.x, 0, current.position.z);
      activityPath.current = [];
      lastSlot.current = "";
      releasePoint.current = null;
      motion.follow = true;
      motion.camera = null;
      cameraAngle.current = current.position.room ? 0.45 : 0;
      if (camera instanceof THREE.PerspectiveCamera) {
        camera.fov = current.position.room ? 32 : 38;
        camera.updateProjectionMatrix();
      }
      const type = roomType(current.position.room);
      if (type) {
        const frame = roomView(
          roomLayout(city, type),
          size.width / size.height,
          current.position,
          size.width < 700,
        );
        camera.position
          .copy(frame.target)
          .add(
            new THREE.Vector3(
              Math.sin(frame.yaw) * frame.distance,
              frame.height,
              Math.cos(frame.yaw) * frame.distance,
            ),
          );
        controls.current?.target.copy(frame.target);
      } else {
        const frame = streetView(size.width);
        camera.position.set(
          current.position.x,
          frame.height + frame.targetY,
          current.position.z + frame.distance,
        );
        controls.current?.target.set(
          current.position.x,
          frame.targetY,
          current.position.z,
        );
      }
      ref.current?.rotation.set(0, current.position.face, 0);
      controls.current?.update();
      useWalking.setState({ position: { ...current.position }, error: "" });
      invalidate();
    }
  }, [key, city, invalidate, camera, controls]);
  useEffect(() => {
    // Server relocations (doors, travel, flights) arrive through store.setSim, which moves
    // `motion`; here only a room mismatch is repaired. Distance alone is not a reason to snap: on
    // a slow link or at a low frame rate the confirmed position trails the walking player.
    if (
      sim?.position &&
      motion.position &&
      (sim.position.room ?? null) !== (motion.position.room ?? null)
    ) {
      motion.position = { ...sim.position };
      visual.current.set(sim.position.x, 0, sim.position.z);
      activityPath.current = [];
      lastSlot.current = "";
      releasePoint.current = null;
      motion.follow = true;
      invalidate();
    }
  }, [sim?.position, sim?.busyUntil, invalidate]);
  useEffect(() => {
    const keys = new Set<string>();
    const update = () => {
      motion.x =
        Number(keys.has("d") || keys.has("arrowright")) -
        Number(keys.has("a") || keys.has("arrowleft"));
      motion.z =
        Number(keys.has("s") || keys.has("arrowdown")) -
        Number(keys.has("w") || keys.has("arrowup"));
      motion.run = keys.has("shift");
      invalidate();
    };
    const down = (e: KeyboardEvent) => {
      const s = useStore.getState();
      if (
        !s.sim ||
        s.sim.introDone === false ||
        (s.sim.firstDay?.complete && !s.sim.firstDay.closingSeen) ||
        s.panel ||
        s.searchOpen ||
        useHomeDesign.getState().open
      )
        return;
      if (
        (e.target as HTMLElement)?.closest(
          'input,textarea,select,[contenteditable="true"]',
        )
      )
        return;
      if (
        [
          "w",
          "a",
          "s",
          "d",
          "arrowup",
          "arrowdown",
          "arrowleft",
          "arrowright",
          "shift",
        ].includes(e.key.toLowerCase())
      ) {
        e.preventDefault();
        keys.add(e.key.toLowerCase());
        update();
      } else if (
        (e.key.toLowerCase() === "e" || e.key === "Enter") &&
        !e.repeat
      ) {
        e.preventDefault();
        interact();
      } else if (e.key === "Escape") {
        const s = useStore.getState();
        if (!s.panel && !s.searchOpen && s.sim?.position?.room)
          window.dispatchEvent(new Event("metro-back"));
        else {
          s.openPanel(null);
          s.setSearchOpen(false);
        }
      }
    };
    const up = (e: KeyboardEvent) => {
      keys.delete(e.key.toLowerCase());
      update();
    };
    const clear = () => {
      keys.clear();
      update();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", clear);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", clear);
      motion.x = motion.z = 0;
    };
  }, [invalidate]);
  useEffect(() => {
    if (!doorRef.current) return;
    doors.forEach(([id, d], i) => {
      dummy.position.set(d.x, 0.055, d.z - (id === "home" ? 1.1 : 0.35));
      dummy.scale.set(1.5, 0.05, 1);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      doorRef.current!.setMatrixAt(i, dummy.matrix);
    });
    doorRef.current.instanceMatrix.needsUpdate = true;
    doorRef.current.computeBoundingSphere();
    invalidate();
  }, [doors, dummy, invalidate]);
  useEffect(() => {
    if (!sim?.busyUntil) return;
    const timer = setInterval(() => {
      if (!document.hidden) invalidate();
    }, 1000 / 30);
    return () => clearInterval(timer);
  }, [sim?.busyUntil, invalidate]);
  useEffect(() => {
    if (sim?.busyUntil && sim.position && motion.position)
      motion.position.face = sim.position.face;
  }, [sim?.busyUntil, sim?.position]);
  useFrame((_, dt) => {
    if (
      !sim ||
      sim.trip ||
      sim.city !== city ||
      !motion.position ||
      !ref.current
    )
      return;
    // Real elapsed time drives walking, so speed is the same at 10 or 60 frames a second. Long
    // stalls (a hidden tab) are capped so nobody teleports across the map.
    const elapsed = Math.min(dt, 0.5);
    motion.walkClock += elapsed;
    const s = useStore.getState(),
      blocked =
        useHomeDesign.getState().open ||
        s.sim?.introDone === false ||
        !!(s.sim?.firstDay?.complete && !s.sim.firstDay.closingSeen) ||
        s.acting ||
        !!s.sim?.busyUntil ||
        !!s.sim?.pendingBeat ||
        !!s.panel ||
        s.searchOpen,
      p = motion.position,
      manual = Math.hypot(motion.x, motion.z) > 0,
      auto = interactionSteering(performance.now(), manual),
      axis = manual ? { x: motion.x, z: motion.z } : auto,
      length = Math.hypot(axis.x, axis.z),
      moving = length > 0 && !blocked;
    if (visualRevision.current !== motion.teleport) {
      visualRevision.current = motion.teleport;
      visual.current.set(p.x, 0, p.z);
      activityPath.current = [];
      lastSlot.current = "";
      releasePoint.current = null;
      motion.follow = true;
    }
    motion.moving = moving;
    if (moving) {
      cancelFlight();
      motion.follow = true;
      const condition = bodyCondition(s.sim ?? sim),
        speed =
          (manual && motion.run ? 6 : 3.1) *
          (condition.tired ? 0.68 : condition.hungry ? 0.86 : 1);
      // Walk the frame's distance in short pieces: collisions stay exact and a route turns its
      // corners within the same frame instead of losing the rest of the step.
      let remaining = speed * elapsed,
        direction = axis,
        pieces = 0;
      while (remaining > 1e-4 && pieces++ < 12) {
        const reach = Math.hypot(direction.x, direction.z);
        if (reach < 1e-6) break;
        const step = Math.min(remaining, 0.2, manual ? Infinity : reach),
          before = motion.position;
        motion.position = slide(
          city,
          before,
          (direction.x / reach) * step,
          (direction.z / reach) * step,
        );
        const moved = Math.hypot(
          motion.position.x - before.x,
          motion.position.z - before.z,
        );
        remaining -= step;
        if (manual) {
          // Joystick turns and wall slides bend the walked line; keep those bends for the server.
          const last = motion.trail[motion.trail.length - 1] ?? s.sim?.position,
            heading = Math.atan2(
              motion.position.x - before.x,
              motion.position.z - before.z,
            );
          if (
            moved > 1e-3 &&
            last &&
            Math.abs(
              Math.atan2(
                Math.sin(heading - lastHeading.current),
                Math.cos(heading - lastHeading.current),
              ),
            ) > 0.12 &&
            motion.trail.length < 16
          )
            motion.trail.push({ x: before.x, z: before.z });
          if (moved > 1e-3) lastHeading.current = heading;
          if (moved < step * 0.2) break;
        } else {
          if (moved < 1e-4) break;
          direction = interactionSteering(performance.now(), false);
        }
      }
      phase.current += elapsed * speed * 2.5;
      invalidate();
    }
    const at = motion.position,
      slot = moving ? null : s.sim?.activitySlot,
      slotKey = slot ? `${at.room}:${slot.id}:${s.sim?.busyUntil ?? ""}` : "";
    if (slotKey !== lastSlot.current) {
      if (slot && at.room) {
        const type = roomType(at.room)!,
          station = roomLayout(city, type).stations.find(
            (st) => st.id === (slot.station ?? slot.id),
          );
        const approach =
          motion.useApproach?.slotId === slot.id
            ? { x: motion.useApproach.x, z: motion.useApproach.z }
            : station
              ? { x: station.x, z: station.z }
              : { x: at.x, z: at.z };
        activityPath.current = [
          ...activityRoute(
            city,
            at.room,
            { x: visual.current.x, z: visual.current.z },
            approach,
          ),
          { x: slot.x, z: slot.z },
        ];
        releasePoint.current = approach;
      } else {
        activityPath.current =
          at.room && releasePoint.current ? [releasePoint.current] : [];
        releasePoint.current = null;
      }
      lastSlot.current = slotKey;
    }
    while (
      activityPath.current.length &&
      Math.hypot(
        activityPath.current[0].x - visual.current.x,
        activityPath.current[0].z - visual.current.z,
      ) < 0.035
    )
      activityPath.current.shift();
    const beforeX = visual.current.x,
      beforeZ = visual.current.z;
    const waypoint = activityPath.current[0],
      goal = new THREE.Vector3(
        waypoint?.x ?? slot?.x ?? at.x,
        0,
        waypoint?.z ?? slot?.z ?? at.z,
      ),
      gap = visual.current.distanceTo(goal),
      staging = gap > 0.035 || activityPath.current.length > 1,
      // Catch up faster when far behind, so the body never trails the walking position.
      step = Math.min(
        1,
        (Math.max(4.2, gap * 3) * Math.min(dt, 0.5)) / Math.max(gap, 0.001),
      );
    visual.current.lerp(goal, step);
    if (staging) invalidate();
    const seated =
      !!slot && ["Sit", "Sleep", "Lie", "Type", "Eat"].includes(slot.pose);
    groundY.current = at.room
      ? roomFloorHeight(
          city,
          roomType(at.room)!,
          visual.current.x,
          visual.current.z,
        )
      : 0;
    if (!staging && slot?.y !== undefined && !seated) groundY.current = slot.y;
    else if (at.room?.startsWith("club:") && visual.current.z < -2.3)
      groundY.current = 0.36;
    if (!at.room) groundY.current = groundHeight(scene, city, at.x, at.z);
    // Activity effects (steam, spray, Zs) are drawn by scene/activity.tsx for everyone.
    const busy = !!sim.busyUntil;
    if (busy) {
      phase.current += Math.min(dt, 0.05) * 5;
      invalidate();
    }
    ref.current.position.set(
      visual.current.x,
      groundY.current,
      visual.current.z,
    );
    const vx = visual.current.x - beforeX,
      vz = visual.current.z - beforeZ,
      speed = Math.hypot(vx, vz) / Math.max(0.001, dt),
      targetFace =
        speed > 0.08
          ? Math.atan2(vx, vz)
          : !staging && slot
            ? slot.face
            : ref.current.rotation.y;
    renderedSpeed.current = speed;
    ref.current.rotation.y = velocityFacing(
      ref.current.rotation.y,
      targetFace,
      dt,
      speed > 0.08,
    );
    const face = ref.current.rotation.y,
      turningToSlot =
        !!slot &&
        !staging &&
        Math.abs(
          Math.atan2(Math.sin(targetFace - face), Math.cos(targetFace - face)),
        ) > 0.16;
    hip.current =
      !staging && !turningToSlot && seated && slot?.y !== undefined
        ? slot.y - groundY.current
        : undefined;
    stagedPose.current =
      speed > 0.08
        ? motion.run && moving
          ? "Run"
          : "Walk"
        : turningToSlot
          ? "Idle"
          : staging
            ? "Idle"
            : activeLifeAction(s.sim ?? sim)
              ? visiblePose(s.sim ?? sim)
              : busy
                ? visiblePose(s.sim ?? sim)
                : ((slot?.pose as CharacterPose) ??
                  (performance.now() < socialUntil.current &&
                  s.socialNotice.includes(sim.username)
                    ? s.socialNotice.includes("waved")
                      ? "Wave"
                      : "Talk"
                    : "Idle"));
    // After a teleport the camera jumps to the player instead of sweeping across the map.
    const snap = motion.snapCamera && motion.follow;
    if (snap) {
      motion.snapCamera = false;
      cancelFlight();
    }
    if (at.room && motion.follow && controls.current) {
      const type = roomType(at.room)!,
        frame = roomView(
          roomLayout(city, type),
          size.width / size.height,
          visual.current,
          size.width < 700,
        ),
        control = controls.current,
        target = frame.follows
          ? frame.target
          : motion.camera
          ? new THREE.Vector3(
              THREE.MathUtils.clamp(
                control.target.x,
                -frame.bounds.w / 2 + 1,
                frame.bounds.w / 2 - 1,
              ),
              frame.target.y,
              THREE.MathUtils.clamp(
                control.target.z,
                -frame.bounds.d / 2 + 1,
                frame.bounds.d / 2 - 1,
              ),
            )
          : frame.target,
        angle = motion.camera?.angle ?? frame.yaw,
        distance = motion.camera?.distance ?? frame.distance,
        height = motion.camera?.height ?? frame.height,
        eye = target
          .clone()
          .add(
            new THREE.Vector3(
              Math.sin(angle) * distance,
              height,
              Math.cos(angle) * distance,
            ),
          ),
        smoothing = snap ? 1 : 1 - Math.exp(-Math.min(dt, 0.1) * 6);
      camera.position.lerp(eye, smoothing);
      control.target.lerp(target, smoothing);
      control.update();
      if (camera.position.distanceTo(eye) > 0.02) invalidate();
    }
    if (!at.room && motion.follow && controls.current) {
      const frame = streetView(size.width),
        distance = motion.camera?.distance ?? frame.distance,
        height = motion.camera?.height ?? frame.height,
        angle = motion.camera?.angle ?? cameraAngle.current,
        // Look a little ahead of a walking player so the street they head into stays in view.
        ahead = moving ? frame.lookAhead : 0,
        heading = ref.current.rotation.y;
      const target = new THREE.Vector3(
        visual.current.x + Math.sin(heading) * ahead,
        groundY.current + frame.targetY,
        visual.current.z + Math.cos(heading) * ahead,
      );
      let eye = target
        .clone()
        .add(
          new THREE.Vector3(
            Math.sin(angle) * distance,
            height,
            Math.cos(angle) * distance,
          ),
        );
      const clear = (eye: THREE.Vector3) =>
        !!at.room ||
        navigation[city].boxes.every((b) => {
          for (let t = 0.1; t < 1; t += 0.08) {
            const x = at.x + (eye.x - at.x) * t,
              z = at.z + (eye.z - at.z) * t,
              y = target.y + (eye.y - target.y) * t;
            if (inBox(x, z, b, 0.25) && y < b.h + 1.1) return false;
          }
          return true;
        });
      if (!motion.camera && !clear(eye)) {
        for (const angle of [0, 0.7, -0.7, 1.4, -1.4, Math.PI, 2.1, -2.1]) {
          const next = target
            .clone()
            .add(
              new THREE.Vector3(
                Math.sin(angle) * distance,
                height,
                Math.cos(angle) * distance,
              ),
            );
          if (clear(next)) {
            cameraAngle.current = angle;
            eye = next;
            camera.position.copy(eye);
            break;
          }
        }
      }
      const t = snap ? 1 : 1 - Math.exp(-Math.min(dt, 0.1) * 6);
      camera.position.lerp(eye, t);
      controls.current.target.lerp(target, t);
      controls.current.update();
      if (camera.position.distanceTo(eye) > 0.02) invalidate();
    }
    const now = performance.now();
    if (now - lastTarget.current > 200) {
      lastTarget.current = now;
      const self = s.sim,
        nearest =
          self && !self.busyUntil && !self.trip
            ? nearbyPerson(self, at, s.players)
            : undefined;
      const current = self && s.socialTarget
          ? s.players.find((player) => player.id === s.socialTarget?.id)
          : undefined,
        eligible =
          self && !self.busyUntil && !self.trip && current
            ? nearbyPerson(self, at, [current])
            : undefined,
        nearestDistance = nearest?.position
          ? Math.hypot(nearest.position.x - at.x, nearest.position.z - at.z)
          : Infinity,
        currentDistance = eligible?.position
          ? Math.hypot(eligible.position.x - at.x, eligible.position.z - at.z)
          : Infinity,
        person =
          eligible?.position && nearestDistance > currentDistance - 0.75
            ? eligible
            : nearest;
      s.setSocialTarget(
        person?.position
          ? {
              id: person.id,
              name: person.username,
              npc: !!person.npc,
              distance: Math.hypot(
                person.position.x - at.x,
                person.position.z - at.z,
              ),
            }
          : null,
      );
    }
    if (
      now - lastContext.current > 100 &&
      lastPosition.current !== `${at.x}:${at.z}:${at.room}`
    ) {
      lastContext.current = now;
      lastPosition.current = `${at.x}:${at.z}:${at.room}`;
      useWalking.setState({ position: { ...at } });
    }
    if (
      !s.acting &&
      !s.sim?.busyUntil &&
      !s.sim?.pendingBeat &&
      now - sent.current >= 200 &&
      !pending.current &&
      (moving ||
        Math.hypot(
          at.x - (s.sim?.position?.x ?? at.x),
          at.z - (s.sim?.position?.z ?? at.z),
        ) > 0.03)
    ) {
      pending.current = true;
      sent.current = now;
      const requested = { ...at },
        via = motion.trail.splice(0),
        world = sim.worldId,
        user = sim.userId,
        revision = motion.revision;
      void api
        .move(city, requested, via)
        .then((r) => {
          // A step confirmed after an activity began must not clear the activity's seat (the
          // sleeper would lie down beside the bed instead of in it).
          if (
            !r?.position ||
            useStore.getState().sim?.busyUntil ||
            useStore.getState().sim?.worldId !== world ||
            useStore.getState().sim?.userId !== user ||
            revision !== motion.revision
          )
            return;
          useStore.setState((s) => ({
            sim: s.sim
              ? {
                  ...s.sim,
                  position: r.position,
                  loc: r.position.place,
                  activitySlot: null,
                }
              : null,
          }));
          useWalking.setState({ error: "" });
        })
        .catch(async (e) => {
          if (
            useStore.getState().sim?.userId !== user ||
            revision !== motion.revision
          )
            return;
          // A lost or late answer is not a refusal: keep walking and send the same corners again
          // with the next update.
          if (!e?.status) {
            if (motion.trail.length + via.length <= 16)
              motion.trail.unshift(...via);
            return;
          }
          // A refused step snaps back to the last confirmed spot. Being too fast is routine
          // (a long frame); only a real obstacle is worth a word.
          motion.trail = [];
          if (/blocked/i.test(e?.message ?? ""))
            useWalking.setState({
              error: "Something is in the way. Try another direction.",
            });
          else if (!/faster than running/i.test(e?.message ?? ""))
            useWalking.setState({ error: friendlyMessage(e) });
          try {
            const r = await api.sim();
            if (
              r.sim.worldId === world &&
              r.sim.userId === user &&
              r.sim.position
            ) {
              motion.position = { ...r.sim.position };
              useStore.getState().setSim(r.sim);
              invalidate();
            }
          } catch {
            /* Retry on next movement; keep last confirmed state. */
          }
        })
        .finally(() => {
          pending.current = false;
          invalidate();
        });
    }
    const v = new THREE.Vector3(
        visual.current.x,
        3.2,
        visual.current.z,
      ).project(camera),
      el = document.querySelector<HTMLElement>(".walking-anchor");
    if (el?.firstElementChild)
      el.style.transform = `translate3d(${((v.x + 1) * size.width) / 2}px,${((1 - v.y) * size.height) / 2}px,0)`;
    gl.shadowMap.autoUpdate = false;
  });
  if (!sim || sim.trip || city !== sim.city) return null;
  const label = [sim.job?.title, lifeLabel(sim)].filter(Boolean).join(" · "),
    condition = bodyCondition(sim),
    speaking = ["Talk", "Wave", "Cheer", "Sleep"].includes(visiblePose(sim)),
    readPosition = () => ({
      x: visual.current.x,
      y: groundY.current,
      z: visual.current.z,
    });
  return (
    <>
      <group name="controlled-player" ref={ref}>
        <Suspense fallback={null}>
          <RiggedCharacter
            look={sim.look}
            readPose={() => stagedPose.current}
            readHipHeight={() => hip.current}
            readSpeed={() => renderedSpeed.current}
            readStartedAt={() => {
              const current = useStore.getState().sim;
              return (
                (
                  current?.lifeAction as
                    { startedAt?: number } | null | undefined
                )?.startedAt ??
                current?.busyStartedAt ??
                undefined
              );
            }}
            readCondition={() => bodyCondition(useStore.getState().sim ?? sim)}
          />
        </Suspense>
      </group>
      {
        <LifeBubble
          id={sim.userId}
          kind="self"
          name={sim.username}
          label={label}
          topic={lifeTopic(sim)}
          speaking={speaking}
          readPosition={readPosition}
        />
      }{" "}
      {condition.dirty && <StinkCloud readPosition={readPosition} />}
      <instancedMesh
        name="walk-doors"
        ref={doorRef}
        args={[undefined, undefined, doors.length]}
      >
        <boxGeometry />
        <meshStandardMaterial
          color="#f3cd7b"
          emissive="#d2aa40"
          emissiveIntensity={0.35}
        />
      </instancedMesh>
    </>
  );
}
