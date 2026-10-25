package app.metrolife;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.IOException;
import java.util.*;

/** Shared footprint collision and server-time speed budget, independent of render rate. */
final class Navigation {

  final GameService g;
  final JsonNode data;
  JsonNode interiors, venues;
  final Map<String, Long> arrivals = new HashMap<>();
  final Map<String, Long> times = new HashMap<>();
  final Map<String, Double> credits = new HashMap<>();

  Navigation(GameService g) {
    this.g = g;
    try (var in = getClass().getResourceAsStream("/static-data/navigation.json")) {
      data = g.mapper.readTree(in);
      try (var rooms = getClass().getResourceAsStream("/static-data/interiors.json")) {
        interiors = g.mapper.readTree(rooms);
        try (var v = getClass().getResourceAsStream("/static-data/venues.json")) {
          venues = g.mapper.readTree(v);
        }
      }
    } catch (IOException e) {
      throw new IllegalStateException("Navigation data missing", e);
    }
  }

  void repairRoomPositions() {
    boolean changed = false;
    for (JsonNode row : g.table("sims")) {
      ObjectNode s = (ObjectNode) row;
      JsonNode p = s.path("position");
      if (
        !p.isObject() ||
        p.path("room").isNull() ||
        p.path("room").asText().isEmpty() ||
        p.path("room").asText().startsWith("transit:")
      ) continue;
      String city = s.path("city").asText(),
        type = type(city, s.path("loc").asText());
      boolean outdated = !p
        .path("room")
        .asText()
        .equals(roomId(s, s.path("loc").asText()));
      if (outdated || !stand(city, p.path("x").asDouble(), p.path("z").asDouble(), p.path("room").asText())) {
        JsonNode exit = layoutFor(s, type).path("exit");
        if (exit.isObject()) {
          ((ObjectNode) p)
            .put("room", roomId(s, s.path("loc").asText()))
            .put("x", exit.path("x").asDouble())
            .put("z", exit.path("z").asDouble());
          s.putNull("activitySlot");
          changed = true;
        }
      }
    }
    if (changed) g.store.save();
  }

  JsonNode layout(String city, String type) {
    JsonNode base = interiors.path(type),
      variant = base.path("variants").path(city);
    return variant.isObject() ? variant : base;
  }

  JsonNode layoutFor(ObjectNode s, String type) {
    return type.equals("home") && g.homeDesign != null
      ? s.has("_visitingHome")
        ? g.homeDesign.layout(s.path("city").asText(), "home:" + s.path("_visitingHome").asText())
        : g.homeDesign.layout(s, g.homeDesign.ensure(s))
      : layout(s.path("city").asText(), type);
  }

  JsonNode city(String city) {
    return data.path("cities").path(city);
  }

  JsonNode door(ObjectNode s, String place) {
    if (place.equals("home") && s.has("_visitingHome")) {
      ObjectNode host = g.homeDesign.owner("home:" + s.path("_visitingHome").asText());
      if (host != null) return city(s.path("city").asText())
        .path("homes")
        .path(host.path("home").path("neighborhood").asText());
    }
    return place.equals("home")
      ? city(s.path("city").asText()).path("homes").path(s.path("home").path("neighborhood").asText())
      : city(s.path("city").asText()).path("doors").path(place);
  }

  /** Actors are visible at an active use slot, not their last walk approach. */
  JsonNode effectivePosition(JsonNode actor) {
    JsonNode use = actor.path("activitySlot");
    return use.isObject() &&
      (actor.path("busyUntil").asLong() > g.now() || use.path("bench").asBoolean() || actor.path("npc").asBoolean())
      ? use
      : actor.path("position");
  }

  List<JsonNode> people(String wid) {
    List<JsonNode> rows = new ArrayList<>();
    g.table("sims").forEach(rows::add);
    g.community.residents().path(wid).forEach(rows::add);
    return rows;
  }

  String arrivalKey(JsonNode actor) {
    return actor.path("worldId").asText() + ":" + actor.path("userId").asText();
  }

  boolean present(JsonNode actor) {
    return (
      actor.path("npc").asBoolean() ||
      g.community.isOnline(actor.path("worldId").asText(), actor.path("userId").asText()) ||
      arrivals.getOrDefault(arrivalKey(actor), 0L) > g.now() ||
      actor.path("busyUntil").asLong() > g.now()
    );
  }

