package app.metrolife;

import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import java.security.SecureRandom;
import java.util.*;
import java.util.function.LongSupplier;
import org.springframework.stereotype.Service;

/** A single monitor is the transaction boundary for the small local simulation. */
@Service
public class GameService {

  final JsonStore store;
  final Content content;
  final ObjectMapper mapper;
  final Progression progression;
  final Stories stories;
  final Civic civic;
  final Property property;
  final Community community;
  final ResidentMotion residentMotion;
  LongSupplier time = System::currentTimeMillis;
  long visits;

  record NameHold(String owner, long until) {}

  final Map<String, NameHold> reservedNames = new HashMap<>();

  synchronized ObjectNode suggestName(String token) {
    String uid = session(token, true).path("userId").asText();
    String name = friendlyName();
    reservedNames.put(name.toLowerCase(Locale.ROOT), new NameHold(uid, now() + 600000));
    return object().put("name", name);
  }

  private final SecureRandom random = new SecureRandom();
  final FirstDay firstDay = new FirstDay(this);
  final Transit transit;
  final HomeDesign homeDesign;
  final Economy economy;
  final Relationships relationships;
  final SocialLife socialLife;
  final LandmarkLife landmarkLife;

  GameService(JsonStore store, Content content, ObjectMapper mapper) {
    this.store = store;
    this.visits = store.data.path("visits").asLong();
    this.content = content;
    this.mapper = mapper;
    this.progression = new Progression(content);
    this.stories = new Stories(this);
    this.civic = new Civic(this);
    this.economy = new Economy(this);
    this.relationships = new Relationships(this);
    this.property = new Property(this);
    this.community = new Community(this);
    navigation = new Navigation(this);
    residentMotion = new ResidentMotion(this);
    transit = new Transit(this);
    homeDesign = new HomeDesign(this);
    socialLife = new SocialLife(this);
    landmarkLife = new LandmarkLife(this);
    navigation.repairRoomPositions();
  }

  long now() {
    return time.getAsLong();
  }

  ObjectNode object() {
    return mapper.createObjectNode();
  }

  ObjectNode table(String name) {
    return (ObjectNode) store.data.get(name);
  }

  String id() {
    return UUID.randomUUID().toString();
  }

  static void require(boolean valid, int status, String message) {
    if (!valid) throw new ApiException(status, message);
  }

  ObjectNode session(String token, boolean required) {
    JsonNode s = token == null ? null : table("sessions").get(token);
    if (s != null && s.path("expiresAt").asLong() > now()) return (ObjectNode) s;
    if (required) throw new ApiException(401, "Your life could not be found. Reload to start again.");
    return null;
  }

  ObjectNode user(ObjectNode session) {
    return (ObjectNode) table("users").get(session.path("userId").asText());
  }

  ObjectNode publicUser(ObjectNode user) {
    ObjectNode copy = user.deepCopy();
    copy.remove(List.of("passwordHash", "lastWorld"));
    return copy;
  }

  ObjectNode world(ObjectNode session) {
    return (ObjectNode) table("worlds").get("public");
  }

  String simKey(ObjectNode session) {
    return session.path("userId").asText() + ":" + world(session).path("id").asText();
  }

  ObjectNode sim(ObjectNode session) {
    ObjectNode s = (ObjectNode) table("sims").get(simKey(session));
    require(s != null, 409, "Choose your city and make yourself at home first");
    return s;
  }

  ObjectNode look(JsonNode custom) {
    ObjectNode look = object()
      .put("body", "f")
      .put("skin", "#b47752")
      .put("hair", "short")
      .put("hairColor", "#302820")
      .put("top", "#326957")
      .put("bottom", "#313c4b")
      .put("style", "casual")
      .put("shoeColor", "#f4eddf");
    if (custom != null && custom.isObject()) {
      for (String field : new String[] { "skin", "hairColor", "top", "bottom", "shoeColor" })
        if (custom.path(field).asText().matches("#[0-9a-fA-F]{6}")) look.put(field, custom.path(field).asText());
      if (Set.of("f", "m").contains(custom.path("body").asText())) look.put("body", custom.path("body").asText());
      if (Set.of("short", "long", "curly", "bald").contains(custom.path("hair").asText())) look.put(
        "hair",
        custom.path("hair").asText()
      );
      if (Set.of("casual", "smart", "street", "work", "party").contains(custom.path("style").asText())) look.put(
        "style",
        custom.path("style").asText()
      );
    }
    return Personality.normalizeLook(look, custom);
  }

  private String username(String value) {
    String name = value.strip().replaceAll(" +", " ");
    require(
      name.length() >= 2 && name.length() <= 20 && name.matches("[\\p{L}][\\p{L} '\u002d]*[\\p{L}]"),
      400,
      "Use 2-20 letters, spaces, hyphens or apostrophes"
    );
    return name;
  }

  private void unique(String name, String except) {
    NameHold held = reservedNames.get(name.toLowerCase(Locale.ROOT));
    require(
      held == null || held.until() < now() || held.owner().equals(except),
      409,
      "That name is being chosen by another neighbour. Try another name."
    );
    for (JsonNode u : table("users"))
      require(
        u.path("id").asText().equals(except) || !u.path("username").asText().equalsIgnoreCase(name),
        409,
        "That name is already taken"
      );
    for (JsonNode rows : community.residents())
      for (JsonNode n : rows)
        require(
          !n.path("username").asText().equalsIgnoreCase(name),
          409,
          "That name belongs to a city resident. Choose another name."
        );
  }

  private String issueSession(String old, ObjectNode u, String selected) {
    if (old != null) table("sessions").remove(old);
    byte[] bytes = new byte[32];
    random.nextBytes(bytes);
    String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    table("sessions")
      .putObject(token)
      .put("userId", u.path("id").asText())
      .put("worldId", selected)
      .put("expiresAt", now() + 30L * 86400000);
    return token;
  }

  public record AuthResult(String token, ObjectNode user) {}

  /** New guest lives per address within GUEST_WINDOW_MS, and across all addresses. */
  static final int GUESTS_PER_ADDRESS = 12,
    GUESTS_TOTAL = 240;
  static final long GUEST_WINDOW_MS = 10 * 60000L;
  final Map<String, ArrayDeque<Long>> guestCreations = new HashMap<>();
  final ArrayDeque<Long> allGuestCreations = new ArrayDeque<>();

  /** Refuse a flood of new guest lives (each one is a saved user and session). */
  void limitGuests(String address) {
    long cutoff = now() - GUEST_WINDOW_MS;
    while (!allGuestCreations.isEmpty() && allGuestCreations.peekFirst() < cutoff) allGuestCreations.pollFirst();
    guestCreations.values().forEach(times -> {
      while (!times.isEmpty() && times.peekFirst() < cutoff) times.pollFirst();
    });
    guestCreations.values().removeIf(ArrayDeque::isEmpty);
    ArrayDeque<Long> mine = guestCreations.computeIfAbsent(address == null ? "" : address, k -> new ArrayDeque<>());
    require(
      mine.size() < GUESTS_PER_ADDRESS && allGuestCreations.size() < GUESTS_TOTAL,
      429,
      "Lots of new lives are starting right now. Please try again in a few minutes."
    );
    mine.addLast(now());
    allGuestCreations.addLast(now());
  }

  synchronized AuthResult guest(String token, JsonNode body) {
    return guest(token, body, null);
  }

