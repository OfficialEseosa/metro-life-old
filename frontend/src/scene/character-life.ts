import type { CharacterPose } from "./character";
import type { VisibleLife } from "../life-actions";
import { lifePose } from "../life-actions";
import type { Look } from "../api/types";

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
const skins = [
  "#f6d3b3",
  "#eabf98",
  "#d9a37a",
  "#c18659",
  "#a06a43",
  "#7f4f30",
  "#5e3a24",
  "#3f271a",
];
const hairs = [
  "#211e24",
  "#493326",
  "#7d5637",
  "#863e2d",
  "#bc7141",
  "#cfac65",
  "#ddd5c7",
  "#89848a",
  "#5b7bd5",
  "#c45a8c",
];
const clothes = [
  "#78917e",
  "#bc7154",
  "#35445c",
  "#c09b4f",
  "#e4d8bc",
  "#44444b",
  "#597b94",
  "#765970",
  "#355e49",
  "#995f46",
  "#8cabbc",
  "#c39598",
];
/** NPC identity is stable across visits and uses the same authored looks as the creator. */
export function residentLook(id: string, original: Look): Look {
  const seed = identitySeed(id),
    top = clothes[seed % clothes.length],
    bottom = clothes[(seed >>> 5) % clothes.length],
    shoeColor = ["#e9dfcc", "#393840", "#765b49"][(seed >>> 9) % 3],
    style = ["casual", "street", "smart", "work", "party"][(seed >>> 12) % 5],
    outfit = { top, bottom, shoeColor, style };
  return {
    ...original,
    body: seed & 1 ? "f" : "m",
    skin: skins[(seed >>> 2) % skins.length],
    hair: [
      "short",
      "bob",
      "long",
      "curly",
      "afro",
      "bun",
      "ponytail",
      "braids",
      "mohawk",
      "bald",
    ][(seed >>> 6) % 10],
    hairColor: hairs[(seed >>> 10) % hairs.length],
    face: ["soft", "bright", "angular", "freckled"][(seed >>> 16) % 4],
    ...outfit,
    outfits: {
      everyday: outfit,
      work: {
        ...outfit,
        style: "work",
        top: clothes[(seed >>> 19) % clothes.length],
      },
      sleep: {
        ...outfit,
        style: "casual",
        top: clothes[(seed >>> 23) % clothes.length],
      },
    },
  };
}
