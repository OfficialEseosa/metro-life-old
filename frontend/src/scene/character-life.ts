import type { CharacterPose } from "./character";
import type { VisibleLife } from "../life-actions";
import { lifePose } from "../life-actions";
import type { Look } from "../api/types";
import type { ActorOptions } from "./characters/actor";
import {
  BOTTOMS,
  HAIR_FUN,
  HAIR_NATURAL,
  PASTELS,
  SHOES,
  SKIN_TONES,
  TOPS,
  deltaE,
  pickWeighted,
  seeded,
} from "./characters/palettes";

export type BodyCondition = { tired: boolean; hungry: boolean; dirty: boolean };
export function bodyCondition(person: VisibleLife): BodyCondition {
  return {
    tired: (person.needs?.energy ?? 100) < 20,
    hungry: (person.needs?.hunger ?? 100) < 20,
    dirty: (person.needs?.hygiene ?? 100) < 20,
  };
}
export function visiblePose(person: VisibleLife): CharacterPose {
  return lifePose(person) as CharacterPose;
}
export function crowdPose(pose: string) {
  return (
    (
      {
        walk: 1,
        run: 2,
        jog: 2,
        sit: 3,
        type: 4,
        work: 4,
        dance: 5,
        fun: 5,
        cheer: 6,
        food: 7,
        eat: 7,
        sleep: 8,
        lie: 8,
        wave: 9,
        talk: 10,
        hangout: 10,
        shower: 11,
        cook: 12,
        interact: 12,
        phone: 10,
        greet: 9,
        sittalk: 3,
        listen: 10,
        celebrate: 6,
      } as Record<string, number>
    )[pose.toLowerCase()] ?? 0
  );
}

/** Turn by the short arc. A sharp reversal pivots before travelling backwards. */
export function velocityFacing(
  current: number,
  target: number,
  dt: number,
  moving = false,
) {
  let delta = Math.atan2(
    Math.sin(target - current),
    Math.cos(target - current),
  );
  if (moving && Math.abs(delta) > 1.3) {
    current = target - Math.sign(delta) * 1.3;
    delta = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  }
  return current + delta * (1 - Math.exp(-Math.min(dt, 0.05) * 16));
}
export function movingPose(person: VisibleLife, speed: number): CharacterPose {
  if (speed > 0.08)
    return speed > 4 || /run|jog/i.test(lifePose(person)) ? "Run" : "Walk";
  const pose = visiblePose(person);
  return ["Walk", "Run", "Jog"].includes(pose) ? "Idle" : pose;
}
export function identitySeed(id: string) {
  let value = 2166136261;
  for (const letter of id)
    value = Math.imul(value ^ letter.charCodeAt(0), 16777619);
  return value >>> 0;
}

const FEMALE_HAIR: readonly (readonly [string, number])[] = [
  ["bob", 16],
  ["long", 18],
  ["ponytail", 12],
  ["bun", 10],
  ["curly", 9],
  ["afro", 7],
  ["braids", 8],
  ["sideshave", 6],
  ["short", 6],
  ["messy", 4],
];
const MALE_HAIR: readonly (readonly [string, number])[] = [
  ["short", 20],
  ["quiff", 14],
  ["spiky", 10],
  ["messy", 14],
  ["mohawk", 4],
  ["curly", 10],
  ["afro", 9],
  ["bald", 7],
  ["long", 3],
  ["sideshave", 3],
];
const CUTS: readonly (readonly [string, number])[] = [
  ["casual", 38],
  ["street", 22],
  ["smart", 16],
  ["party", 10],
  ["work", 14],
];

/** Pick a top and a bottom that never sit closer than delta E 15. */
function garments(random: () => number) {
  let top: string = TOPS[Math.floor(random() * TOPS.length)];
  // White and charcoal tops stay rare (about 8 % each).
  if ((top === "#ffffff" || top === "#3a3a3a") && random() < 0.4)
    top = TOPS[Math.floor(random() * TOPS.length)];
  let bottom: string = BOTTOMS[Math.floor(random() * BOTTOMS.length)];
  for (let i = 0; i < 6 && deltaE(top, bottom) < 15; i++)
    bottom = BOTTOMS[Math.floor(random() * BOTTOMS.length)];
  return { top, bottom };
}

/**
 * NPC identity is stable across visits. ResidentStyle.java builds the same look on the
 * server (same hash, generator and palettes) so portraits match the street.
 */
export function residentLook(id: string, original: Look): Look {
  const seed = identitySeed(id),
    random = seeded(seed),
    body = seed & 1 ? "f" : "m",
    skin = SKIN_TONES[Math.floor(random() * SKIN_TONES.length)],
    hair = pickWeighted(body === "f" ? FEMALE_HAIR : MALE_HAIR, random()),
    grey = random() < 0.08,
    fun = random() < 0.04,
    hairColor = grey
      ? "#c9c3bb"
      : fun
        ? HAIR_FUN[0]
        : HAIR_NATURAL[Math.floor(random() * (HAIR_NATURAL.length - 1))],
    face = ["soft", "bright", "angular", "freckled"][Math.floor(random() * 4)],
    style = pickWeighted(CUTS, random()),
    everyday = {
      ...garments(random),
      shoeColor: SHOES[Math.floor(random() * SHOES.length)],
      style,
    },
    work = {
      ...garments(random),
      shoeColor: everyday.shoeColor,
      style: random() < 0.5 ? "work" : "smart",
    },
    sleep = {
      top: PASTELS[Math.floor(random() * PASTELS.length)],
      bottom: everyday.bottom,
      shoeColor: everyday.shoeColor,
      style: "casual",
    };
  return {
    ...original,
    body,
    skin,
    hair,
    hairColor,
    face,
    ...everyday,
    outfits: { everyday, work, sleep },
  } as Look;
}

/** Client-only personality for a resident: height, build, idle and walk, accessories. */
export function residentOptions(id: string): ActorOptions {
  const seed = identitySeed(id),
    random = seeded(seed ^ 0x2545f491),
    male = !(seed & 1),
    glasses = random() < 0.15,
    facial =
      male && random() < 0.22
        ? random() < 0.5
          ? ("moustache" as const)
          : ("stubble" as const)
        : undefined;
  return { seed, personality: true, accessories: { glasses, facial } };
}