  synchronized AuthResult guest(String token, JsonNode body, String address) {
    ObjectNode old = session(token, false);
    if (old != null) return new AuthResult(token, publicUser(user(old)));
    if (address != null) limitGuests(address);
    String name = body.path("username").asText("").trim();
    if (name.isEmpty()) name = friendlyName();
    if (body.path("username").asText().length() > 0) name = username(name);
    unique(name, "");
    String uid = id();
    ObjectNode u = table("users")
      .putObject(uid)
      .put("id", uid)
      .put("username", name)
      .put("guest", true)
      .put("createdAt", now());
    u.set("look", look(body.get("look")));
    String issued = issueSession(null, u, "public");
    store.save();
    return new AuthResult(issued, publicUser(u));
  }

  synchronized AuthResult newLife(String token, JsonNode body) {
    require(body.path("confirm").asBoolean(), 400, "Confirm that you want to start a new life");
    ObjectNode old = session(token, true);
    String uid = old.path("userId").asText();
    var sessionIds = new ArrayList<String>();
    table("sessions").fieldNames().forEachRemaining(sessionIds::add);
    for (String key : sessionIds)
      if (table("sessions").path(key).path("userId").asText().equals(uid)) table("sessions").remove(key);
    table("sims").remove(uid + ":public");
    table("users").remove(uid);
    community.online.remove("public:" + uid);
    for (JsonNode city : content.world.path("cities")) {
      ObjectNode p = property.state(world(null), city.path("id").asText());
      for (String kind : List.of("plots", "billboards")) {
        ArrayNode rows = p.withArray(kind);
        for (int i = rows.size() - 1; i >= 0; i--) if (rows.get(i).path("userId").asText().equals(uid)) rows.remove(i);
      }
      p.put("revision", p.path("revision").asInt() + 1);
      ObjectNode c = civic.state(world(null), city.path("id").asText());
      c.withObject("votes").remove(uid);
      ArrayNode candidates = c.withArray("candidates");
      for (int i = candidates.size() - 1; i >= 0; i--) if (
        candidates.get(i).path("id").asText().equals(uid)
      ) candidates.remove(i);
      c.withObject("campaignDays").remove(uid);
      if (c.path("mayor").path("id").asText().equals(uid)) {
        c.putNull("mayor");
        civic.recordPolicy(world(null), city.path("id").asText(), "", now());
      }
      var voters = new ArrayList<String>();
      c.withObject("votes")
        .fields()
        .forEachRemaining(e -> {
          if (e.getValue().asText().equals(uid)) voters.add(e.getKey());
        });
      voters.forEach(c.withObject("votes")::remove);
    }
    return guest(null, object());
  }

  synchronized ObjectNode finishIntro(String token) {
    ObjectNode ses = session(token, true),
      s = sim(ses);
    if (!s.path("introDone").asBoolean()) {
      s.put("introDone", true);
      navigation.position(s);
      JsonNode at = navigation.position(s);
      if (at.path("room").isNull() && at.path("place").asText().equals("home")) navigation.door(
        token,
        object().put("loc", "home").put("enter", true)
      );
      store.save();
    }
    return simResponse(s, world(ses));
  }

  synchronized ObjectNode finishFirstDay(String token) {
    ObjectNode ses = session(token, true),
      s = sim(ses);
    require(s.path("firstDay").path("complete").asBoolean(), 409, "Your first day is still taking shape");
    if (!s.path("firstDay").path("closingSeen").asBoolean()) {
      s.withObject("firstDay").put("closingSeen", true);
      store.save();
    }
    return simResponse(s, world(ses));
  }

  synchronized ObjectNode payFirstRent(String token) {
    ObjectNode ses = session(token, true),
      s = sim(ses),
      w = world(ses);
    decay(s, w);
    require(
      s.path("firstDay").isObject() && !s.path("firstDay").path("rent").asBoolean(),
      409,
      "Your first rent is already paid"
    );
    require(s.path("position").path("room").asText().startsWith("home:"), 409, "Pay your rent from home");
    require(s.path("busyUntil").isNull() && s.path("pendingBeat").isNull(), 409, "Finish this moment first");
    int rent = s.path("home").path("rent").asInt();
    require(s.path("cash").asDouble() >= rent, 402, "You need $" + rent + " for rent");
    property.pay(s, rent, "First home rent");
    int day = clock(w).path("day").asInt();
    s.withObject("home").put("rentPaidThrough", Math.max(day, s.path("home").path("rentPaidThrough").asInt(day)) + 1);
    firstDay.mark(s, "rent");
    store.save();
    return simResponse(s, w);
  }

  synchronized ObjectNode outfit(String token, JsonNode body) {
    ObjectNode ses = session(token, true),
      s = sim(ses),
      u = user(ses);
    decay(s, world(ses));
    require(
      s.path("busyUntil").isNull() && s.path("pendingBeat").isNull(),
      409,
      "Finish this moment before changing clothes"
    );
    String style = body.path("style").asText();
    require(Set.of("casual", "street", "smart", "work", "party").contains(style), 400, "Choose a listed outfit");
    boolean owned = Set.of("casual", "street").contains(style) || s.path("outfits").has(style);
    if (style.equals("work")) {
      require(s.path("job").isObject(), 409, "A job unlocks your work outfit");
      owned = true;
    }
    if (!owned) {
      int cost = style.equals("party") ? 90 : 120;
      require(s.path("cash").asDouble() >= cost, 402, "Save $" + cost + " for this outfit");
      property.confirm(body, cost);
      property.pay(s, cost, "Outfit: " + style);
      s.withObject("outfits").put(style, true);
    }
    s.withObject("look").put("style", style);
    s.withObject("look").withObject("outfits").withObject("everyday").put("style", style);
    u.set("look", s.path("look").deepCopy());
    store.save();
    return simResponse(s, world(ses));
  }

  double minuteMillis(ObjectNode w) {
    return w.path("minuteMs").asDouble(1000);
  }

  long absoluteMinutes(ObjectNode w) {
    long anchor = w.path("clockAnchorAt").asLong(w.path("startedAt").asLong());
    long minutes = w.path("clockAnchorMinutes").asLong(540);
    return (
      Math.max(0, (long) Math.floor((now() - anchor) / minuteMillis(w))) + minutes + w.path("transitMinutes").asLong()
    );
  }

  long gameInstant(ObjectNode w, long minute) {
    return (
      w.path("clockAnchorAt").asLong(w.path("startedAt").asLong()) +
      (long) ((minute - w.path("clockAnchorMinutes").asLong(540) - w.path("transitMinutes").asLong()) * minuteMillis(w))
    );
  }

  ObjectNode clock(ObjectNode world) {
    long minutes = absoluteMinutes(world);
    int day = (int) (minutes / 1440) + 1;
    return object()
      .put("day", day)
      .put("hour", (minutes % 1440) / 60)
      .put("minute", minutes % 60)
      .put(
        "weekday",
        new String[] { "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday" }[(day - 1) % 7]
      )
      .put("msPerMinute", world.path("minuteMs").asDouble(1000))
      .put("at", now());
  }

  ObjectNode scheduleClock(ObjectNode s, ObjectNode w) {
    ObjectNode clock = clock(w);
    long minutes = absoluteMinutes(w) + s.path("scheduleMinutes").asLong();
    clock
      .put("day", minutes / 1440 + 1)
      .put("hour", (minutes % 1440) / 60)
      .put("minute", minutes % 60);
    return clock;
  }

