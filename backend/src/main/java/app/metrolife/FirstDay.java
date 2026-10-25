package app.metrolife;

import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.List;

/** Durable teaching goals advance only from accepted server events. */
final class FirstDay {

  static final List<String> STEPS = List.of("outside", "job", "shift", "meal", "neighbour", "rent");
  /**
   * The steps a player completes by playing. Rent is charged automatically (and is free for the first
   * two game days), so it is tracked but never holds back city space: the first day is reachable in
   * about ten minutes of play.
   */
  static final List<String> REQUIRED = List.of("outside", "job", "shift", "meal", "neighbour");
  static final java.util.Map<String, String> LABELS = java.util.Map.of(
    "outside",
    "step outside",
    "job",
    "get a job",
    "shift",
    "work one shift",
    "meal",
    "eat at a cafe",
    "neighbour",
    "wave to a neighbour"
  );
  final GameService g;

  FirstDay(GameService g) {
    this.g = g;
  }

  void init(ObjectNode s, ObjectNode w) {
    s.put("introDone", false).put("arrivalDay", g.clock(w).path("day").asInt());
    ObjectNode goals = s.putObject("firstDay").put("complete", false);
    for (String step : STEPS) goals.put(step, false);
    // The starter studio's first two game days are prepaid, so the rent step starts done.
    goals.put("rent", true);
    s.putObject("outfits").put("casual", true).put("street", true);
  }

  boolean complete(ObjectNode s) {
    return !s.path("firstDay").isObject() || s.path("firstDay").path("complete").asBoolean();
  }

  void mark(ObjectNode s, String step) {
    if (!s.path("firstDay").isObject() || !STEPS.contains(step)) return;
    ObjectNode goals = s.withObject("firstDay");
    goals.put(step, true);
    goals.put("complete", goals.path("complete").asBoolean() || REQUIRED.stream().allMatch(k -> goals.path(k).asBoolean()));
  }

  boolean outside(ObjectNode s) {
    if (
      !s.path("introDone").asBoolean() ||
      !s.path("position").isObject() ||
      !s.path("position").path("room").isNull() ||
      s.path("firstDay").path("outside").asBoolean() ||
      !s.path("firstDay").isObject()
    ) return false;
    mark(s, "outside");
    return true;
  }

  /** Upgrades existing lives to the shorter checklist without waiting for another step. */
  void refresh(ObjectNode s) {
    if (!s.path("firstDay").isObject() || s.path("firstDay").path("complete").asBoolean()) return;
    ObjectNode goals = s.withObject("firstDay");
    if (REQUIRED.stream().allMatch(k -> goals.path(k).asBoolean())) goals.put("complete", true);
  }

  /** What is still missing, in plain words, for a disabled reason. Empty when the first day is done. */
  String remaining(ObjectNode s) {
    if (complete(s)) return "";
    List<String> left = REQUIRED.stream().filter(k -> !s.path("firstDay").path(k).asBoolean()).map(LABELS::get).toList();
    if (left.isEmpty()) return "";
    String list = left.size() == 1
      ? left.get(0)
      : String.join(", ", left.subList(0, left.size() - 1)) + " and " + left.get(left.size() - 1);
    return "Unlocks after your first day. Still to do: " + list + ".";
  }

  void established(ObjectNode s) {
    refresh(s);
    String left = remaining(s);
    GameService.require(left.isEmpty(), 409, left);
  }
}
