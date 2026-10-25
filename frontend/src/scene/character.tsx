/* oxlint-disable react/immutability -- The actor, mixer and marker are owned Three resources. */
import { use, useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
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

/**
 * People further than this from the player no longer cast a sun shadow. The follow
 * shadow box is 26 m wide; beyond this range a person's shadow is a few pixels, while
 * each caster still costs a full skinned draw on every shadow refresh.
 */
const SHADOW_RANGE = 18;

/** Same renderer for the controlled person, residents, staff and the pose studio. */
export function RiggedCharacter({
  look,
  readPose = () => "Idle",
  readHipHeight,
  readCondition,
  readSpeed,
  readDistance,
  readLookAt,
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
  /** World position of a head to look toward, if anyone is close. */
  readLookAt?: () => THREE.Vector3 | undefined;
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
    return () => {
      actor.owners--;
      queueMicrotask(() => {
        if (!actor.owners) actor.dispose();
      });
    };
  }, [actor]);
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
    // Play renders every frame; the title screen and pose studio render on demand,
    // where a person keeps their clip moving by asking for the next frame.
    if (state.frameloop === "demand") state.invalidate();
    pending.current += Math.min(dt, 0.1);
    const distance = readDistance?.() ?? 0,
      every = distance > 28 ? 3 : distance > 16 ? 2 : 1;
    actor.setCastShadow(distance <= SHADOW_RANGE);
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
      lookAt: readLookAt?.(),
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