  ObjectNode worldInfo(ObjectNode w) {
    ObjectNode result = w.deepCopy();
    result.remove(List.of("members", "startedAt", "transitMinutes"));
    int count = 0;
    for (JsonNode s : table("sims")) if (s.path("worldId").equals(w.get("id"))) count++;
    return result
      .put("players", count + community.residents().path(w.path("id").asText()).size())
      .put("online", community.onlineCount(w.path("id").asText()));
  }

  synchronized ObjectNode me(String token) {
    ObjectNode session = session(token, false),
      w = world(session),
      out = object().put("now", now());
    out.set("clock", clock(w));
    if (session == null) {
      out.putNull("user").putNull("world").putNull("sim");
      return out;
    }
    out.set("user", publicUser(user(session)));
    out.set("world", worldInfo(w));
    ObjectNode s = (ObjectNode) table("sims").get(simKey(session));
    if (s != null) {
      navigation.resumePosture(s);
      decay(s, w);
      out.set("sim", publicSim(s));
      out.set("clock", clock(w));
    } else out.putNull("sim");
    return out;
  }

  Navigation navigation;

  ObjectNode publicSim(ObjectNode s) {
    Personality.normalize(s);
    if (!s.path("needs").has("hygiene")) s.withObject("needs").put("hygiene", 85);
    homeDesign.ensure(s);
    navigation.position(s);
    ObjectNode copy = s.deepCopy();
    copy.put("createdAt", createdAt(s));
    copy.set("traitMoodlets", Personality.moodlets(s));
    copy.set("wants", Personality.wants(s));
    copy.remove("_wantBaseline");
    copy.set("economy", economy.read(s, (ObjectNode) table("worlds").get(s.path("worldId").asText())));
    copy.set("relationships", relationships.read(s));
    copy.set("personalSchedule", scheduleClock(s, (ObjectNode) table("worlds").get(s.path("worldId").asText())));
    copy.set(
      "shiftSchedule",
      CareerRhythm.snapshot(this, s, (ObjectNode) table("worlds").get(s.path("worldId").asText()))
    );
    copy.remove(List.of("ledger", "_ledgerBalance", "_moneyReason"));
    copy.set("trip", transit.trip(s));
    ObjectNode host = s.has("_visitingHome") ? homeDesign.owner("home:" + s.path("_visitingHome").asText()) : null;
    if (host == null) host = s;
    copy.set("homeDesign", homeDesign.ensure(host).deepCopy());
    copy.set("homeLayout", homeDesign.layout(host, homeDesign.ensure(host)));
    if (copy.path("aspiration").isObject()) copy.withObject("aspiration").set("milestones", progression.milestones(s));
    copy.set("stories", stories.journal(s));
    copy.set("storyLead", stories.lead(s));
    if (s.path("firstDay").isObject()) {
      firstDay.refresh(s);
      ((ObjectNode) copy.path("firstDay")).put("complete", s.path("firstDay").path("complete").asBoolean()).put(
        "remaining",
        firstDay.remaining(s)
      );
    }
    copy.remove(
      List.of(
        "updatedAt",
        "lastDay",
        "actionsCount",
        "_pendingAction",
        "_metrics",
        "_stories",
        "_claims",
        "_readyClaims",
        "_storyDeparted",
        "_externalMetrics",
        "_externalProgress",
        "_lastChat",
        "_lastSocial",
        "_socialText",
        "_socialAt",
        "_socialFrom",
        "dailyVisited",
        "_outside",
        "_pendingTravel",
        "_transitNap",
        "_lastTripChat",
        "_transitMinutes",
        "_inviteCode",
        "_lastEmote",
        "_houseLikesGiven",
        "_visitingHome",
        "_venueAttempt",
        "_venueCooldown",
        "_lastVenueGame",
        "_lastShotPrize",
        "_workRhythm",
        "_giftsByFriend"
      )
    );
    for (String need : Content.NEEDS)
      copy.withObject("needs").put(need, Math.round(s.path("needs").path(need).asDouble(85) * 10) / 10.0);
    copy.put("socialReadyAt", s.path("_lastSocial").asLong(0) + Community.SOCIAL_COOLDOWN_MS);
    DisplayNames.apply(copy);
    return copy;
  }

  String friendlyName() {
    String[] first =
      "Avery Riley Jordan Casey Morgan Taylor Alex Jamie Quinn Rowan Sage Skyler Reese Parker Cameron Blair Adrian Ashley Aubrey Bailey Briar Brooklyn Charlie Dakota Drew Emerson Emery Evan Frankie Harper Hayden Jesse Jules Kai Kendall Kennedy Lee Logan Marley Micah Peyton Phoenix Remy Robin Rory Ryan Sam Shay Sidney Spencer Stevie Tatum Toby Tristan Wren Whitney Cody Dylan Ellery Finley Grey Hollis Indigo Justice Keegan Lennox".split(
        " "
      );
    String[] last =
      "Brooks Vale Reed Lane Park Ellis Hayes Quill Blake Bell Stone Wells Banks Hill West Hart Adler Bailey Baker Barrett Benson Bishop Bowen Brady Burke Campbell Chandler Collins Conway Cook Crosby Dean Dixon Donovan Drake Everett Farley Fleming Flynn Fox Gardner Gibson Graham Griffin Hardy Harris Hartley Henderson Hunt Irwin James Keller Knight Lewis Mitchell Monroe Nash Palmer Pierce Price Reid Rivers Russell Shaw Tate Walker Winters Young".split(
        " "
      );
    reservedNames.entrySet().removeIf(e -> e.getValue().until() < now());
    Set<String> used = new HashSet<>(reservedNames.keySet());
    for (JsonNode u : table("users")) used.add(u.path("username").asText().toLowerCase(Locale.ROOT));
    for (JsonNode rows : community.residents())
      for (JsonNode n : rows) used.add(n.path("username").asText().toLowerCase(Locale.ROOT));
    int count = first.length * last.length,
      start = random.nextInt(count);
    for (int middle = 0; middle <= 26; middle++) for (int i = 0; i < count; i++) {
      int k = (start + i) % count;
      String name =
        first[k / last.length] + " " + (middle == 0 ? "" : (char) ('A' + middle - 1) + " ") + last[k % last.length];
      if (!used.contains(name.toLowerCase(Locale.ROOT))) return name;
    }
    throw new ApiException(409, "Choose a name to start your life.");
  }