  /**
   * Two people read as one body when they stand in line with the camera, which looks along z,
   * so a spot needs more clearance in depth than sideways.
   */
  static boolean crowded(JsonNode at, double x, double z) {
    return Math.hypot((at.path("x").asDouble() - x) / .85, (at.path("z").asDouble() - z) / 1.5) < 1;
  }

  boolean freeSpot(ObjectNode actor, double x, double z, String room) {
    String city = actor.path("city").asText(),
      wid = actor.path("worldId").asText();
    if (!stand(city, x, z, room)) return false;
    for (JsonNode other : people(wid)) {
      if (
        other.path("userId").equals(actor.path("userId")) ||
        !other.path("worldId").asText().equals(wid) ||
        !other.path("city").asText().equals(city) ||
        !other.path("position").isObject() ||
        !other.path("position").path("room").asText("").equals(room) ||
        !present(other)
      ) continue;
      if (crowded(effectivePosition(other), x, z)) return false;
      JsonNode reserved = other.path("_roomSlot");
      if (
        other.path("npc").asBoolean() &&
        other.path("_phase").asText().equals("approach") &&
        reserved.isObject() &&
        crowded(reserved, x, z)
      ) return false;
    }
    if (!room.isEmpty()) for (JsonNode staff : layout(city, room.split(":")[0]).path("staff"))
      if (crowded(staff, x, z)) return false;
    return true;
  }

  /** Allocate only on arrival/reconnect; normal movement keeps its existing continuous rules. */
  ObjectNode freeArrival(ObjectNode actor, ObjectNode desired) {
    arrivals.entrySet().removeIf(e -> e.getValue() <= g.now());
    String room = desired.path("room").asText("");
    double x = desired.path("x").asDouble(),
      z = desired.path("z").asDouble();
    if (freeSpot(actor, x, z, room)) {
      arrivals.put(arrivalKey(actor), g.now() + 12000);
      return desired;
    }
    for (int ring = 1; ring <= (room.isEmpty() ? 3 : 6); ring++) {
      double radius = ring;
      int count = 8 * ring;
      // The camera looks along z, so someone straight in front of or behind the person already
      // standing here reads as one body. Try the spots beside them first.
      List<Double> angles = new ArrayList<>();
      for (int i = 0; i < count; i++) angles.add((i * Math.PI * 2) / count);
      angles.sort(Comparator.comparingDouble(a -> Math.abs(Math.cos(a))));
      for (double angle : angles) {
        double px = x + Math.sin(angle) * radius,
          pz = z + Math.cos(angle) * radius;
        if (freeSpot(actor, px, pz, room)) {
          arrivals.put(arrivalKey(actor), g.now() + 12000);
          return desired.put("x", px).put("z", pz);
        }
      }
    }
    throw new ApiException(409, "This entrance is busy. Wait for someone to move.");
  }

  ObjectNode arrival(ObjectNode actor, String loc, String room, double x, double z, double face) {
    ObjectNode p = g
      .object()
      .put("x", x)
      .put("z", z)
      .put("face", face)
      .put("place", loc)
      .put("city", actor.path("city").asText());
    if (room.isEmpty()) p.putNull("room");
    else p.put("room", room);
    return freeArrival(actor, p);
  }

  ObjectNode position(ObjectNode s) {
    String place = s.path("loc").asText();
    if (
      !s.path("position").isObject() ||
      !s.path("position").path("place").asText().equals(place) ||
      !s.path("position").path("city").asText().equals(s.path("city").asText())
    ) {
      JsonNode d = door(s, place);
      ObjectNode p = arrival(s, place, "", d.path("x").asDouble(), d.path("z").asDouble(), Math.PI);
      s.set("position", p);
      String key = s.path("worldId").asText() + s.path("userId").asText();
      times.put(key, g.now());
      credits.put(key, 2.4);
      return p;
    }
    return (ObjectNode) s.path("position");
  }

  void rejoin(ObjectNode actor) {
    if (
      g.transit.active(actor) ||
      actor.path("npc").asBoolean() ||
      g.community.isOnline(actor.path("worldId").asText(), actor.path("userId").asText()) ||
      arrivals.getOrDefault(arrivalKey(actor), 0L) > g.now() ||
      actor.path("busyUntil").asLong() > g.now()
    ) return;
    ObjectNode p = position(actor);
    if (!actor.path("activitySlot").isObject()) actor.set("position", freeArrival(actor, p.deepCopy()));
  }

