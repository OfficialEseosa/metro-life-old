/** Wardrobe rules: which modular parts make each outfit cut, and how each original material is tinted. */
import type { Donor, PartName, Sex } from "./kit";
import { luminance } from "./palettes";

export type Cut = "casual" | "street" | "smart" | "party" | "work";
export type PartSet = Record<Exclude<PartName, "Head">, Donor>;

/** Colour slots that a cloth vertex can take. */
export const SLOTS = [
  "top",
  "topDark",
  "shirt",
  "tie",
  "bottom",
  "bottomDark",
  "shoe",
  "sole",
  "accent",
  "glasses",
] as const;
export type Slot = (typeof SLOTS)[number];

export function cutOf(style: string | undefined): Cut {
  return style === "street" ||
    style === "smart" ||
    style === "party" ||
    style === "work"
    ? style
    : "casual";
}

/**
 * Modular part choices. The work cut is a plain apron vest over a shirt with trousers,
 * so no career shows a construction hard hat.
 */
export function partsFor(sex: Sex, cut: Cut, variant = 0): PartSet {
  if (sex === "f")
    return {
      casual: { Body: "f_casual", Legs: "f_casual", Feet: "f_casual" },
      street: { Body: "f_street", Legs: "f_street", Feet: "f_street" },
      smart: { Body: "f_smart", Legs: "f_smart", Feet: "f_smart" },
      party: { Body: "f_party", Legs: "f_party", Feet: "f_party" },
      work: { Body: "f_work", Legs: "f_smart", Feet: "f_smart" },
    }[cut] as PartSet;
  return {
    casual:
      variant & 1
        ? { Body: "m_casual2", Legs: "m_casual2", Feet: "m_casual2" }
        : { Body: "m_casual", Legs: "m_casual", Feet: "m_casual" },
    street: { Body: "m_street", Legs: "m_street", Feet: "m_street" },
    smart: { Body: "m_smart", Legs: "m_smart", Feet: "m_smart" },
    party: { Body: "m_smart", Legs: "m_casual", Feet: "m_casual" },
    work: { Body: "m_work", Legs: "m_smart", Feet: "m_smart" },
  }[cut] as PartSet;
}

/** Head shape follows the face choice, within the body's sex. */
export function headFor(sex: Sex, face: string | undefined): Donor {
  if (sex === "f")
    return face === "bright"
      ? "f_party"
      : face === "angular"
        ? "f_smart"
        : face === "freckled"
          ? "f_street"
          : "f_casual";
  return face === "bright"
    ? "m_party"
    : face === "angular"
      ? "m_smart"
      : face === "freckled"
        ? "m_casual2"
        : "m_casual";
}

const RULES: Partial<Record<Donor, Record<string, Slot | "skin" | "skinDark">>> = {
  f_casual: { White: "top", Grey: "shoe", Orange: "bottom" },
  f_party: { LimeGreen: "top", Gold: "accent", Red: "shoe" },
  f_smart: { White: "shirt" },
  f_street: { Pink: "top", Grey: "sole" },
  f_work: {
    Worker_Vest: "top",
    Worker_Yellow: "topDark",
    White: "shirt",
    Brown_02: "bottom",
    Brown2: "bottomDark",
  },
  m_casual: { White: "sole", Red_Dark: "shoe", LightBrown: "top", LightBlue: "bottom" },
  m_casual2: { White: "sole", Purple: "shoe", LightBlue: "bottom" },
  m_party: { Red_Dark: "bottom", White: "sole", LightBrown: "top" },
  m_smart: { Suit: "top", White: "shirt", Tie: "tie" },
  m_street: { LightBlue: "bottom", White: "shirt" },
  m_work: {
    Worker_Yellow: "topDark",
    Worker_Vest: "top",
    LightBrown: "shirt",
    Brown: "bottom",
    Brown2: "bottomDark",
    Grey: "sole",
  },
};

/** Slot for one original material of one part, or skin, or null when hidden. */
export function slotFor(
  donor: Donor,
  part: PartName,
  material: string,
): Slot | "skin" | "skinDark" | null {
  if (material === "Skin_Darker") return "skinDark";
  if (/^Skin/.test(material)) return "skin";
  if (part === "Head") return null;
  const rule = RULES[donor]?.[material];
  if (rule) {
    // Legs of a dress share the top colour; suit trousers use the bottom colour.
    if (part === "Legs" && rule === "top")
      return donor === "f_party" ? "top" : "bottom";
    if (part === "Feet" && (rule === "top" || rule === "bottom")) return "shoe";
    return rule;
  }
  if (part === "Legs") return "bottom";
  if (part === "Feet") return "shoe";
  // Remaining body materials: the main garment, or a darker trim on the street jacket.
  if (donor === "f_street" && material === "Black") return "topDark";
  return "top";
}

export type OutfitColours = Record<Slot, string>;
/** Derive every slot colour from the three saved outfit colours. */
export function outfitColours(
  top: string,
  bottom: string,
  shoe: string,
  cut: Cut,
): OutfitColours {
  const dark = (hex: string, f: number) => {
    const n = parseInt(hex.slice(1), 16),
      c = (s: number) =>
        Math.round(((n >> s) & 255) * f)
          .toString(16)
          .padStart(2, "0");
    return "#" + c(16) + c(8) + c(0);
  };
  const light = luminance(top) > 0.45;
  return {
    top,
    topDark: dark(top, cut === "work" ? 0.82 : 0.45),
    shirt: cut === "smart" && light ? "#e9e4da" : "#f3eee4",
    tie:
      cut === "party"
        ? "#f3eee4"
        : luminance(top) > 0.3
          ? "#2f3e57"
          : "#c9a36b",
    bottom,
    bottomDark: dark(bottom, 0.78),
    shoe,
    sole: "#ece6da",
    accent: "#d9b45a",
    glasses: "#2b2421",
  };
}