  synchronized ObjectNode setup(String token, JsonNode body) {
    ObjectNode session = session(token, true),
      u = user(session);
    String city = body.path("city").asText(),
      nh = body.path("neighborhood").asText(),
      aid = body.path("aspiration").asText();
    content.city(city);
    content.neighborhood(city, nh);
    ObjectNode aspiration = content.aspiration(aid);
    ObjectNode existing = (ObjectNode) table("sims").get(simKey(session));
    // Onboarding is one-time. Repeating it must never mint money or teleport a resident.
    if (existing != null) throw new ApiException(
      409,
      "Your life is already set up. Use your home or aspiration panel to make changes"
    );
    socialLife.pace(world(session));
    String name = username(body.path("username").asText());
    unique(name, u.path("id").asText());
    String pronouns = body.path("pronouns").asText("they");
    require(Set.of("she", "he", "they").contains(pronouns), 400, "Choose she, he or they");
    ObjectNode chosenLook = look(body.has("look") ? body.get("look") : u.get("look"));
    require(
      Set.of("casual", "street").contains(chosenLook.path("style").asText()),
      400,
      "Start with casual or street clothes"
    );
    reservedNames.remove(name.toLowerCase(Locale.ROOT));
    u.put("username", name).put("pronouns", pronouns);
    u.set("look", chosenLook);
    ObjectNode s = table("sims")
      .putObject(simKey(session))
      .put("userId", u.path("id").asText())
      .put("worldId", world(session).path("id").asText())
      .put("username", u.path("username").asText())
      .put("city", city)
      .put("loc", "home")
      .put("cash", 150)
      .put("xp", 0)
      .put("level", 1)
      .put("xpNext", 100)
      .put("mood", "great")
      .put("setupDone", true)
      .put("createdAt", now())
      .put("updatedAt", now())
      .put("lastDay", clock(world(session)).path("day").asInt())
      .put("actionsCount", 0);
    s.put("pronouns", pronouns);
    s.set("look", u.get("look").deepCopy());
    s.putObject("home")
      .put("city", city)
      .put("neighborhood", nh)
      .put("rent", content.neighborhood(city, nh).path("rent").asInt())
      .put("kind", "studio");
    ObjectNode needs = s.putObject("needs");
    for (String need : Content.NEEDS) needs.put(need, 85);
    ObjectNode skills = s.putObject("skills");
    for (String skill : Content.SKILLS) skills.putObject(skill).put("level", 0).put("xp", 0).put("next", 100);
    s.putNull("job").putNull("busyUntil").putNull("busyLabel").putNull("pendingBeat");
    s.putArray("visited").add("home");
    ObjectNode a = s
      .putObject("aspiration")
      .put("id", aid)
      .put("label", aspiration.path("label").asText())
      .put("step", 0)
      .put("total", aspiration.path("milestones").size());
    a.set("current", aspiration.path("milestones").get(0).deepCopy());
    Personality.setup(s, body.get("traits"));
    resetDaily(s);
    firstDay.init(s, world(session));
    // A new life settles in rent-free for its first two game days (about fourteen real minutes).
    s.withObject("home").put("rentPaidThrough", clock(world(session)).path("day").asInt() + 2);
    store.save();
    return simResponse(s, world(session));
  }

  void resetDaily(ObjectNode s) {
    s.putArray("dailyVisited");
    s.putObject("moneyToday").put("income", 0).put("spent", 0);
    ArrayNode goals = s.putArray("daily");
    String[] ids = { "explore", "work", "cook" },
      texts = { "Visit three places", "Earn money from an activity", "Cook a meal at home" },
      icons = { "map-pin", "briefcase", "cooking-pot" };
    for (int i = 0; i < 3; i++) {
      ObjectNode g = goals
        .addObject()
        .put("id", ids[i])
        .put("text", texts[i])
        .put("icon", icons[i])
        .put("progress", 0)
        .put("target", i == 0 ? 3 : 1)
        .put("done", false);
      g.putObject("reward").put("cash", 5).put("xp", 25);
    }
    Personality.resetWants(s);
  }

  ObjectNode simResponse(ObjectNode s, ObjectNode w) {
    ObjectNode out = object();
    out.set("sim", publicSim(s));
    out.set("clock", clock(w));
    return out;
  }

  synchronized ObjectNode travel(String token, JsonNode body) {
    ObjectNode out = navigation.travel(token, body),
      s = sim(session(token, true));
    if (firstDay.outside(s)) {
      store.save();
      return simResponse(s, world(session(token, true)));
    }
    return out;
  }

  synchronized ObjectNode door(String token, JsonNode body) {
    navigation.door(token, body);
    ObjectNode ses = session(token, true),
      s = sim(ses);
    if (body.path("enter").asBoolean()) recordArrival(s);
    firstDay.outside(s);
    store.save();
    return simResponse(s, world(ses));
  }

  synchronized ObjectNode posture(String token, JsonNode body) {
    return navigation.posture(token, body);
  }

  /** Settle due work first; unfinished promises have never charged or rewarded the live sim. */
  synchronized ObjectNode cancelAction(String token) {
    ObjectNode ses = session(token, true),
      s = sim(ses),
      w = world(ses);
    decay(s, w);
    require(!transit.active(s), 409, "This departure is booked. You will arrive at the destination hub.");
    s.remove(List.of("_pendingAction", "_pendingTravel", "workGame"));
    s.putNull("busyUntil").putNull("busyStartedAt").putNull("busyLabel").putNull("busyKind").putNull("activitySlot");
    store.save();
    return simResponse(s, w);
  }

  synchronized ObjectNode movePosition(String token, JsonNode body) {
    ObjectNode out = navigation.move(token, body),
      s = sim(session(token, true));
    boolean changed = firstDay.outside(s);
    if (s.path("position").path("room").isNull()) changed = recordArrival(s) || changed;
    if (changed) store.save();
    return out;
  }

  synchronized ObjectNode getSim(String token) {
    ObjectNode session = session(token, true),
      s = sim(session),
      w = world(session);
    navigation.resumePosture(s);
    decay(s, w);
    return simResponse(s, w);
  }

  void decay(ObjectNode s, ObjectNode w) {
    transit.tick(w);
    civic.tick(w);
    property.syncPlots(s, w);
    int day = clock(w).path("day").asInt(),
      elapsed = Math.max(0, day - s.path("lastDay").asInt());
    if (elapsed > 0) {
      resetDaily(s);
      property.rent(s, w, elapsed);
      s.put("lastDay", day);
    }
    double hours = Math.min(
      6 + s.path("_transitMinutes").asDouble() / 60,
      Math.max(0, now() - s.path("updatedAt").asLong()) / (minuteMillis(w) * 60)
    );
    if (s.has("_pendingAction") && s.path("busyUntil").asLong() > 0 && s.path("busyUntil").asLong() <= now()) {
      double before = Math.min(
        hours,
        Math.max(0, s.path("busyUntil").asLong() - s.path("updatedAt").asLong()) / (minuteMillis(w) * 60)
      );
      decayNeeds(s, before);
      settleAction(s);
      decayNeeds(s, hours - before);
    } else decayNeeds(s, hours);
    JsonNode nap = s.remove("_transitNap");
    if (nap != null) s.withObject("needs").put(
      "energy",
      Math.min(100, s.path("needs").path("energy").asDouble() + nap.asInt())
    );
    if (s.has("_pendingTravel") && s.path("busyUntil").asLong() <= now()) {
      navigation.settleTravel(s);
      firstDay.outside(s);
      recordArrival(s);
    }
    if (socialLife != null) {
      ObjectNode event = socialLife.state(w, s.path("city").asText());
      if (socialLife.active(event)) socialLife.claim(s, event);
    }
    s.put("updatedAt", now());
    if (!s.path("busyUntil").isNull() && s.path("busyUntil").asLong() <= now()) s.putNull("busyUntil")
      .putNull("busyLabel")
      .putNull("busyStartedAt")
      .putNull("busyKind")
      .putNull("activitySlot");
    if (s.path("_externalProgress").asBoolean() && !s.has("_pendingAction")) finishProgress(s);
    property.rent(s, w, 0);
    s.remove("_transitMinutes");
    updateMood(s);
  }

