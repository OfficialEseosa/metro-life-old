package app.metrolife;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.*;
import java.util.*;

/** Saved creator choices and small, explicit personality effects. No scheduler or hidden simulation. */
final class Personality {

  static final List<String> TRAITS = List.of(
    "creative",
    "bookworm",
    "foodie",
    "active",
    "outgoing",
    "ambitious",
    "music-lover",
    "easygoing",
    "independent",
    "early-bird",
    "homebody",
    "curious"
  );
  static final List<String> HAIR = List.of(
    "short",
    "bob",
    "long",
    "curly",
    "afro",
    "bun",
    "ponytail",
    "braids",
    "mohawk",
    "quiff",
    "spiky",
    "messy",
    "sideshave",
    "bald"
  );
  static final List<String> FACES = List.of("soft", "bright", "angular", "freckled");
  static final Map<String, String> SKILL = Map.of(
    "creative",
    "creativity",
    "bookworm",
    "tech",
    "foodie",
    "cooking",
    "active",
    "fitness",
    "outgoing",
    "charisma",
    "ambitious",
    "business",
    "music-lover",
    "music"
  );

  static boolean has(JsonNode sim, String trait) {
    for (JsonNode t : sim.path("traits")) if (t.asText().equals(trait)) return true;
    return false;
  }

  static String label(String id) {
    return switch (id) {
      case "music-lover" -> "Music lover";
      case "early-bird" -> "Early bird";
      default -> Content.title(id);
    };
  }

  static ObjectNode normalizeLook(ObjectNode result, JsonNode source) {
    if (source == null) source = result;
    String hair = source.path("hair").asText("short"),
      face = source.path("face").asText("soft");
    result.put("hair", HAIR.contains(hair) ? hair : "short").put("face", FACES.contains(face) ? face : "soft");
    ObjectNode wardrobe = result.putObject("outfits");
    for (String occasion : List.of("everyday", "work", "sleep")) {
      JsonNode requested = source.path("outfits").path(occasion);
      ObjectNode outfit = wardrobe.putObject(occasion);
      for (String colour : List.of("top", "bottom", "shoeColor")) {
        String fallback = result
          .path(colour)
          .asText(colour.equals("top") ? "#326957" : colour.equals("bottom") ? "#313c4b" : "#f4eddf");
        String value = requested.path(colour).asText(fallback);
        outfit.put(colour, value.matches("#[0-9a-fA-F]{6}") ? value : fallback);
      }
      String fallback = occasion.equals("work")
          ? "work"
          : occasion.equals("sleep")
            ? "casual"
            : result.path("style").asText("casual"),
        style = requested.path("style").asText(fallback);
      outfit.put("style", Set.of("casual", "street", "smart", "work", "party").contains(style) ? style : fallback);
    }
    return result;
  }

  static void setup(ObjectNode sim, JsonNode requested) {
    LinkedHashSet<String> chosen = new LinkedHashSet<>();
    if (requested != null) for (JsonNode trait : requested) {
      String id = trait.asText();
      GameService.require(TRAITS.contains(id), 400, "Choose a listed personality trait");
      chosen.add(id);
    }
    if (chosen.isEmpty()) chosen.addAll(List.of("curious", "easygoing", "homebody"));
    GameService.require(chosen.size() == 3, 400, "Choose exactly three different personality traits");
    ArrayNode traits = sim.putArray("traits");
    chosen.forEach(traits::add);
    resetWants(sim);
  }

  static void normalize(ObjectNode sim) {
    if (!sim.path("traits").isArray() || sim.path("traits").size() != 3) setup(sim, null);
    if (sim.path("look") instanceof ObjectNode look && !look.path("outfits").isObject()) normalizeLook(
      look,
      look.deepCopy()
    );
    if (!sim.path("_wantBaseline").isObject()) resetWants(sim);
  }

  static double needDecayMultiplier(JsonNode sim, String need) {
    double multiplier = 1;
    if (need.equals("fun") && has(sim, "easygoing")) multiplier *= .75;
    if (need.equals("social") && has(sim, "independent")) multiplier *= .70;
    if (need.equals("energy") && has(sim, "early-bird")) multiplier *= .80;
    return multiplier;
  }

