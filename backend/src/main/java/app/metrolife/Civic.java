package app.metrolife;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.*;
import java.util.*;

/** Three game-day elections, scoped by world and city. Called under GameService's monitor. */
final class Civic {

  final GameService g;

  Civic(GameService g) {
    this.g = g;
  }

  ObjectNode state(ObjectNode world, String city) {
    return g.store.data.withObject("civic").withObject(world.path("id").asText()).withObject(city);
  }

  int day(ObjectNode w) {
    return g.clock(w).path("day").asInt();
  }

  long dayAt(ObjectNode w, int day) {
    return g.gameInstant(w, (day - 1) * 1440L);
  }

  void tick(ObjectNode w) {
    for (JsonNode city : g.content.world.path("cities")) {
      ObjectNode c = state(w, city.path("id").asText());
      int term = (day(w) - 1) / 3 + 1,
        old = c.path("term").asInt(1);
      if (!c.has("policyHistory")) c.putArray("policyHistory")
        .addObject()
        .put("at", w.path("startedAt").asLong())
        .put("policy", c.path("mayor").path("policy").asText(""));
      if (!c.has("candidates")) {
        c.putArray("candidates");
        c.putObject("votes");
        c.putObject("campaignDays");
        c.putNull("mayor");
        c.put("term", term);
      }
      if (term > old) {
        recordPolicy(w, city.path("id").asText(), "", dayAt(w, old * 3 + 1));
        ObjectNode winner = null;
        int votes = -1;
        for (JsonNode candidate : c.path("candidates")) {
          int count = tally(c, candidate.path("id").asText());
          if (count > votes) {
            winner = ((ObjectNode) candidate).deepCopy();
            votes = count;
          }
        }
        if (winner != null && votes > 0) {
          winner
            .put("votes", votes)
            .putNull("policy")
            .putNull("announcement")
            .putNull("announcementAt")
            .put("policyNextDay", 0);
          if (term == old + 1) c.set("mayor", winner);
          else c.putNull("mayor");
          ObjectNode s = (ObjectNode) g.table("sims").get(winner.path("id").asText() + ":" + w.path("id").asText());
          if (s != null && term == old + 1) external(s, "electionWins");
        } else c.putNull("mayor");
        c.put("term", term);
        c.putArray("candidates");
        c.putObject("votes");
        c.putObject("campaignDays");
      }
    }
  }

  void external(ObjectNode s, String metric) {
    ObjectNode m = s.withObject("_externalMetrics");
    m.put(metric, m.path(metric).asInt() + 1);
    s.put("_externalProgress", true);
  }

  int tally(ObjectNode c, String id) {
    int votes = 0;
    for (JsonNode v : c.path("votes")) if (v.asText().equals(id)) votes++;
    for (JsonNode candidate : c.path("candidates"))
      if (candidate.path("id").asText().equals(id)) votes += candidate.path("support").asInt();
    return votes;
  }

  ObjectNode candidate(ObjectNode c, String id) {
    for (JsonNode candidate : c.path("candidates"))
      if (candidate.path("id").asText().equals(id)) return (ObjectNode) candidate;
    return null;
  }

  String policy(ObjectNode w, String city) {
    tick(w);
    return state(w, city).path("mayor").path("policy").asText("");
  }

  ObjectNode resident(String token, String city) {
    g.content.city(city);
    ObjectNode session = g.session(token, true),
      s = g.sim(session);
    g.decay(s, g.world(session));
    GameService.require(s.path("city").asText().equals(city), 403, "Travel to this city first");
    GameService.require(
      s.path("busyUntil").isNull() && s.path("pendingBeat").isNull(),
      409,
      "Finish your activity or story first"
    );
    return s;
  }

  String text(JsonNode body, String field, int min, int max) {
    String value = body.path(field).asText().trim();
    GameService.require(
      value.length() >= min &&
        value.length() <= max &&
        !GameService.containsEmoji(value) &&
        value.codePoints().noneMatch(c -> Character.isISOControl(c) || Character.getType(c) == Character.FORMAT) &&
        value
          .codePoints()
          .anyMatch(
            c ->
              !Character.isWhitespace(c) &&
              !Character.isSpaceChar(c) &&
              Character.getType(c) != Character.NON_SPACING_MARK &&
              Character.getType(c) != Character.COMBINING_SPACING_MARK &&
              Character.getType(c) != Character.ENCLOSING_MARK
          ),
      400,
      "Use " + min + "–" + max + " plain-text characters"
    );
    return value;
  }

