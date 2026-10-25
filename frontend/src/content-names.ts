import naming from "./shared-data/display-names.json";
const replacements = Object.entries(naming.replace)
  .sort((a, b) => b[0].length - a[0].length)
  .map(
    ([from, to]) =>
      [
        new RegExp(
          "(?<![\\p{L}\\p{N}])" +
            from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") +
            "(?![\\p{L}\\p{N}])",
          "gu",
        ),
        to,
      ] as const,
  );
export function fictionalText(value: string) {
  for (const [from, to] of replacements) value = value.replace(from, () => to);
  return value;
}
export function venueName(id: string, fallback = "A place in the city") {
  return (
    (naming.venues as Record<string, string>)[id] ?? fictionalText(fallback)
  );
}
