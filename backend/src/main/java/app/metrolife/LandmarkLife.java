package app.metrolife;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.*;
import java.util.*;

/** Small authored venue activities, shared show clocks and room-local turn scores. */
final class LandmarkLife {

  final GameService g;
  final JsonNode config;

  LandmarkLife(GameService g) {
    this.g = g;
    try (var in = getClass().getResourceAsStream("/static-data/venues.json")) {
      config = g.mapper.readTree(in).path("landmarkLife");
    } catch (Exception e) {
      throw new IllegalStateException("Venue activities missing", e);
    }
  }

  static void install(Content c) {
    try (var in = LandmarkLife.class.getResourceAsStream("/static-data/venues.json")) {
      JsonNode definitions = c.mapper.readTree(in).path("landmarkLife");
      var entries = definitions.fields();
      while (entries.hasNext()) {
        var entry = entries.next();
        JsonNode definition = entry.getValue();
        ObjectNode place = c.landmark(definition.path("city").asText(), entry.getKey());
        place.set("venueActions", definition.path("actions").deepCopy());
        for (JsonNode row : definition.path("actions")) {
          String kind = row.path("kind").asText();
          if (!kind.equals("food") && !kind.equals("watch")) continue;
          String id = "venue-" + row.path("id").asText();
          boolean found = false;
          for (JsonNode a : place.path("actions")) if (a.path("id").asText().equals(id)) found = true;
          if (found) continue;
          Map<String, Integer> needs = new HashMap<>();
          needs.put(row.path("need").asText("fun"), row.path("gain").asInt(8));
          ObjectNode action = c.action(
            id,
            row.path("label").asText(),
            kind.equals("food") ? "food" : "fun",
            kind.equals("food") ? "utensils" : "sparkles",
            12,
            row.path("cost").asInt(),
            0,
            needs,
            Map.of()
          );
          action
            .put("venueStation", row.path("station").asText())
            .put("venuePose", row.path("pose").asText())
            .put("xp", 5);
          place.withArray("actions").add(action);
        }
      }
    } catch (Exception e) {
      throw new IllegalStateException("Could not install venue activities", e);
    }
  }

  JsonNode definition(String loc) {
    JsonNode row = config.path(loc);
    GameService.require(row.isObject(), 404, "This place has no scheduled venue activity");
    return row;
  }

  ObjectNode state(ObjectNode w, String loc) {
    ObjectNode row = g.store.data.withObject("venueLife").withObject(w.path("id").asText()).withObject(loc);
    if (!row.has("scores")) row.putArray("scores");
    if (!row.has("art")) row.putArray("art");
    if (!row.has("waveUsers")) row.putArray("waveUsers");
    return row;
  }

  JsonNode action(JsonNode cfg, String kind) {
    for (JsonNode row : cfg.path("actions")) if (row.path("id").asText().equals(kind)) return row;
    throw new ApiException(400, "Choose one of this venue's activities");
  }

  JsonNode station(ObjectNode s, String loc, JsonNode action) {
    String city = s.path("city").asText(),
      type = g.navigation.type(city, loc);
    for (JsonNode row : g.navigation.layout(city, type).path("stations"))
      if (row.path("id").asText().equals(action.path("station").asText())) return row;
    return g.mapper.nullNode();
  }

  String reason(ObjectNode s, String loc, JsonNode cfg, JsonNode action, ObjectNode shared) {
    if (s == null) return "Start your life first";
    if (!s.path("city").asText().equals(cfg.path("city").asText())) return "Travel to this city first";
    if (g.transit.active(s)) return "Arrive before joining in";
    if (
      !s.path("position").path("room").asText().equals(g.navigation.roomId(s, loc))
    ) return "Walk inside this venue first";
    if (g.community.socialBusy(s)) return "Finish your activity or story first";
    JsonNode point = station(s, loc, action);
    if (!point.isObject()) return "This activity is being set up";
    if (
      Math.hypot(
        s.path("position").path("x").asDouble() - point.path("x").asDouble(),
        s.path("position").path("z").asDouble() - point.path("z").asDouble()
      ) > 1.65
    ) return "Walk to " + point.path("name").asText(action.path("station").asText());
    if (s.path("cash").asDouble() < action.path("cost").asDouble()) return (
      "Save $" + action.path("cost").asInt() + " for this"
    );
    JsonNode turn = shared.path("turn");
    if (
      action.path("kind").asText().equals("game") &&
      turn.path("expiresAt").asLong() > g.now() &&
      !turn.path("userId").asText().equals(s.path("userId").asText())
    ) return turn.path("username").asText() + " is taking a turn";
    return "";
  }