  static boolean polygon(double x, double z, JsonNode poly) {
    boolean inside = false;
    for (int i = 0, j = poly.size() - 1; i < poly.size(); j = i++) {
      JsonNode a = poly.get(i),
        b = poly.get(j);
      double ax = a.get(0).asDouble(),
        az = a.get(1).asDouble(),
        bx = b.get(0).asDouble(),
        bz = b.get(1).asDouble();
      if (az > z != bz > z && x < ((bx - ax) * (z - az)) / (bz - az) + ax) inside = !inside;
    }
    return inside;
  }

  static boolean box(double x, double z, JsonNode b, double pad) {
    double dx = x - b.path("x").asDouble(),
      dz = z - b.path("z").asDouble(),
      a = b.path("a").asDouble(),
      c = Math.cos(a),
      s = Math.sin(a);
    return (
      Math.abs(dx * c - dz * s) < b.path("w").asDouble() / 2 + pad &&
      Math.abs(dx * s + dz * c) < b.path("d").asDouble() / 2 + pad
    );
  }

  boolean stand(String city, double x, double z, String room) {
    if (!room.isEmpty()) {
      JsonNode layout =
        room.startsWith("home:") && g.homeDesign != null
          ? g.homeDesign.layout(city, room)
          : layout(city, room.split(":")[0]);
      double hw =
          layout
            .path("bounds")
            .path("w")
            .asDouble(room.startsWith("home:") ? 7 : 12) /
            2 -
          .25,
        hd =
          layout
            .path("bounds")
            .path("d")
            .asDouble(room.startsWith("home:") ? 6 : 10) /
            2 -
          .25;
      if (
        !layout.isObject() ||
        Math.abs(x) >= hw ||
        Math.abs(z) >= hd ||
        (layout.path("floor").isArray() && !polygon(x, z, layout.path("floor")))
      ) return false;
      for (JsonNode b : layout.path("boxes")) if (box(x, z, b, .3)) return false;
      return true;
    }
    JsonNode n = city(city);
    boolean land = false;
    for (JsonNode p : n.path("land")) if (polygon(x, z, p)) land = true;
    for (JsonNode b : n.path("bridges")) if (box(x, z, b, -.35)) land = true;
    if (!land) return false;
    for (JsonNode p : n.path("water")) if (polygon(x, z, p)) return false;
    for (JsonNode b : n.path("boxes")) if (box(x, z, b, .3)) return false;
    return true;
  }

  /** The piece of home furniture an action is done at; seats serve both a quiet sit and company. */
  static String homeStation(String actionId) {
    return switch (actionId) {
      case "sleep" -> "bed";
      case "cook" -> "stove";
      case "shower" -> "shower";
      case "invite", "relax" -> "chair";
      default -> "";
    };
  }

  /** Whether a home station built for {@code stationAction} supports {@code actionId}. */
  static boolean homeStationSupports(String stationAction, String actionId) {
    if (stationAction.equals(actionId)) return true;
    String kind = homeStation(actionId);
    return !kind.isEmpty() && homeStation(stationAction).equals(kind);
  }

  String type(String city, String loc) {
    if (loc.equals("home")) return "home";
    var types = interiors.fields();
    while (types.hasNext()) {
      var entry = types.next();
      for (JsonNode id : entry.getValue().path("landmarks").path(city))
        if (id.asText().equals(loc)) return entry.getKey();
    }
    return "";
  }

  JsonNode activityUse(String city, String type, JsonNode action) {
    if (action.has("venueStation")) return g
      .object()
      .put("station", action.path("venueStation").asText())
      .put("pose", action.path("venuePose").asText("Interact"));
    JsonNode rules = layout(city, type).path("activities"),
      rule = rules.path(action.path("requires").has("job") ? "job" : action.path("kind").asText());
    return rule.isObject() ? rule : rules.path("fun");
  }

  String roomId(ObjectNode s, String loc) {
    String type = type(s.path("city").asText(), loc);
    return type + ":" + (loc.equals("home") ? s.path("_visitingHome").asText(s.path("userId").asText()) : loc);
  }

  void idle(ObjectNode s) {
    GameService.require(
      s.path("busyUntil").isNull() && s.path("pendingBeat").isNull(),
      409,
      "Finish this moment first"
    );
  }