  ObjectNode read(String token, String city) {
    g.content.city(city);
    ObjectNode session = g.session(token, false),
      w = g.world(session);
    tick(w);
    ObjectNode c = state(w, city),
      s = session == null ? null : (ObjectNode) g.table("sims").get(g.simKey(session));
    String uid = s == null ? "" : s.path("userId").asText();
    boolean here = s != null && s.path("city").asText().equals(city),
      running = candidate(c, uid) != null;
    ObjectNode out = g
      .object()
      .put("city", city)
      .put("running", running)
      .put("isMayor", c.path("mayor").path("id").asText().equals(uid) && !uid.isEmpty());
    out.set("mayor", c.path("mayor").deepCopy());
    out
      .putObject("term")
      .put("id", c.path("term").asInt())
      .put("endsDay", c.path("term").asInt() * 3 + 1)
      .put("endsAt", dayAt(w, c.path("term").asInt() * 3 + 1));
    ArrayNode candidates = out.putArray("candidates");
    for (JsonNode n : c.path("candidates")) {
      ObjectNode row = ((ObjectNode) n).deepCopy();
      row.remove("support");
      row.put("votes", tally(c, row.path("id").asText()));
      candidates.add(row);
    }
    if (c.path("votes").has(uid)) out.put("myVote", c.path("votes").path(uid).asText());
    else out.putNull("myVote");
    if (!here) {
      out.put("canRun", "Travel here to take part").put("canVote", "Travel here to vote");
    } else {
      if (running) out.put("canRun", "You are on the ballot");
      else if (g.progression.skill(s, "charisma") < 2) out.put("canRun", "Reach Charisma 2 to run");
      else out.put("canRun", true);
      if (c.path("votes").has(uid)) out.put("canVote", "Your vote is counted for this term");
      else if (!g.established(s)) out.put("canVote", "Live here for one game day before voting");
      else out.put("canVote", true);
    }
    out.put("campaignReady", running && c.path("campaignDays").path(uid).asInt() != day(w));
    return out;
  }

  ObjectNode mutate(String token, String kind, JsonNode body) {
    String city = body.path("city").asText();
    ObjectNode s = resident(token, city),
      w = g.world(g.session(token, true)),
      c = state(w, city);
    String uid = s.path("userId").asText();
    switch (kind) {
      case "run" -> {
        GameService.require(g.progression.skill(s, "charisma") >= 2, 403, "Reach Charisma 2 to run");
        GameService.require(candidate(c, uid) == null, 409, "You are already on the ballot");
        String slogan = text(body, "slogan", 3, 80);
        ObjectNode row = c
          .withArray("candidates")
          .addObject()
          .put("id", uid)
          .put("username", s.path("username").asText())
          .put("slogan", slogan)
          .put("npc", false)
          .put("support", 0);
        row.set("look", s.path("look").deepCopy());
        external(s, "campaign");
      }
      case "vote" -> {
        GameService.require(g.established(s), 403, "Live here for one game day before voting");
        GameService.require(!c.path("votes").has(uid), 409, "Your vote is already counted for this term");
        String id = body.path("candidateId").asText();
        GameService.require(candidate(c, id) != null, 404, "Choose someone on the current ballot");
        c.withObject("votes").put(uid, id);
      }
      case "policy" -> {
        ObjectNode mayor = mayor(c, uid);
        String id = body.path("policy").asText();
        boolean valid = false;
        for (JsonNode p : g.content.world.path("policies")) if (p.path("id").asText().equals(id)) valid = true;
        GameService.require(valid, 400, "Choose an offered policy");
        GameService.require(day(w) >= mayor.path("policyNextDay").asInt(), 409, "Your policy is set for this week");
        mayor.put("policy", id).put("policyNextDay", day(w) + 7);
        recordPolicy(w, city, id, g.now());
      }
      case "announce" -> {
        ObjectNode mayor = mayor(c, uid);
        String value = text(body, "text", 3, 140);
        GameService.require(
          !value.contains("://") && !value.toLowerCase(Locale.ROOT).contains("www."),
          400,
          "Keep announcements free of links"
        );
        GameService.require(
          g.now() - mayor.path("announcementAt").asLong() > 60000,
          429,
          "Wait one game hour before another announcement"
        );
        mayor.put("announcement", value).put("announcementAt", g.now());
      }
      default -> throw new ApiException(400, "Choose a civic action");
    }
    g.finishProgress(s);
    g.store.save();
    return read(token, city);
  }

