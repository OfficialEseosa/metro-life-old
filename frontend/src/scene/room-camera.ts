import * as THREE from "three";
import type { RoomLayout } from "../navigation";

/** Farthest the room camera sits from its target, in metres along the view ray. */
const ROOM_REACH = { laptop: 21, phone: 18 };

/**
 * Room framing. A small room is fitted whole, as a stage. In a hall too large to fit at a
 * readable size the camera follows the player at a fixed reach instead, so the player stays
 * a person on screen rather than a dot in a dollhouse.
 */
export function roomView(
  layout: RoomLayout | undefined,
  aspect: number,
  player?: { x: number; z: number },
  compact = false,
) {
  const bounds = layout?.bounds ?? { w: 12, d: 10 },
    height = layout?.height ?? 3.6,
    focus = (
      layout as
        (RoomLayout & { cameraFocus?: { x: number; y: number; z: number } })
        | undefined
    )?.cameraFocus,
    yaw = 0.45,
    pitch = (50 * Math.PI) / 180,
    target = new THREE.Vector3(
      focus?.x ?? 0,
      focus?.y ?? height * 0.22,
      focus?.z ?? 0,
    ),
    direction = new THREE.Vector3(
      Math.sin(yaw) * Math.cos(pitch),
      Math.sin(pitch),
      Math.cos(yaw) * Math.cos(pitch),
    ),
    right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw)),
    up = new THREE.Vector3().crossVectors(direction, right),
    tanV = Math.tan((32 * Math.PI) / 360),
    tanH = tanV * aspect;
  let distance = 8;
  for (const x of [-bounds.w / 2, bounds.w / 2])
    for (const y of [0, height])
      for (const z of [-bounds.d / 2, bounds.d / 2]) {
        const corner = new THREE.Vector3(x, y, z).sub(target),
          depth = corner.dot(direction);
        distance = Math.max(
          distance,
          depth + Math.abs(corner.dot(right)) / (tanH * 0.88),
          depth + Math.abs(corner.dot(up)) / (tanV * 0.82),
        );
      }
  const reach = compact ? ROOM_REACH.phone : ROOM_REACH.laptop,
    follows = distance > reach * 1.15;
  if (follows) {
    distance = reach;
    // Aim a little in front of the player, so they sit above the centre of the frame and clear of
    // the bottom bar, and stop short of the walls so the frame never centres on the skirting.
    const lead = compact ? 1.6 : 1.2,
      px = (player?.x ?? target.x) + Math.sin(yaw) * lead,
      pz = (player?.z ?? target.z) + Math.cos(yaw) * lead;
    target.set(
      THREE.MathUtils.clamp(px, -bounds.w / 2 + 1, bounds.w / 2 - 1),
      1.1,
      THREE.MathUtils.clamp(pz, -bounds.d / 2 + 1, bounds.d / 2 + lead),
    );
  }
  return {
    target,
    yaw,
    height: distance * Math.sin(pitch),
    distance: distance * Math.cos(pitch),
    reach: distance,
    follows,
    bounds,
  };
}

/**
 * Outdoor follow framing: the player reads as a person (about 14% of the screen height on a
 * laptop, at least 56 px on a 375 px phone) with room to see the street ahead and both kerbs.
 */
export function streetView(width: number) {
  return width < 700
    ? { distance: 14.5, height: 8, targetY: 1.1, lookAhead: 1.5 }
    : { distance: 13, height: 7.4, targetY: 1, lookAhead: 1.4 };
}

/** Closest and farthest the player may wheel or pinch the follow camera. */
export function zoomLimits(room: boolean, roomReach = 0) {
  return room
    ? { min: 5, max: Math.max(9, roomReach * 1.35) }
    : { min: 9, max: 42 };
}