  void stage(ObjectNode s, String loc, JsonNode action) {
    stage(s, loc, action, "");
  }

  void stage(ObjectNode s, String loc, JsonNode action, String slotId) {
    String city = s.path("city").asText(),
      type = type(city, loc),
      id = action.path("id").asText();
    if (type.isEmpty()) {
      s.putNull("activitySlot");
      return;
    }
    String chosen = type.equals("home") ? homeStation(id) : "";
    JsonNode use = activityUse(city, type, action);
    String pose = use.path("pose").asText(),
      station = use.path("station").asText();
    JsonNode winner = null;
    double nearest = Double.MAX_VALUE;
    JsonNode at = position(s);
    for (JsonNode slot : layoutFor(s, type).path("slots")) {
      if (!slotId.isEmpty() && !slot.path("id").asText().equals(slotId)) continue;
      if (
        type.equals("home")
          ? chosen.isEmpty()
            ? !slot.path("action").asText(id).equals(id)
            : !homeStation(slot.path("action").asText()).equals(chosen)
          : !slot.path("pose").asText().equals(pose) || !slot.path("station").asText().equals(station)
      ) continue;
      boolean occupied = occupied(s, slot, at.path("room").asText());
      double distance = Math.hypot(
        slot.path("x").asDouble() - at.path("x").asDouble(),
        slot.path("z").asDouble() - at.path("z").asDouble()
      );
      if (!occupied && distance < nearest) {
        winner = slot;
        nearest = distance;
      }
    }
    GameService.require(winner != null, 409, "The furniture is in use. Wait for a free place.");
    s.set("activitySlot", winner.deepCopy());
  }

  JsonNode requestedSlot(ObjectNode s, String loc, JsonNode action, String slotId) {
    String city = s.path("city").asText(),
      type = type(city, loc),
      home = type.equals("home") ? homeStation(action.path("id").asText()) : "";
    JsonNode use = activityUse(city, type, action);
    for (JsonNode slot : layoutFor(s, type).path("slots"))
      if (slot.path("id").asText().equals(slotId)) {
        boolean compatible = type.equals("home")
          ? slot.path("action").asText().equals(action.path("id").asText()) ||
            slotId.equals(home) ||
            (!home.isEmpty() && homeStation(slot.path("action").asText()).equals(home))
          : slot.path("station").equals(use.path("station")) && slot.path("pose").equals(use.path("pose"));
        GameService.require(compatible, 400, "Choose furniture that supports this activity");
        return slot;
      }
    throw new ApiException(400, "Choose furniture in this room");
  }

  void requireSlotAction(ObjectNode s, String loc, JsonNode action, String slotId) {
    JsonNode slot = requestedSlot(s, loc, action, slotId);
    String city = s.path("city").asText();
    if (type(city, loc).equals("home")) {
      atStation(s, loc, slot.path("station").asText());
      return;
    }
    ObjectNode p = position(s);
    String room = roomId(s, loc);
    GameService.require(p.path("room").asText().equals(room), 409, "Walk inside first");
    GameService.require(
      stand(city, p.path("x").asDouble(), p.path("z").asDouble(), room) &&
        Math.hypot(
          p.path("x").asDouble() - slot.path("x").asDouble(),
          p.path("z").asDouble() - slot.path("z").asDouble()
        ) <= 1.45,
      409,
      "Walk up to the selected furniture first"
    );
    GameService.require(!occupied(s, slot, room), 409, "The furniture is in use. Wait for a free place.");
    p.put("face", slot.path("face").asDouble());
  }

  boolean occupied(ObjectNode s, JsonNode slot, String room) {
    String wid = s.path("worldId").asText();
    List<JsonNode> people = new ArrayList<>();
    g.table("sims").forEach(people::add);
    g.community.residents().path(wid).forEach(people::add);
    for (JsonNode other : people)
      if (
        !other.path("userId").equals(s.path("userId")) &&
        other.path("worldId").asText().equals(wid) &&
        other.path("city").equals(s.path("city")) &&
        other.path("position").path("room").asText().equals(room) &&
        (other.path("activitySlot").path("id").equals(slot.path("id")) ||
          (other.path("npc").asBoolean() &&
            other.path("_phase").asText().equals("approach") &&
            other.path("_roomSlot").path("id").equals(slot.path("id")))) &&
        (other.path("busyUntil").asLong() > g.now() ||
          (other.path("npc").asBoolean() &&
            (other.path("_phase").asText().equals("dwell") || other.path("_phase").asText().equals("approach"))))
      ) return true;
    return false;
  }