  ObjectNode moment(ObjectNode w, String loc, JsonNode cfg) {
    long period = cfg.path("periodSeconds").asLong(720) * 1000,
      base = w.path("startedAt").asLong() + Math.floorMod(loc.hashCode(), 80) * 1000L,
      cycle = Math.floorDiv(g.now() - base, period),
      start = base + cycle * period + 30000,
      end = start + 120000;
    String phase =
      g.now() < start ? "prelude" : g.now() < end ? "active" : g.now() < end + 30000 ? "encore" : "between";
    return g
      .object()
      .put("id", loc + ":" + cycle)
      .put("title", cfg.path("event").asText())
      .put("startsAt", start)
      .put("endsAt", end)
      .put("nextAt", start + period)
      .put("phase", phase)
      .put("cycleMs", period);
  }

  ObjectNode read(String token, String loc) {
    JsonNode cfg = definition(loc);
    ObjectNode ses = g.session(token, false),
      w = g.world(ses),
      s = ses == null ? null : (ObjectNode) g.table("sims").get(g.simKey(ses));
    if (s != null) g.decay(s, w);
    return response(s, w, loc, cfg);
  }

  ObjectNode response(ObjectNode s, ObjectNode w, String loc, JsonNode cfg) {
    ObjectNode shared = state(w, loc),
      out = g
        .object()
        .put("loc", loc)
        .put("city", cfg.path("city").asText())
        .put("title", cfg.path("title").asText())
        .put("type", cfg.path("type").asText())
        .put("at", g.now());
    out.set("moment", moment(w, loc, cfg));
    ObjectNode visible = shared.deepCopy();
    visible.remove(List.of("waveUsers", "turn"));
    JsonNode turn = shared.path("turn");
    if (turn.path("expiresAt").asLong() > g.now()) visible.set("turn", turn.deepCopy());
    out.set("shared", visible);
    ArrayNode actions = out.putArray("actions");
    for (JsonNode action : cfg.path("actions")) {
      ObjectNode copy = ((ObjectNode) action).deepCopy();
      copy.put("reason", reason(s, loc, cfg, action, shared));
      if (s != null) {
        JsonNode point = station(s, loc, action);
        if (point.isObject()) copy.set("point", point.deepCopy());
      }
      actions.add(copy);
    }
    if (s != null) {
      JsonNode attempt = s.path("_venueAttempt");
      out.set(
        "attempt",
        attempt.path("loc").asText().equals(loc) && attempt.path("expiresAt").asLong() > g.now()
          ? attempt.deepCopy()
          : g.mapper.nullNode()
      );
      out.set("sim", g.publicSim(s));
    } else out.putNull("attempt");
    out.set("clock", g.clock(w));
    return out;
  }

  ObjectNode mutate(String token, JsonNode body) {
    ObjectNode ses = g.session(token, true),
      s = g.sim(ses),
      w = g.world(ses);
    g.decay(s, w);
    String loc = body.path("loc").asText(),
      kind = body.path("kind").asText();
    JsonNode cfg = definition(loc),
      action = action(cfg, kind);
    ObjectNode shared = state(w, loc);
    String blocked = reason(s, loc, cfg, action, shared);
    GameService.require(blocked.isEmpty(), 409, blocked);
    GameService.require(
      g.civic.openFor(w, s.path("city").asText(), g.content.landmark(s.path("city").asText(), loc), s),
      409,
      g.civic.closedMessage(g.content.landmark(s.path("city").asText(), loc))
    );
    String uid = s.path("userId").asText(),
      mode = action.path("kind").asText();
    String message;
    if (mode.equals("paint")) {
      JsonNode pixels = body.path("cells");
      GameService.require(pixels.isArray() && pixels.size() == 16, 400, "Paint all sixteen squares of your canvas");
      Set<String> colours = Set.of("#e4b95b", "#6f9e8b", "#779bc0", "#c87d8c", "#ede0c7", "#64537f");
      for (JsonNode cell : pixels)
        GameService.require(colours.contains(cell.asText()), 400, "Use the studio paint palette");
    }
    if (mode.equals("game")) {
      message = game(s, w, loc, kind, body.path("phase").asText(), shared);
    } else {
      long last = s
        .path("_venueCooldown")
        .path(loc + ":" + kind)
        .asLong();
      GameService.require(g.now() - last >= 3500, 429, "Give this moment a little time");
      s.withObject("_venueCooldown").put(loc + ":" + kind, g.now());
      double cost = action.path("cost").asDouble();
      if (cost > 0) g.property.pay(s, cost, action.path("label").asText());
      String need = action.path("need").asText("fun");
      s.withObject("needs").put(
        need,
        Math.min(100, s.path("needs").path(need).asDouble() + action.path("gain").asInt(8))
      );
      g.community.gesture(s, action.path("pose").asText("Interact"), "venue:" + kind, action.path("label").asText());
      if (kind.equals("wave")) {
        if (g.now() - shared.path("waveAt").asLong() > 14000) {
          shared.put("waveAt", g.now());
          shared.putArray("waveUsers");
        }
        boolean joined = false;
        for (JsonNode id : shared.path("waveUsers")) if (id.asText().equals(uid)) joined = true;
        if (!joined) shared.withArray("waveUsers").add(uid);
        shared.put("waveCount", shared.path("waveUsers").size());
      }
      if (kind.equals("dancecam")) {
        shared.put("danceAt", g.now()).put("danceName", s.path("username").asText()).put("danceUserId", uid);
      }
      if (kind.equals("curtain") || kind.equals("organ")) {
        shared.put(kind.equals("curtain") ? "curtainAt" : "organAt", g.now());
      }
      if (kind.equals("train")) shared.put("trainAt", g.now());
      if (kind.equals("ray")) shared.put("rayAt", g.now());
      if (mode.equals("paint")) {
        JsonNode cells = body.path("cells");
        ArrayNode art = shared.withArray("art");
        for (int i = art.size() - 1; i >= 0; i--) if (art.get(i).path("userId").asText().equals(uid)) art.remove(i);
        ObjectNode painting = art
          .addObject()
          .put("id", g.id())
          .put("userId", uid)
          .put("username", s.path("username").asText())
          .put("at", g.now());
        painting.set("cells", cells.deepCopy());
        while (art.size() > 12) art.remove(0);
        g.addSkill((ObjectNode) s.path("skills").path("creativity"), 12);
        s.put("painting", true);
      }
      message = action.path("label").asText() + ". A little moment, shared.";
    }
    g.updateMood(s);
    g.store.save();
    ObjectNode response = response(s, w, loc, cfg);
    response.put("message", message);
    return response;
  }

