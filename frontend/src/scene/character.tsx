/* oxlint-disable react/immutability -- The actor, mixer and marker are owned Three resources. */
import { use, useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { Look } from "../api/types";
import type { BodyCondition } from "./character-life";
import { serverNow } from "../server-time";
import {
  CharacterActor,
  loadLook,
  lookKey,
  lookReady,
  preloadAllBodies,
  type ActorOptions,
  type CharacterPose,
} from "./characters/actor";
import { SelectionMarker } from "./characters/marker";

export type { CharacterPose } from "./characters/actor";

// Bodies and clips are shared by everyone in the city; start loading with the scene code.
if (typeof window !== "undefined") void preloadAllBodies().catch(() => {});

const animationCanvases = new Map<() => void, number>();
let animationTimer: ReturnType<typeof setInterval> | undefined;
function animateCanvas(invalidate: () => void) {
  animationCanvases.set(
    invalidate,
    (animationCanvases.get(invalidate) ?? 0) + 1,
  );
  if (!animationTimer)
    animationTimer = setInterval(() => {
      if (!document.hidden) for (const draw of animationCanvases.keys()) draw();
    }, 1000 / 60);
  return () => {
    const users = (animationCanvases.get(invalidate) ?? 1) - 1;
    if (users) animationCanvases.set(invalidate, users);
    else animationCanvases.delete(invalidate);
    if (!animationCanvases.size && animationTimer) {
      clearInterval(animationTimer);
      animationTimer = undefined;
    }
  };
}

/** Same renderer for the controlled person, residents, staff and the pose studio. */
export function RiggedCharacter({
  look,
  readPose = () => "Idle",
  readHipHeight,
  readCondition,
  readSpeed,
  readDistance,
  readStartedAt,
  selected,
  options,
}: {
  look: Look;
  readPose?: () => CharacterPose;
  readHipHeight?: () => number | undefined;
  readCondition?: () => BodyCondition;
  readSpeed?: () => number;
  readDistance?: () => number;
  readStartedAt?: () => number | undefined;
  /** Show the player's own marker. Detected automatically under "controlled-player". */
  selected?: boolean;
  /** Resident identity and accessories; omitted for the player. */
  options?: ActorOptions;
}) {
  const key = lookKey(look),
    optionsKey = JSON.stringify(options ?? null);
  // Suspend only while the look's parts are still loading.
  if (!lookReady(look, options)) use(loadLook(look, options));
  const invalidate = useThree((s) => s.invalidate);
  const actor = useMemo(
    () => new CharacterActor(look, options),
    // The key strings capture every field the actor reads.
    [key, optionsKey], // oxlint-disable-line react-hooks/exhaustive-deps
  );
  const group = useRef<THREE.Group>(null),
    marker = useRef<SelectionMarker | null>(null),
    frame = useRef(0),
    pending = useRef(0),
    head = useMemo(() => new THREE.Vector3(), []);
  useEffect(() => {
    // StrictMode mounts twice; dispose only when nobody re-acquired the actor.
    actor.owners++;
    const stop = animateCanvas(invalidate);
    return () => {
      stop();
      actor.owners--;
      queueMicrotask(() => {
        if (!actor.owners) actor.dispose();
      });
    };
  }, [actor, invalidate]);
  useEffect(() => {
    let own = selected;
    if (own === undefined) {
      let parent = group.current?.parent;
      while (parent && own === undefined) {
        if (parent.name === "controlled-player") own = true;
        parent = parent.parent;
      }
    }
    if (!own || !group.current) return;
    const m = new SelectionMarker();
    group.current.add(m.group);
    marker.current = m;
    return () => {
      m.group.removeFromParent();
      m.dispose();
      marker.current = null;
    };
  }, [selected, actor]);
  useFrame((state, dt) => {
    pending.current += Math.min(dt, 0.1);
    const distance = readDistance?.() ?? 0,
      every = distance > 28 ? 3 : distance > 16 ? 2 : 1;
    if (++frame.current % every) return;
    const step = pending.current;
    pending.current = 0;
    // Development only: the lab can hold the player in a pose to inspect it in a real room.
    const forced =
      import.meta.env.DEV && marker.current
        ? (window as { __metroForcePose?: { pose: CharacterPose; hip?: number } })
            .__metroForcePose
        : undefined;
    const pose = forced?.pose ?? readPose(),
      condition = readCondition?.();
    actor.update(step, {
      pose,
      speed: forced ? 0 : (readSpeed?.() ?? 0),
      hip: forced ? forced.hip : readHipHeight?.(),
      tired: condition?.tired,
      hungry: condition?.hungry,
      startedAt: readStartedAt?.(),
      now: serverNow(),
    });
    actor.root.userData.clip = pose;
    actor.root.userData.crossFadeSeconds = 0.25;
    if (marker.current) {
      actor.headTop(head);
      marker.current.update(state.clock.elapsedTime, head.y);
    }
  });
  return (
    <group ref={group}>
      <primitive object={actor.root} />
    </group>
  );
}