  void resumePosture(ObjectNode s) {
    if (
      s.path("activitySlot").path("bench").asBoolean() &&
      !g.community.isOnline(s.path("worldId").asText(), s.path("userId").asText())
    ) s.putNull("activitySlot");
    rejoin(s);
  }

  ObjectNode posture(String token, JsonNode body) {
    ObjectNode ses = g.session(token, true),
      s = g.sim(ses),
      w = g.world(ses);
    g.decay(s, w);
    idle(s);
    ObjectNode p = position(s);
    if (body.path("bench").isNull() || !body.has("bench")) {
      s.putNull("activitySlot");
      g.store.save();
      return g.simResponse(s, w);
    }
    GameService.require(p.path("room").isNull(), 409, "Leave the room before sitting outside");
    String id = body.path("bench").asText(),
      city = s.path("city").asText();
    JsonNode chosen = null;
    var parks = g.residentMotion.data.path("cities").path(city).path("parks").fields();
    while (parks.hasNext()) {
      var park = parks.next();
      for (int i = 0; i < park.getValue().path("benches").size(); i++) if (id.equals(park.getKey() + ":" + i)) chosen =
        park.getValue().path("benches").get(i);
    }
    GameService.require(chosen != null, 400, "Choose a park bench");
    double x = chosen.get(0).asDouble(),
      z = chosen.get(1).asDouble();
    GameService.require(
      Math.hypot(p.path("x").asDouble() - x, p.path("z").asDouble() - z) < 2,
      409,
      "Walk to the bench first"
    );
    GameService.require(freeSpot(s, x, z, ""), 409, "This bench is occupied");
    s.putObject("activitySlot")
      .put("id", id)
      .put("pose", "Sit")
      .put("x", x)
      .put("z", z)
      .put("y", .61)
      .put("face", 0)
      .put("bench", true);
    g.store.save();
    return g.simResponse(s, w);
  }

  void atDoor(ObjectNode s, String loc) {
    ObjectNode p = position(s);
    JsonNode d = door(s, loc);
    GameService.require(
      d.isObject() &&
        p.path("room").isNull() &&
        Math.hypot(d.path("x").asDouble() - p.path("x").asDouble(), d.path("z").asDouble() - p.path("z").asDouble()) <=
          3,
      409,
      "Walk to the door first"
    );
  }

  void atStation(ObjectNode s, String loc, String station) {
    ObjectNode p = position(s);
    GameService.require(p.path("room").asText().equals(roomId(s, loc)), 409, "Walk inside first");
    JsonNode chosen = null;
    for (JsonNode row : layoutFor(s, type(s.path("city").asText(), loc)).path("stations"))
      if (row.path("id").asText().equals(station)) chosen = row;
    GameService.require(
      chosen != null &&
        Math.hypot(
          p.path("x").asDouble() - chosen.path("x").asDouble(),
          p.path("z").asDouble() - chosen.path("z").asDouble()
        ) <= 1.45,
      409,
      "Walk up to the furniture first"
    );
    p.put("face", chosen.path("face").asDouble());
  }

  ObjectNode door(String token, JsonNode body) {
    ObjectNode ses = g.session(token, true),
      s = g.sim(ses),
      w = g.world(ses);
    g.decay(s, w);
    ObjectNode p = position(s);
    idle(s);
    s.putNull("activitySlot");
    boolean enter = body.path("enter").asBoolean();
    if (enter) {
      String loc = body.path("loc").asText(),
        city = s.path("city").asText(),
        type = type(city, loc);
      GameService.require(!type.isEmpty(), 400, "This building has no room to enter");
      if (loc.equals("home")) GameService.require(
        s.path("home").path("city").asText().equals(city),
        403,
        "Your home is in another city"
      );
      else if (!type.equals("club")) GameService.require(
        g.civic.open(w, city, g.content.landmark(city, loc), g.clock(w).path("hour").asInt()),
        409,
        g.civic.closedMessage(g.content.landmark(city, loc))
      );
      atDoor(s, loc);
      JsonNode exit = layoutFor(s, type).path("exit");
      ObjectNode inside = arrival(
        s,
        loc,
        roomId(s, loc),
        exit.path("x").asDouble(),
        exit.path("z").asDouble(),
        Math.PI
      );
      s.set("_outside", p.deepCopy());
      s.put("loc", loc);
      s.set("position", inside);
    } else {
      GameService.require(!p.path("room").isNull(), 409, "You are already outside");
      JsonNode exit = layoutFor(s, p.path("room").asText().split(":")[0]).path("exit");
      GameService.require(
        Math.hypot(
          p.path("x").asDouble() - exit.path("x").asDouble(),
          p.path("z").asDouble() - exit.path("z").asDouble()
        ) <= 1.5,
        409,
        "Walk to the exit first"
      );
      JsonNode outside = s.remove("_outside");
      if (outside != null) {
        s.set("position", outside);
        s.put("loc", outside.path("place").asText());
      } else {
        s.remove("position");
        position(s);
      }
      s.withObject("position").putNull("room");
      s.remove("_visitingHome");
      s.set("position", freeArrival(s, s.withObject("position").deepCopy()));
      if (p.path("room").asText().startsWith("home:")) g.firstDay.mark(s, "outside");
    }
    g.store.save();
    return g.simResponse(s, w);
  }

