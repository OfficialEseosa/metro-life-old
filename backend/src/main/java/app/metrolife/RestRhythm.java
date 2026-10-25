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

  /** Longest real wait for a full night's sleep. A game day is only seven real minutes. */
  static final long MAX_SLEEP_MS = 20000,
    MIN_SLEEP_MS = 6000;

  /** Zero preserves the established duration for every non-sleep activity. Deeper tiredness sleeps longer, within a short real wait. */
  static long duration(GameService g, ObjectNode s, ObjectNode w, JsonNode action) {
    if (!sleep(action)) return 0;
    return Math.round(MIN_SLEEP_MS + (MAX_SLEEP_MS - MIN_SLEEP_MS) * Math.min(1, deficit(s) / 100));
  }

  static double recovery(JsonNode s) {
    return deficit(s);
  }
}
