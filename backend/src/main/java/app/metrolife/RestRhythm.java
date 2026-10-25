package app.metrolife;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;

/** Sleeping uses personal real time. It never changes a shared world's clock. */
final class RestRhythm {

  private RestRhythm() {}

  static double deficit(JsonNode s) {
    return Math.max(0, 100 - s.path("needs").path("energy").asDouble(85));
  }

  static double hours(JsonNode s) {
    return Math.max(1, Math.min(8, deficit(s) / 15.0));
  }

  static boolean sleep(JsonNode action) {
    return action.path("id").asText().equals("sleep");
  }

  /** Zero preserves the established duration for every non-sleep activity. */
  static long duration(GameService g, ObjectNode s, ObjectNode w, JsonNode action) {
    return sleep(action) ? Math.max(1000, Math.round(hours(s) * 60 * g.minuteMillis(w))) : 0;
  }

  static double recovery(JsonNode s) {
    return deficit(s);
  }
}