  void finishProgress(ObjectNode s) {
    s.remove("_externalProgress");
    double before = s.path("cash").asDouble();
    progression.evaluate(s, mapper.createArrayNode());
    double gain = s.path("cash").asDouble() - before;
    if (gain > 0) {
      ObjectNode ledger = s.withObject("moneyToday");
      ledger.put("income", ledger.path("income").asDouble() + gain);
    }
    updateLevel(s);
  }

  /** Only real public-landmark arrivals count; home and street are not exploration. */
  boolean trackVisit(ObjectNode s, String city, String loc, ArrayNode completed) {
    boolean landmark = false;
    for (JsonNode place : content.city(city).path("landmarks"))
      if (place.path("id").asText().equals(loc)) landmark = true;
    if (!landmark) return false;
    boolean first = true;
    for (JsonNode place : s.path("visited")) if (place.asText().equals(loc)) first = false;
    if (first) s.withArray("visited").add(loc);
    String key = city + ":" + loc;
    boolean today = true;
    for (JsonNode place : s.path("dailyVisited")) if (place.asText().equals(key)) today = false;
    if (today) {
      s.withArray("dailyVisited").add(key);
      advanceDaily(s, "explore", completed);
    }
    return first || today;
  }

  void advanceDaily(ObjectNode s, String id, ArrayNode completed) {
    for (JsonNode node : s.path("daily")) {
      ObjectNode goal = (ObjectNode) node;
      if (!goal.path("id").asText().equals(id) || goal.path("done").asBoolean()) continue;
      int progress = Math.min(goal.path("target").asInt(), goal.path("progress").asInt() + 1);
      goal.put("progress", progress);
      if (progress >= goal.path("target").asInt()) {
        goal.put("done", true);
        s.put("cash", s.path("cash").asDouble() + goal.path("reward").path("cash").asDouble()).put(
          "xp",
          s.path("xp").asInt() + goal.path("reward").path("xp").asInt()
        );
        completed.add(goal.path("text").asText());
      }
    }
  }

  boolean recordArrival(ObjectNode s) {
    double before = s.path("cash").asDouble();
    ArrayNode completed = mapper.createArrayNode();
    if (!trackVisit(s, s.path("city").asText(), s.path("loc").asText(), completed)) return false;
    progression.evaluate(s, completed);
    double gain = s.path("cash").asDouble() - before;
    if (gain > 0) {
      ObjectNode money = s.withObject("moneyToday");
      money.put("income", money.path("income").asDouble() + gain);
    }
    updateLevel(s);
    return true;
  }

  void decayNeeds(ObjectNode s, double hours) {
    economy.decayNeeds(s, hours);
  }

  void settleAction(ObjectNode s) {
    String originCity = s.path("city").asText();
    JsonNode pending = s.remove("_pendingAction"),
      future = pending.path("state"),
      deltas = pending.path("deltas");
    economy.capture(s);
    double expense = pending.path("cost").asDouble(),
      wage = pending
        .path("activity")
        .path("pay")
        .asDouble(Math.max(0, deltas.path("cash").asDouble() + expense)),
      reward = deltas.path("cash").asDouble() + expense - wage;
    String label = pending.path("activity").path("label").asText("Activity");
    s.put("cash", s.path("cash").asDouble() - expense);
    economy.record(s, -expense, label + " purchase");
    s.put("cash", s.path("cash").asDouble() + wage);
    economy.record(s, wage, "Wage: " + label);
    s.put("cash", s.path("cash").asDouble() + reward);
    economy.record(s, reward, "Daily goal and milestone rewards");
    s.put("xp", s.path("xp").asInt() + deltas.path("xp").asInt());
    double cost = pending.path("cost").asDouble();
    ObjectNode money = s.withObject("moneyToday");
    money
      .put("spent", money.path("spent").asDouble() + cost)
      .put("income", money.path("income").asDouble() + deltas.path("cash").asDouble() + cost);
    for (String field : List.of(
      "city",
      "loc",
      "skills",
      "job",
      "visited",
      "actionsCount",
      "pendingBeat",
      "aspiration",
      "_metrics",
      "_stories",
      "_claims",
      "_readyClaims",
      "_storyDeparted"
    ))
      if (future.has(field)) s.set(field, future.path(field).deepCopy());
    if (future.path("lastDay").asInt() == s.path("lastDay").asInt()) {
      s.set("daily", future.path("daily").deepCopy());
      if (future.has("dailyVisited")) s.set("dailyVisited", future.path("dailyVisited").deepCopy());
    }
    deltas
      .path("needs")
      .fields()
      .forEachRemaining(e ->
        s
          .withObject("needs")
          .put(e.getKey(), Math.clamp(s.path("needs").path(e.getKey()).asDouble() + e.getValue().asDouble(), 0, 100))
      );
    if (pending.has("campaignCity")) {
      ObjectNode w = (ObjectNode) table("worlds").get(s.path("worldId").asText());
      civic.campaign(
        w,
        s,
        pending.path("campaignCity").asText(),
        pending.path("campaignTerm").asInt(),
        pending.path("campaignDay").asInt(s.path("lastDay").asInt())
      );
    }
    CareerRhythm.settled(this, s, (ObjectNode) table("worlds").get(s.path("worldId").asText()), pending);
    if (pending.path("activity").path("id").asText().equals("sleep")) s.withObject("needs").put("energy", 100);
    s.remove("workGame");
    if (pending.path("shift").asBoolean()) firstDay.mark(s, "shift");
    if (pending.path("meal").asBoolean()) firstDay.mark(s, "meal");
    if (!s.path("city").asText().equals(originCity)) recordArrival(s);
    updateLevel(s);
  }

  void updateMood(ObjectNode s) {
    double min = 100,
      sum = 0;
    for (String n : Content.NEEDS) {
      double v = s.path("needs").path(n).asDouble(85);
      min = Math.min(min, v);
      sum += v;
    }
    double average = sum / Content.NEEDS.length;
    s.put("mood", min <= 5 ? "rough" : min < 20 ? "low" : average < 45 ? "okay" : average < 75 ? "good" : "great");
  }

  void requirements(ObjectNode s, JsonNode requires) {
    require(s.path("cash").asDouble() >= requires.path("cash").asDouble(), 402, "You need more cash for this");
    require(s.path("level").asInt() >= requires.path("level").asInt(), 403, "Build your level before trying this");
    requires
      .path("skills")
      .fields()
      .forEachRemaining(e ->
        require(
          s.path("skills").path(e.getKey()).path("level").asInt() >= e.getValue().asInt(),
          403,
          "You need " + Content.title(e.getKey()) + " " + e.getValue().asInt()
        )
      );
    if (requires.has("job")) require(
      s.path("job").path("track").asText().equals(requires.path("job").asText()),
      403,
      "Apply for this job before working a shift"
    );
  }

  synchronized ObjectNode jobs(String token, String city) {
    content.city(city);
    ObjectNode out = object();
    ArrayNode jobs = out.putArray("jobs");
    for (JsonNode career : content.world.path("careers"))
      for (JsonNode level : career.path("levels")) {
        String track = career.path("track").asText();
        ObjectNode job = ((ObjectNode) level).deepCopy();
        job
          .put("payPerHour", Content.cityPay(city, level.path("payPerHour").asInt()))
          .put("id", (city.equals("atl") ? "" : city + "-") + track + "-" + level.path("level").asInt())
          .put("track", track)
          .put("city", city)
          .put("loc", Content.workplace(city, track));
        job.remove("shiftsToPromote");
        jobs.add(job);
      }
    return out;
  }