  static double skillMultiplier(JsonNode sim, String skill) {
    double multiplier = has(sim, "curious") ? 1.10 : 1;
    for (var entry : SKILL.entrySet())
      if (entry.getValue().equals(skill) && has(sim, entry.getKey())) multiplier += .25;
    if (skill.equals("music") && has(sim, "creative")) multiplier += .25;
    return multiplier;
  }

  static double needDelta(JsonNode sim, JsonNode action, String loc, String need, double base) {
    String kind = action.path("kind").asText(),
      id = action.path("id").asText();
    double bonus = 0;
    if (need.equals("hunger") && base > 0 && has(sim, "foodie")) bonus += 8;
    if (need.equals("energy") && id.equals("sleep") && has(sim, "early-bird")) bonus += 8;
    if (need.equals("social") && base > 0 && has(sim, "outgoing")) bonus += 8;
    if (need.equals("fun")) {
      if (loc.equals("home") && has(sim, "homebody")) bonus += 8;
      if (has(sim, "active") && action.path("skills").has("fitness")) bonus += 8;
      if (has(sim, "music-lover") && action.path("skills").has("music")) bonus += 8;
      if (has(sim, "bookworm") && kind.equals("learn")) bonus += 6;
      if (has(sim, "ambitious") && kind.equals("work")) bonus += 6;
    }
    return base + bonus;
  }

  static ArrayNode moodlets(ObjectNode sim) {
    ArrayNode rows = JsonNodeFactory.instance.arrayNode();
    for (JsonNode trait : sim.path("traits")) {
      String id = trait.asText();
      rows
        .addObject()
        .put("id", id)
        .put("label", label(id))
        .put(
          "detail",
          switch (id) {
            case "easygoing" -> "Fun drains 25% more slowly";
            case "independent" -> "Social need drains 30% more slowly";
            case "early-bird" -> "Energy drains 20% more slowly; sleep restores extra energy";
            case "homebody" -> "Home activities restore extra fun";
            case "curious" -> "All skill practice earns 10% more XP";
            default -> "Favourite skill practice earns 25% more XP";
          }
        );
    }
    return rows;
  }

  static void resetWants(ObjectNode sim) {
    ObjectNode baseline = sim.putObject("_wantBaseline");
    baseline.set("metrics", sim.path("_metrics").deepCopy());
    baseline.put("visits", sim.path("dailyVisited").size());
  }

  static ArrayNode wants(ObjectNode sim) {
    String aspiration = sim.path("aspiration").path("id").asText("founder");
    String skill = switch (aspiration) {
      case "headliner" -> "music";
      case "mayor" -> "charisma";
      case "restaurateur" -> "cooking";
      case "athlete" -> "fitness";
      case "collector" -> "creativity";
      case "mogul" -> "business";
      default -> "tech";
    };
    String kind = aspiration.equals("mayor")
      ? "civic"
      : aspiration.equals("restaurateur")
        ? "cook"
        : aspiration.equals("mogul")
          ? "work"
          : "learn";
    ArrayNode rows = JsonNodeFactory.instance.arrayNode();
    want(rows, "dream-practice", "Practice " + Content.title(skill), "sparkles", metric(sim, skill), 1);
    want(
      rows,
      "dream-step",
      kind.equals("cook")
        ? "Cook something at home"
        : kind.equals("work")
          ? "Finish a paid activity"
          : kind.equals("civic")
            ? "Take part in city life"
            : "Learn something today",
      kind.equals("cook") ? "cooking-pot" : "briefcase",
      metric(sim, kind),
      1
    );
    want(
      rows,
      "dream-explore",
      "Find a little inspiration in two places",
      "compass",
      Math.max(0, sim.path("dailyVisited").size() - sim.path("_wantBaseline").path("visits").asInt()),
      2
    );
    return rows;
  }

  private static int metric(JsonNode sim, String metric) {
    return Math.max(
      0,
      sim.path("_metrics").path(metric).asInt() - sim.path("_wantBaseline").path("metrics").path(metric).asInt()
    );
  }

  private static void want(ArrayNode rows, String id, String text, String icon, int progress, int target) {
    ObjectNode row = rows
      .addObject()
      .put("id", id)
      .put("text", text)
      .put("icon", icon)
      .put("progress", Math.min(target, progress))
      .put("target", target)
      .put("done", progress >= target);
    row.putObject("reward").put("cash", 0).put("xp", 0);
  }
}