  String game(ObjectNode s, ObjectNode w, String loc, String kind, String phase, ObjectNode shared) {
    String uid = s.path("userId").asText();
    if (phase.equals("start")) {
      GameService.require(
        g.now() - s.path("_lastVenueGame").asLong() >= 2000,
        429,
        "Take a breath before your next turn"
      );
      long now = g.now();
      s.putObject("_venueAttempt")
        .put("id", g.id())
        .put("loc", loc)
        .put("kind", kind)
        .put("startedAt", now)
        .put("expiresAt", now + 15000)
        .put("periodMs", 2200)
        .put("target", .5);
      shared
        .putObject("turn")
        .put("userId", uid)
        .put("username", s.path("username").asText())
        .put("kind", kind)
        .put("expiresAt", now + 15000);
      g.community.gesture(s, "Interact", "venue:" + kind, "Taking a turn");
      return "Your turn. Stop the marker in the green centre.";
    }
    GameService.require(phase.equals("finish"), 400, "Start a turn, then release your shot");
    JsonNode attempt = s.path("_venueAttempt");
    GameService.require(
      attempt.path("loc").asText().equals(loc) &&
        attempt.path("kind").asText().equals(kind) &&
        attempt.path("expiresAt").asLong() > g.now(),
      409,
      "Start a fresh turn"
    );
    long elapsed = g.now() - attempt.path("startedAt").asLong();
    GameService.require(elapsed >= 150, 409, "Let the marker start moving");
    double wave = (elapsed % 2200) / 1100.0,
      position = wave <= 1 ? wave : 2 - wave;
    int precision = (int) Math.round(Math.max(0, 1 - Math.abs(position - .5) * 2) * 100),
      score = kind.equals("skee")
        ? precision >= 85
          ? 50
          : precision >= 55
            ? 30
            : 10
        : kind.equals("golf")
          ? precision >= 90
            ? 1
            : precision >= 60
              ? 2
              : 3
          : precision >= 82
            ? 3
            : 0;
    String label = kind.equals("golf")
      ? score + " strokes"
      : kind.equals("skee")
        ? score + " tickets"
        : score == 3
          ? "Swish! Three points"
          : "So close! Try again";
    ArrayNode scores = shared.withArray("scores");
    ObjectNode result = scores
      .addObject()
      .put("id", g.id())
      .put("userId", uid)
      .put("username", s.path("username").asText())
      .put("kind", kind)
      .put("score", score)
      .put("precision", precision)
      .put("at", g.now())
      .put("text", label);
    while (scores.size() > 24) scores.remove(0);
    s.remove("_venueAttempt");
    s.put("_lastVenueGame", g.now());
    shared.remove("turn");
    shared
      .put("lastPlayAt", g.now())
      .put("lastPlayer", s.path("username").asText())
      .put("lastKind", kind)
      .put("lastScore", score);
    s.withObject("needs")
      .put("fun", Math.min(100, s.path("needs").path("fun").asDouble() + 8))
      .put("social", Math.min(100, s.path("needs").path("social").asDouble() + 3));
    g.community.gesture(s, score > 0 ? "Cheer" : "Laugh", "venue:" + kind, label);
    if (kind.equals("skee")) s.put("fairTickets", s.path("fairTickets").asInt() + score);
    if (kind.equals("shot") && score == 3 && g.now() - s.path("_lastShotPrize").asLong() > 60000) {
      g.economy.credit(s, 5, "Half-court challenge prize");
      s.put("_lastShotPrize", g.now());
    }
    g.addSkill((ObjectNode) s.path("skills").path("fitness"), 5);
    return label;
  }
}