  synchronized ObjectNode applyJob(String token, JsonNode body) {
    ObjectNode session = session(token, true),
      s = sim(session);
    decay(s, world(session));
    require(
      s.path("busyUntil").isNull() && s.path("pendingBeat").isNull(),
      409,
      "Finish your activity or story before applying"
    );
    String jobId = body.path("jobId").asText();
    ObjectNode chosen = null;
    JsonNode careerChosen = null;
    for (JsonNode candidate : jobs(token, s.path("city").asText()).path("jobs"))
      if (candidate.path("id").asText().equals(jobId)) {
        chosen = ((ObjectNode) candidate).deepCopy();
        careerChosen = candidate;
        chosen.put("shiftsToPromote", 3 + candidate.path("level").asInt());
      }
    require(chosen != null, 404, "That job is no longer listed");
    require(s.path("city").equals(chosen.get("city")), 403, "Travel to this city before applying");
    require(chosen.path("level").asInt() == 1, 403, "Apply for an entry role and earn promotions through shifts");
    require(s.path("loc").equals(chosen.path("loc")), 409, "Visit the workplace before applying");
    require(
      civic.open(
        world(session),
        s.path("city").asText(),
        content.landmark(s.path("city").asText(), chosen.path("loc").asText()),
        clock(world(session)).path("hour").asInt()
      ),
      409,
      "Apply while the workplace is open"
    );
    requirements(s, chosen.path("requires"));
    navigation.atStation(s, chosen.path("loc").asText(), "desk");
    require(chosen.path("level").asInt() == 1, 403, "Apply for an entry role and earn promotions through shifts");
    require(s.path("job").isNull(), 409, "Leave your current role before accepting another");
    chosen.put("id", jobId).put("track", careerChosen.path("track").asText()).put("shifts", 0);
    s.set("job", chosen);
    s.withObject("outfits").put("work", true);
    firstDay.mark(s, "job");
    store.save();
    ObjectNode out = object().put("hired", true);
    out.set("sim", publicSim(s));
    return out;
  }

  synchronized ObjectNode quitJob(String token) {
    ObjectNode session = session(token, true),
      s = sim(session);
    decay(s, world(session));
    require(s.path("busyUntil").isNull(), 409, "Finish your shift before leaving your role");
    s.putNull("job");
    store.save();
    ObjectNode out = object();
    out.set("sim", publicSim(s));
    return out;
  }

