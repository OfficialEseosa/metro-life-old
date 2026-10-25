package app.metrolife;

import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.List;

/** Durable teaching goals advance only from accepted server events. */
final class FirstDay {

  static final List<String> STEPS = List.of("outside", "job", "shift", "meal", "neighbour", "rent");
  final GameService g;

  FirstDay(GameService g) {
    this.g = g;
  }

  void init(ObjectNode s, ObjectNode w) {
    s.put("introDone", false).put("arrivalDay", g.clock(w).path("day").asInt());
    ObjectNode goals = s.putObject("firstDay").put("complete", false);
    for (String step : STEPS) goals.put(step, false);
    s.putObject("outfits").put("casual", true).put("street", true);
  }

  boolean complete(ObjectNode s) {
    return !s.path("firstDay").isObject() || s.path("firstDay").path("complete").asBoolean();
  }

  void mark(ObjectNode s, String step) {
    if (!s.path("firstDay").isObject() || !STEPS.contains(step)) return;
    ObjectNode goals = s.withObject("firstDay");
    goals.put(step, true);
    goals.put("complete", STEPS.stream().allMatch(k -> goals.path(k).asBoolean()));
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

  void established(ObjectNode s) {
    GameService.require(complete(s), 409, "Settle in and finish your first-day goals before booking city space");
  }
}
