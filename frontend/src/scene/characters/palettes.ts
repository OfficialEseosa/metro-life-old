/** Curated character palettes (sRGB hex). Shared by the creator suggestions, residents and the far-crowd impostor. */

/** Twelve warm-balanced skin tones, light to deep. */
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
] as const;

export const HAIR_NATURAL = [
  "#1f1a17",
  "#3b2a20",
  "#5c3d27",
  "#8a5a32",
  "#b07c45",
  "#d9b27a",
  "#ead39a",
  "#a33b24",
  "#c9c3bb",
] as const;
export const HAIR_FUN = ["#6b4fa0"] as const;
export const HAIR_COLOURS = [...HAIR_NATURAL, ...HAIR_FUN] as const;

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
] as const;
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
] as const;
export const SHOES = [
  "#2b2421",
  "#6b4a35",
  "#e9e4da",
  "#3b4a5a",
  "#9a3b32",
  "#c8b08a",
] as const;
/** Soft sleepwear tops. */
export const PASTELS = [
  "#c9d8ef",
  "#e8c9d6",
  "#d5e6c8",
  "#efe0bd",
  "#d9d0ee",
  "#c6e2e0",
] as const;

/** Iris colours with weights that roughly follow real-world frequency. */
export const IRISES: readonly (readonly [string, number])[] = [
  ["#4a2c1a", 34],
  ["#6b4426", 22],
  ["#2b1a12", 14],
  ["#7c6a3a", 10],
  ["#4f7a52", 8],
  ["#4d78a8", 8],
  ["#6f7d86", 4],
];

function channel(v: number) {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
/** CIE Lab of an sRGB hex colour (D65). */
export function lab(hex: string) {
  const n = parseInt(hex.slice(1), 16),
    r = channel((n >> 16) & 255),
    g = channel((n >> 8) & 255),
    b = channel(n & 255),
    x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047,
    y = r * 0.2126 + g * 0.7152 + b * 0.0722,
    z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883,
    f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))] as const;
}
export function deltaE(a: string, b: string) {
  const p = lab(a),
    q = lab(b);
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
}
/** Relative luminance (0..1) of an sRGB hex colour. */
export function luminance(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return (
    0.2126 * channel((n >> 16) & 255) +
    0.7152 * channel((n >> 8) & 255) +
    0.0722 * channel(n & 255)
  );
}
/** Small deterministic generator for palette picks. */
export function seeded(seed: number) {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}
export function pickWeighted<T>(
  items: readonly (readonly [T, number])[],
  random: number,
) {
  const total = items.reduce((sum, [, weight]) => sum + weight, 0);
  let at = random * total;
  for (const [item, weight] of items) {
    at -= weight;
    if (at <= 0) return item;
  }
  return items[items.length - 1][0];
}
/** Stable 32-bit hash of any string (FNV-1a). */
export function hashString(text: string) {
  let value = 2166136261;
  for (let i = 0; i < text.length; i++)
    value = Math.imul(value ^ text.charCodeAt(i), 16777619);
  return value >>> 0;
}