  synchronized ObjectNode act(String token, JsonNode body) {
    ObjectNode session = session(token, true),
      live = sim(session),
      w = world(session);
    decay(live, w);
    ObjectNode s = live.deepCopy();
    String city = body.path("city").asText(),
      loc = body.path("loc").asText(),
      action = body.path("action").asText();
    content.city(city);
    String slotId = body.path("slotId").asText("");
    require(
      !body.hasNonNull("slotId") || (body.path("slotId").isTextual() && !slotId.isBlank()),
      400,
      "Choose a valid furniture slot"
    );
    require(s.path("city").asText().equals(city), 403, "Fly to this city before doing an activity here");
    require(s.path("busyUntil").isNull(), 409, "Finish your current activity first");
    require(s.path("pendingBeat").isNull(), 409, "Choose what happens in your story first");
    JsonNode actions;
    if (loc.equals("home")) {
      require(
        s.path("home").path("city").asText().equals(city) || s.has("_visitingHome"),
        403,
        "Your home is in another city"
      );
      actions = content.city(city).path("homeActions");
    } else {
      ObjectNode landmark = content.landmark(city, loc);
      require(civic.openFor(w, city, landmark, live), 409, civic.closedMessage(landmark));
      actions = landmark.path("actions");
    }
    ObjectNode a = null;
    for (JsonNode option : actions) if (option.path("id").asText().equals(action)) a = (ObjectNode) option;
    require(a != null, 400, "Choose an activity offered at this place");
    if (a.has("to")) {
      ObjectNode booked = transit.book(
        token,
        object().put("to", a.path("to").asText()).put("mode", "plane").put("confirm", body.path("confirm").asBoolean())
      );
      ObjectNode result = object()
        .put("text", "Your shared flight is booked. Boarding now.")
        .put("busyUntil", booked.path("sim").path("busyUntil").asLong())
        .put("leveledUp", false)
        .putNull("promoted")
        .putNull("beat");
      ObjectNode delta = result
        .putObject("deltas")
        .put("cash", -booked.path("sim").path("trip").path("fare").asInt())
        .put("xp", 0);
      delta.putObject("needs");
      delta.putObject("skills");
      result.putArray("goalsCompleted");
      booked.set("result", result);
      return booked;
    }
    requirements(s, a.path("requires"));
    if (a.path("requires").has("job")) require(
      s.path("job").path("city").asText().equals(city) && s.path("job").path("loc").asText().equals(loc),
      403,
      "Work at your own workplace"
    );
    double cashBefore = s.path("cash").asDouble();
    int xpBefore = s.path("xp").asInt();
    if (a.path("requires").has("job")) {
      a = a.deepCopy();
      a.put("pay", s.path("job").path("payPerHour").asInt());
      s.withObject("job").put("shifts", s.path("job").path("shifts").asInt() + 1);
    }
    a = civic.action(w, city, loc.equals("home") ? object() : content.landmark(city, loc), a);
    CareerRhythm.validate(this, s, w, a);
    property.confirm(body, a.path("cost").asDouble());
    require(
      s.path("cash").asDouble() >= a.path("cost").asDouble(),
      402,
      "You do not have enough cash for this activity"
    );
    if (slotId.isEmpty()) navigation.requireAction(live, loc, action);
    else navigation.requireSlotAction(live, loc, a, slotId);
    s.set("position", live.path("position").deepCopy());
    boolean campaign = a.path("label").asText().equals("Campaign");
    if (campaign) civic.campaignCheck(w, s, city);
    boolean low = Set.of("rough", "low").contains(s.path("mood").asText());
    double cashDelta = Math.floor(a.path("pay").asDouble() * (low ? .7 : 1)) - a.path("cost").asDouble();
    s.put("cash", s.path("cash").asDouble() + cashDelta);
    int xp = a.path("xp").asInt();
    s.put("xp", s.path("xp").asInt() + xp);
    int oldLevel = s.path("level").asInt();
    updateLevel(s);
    ObjectNode recoveryActor = live.deepCopy();
    if (loc.equals("home")) navigation.stage(recoveryActor, loc, a, slotId);
    ObjectNode homeBonus = loc.equals("home") ? homeDesign.recoveryBonus(recoveryActor, action) : object();
    ObjectNode needDeltas = object(),
      skillDeltas = object();
    for (String need : Content.NEEDS) {
      ObjectNode needs = s.withObject("needs");
      double before = needs.path(need).asDouble(),
        after = Math.clamp(
          before +
            Personality.needDelta(s, a, loc, need, a.path("needs").path(need).asDouble()) +
            homeBonus.path(need).asDouble(),
          0,
          100
        );
      needs.put(need, after);
      needDeltas.put(need, after - before);
    }
    a.path("skills")
      .fields()
      .forEachRemaining(e -> {
        ObjectNode skill = (ObjectNode) s.path("skills").get(e.getKey());
        int gain = (int) Math.floor(e.getValue().asInt() * (low ? .7 : 1) * Personality.skillMultiplier(s, e.getKey()));
        addSkill(skill, gain);
        skillDeltas.put(e.getKey(), gain);
      });
    ArrayNode completed = mapper.createArrayNode();
    trackVisit(s, city, loc, completed);
    s.put("loc", loc).put("actionsCount", s.path("actionsCount").asInt() + 1);
    if (a.has("to")) {
      String to = a.path("to").asText();
      content.city(to);
      s.put("city", to).put("loc", to.equals("atl") ? "atlAirport" : to.equals("nyc") ? "nycAirport" : "bayAirport");
    }
    long rhythm = CareerRhythm.duration(this, s, w, a),
      rest = RestRhythm.duration(this, live, w, a);
    long busyUntil =
      now() +
      (rhythm > 0
        ? rhythm
        : rest > 0
          ? rest
          : navigation.type(city, loc).isEmpty()
            ? Math.clamp(a.path("durationMin").asLong() * 60, 2000, 6000)
            : 6000);
    s.put("busyUntil", busyUntil).put("busyLabel", a.path("label").asText());
    if (a.path("pay").asInt() > 0) advanceDaily(s, "work", completed);
    if (loc.equals("home") && action.equals("cook")) advanceDaily(s, "cook", completed);
    int dailyCash = 0;
    for (JsonNode goal : s.path("daily"))
      for (JsonNode done : completed)
        if (done.asText().equals(goal.path("text").asText())) dailyCash += goal.path("reward").path("cash").asInt();
    int dailyCount = completed.size();
    String promoted = progression.activity(s, a, loc);
    stories.depart(s, city, loc);
    // Stories open on the first ordinary activity at a story landmark; no checklist gate.
    if (!a.path("requires").has("job") && !action.equals("visit-workplace")) stories.trigger(s, city, loc);
    progression.evaluate(s, completed);
    updateMood(s);
    updateLevel(s);
    ObjectNode out = object(),
      result = object()
        .put("text", outcomeText(a, loc, action, cashDelta, needDeltas, skillDeltas, dailyCount))
        .put("busyUntil", busyUntil)
        .put("leveledUp", s.path("level").asInt() > oldLevel)
        .putNull("promoted")
        .putNull("beat");
    if (completed.size() > dailyCount) {
      StringBuilder text = new StringBuilder(result.path("text").asText());
      for (int i = dailyCount; i < completed.size(); i++) text
        .append(" ")
        .append(completed.get(i).asText())
        .append(" completed.");
      result.put("text", text.toString());
    }
    if (promoted != null) {
      result.put("promoted", promoted);
      result.put("text", result.path("text").asText() + " Promoted to " + promoted + "!");
    }
    result.set("beat", s.path("pendingBeat").deepCopy());
    ObjectNode deltas = result
      .putObject("deltas")
      .put("cash", s.path("cash").asDouble() - cashBefore)
      .put("xp", s.path("xp").asInt() - xpBefore);
    deltas.set("needs", needDeltas);
    deltas.set("skills", skillDeltas);
    result.set("goalsCompleted", completed);
    result
      .putObject("activity")
      .put("id", action)
      .put("label", a.path("label").asText())
      .put("cost", a.path("cost").asDouble())
      .put("pay", Math.floor(a.path("pay").asDouble() * (low ? .7 : 1)))
      .put("dailyCash", dailyCash)
      .put("bonusCash", s.path("cash").asDouble() - cashBefore - cashDelta - dailyCash);
    // Persist the accepted outcome; readers settle it exactly once at its deadline,
    // including after a restart. Clients cannot mint or accelerate the reward.
    navigation.stage(live, loc, a, slotId);
    ObjectNode pending = live
      .putObject("_pendingAction")
      .put("cost", a.path("cost").asDouble())
      .put("shift", a.path("requires").has("job"))
      .put("meal", a.path("kind").asText().equals("food") && a.path("cost").asDouble() > 0);
    pending.put("paidGig", CareerRhythm.gig(a));
    pending.set("activity", result.path("activity").deepCopy());
    pending.set("state", s);
    pending.set("deltas", deltas.deepCopy());
    if (campaign) pending
      .put("campaignCity", city)
      .put("campaignTerm", civic.state(w, city).path("term").asInt())
      .put("campaignDay", civic.day(w));
    if (a.path("requires").has("job")) live
      .putObject("workGame")
      .put("id", id())
      .put("startsAt", now())
      .put("endsAt", busyUntil)
      .put("taps", 0)
      .put("best", 0)
      .put("basePay", result.path("activity").path("pay").asInt())
      .put("bonus", 0);
    live
      .put("loc", loc)
      .put("busyKind", a.path("kind").asText())
      .put("busyStartedAt", now())
      .put("busyUntil", busyUntil)
      .put("busyLabel", a.path("label").asText());
    store.save();
    out.set("sim", publicSim(live));
    out.set("result", result);
    return out;
  }

  synchronized ObjectNode setAspiration(String token, JsonNode body) {
    ObjectNode session = session(token, true),
      s = sim(session);
    decay(s, world(session));
    require(
      s.path("busyUntil").isNull() && s.path("pendingBeat").isNull(),
      409,
      "Finish your activity or story before changing dreams"
    );
    progression.select(s, body.path("aspiration").asText());
    store.save();
    ObjectNode out = object();
    out.set("sim", publicSim(s));
    return out;
  }

  synchronized ObjectNode chooseStory(String token, JsonNode body) {
    ObjectNode session = session(token, true),
      s = sim(session);
    decay(s, world(session));
    require(s.path("busyUntil").isNull(), 409, "Finish your activity before making this choice");
    ObjectNode outcome = stories.choose(s, body.path("beatId").asText(), body.path("choice").asText());
    store.save();
    ObjectNode out = object();
    out.set("sim", publicSim(s));
    out.set("outcome", outcome);
    return out;
  }

  void addSkill(ObjectNode skill, int gain) {
    int level = skill.path("level").asInt(),
      xp = skill.path("xp").asInt() + gain;
    while (level < 10 && xp >= 100 * (level + 1)) {
      xp -= 100 * (level + 1);
      level++;
    }
    skill
      .put("level", level)
      .put("xp", level == 10 ? 0 : xp)
      .put("next", 100 * (level + 1));
  }

  void updateLevel(ObjectNode s) {
    int level = 1,
      xp = s.path("xp").asInt();
    while (level < 100 && xp >= (100 * level * (level + 1)) / 2) level++;
    s.put("level", level).put("xpNext", (100 * level * (level + 1)) / 2);
  }

