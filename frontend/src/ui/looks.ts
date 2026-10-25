import type { Look } from "../api/types";

/**
 * Character palettes offered by the creator and the quick start. They match the
 * art direction palettes the character renderer uses for residents, so a player
 * can look like anyone they meet in the city.
 */
export const SKIN_TONES = [
  "#f6d7c3",
  "#f0c8a8",
  "#e8b991",
  "#dda67c",
  "#cf9469",
  "#c08058",
  "#ad6f4a",
  "#9a5e3d",
  "#844e33",
  "#6e3f29",
  "#5a3322",
  "#46281b",
];
export const HAIR_COLOURS = [
  "#1f1a17",
  "#3b2a20",
  "#5c3d27",
  "#8a5a32",
  "#b07c45",
  "#d9b27a",
  "#ead39a",
  "#a33b24",
  "#c9c3bb",
  "#6b4fa0",
];
export const TOPS = [
  "#e46f5a",
  "#f2a65a",
  "#f6d06f",
  "#8fbf7a",
  "#4e9f8a",
  "#5b8fd1",
  "#8a79c9",
  "#d97aa6",
  "#f4efe6",
  "#2f4858",
  "#9b4d5a",
  "#c9a36b",
  "#6f8f3d",
  "#3e7cb1",
  "#ffffff",
  "#3a3a3a",
];
export const BOTTOMS = [
  "#2f3e57",
  "#3d5a80",
  "#56483f",
  "#4b4f54",
  "#6c6f4b",
  "#c2b59b",
  "#1f2326",
  "#7a5c4a",
  "#8c9aa8",
  "#5e3b4f",
];
export const SHOES = [
  "#2b2421",
  "#6b4a35",
  "#e9e4da",
  "#3b4a5a",
  "#9a3b32",
  "#c8b08a",
];
export const PASTELS = [
  "#c9d8ef",
  "#e8c9d6",
  "#d5e6c8",
  "#efe0bd",
  "#d9d0ee",
  "#c6e2e0",
];
/** Friendly names so colour is never the only cue. */
export const COLOUR_NAMES: Record<string, string> = {
  "#f6d7c3": "Porcelain",
  "#f0c8a8": "Peach",
  "#e8b991": "Sand",
  "#dda67c": "Honey",
  "#cf9469": "Caramel",
  "#c08058": "Amber",
  "#ad6f4a": "Cinnamon",
  "#9a5e3d": "Chestnut",
  "#844e33": "Mocha",
  "#6e3f29": "Cocoa",
  "#5a3322": "Espresso",
  "#46281b": "Ebony",
  "#1f1a17": "Black",
  "#3b2a20": "Dark brown",
  "#5c3d27": "Brown",
  "#8a5a32": "Chestnut",
  "#b07c45": "Light brown",
  "#d9b27a": "Dark blond",
  "#ead39a": "Blond",
  "#a33b24": "Auburn",
  "#c9c3bb": "Silver",
  "#6b4fa0": "Violet",
  "#e46f5a": "Coral",
  "#f2a65a": "Apricot",
  "#f6d06f": "Butter",
  "#8fbf7a": "Sage",
  "#4e9f8a": "Teal",
  "#5b8fd1": "Cornflower",
  "#8a79c9": "Lavender",
  "#d97aa6": "Rose",
  "#f4efe6": "Cream",
  "#2f4858": "Ink blue",
  "#9b4d5a": "Berry",
  "#c9a36b": "Camel",
  "#6f8f3d": "Olive",
  "#3e7cb1": "Denim",
  "#ffffff": "White",
  "#3a3a3a": "Charcoal",
  "#2f3e57": "Navy",
  "#3d5a80": "Denim",
  "#56483f": "Brown",
  "#4b4f54": "Slate",
  "#6c6f4b": "Khaki",
  "#c2b59b": "Sand",
  "#1f2326": "Near black",
  "#7a5c4a": "Cocoa",
  "#8c9aa8": "Light denim",
  "#5e3b4f": "Plum",
  "#2b2421": "Black",
  "#6b4a35": "Tan",
  "#e9e4da": "Off white",
  "#3b4a5a": "Navy",
  "#9a3b32": "Red",
  "#c8b08a": "Beige",
  "#c9d8ef": "Sky",
  "#e8c9d6": "Blush",
  "#d5e6c8": "Mint",
  "#efe0bd": "Vanilla",
  "#d9d0ee": "Lilac",
  "#c6e2e0": "Seafoam",
};
export const colourName = (hex: string, fallback: string) =>
  COLOUR_NAMES[hex.toLowerCase()] ?? fallback;

export const pick = <T>(values: readonly T[]) =>
  values[Math.floor(Math.random() * values.length)];

/** A ready-to-play look with harmonious everyday, work and sleep outfits. */
export function readyLook(): Look {
  const top = pick(TOPS.filter((c) => c !== "#ffffff" && c !== "#3a3a3a")),
    bottom = pick(BOTTOMS),
    shoeColor = pick(SHOES),
    style = pick(["casual", "street"]);
  return {
    body: pick(["f", "m"]),
    skin: pick(SKIN_TONES),
    hair: pick(["curly", "bob", "short", "bun", "afro", "braids", "long", "ponytail"]),
    hairColor: pick(HAIR_COLOURS.slice(0, 9)),
    face: pick(["soft", "bright", "angular", "freckled"]),
    top,
    bottom,
    style,
    shoeColor,
    outfits: {
      everyday: { top, bottom, style, shoeColor },
      work: {
        top: "#f4efe6",
        bottom: "#2f3e57",
        style: "work",
        shoeColor: "#2b2421",
      },
      sleep: {
        top: pick(PASTELS),
        bottom: "#8c9aa8",
        style: "casual",
        shoeColor: "#e9e4da",
      },
    },
  } as Look;
}