  void requireAction(ObjectNode s, String loc, String action) {
    String type = type(s.path("city").asText(), loc);
    if (type.isEmpty()) {
      atDoor(s, loc);
      return;
    }
    if (type.equals("home")) {
      JsonNode nearest = null;
      double distance = Double.MAX_VALUE;
      ObjectNode at = position(s);
      for (JsonNode row : layoutFor(s, type).path("stations"))
        if (homeStationSupports(row.path("action").asText(), action)) {
          double gap = Math.hypot(
            at.path("x").asDouble() - row.path("x").asDouble(),
            at.path("z").asDouble() - row.path("z").asDouble()
          );
          if (gap < distance) {
            nearest = row;
            distance = gap;
          }
        }
      if (nearest != null) {
        atStation(s, loc, nearest.path("id").asText());
        return;
      }
      throw new ApiException(409, "Buy furniture for this activity first");
    }
    JsonNode a = null;
    for (JsonNode row : g.content.landmark(s.path("city").asText(), loc).path("actions"))
      if (row.path("id").asText().equals(action)) a = row;
    GameService.require(a != null, 400, "Choose an activity here");
    String required = activityUse(s.path("city").asText(), type, a).path("station").asText();
    // Ordering at a cafe counter also reserves an actual dining seat.
    if (type.equals("cafe") && a.path("kind").asText().equals("food")) {
      ObjectNode at = position(s);
      for (JsonNode row : layoutFor(s, type).path("stations"))
        if (
          row.path("id").asText().equals("counter") &&
          Math.hypot(
            at.path("x").asDouble() - row.path("x").asDouble(),
            at.path("z").asDouble() - row.path("z").asDouble()
          ) <= 1.45
        ) {
          atStation(s, loc, "counter");
          return;
        }
    }
    atStation(s, loc, required);
  }

  ObjectNode travel(String token, JsonNode body) {
    ObjectNode ses = g.session(token, true),
      s = g.sim(ses),
      w = g.world(ses);
    g.decay(s, w);
    idle(s);
    String city = body.path("city").asText(),
      loc = body.path("loc").asText();
    GameService.require(city.equals(s.path("city").asText()), 403, "Use the airport to fly to another city");
    if (loc.equals("home")) GameService.require(
      s.path("home").path("city").asText().equals(city),
      403,
      "Your home is in another city"
    );
    else g.content.landmark(city, loc);
    JsonNode d = door(s, loc);
    GameService.require(d.isObject(), 404, "Choose a doorway");
    ObjectNode at = position(s);
    if (!at.path("room").isNull()) {
      JsonNode outside = s.remove("_outside");
      if (outside != null) s.set("position", outside);
      else {
        at.putNull("room");
        JsonNode origin = door(s, s.path("loc").asText());
        at.put("x", origin.path("x").asDouble()).put("z", origin.path("z").asDouble());
      }
      s.withObject("position").putNull("room");
      s.remove("_visitingHome");
      s.put("loc", s.path("position").path("place").asText());
      s.set("position", freeArrival(s, s.withObject("position").deepCopy()));
    }
    s.put("busyStartedAt", g.now())
      .put("busyUntil", g.now() + 2000)
      .put("busyLabel", "Heading to " + d.path("name").asText());
    s.putNull("activitySlot");
    s.put("_pendingTravel", loc);
    g.store.save();
    return g.simResponse(s, w);
  }