  String outcomeText(
    ObjectNode a,
    String loc,
    String action,
    double cash,
    ObjectNode needs,
    ObjectNode skills,
    int goals
  ) {
    if (
      action.equals("visit-workplace")
    ) return "You arrived at the workplace. Apply for an entry role while it is open.";
    String opening = loc.equals("home")
      ? switch (action) {
          case "sleep" -> "You wake up with a clearer head.";
          case "cook" -> "Dinner is on the table.";
          case "shower" -> "Freshened up and ready to go.";
          case "invite" -> "Good company makes home feel brighter.";
          default -> a.path("label").asText() + ".";
        }
      : a.path("label").asText() + ".";
    List<String> changes = new ArrayList<>();
    if (cash > 0) changes.add("Earned $" + (int) cash);
    else if (cash < 0) changes.add("Spent $" + (int) -cash);
    needs.fields().forEachRemaining(e -> {
      long change = Math.round(e.getValue().asDouble());
      if (change != 0) changes.add(Content.title(e.getKey()) + " " + (change > 0 ? "+" : "") + change);
    });
    skills.fields().forEachRemaining(e -> {
      if (e.getValue().asInt() > 0) changes.add(Content.title(e.getKey()) + " +" + e.getValue().asInt() + " XP");
    });
    if (changes.isEmpty()) changes.add("You are already feeling refreshed");
    if (goals > 0) changes.add(goals + " daily goal" + (goals > 1 ? "s" : "") + " completed");
    return opening + " " + String.join(" · ", changes) + ".";
  }

  synchronized ObjectNode homeDesign(String token) {
    return homeDesign.read(token);
  }

  synchronized ObjectNode homeDesign(String token, JsonNode body) {
    return homeDesign.mutate(token, body);
  }

  synchronized ObjectNode transit(String token, String city) {
    return transit.read(token, city);
  }

  synchronized ObjectNode bookTransit(String token, JsonNode body) {
    return transit.book(token, body);
  }

  synchronized ObjectNode napTransit(String token) {
    return transit.nap(token);
  }

  synchronized ObjectNode chatTransit(String token, JsonNode body) {
    return transit.say(token, body);
  }

  synchronized ObjectNode stats() {
    Set<String> users = new HashSet<>();
    for (var e : community.online.entrySet())
      if (e.getValue() > now() - 12000) users.add(e.getKey().substring(e.getKey().indexOf(':') + 1));
    return object().put("online", users.size()).put("visits", ++visits);
  }

  @jakarta.annotation.PreDestroy
  synchronized void checkpoint() {
    store.save();
  }

  /** Unused guests (no life set up) are forgotten after a day; lives nobody can sign into after a quiet month. */
  static final long UNUSED_GUEST_MS = 86400000L,
    ABANDONED_LIFE_MS = 30L * 86400000;

  @org.springframework.scheduling.annotation.Scheduled(initialDelay = 30000, fixedDelay = 15 * 60000)
  synchronized void purge() {
    long at = now();
    int removed = 0;
    Set<String> signedIn = new HashSet<>();
    var expired = new ArrayList<String>();
    table("sessions")
      .fields()
      .forEachRemaining(e -> {
        if (e.getValue().path("expiresAt").asLong() <= at) expired.add(e.getKey());
        else signedIn.add(e.getValue().path("userId").asText());
      });
    expired.forEach(table("sessions")::remove);
    var users = new ArrayList<String>();
    table("users").fieldNames().forEachRemaining(users::add);
    for (String uid : users) {
      if (signedIn.contains(uid) || community.isOnline("public", uid)) continue;
      JsonNode u = table("users").path(uid);
      JsonNode s = table("sims").get(uid + ":public");
      long created = u.path("createdAt").asLong(at);
      boolean unused = s == null && at - created > UNUSED_GUEST_MS;
      boolean abandoned = s != null && at - s.path("updatedAt").asLong(at) > ABANDONED_LIFE_MS;
      if (!u.path("guest").asBoolean(true) || !(unused || abandoned)) continue;
      table("users").remove(uid);
      table("sims").remove(uid + ":public");
      removed++;
    }
    if (removed > 0 || !expired.isEmpty()) store.save();
  }

  long createdAt(ObjectNode s) {
    return s.path("createdAt").asLong(table("users").path(s.path("userId").asText()).path("createdAt").asLong(now()));
  }

  boolean established(ObjectNode s) {
    ObjectNode w = (ObjectNode) table("worlds").get(s.path("worldId").asText());
    return minuteMillis(w) < 1000 || now() - createdAt(s) >= (long) (minuteMillis(w) * 1440);
  }

  synchronized ObjectNode daily(String token, String city) {
    content.city(city);
    ObjectNode c = clock(world(session(token, false)));
    return object()
      .put("date", "Day " + c.path("day").asInt())
      .put("weekday", c.path("weekday").asText())
      .put("weather", city.equals("bay") ? "Coastal haze" : city.equals("nyc") ? "Clear and crisp" : "Warm and sunny")
      .put("headline", "A new day, a city of possibilities")
      .put("tip", "Keep your needs up. Home is always open.");
  }

  synchronized String defaultCity(String token, String city) {
    if (!city.isBlank()) return city;
    ObjectNode session = session(token, false);
    JsonNode s = session == null ? null : table("sims").get(simKey(session));
    return s == null ? "atl" : s.path("city").asText("atl");
  }

  synchronized ObjectNode mayor(String token, String city) {
    return civic.read(token, city);
  }

  synchronized ObjectNode mayorAction(String token, String kind, JsonNode body) {
    return civic.mutate(token, kind, body);
  }

  synchronized ObjectNode plots(String token, String city) {
    return property.readPlots(token, city);
  }

  synchronized ObjectNode buyPlot(String token, JsonNode body) {
    return property.buyPlot(token, body);
  }

  synchronized ObjectNode billboards(String token, String city) {
    return property.readBoards(token, city);
  }

  synchronized ObjectNode bookBillboard(String token, JsonNode body) {
    return property.book(token, body);
  }

  synchronized ObjectNode homes(String token, String city) {
    return property.homes(token, city);
  }

  synchronized ObjectNode moveHome(String token, JsonNode body) {
    return property.move(token, body);
  }

  synchronized byte[] atlas(String token, String city, String world) {
    return property.atlas(token, city, world);
  }

  synchronized byte[] art(String token, String kind, String id) {
    return property.art(token, kind, id);
  }

  synchronized ObjectNode players(String token, String city) {
    return community.players(world(session(token, false)), city);
  }

  synchronized ObjectNode chat(String token, String city) {
    return community.chat(token, city);
  }

  synchronized ObjectNode say(String token, JsonNode body) {
    return community.say(token, body);
  }

  /** Live socket fan-out to one user's open sockets: (worldId, userId, frame). Set by LiveWire. */
  volatile TriConsumer userFrames;

  interface TriConsumer {
    void accept(String worldId, String userId, String frame);
  }

  synchronized ObjectNode social(String token, JsonNode body) {
    ObjectNode out = community.social(token, body);
    ObjectNode ses = session(token, true),
      w = world(ses),
      from = sim(ses),
      target = community.target(w, body.path("targetId").asText());
    if (target != null && !target.path("npc").asBoolean() && userFrames != null) {
      String kind = body.path("kind").asText();
      ObjectNode frame = object()
        .put("type", "socialReceived")
        .put("kind", kind)
        .put("fromId", from.path("userId").asText())
        .put("fromName", from.path("username").asText())
        .put("text", out.path("text").asText())
        .put("at", now());
      if (kind.equals("gift")) frame.put("amount", body.path("amount").asInt());
      userFrames.accept(w.path("id").asText(), target.path("userId").asText(), frame.toString());
    }
    return out;
  }

  static boolean containsEmoji(String s) {
    return s
      .codePoints()
      .anyMatch(cp -> cp >= 0x1F000 || (cp >= 0x2600 && cp <= 0x27BF) || cp == 0xFE0F || cp == 0x200D);
  }
}
