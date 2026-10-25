package app.metrolife;

import com.fasterxml.jackson.databind.node.ObjectNode;

/**
 * Deterministic resident looks. This mirrors residentLook() in
 * frontend/src/scene/character-life.ts step for step (same hash, generator, palettes and
 * order of random draws), so a resident's portrait matches the person on the street.
 */
final class ResidentStyle {
  static final String[] SKIN = {"#f6d7c3", "#f0c8a8", "#e8b991", "#dda67c", "#cf9469", "#c08058",
      "#ad6f4a", "#9a5e3d", "#844e33", "#6e3f29", "#5a3322", "#46281b"};
  static final String[] HAIR_NATURAL = {"#1f1a17", "#3b2a20", "#5c3d27", "#8a5a32", "#b07c45",
      "#d9b27a", "#ead39a", "#a33b24", "#c9c3bb"};
  static final String HAIR_FUN = "#6b4fa0";
  static final String[] TOPS = {"#e46f5a", "#f2a65a", "#f6d06f", "#8fbf7a", "#4e9f8a", "#5b8fd1",
      "#8a79c9", "#d97aa6", "#f4efe6", "#2f4858", "#9b4d5a", "#c9a36b", "#6f8f3d", "#3e7cb1",
      "#ffffff", "#3a3a3a"};
  static final String[] BOTTOMS = {"#2f3e57", "#3d5a80", "#56483f", "#4b4f54", "#6c6f4b",
      "#c2b59b", "#1f2326", "#7a5c4a", "#8c9aa8", "#5e3b4f"};
  static final String[] SHOES = {"#2b2421", "#6b4a35", "#e9e4da", "#3b4a5a", "#9a3b32", "#c8b08a"};
  static final String[] PASTELS = {"#c9d8ef", "#e8c9d6", "#d5e6c8", "#efe0bd", "#d9d0ee", "#c6e2e0"};
  static final String[] FACES = {"soft", "bright", "angular", "freckled"};
  static final String[] FEMALE_HAIR = {"bob", "long", "ponytail", "bun", "curly", "afro", "braids",
      "sideshave", "short", "messy"};
  static final int[] FEMALE_HAIR_WEIGHT = {16, 18, 12, 10, 9, 7, 8, 6, 6, 4};
  static final String[] MALE_HAIR = {"short", "quiff", "spiky", "messy", "mohawk", "curly", "afro",
      "bald", "long", "sideshave"};
  static final int[] MALE_HAIR_WEIGHT = {20, 14, 10, 14, 4, 10, 9, 7, 3, 3};
  static final String[] CUTS = {"casual", "street", "smart", "party", "work"};
  static final int[] CUT_WEIGHT = {38, 22, 16, 10, 14};

  /** xorshift32, identical to seeded() in frontend/src/scene/characters/palettes.ts. */
  private static final class Random {
    int state;

    Random(long seed) {
      state = (int) seed;
      if (state == 0) state = 1;
    }

    double next() {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      return Integer.toUnsignedLong(state) / 4294967296.0;
    }

    int index(int length) {
      return (int) Math.floor(next() * length);
    }
  }

  static long seed(String id) {
    int hash = 0x811c9dc5;
    for (char c : id.toCharArray()) hash = (hash ^ c) * 16777619;
    return Integer.toUnsignedLong(hash);
  }

  private static String weighted(String[] items, int[] weights, double random) {
    int total = 0;
    for (int w : weights) total += w;
    double at = random * total;
    for (int i = 0; i < items.length; i++) {
      at -= weights[i];
      if (at <= 0) return items[i];
    }
    return items[items.length - 1];
  }

  private static double channel(int v) {
    double c = v / 255.0;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }

  private static double[] lab(String hex) {
    int n = Integer.parseInt(hex.substring(1), 16);
    double r = channel((n >> 16) & 255), g = channel((n >> 8) & 255), b = channel(n & 255);
    double x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
    double y = r * 0.2126 + g * 0.7152 + b * 0.0722;
    double z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
    double fx = f(x), fy = f(y), fz = f(z);
    return new double[] {116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)};
  }

  private static double f(double t) {
    return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16.0 / 116;
  }

  static double deltaE(String a, String b) {
    double[] p = lab(a), q = lab(b);
    return Math.sqrt((p[0] - q[0]) * (p[0] - q[0]) + (p[1] - q[1]) * (p[1] - q[1])
        + (p[2] - q[2]) * (p[2] - q[2]));
  }

  /** A top and a bottom never closer than delta E 15; white and charcoal tops stay rare. */
  private static String[] garments(Random random) {
    String top = TOPS[random.index(TOPS.length)];
    if ((top.equals("#ffffff") || top.equals("#3a3a3a")) && random.next() < 0.4)
      top = TOPS[random.index(TOPS.length)];
    String bottom = BOTTOMS[random.index(BOTTOMS.length)];
    for (int i = 0; i < 6 && deltaE(top, bottom) < 15; i++)
      bottom = BOTTOMS[random.index(BOTTOMS.length)];
    return new String[] {top, bottom};
  }

  static ObjectNode look(ObjectNode original, String id) {
    long seed = seed(id);
    Random random = new Random(seed);
    boolean female = (seed & 1) == 1;
    String skin = SKIN[random.index(SKIN.length)];
    String hair = female
        ? weighted(FEMALE_HAIR, FEMALE_HAIR_WEIGHT, random.next())
        : weighted(MALE_HAIR, MALE_HAIR_WEIGHT, random.next());
    boolean grey = random.next() < 0.08, fun = random.next() < 0.04;
    String hairColor = grey ? "#c9c3bb"
        : fun ? HAIR_FUN : HAIR_NATURAL[random.index(HAIR_NATURAL.length - 1)];
    String face = FACES[random.index(4)];
    String style = weighted(CUTS, CUT_WEIGHT, random.next());
    String[] everyday = garments(random);
    String shoes = SHOES[random.index(SHOES.length)];
    String[] work = garments(random);
    String workStyle = random.next() < 0.5 ? "work" : "smart";
    String sleepTop = PASTELS[random.index(PASTELS.length)];
    ObjectNode result = original.deepCopy();
    result.put("body", female ? "f" : "m").put("skin", skin).put("hair", hair)
        .put("hairColor", hairColor).put("face", face).put("top", everyday[0])
        .put("bottom", everyday[1]).put("shoeColor", shoes).put("style", style);
    ObjectNode outfits = result.putObject("outfits");
    outfits.putObject("everyday").put("top", everyday[0]).put("bottom", everyday[1])
        .put("shoeColor", shoes).put("style", style);
    outfits.putObject("work").put("top", work[0]).put("bottom", work[1]).put("shoeColor", shoes)
        .put("style", workStyle);
    outfits.putObject("sleep").put("top", sleepTop).put("bottom", everyday[1])
        .put("shoeColor", shoes).put("style", "casual");
    return result;
  }
}