  ObjectNode mayor(ObjectNode c, String uid) {
    GameService.require(c.path("mayor").path("id").asText().equals(uid), 403, "Only the current mayor can do this");
    return (ObjectNode) c.path("mayor");
  }

  void campaignCheck(ObjectNode w, ObjectNode s, String city) {
    ObjectNode c = state(w, city);
    String uid = s.path("userId").asText();
    GameService.require(candidate(c, uid) != null, 403, "Join the ballot before campaigning");
    GameService.require(
      c.path("campaignDays").path(uid).asInt() != day(w),
      409,
      "You have campaigned today. Return tomorrow"
    );
  }

  void campaign(ObjectNode w, ObjectNode s, String city, int term, int acceptedDay) {
    ObjectNode c = state(w, city);
    String uid = s.path("userId").asText();
    ObjectNode row = candidate(c, uid);
    if (row != null && c.path("term").asInt() == term && c.path("campaignDays").path(uid).asInt() != acceptedDay) {
      row.put("support", row.path("support").asInt() + 1);
      c.withObject("campaignDays").put(uid, acceptedDay);
    }
  }

  void recordPolicy(ObjectNode w, String city, String policy, long at) {
    state(w, city).withArray("policyHistory").addObject().put("at", at).put("policy", policy);
  }

  String policyAt(ObjectNode w, String city, long at) {
    String policy = "";
    for (JsonNode entry : state(w, city).path("policyHistory"))
      if (entry.path("at").asLong() <= at) policy = entry.path("policy").asText();
    return policy;
  }

  boolean open(ObjectNode w, String city, JsonNode landmark, int hour) {
    int start = landmark.path("open").get(0).asInt(),
      end = landmark.path("open").get(1).asInt();
    if (start == 0 && end == 24) return true;
    String policy = policy(w, city),
      category = landmark.path("category").asText();
    if (policy.equals("parks") && category.equals("park")) end = 24;
    if (policy.equals("arts") && category.equals("culture")) end = 24;
    if (policy.equals("nightlife") && category.equals("nightlife")) end = 4;
    return start < end ? hour >= start && hour < end : hour >= start || hour < end;
  }

  /** Open now, or the sim is already inside: whoever came in before closing may finish their visit. */
  boolean openFor(ObjectNode w, String city, JsonNode landmark, ObjectNode s) {
    if (open(w, city, landmark, g.clock(w).path("hour").asInt())) return true;
    String room = s.path("position").path("room").asText("");
    return !room.isEmpty() && room.endsWith(":" + landmark.path("id").asText());
  }

  /** A friendly closed message that says when to come back. */
  String closedMessage(JsonNode landmark) {
    return (
      landmark.path("name").asText("This place") +
      " is closed right now. It opens at " +
      String.format("%02d:00", landmark.path("open").get(0).asInt() % 24) +
      "."
    );
  }

  ObjectNode action(ObjectNode w, String city, JsonNode landmark, ObjectNode action) {
    ObjectNode a = action.deepCopy();
    String policy = policy(w, city),
      category = landmark.path("category").asText();
    int hour = g.clock(w).path("hour").asInt();
    if (policy.equals("transit") && category.equals("transport") && !a.has("to")) a.put("cost", 0);
    if (policy.equals("arts") && category.equals("culture") && hour >= 18 && !a.path("requires").has("job")) a.put(
      "cost",
      0
    );
    if (policy.equals("smallbiz") && a.path("kind").asText().equals("work")) a.put(
      "pay",
      Math.floor(a.path("pay").asDouble() * 1.05)
    );
    return a;
  }
}