  void settleTravel(ObjectNode s) {
    JsonNode loc = s.remove("_pendingTravel");
    if (loc != null) {
      s.put("loc", loc.asText());
      s.remove("position");
      position(s);
    }
  }

  ObjectNode move(String token, JsonNode b) {
    ObjectNode ses = g.session(token, true),
      s = g.sim(ses),
      w = g.world(ses);
    g.decay(s, w);
    ObjectNode p = position(s);
    GameService.require(
      s.path("busyUntil").isNull() && s.path("pendingBeat").isNull(),
      409,
      "Finish this moment before walking"
    );
    GameService.require(b.path("city").asText().equals(s.path("city").asText()), 409, "You are in a different city");
    double x = b.path("x").asDouble(Double.NaN),
      z = b.path("z").asDouble(Double.NaN),
      face = b.path("face").asDouble(Double.NaN);
    GameService.require(
      Double.isFinite(x) && Double.isFinite(z) && Double.isFinite(face),
      400,
      "Send a finite position"
    );
    // The client walks a polyline: it reports the corners it turned since its last update, so each
    // straight piece is checked on its own and walking never stops at a corner to wait for the server.
    List<double[]> route = new ArrayList<>();
    route.add(new double[] { p.path("x").asDouble(), p.path("z").asDouble() });
    JsonNode via = b.path("via");
    if (via.isArray()) {
      GameService.require(via.size() <= 16, 400, "Send fewer route corners");
      for (JsonNode corner : via) {
        double cx = corner.path("x").asDouble(Double.NaN),
          cz = corner.path("z").asDouble(Double.NaN);
        GameService.require(Double.isFinite(cx) && Double.isFinite(cz), 400, "Send a finite position");
        route.add(new double[] { cx, cz });
      }
    }
    route.add(new double[] { x, z });
    String key = s.path("worldId").asText() + s.path("userId").asText();
    long at = g.now();
    // 7.5 m/s of credit, saved up to 12 m so one slow round trip never reads as speeding.
    double budget = Math.min(
        12,
        credits.getOrDefault(key, 2d) + Math.max(0, at - times.getOrDefault(key, at)) * .0075
      ),
      distance = 0;
    for (int i = 1; i < route.size(); i++) distance += Math.hypot(
      route.get(i)[0] - route.get(i - 1)[0],
      route.get(i)[1] - route.get(i - 1)[1]
    );
    times.put(key, at);
    credits.put(key, budget);
    GameService.require(distance <= budget + 1e-6, 409, "That is faster than running");
    for (int leg = 1; leg < route.size(); leg++) {
      double[] from = route.get(leg - 1),
        to = route.get(leg);
      int steps = Math.max(1, (int) Math.ceil(Math.hypot(to[0] - from[0], to[1] - from[1]) / .15));
      for (int i = 1; i <= steps; i++) {
        double t = (double) i / steps;
        GameService.require(
          stand(
            s.path("city").asText(),
            from[0] + (to[0] - from[0]) * t,
            from[1] + (to[1] - from[1]) * t,
            p.path("room").asText("")
          ),
          409,
          "The path is blocked"
        );
      }
    }
    credits.put(key, budget - distance);
    s.putNull("activitySlot");
    p.put("x", x).put("z", z).put("face", face);
    if (p.path("room").isNull()) {
      String near = "street";
      double best = 3;
      Iterator<String> ids = city(s.path("city").asText()).path("doors").fieldNames();
      while (ids.hasNext()) {
        String id = ids.next();
        JsonNode d = door(s, id);
        double d2 = Math.hypot(d.path("x").asDouble() - x, d.path("z").asDouble() - z);
        if (d2 < best) {
          best = d2;
          near = id;
        }
      }
      if (s.path("home").path("city").equals(s.path("city"))) {
        JsonNode d = door(s, "home");
        if (Math.hypot(d.path("x").asDouble() - x, d.path("z").asDouble() - z) < best) near = "home";
      }
      s.put("loc", near);
      p.put("place", near);
    }
    g.community.online.put(s.path("worldId").asText() + ":" + s.path("userId").asText(), at);
    ObjectNode out = g.object();
    out.set("position", p.deepCopy());
    out.put("now", at);
    return out;
  }
}
