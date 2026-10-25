/** One icon per need, used by every need display. */
export const NEED_ICONS: Record<string, string> = {
  energy: "zap",
  hunger: "utensils",
  fun: "sparkles",
  social: "users",
  hygiene: "droplets",
};
export const NEED_ORDER = [
  "energy",
  "hunger",
  "fun",
  "social",
  "hygiene",
] as const;
export const NEED_LABELS: Record<string, string> = {
  energy: "Energy",
  hunger: "Hunger",
  fun: "Fun",
  social: "Social",
  hygiene: "Hygiene",
};
/** "tech" -> "Tech", "music-lover" -> "Music lover". */
export const titleCase = (text: string) =>
  text ? text[0].toUpperCase() + text.slice(1).replace(/-/g, " ") : text;
