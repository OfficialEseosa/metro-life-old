package app.metrolife;

import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import java.io.IOException;
import java.util.*;
import org.springframework.stereotype.Component;

@Component
public class Content {

  final ObjectMapper mapper;
  final ObjectNode world;
  final JsonNode transit;
  static final String[] SKILLS = { "fitness", "cooking", "music", "tech", "charisma", "creativity", "business" };
  static final String[] NEEDS = { "energy", "hunger", "fun", "social", "hygiene" };
  /** Need loss per game hour, in NEEDS order. A game day is seven real minutes, so these stay gentle. */
  static final double[] NEED_RATES = { .45, .55, .42, .36, .4 };
  static final String[] TRACKS = { "tech", "music", "sports", "food", "finance", "arts", "civic", "health" };
  static final String[] ASPIRATIONS = {
    "founder",
    "headliner",
    "mayor",
    "restaurateur",
    "athlete",
    "collector",
    "mogul",
  };
  static final String[] ASPIRATION_NAMES = {
    "Startup Founder",
    "Headliner",
    "Mayor",
    "Restaurateur",
    "Pro Athlete",
    "Art Collector",
    "Real-Estate Mogul",
  };

  public Content(ObjectMapper mapper) throws IOException {
    this.mapper = mapper;
    DisplayNames.load(mapper);
    try (var data = getClass().getResourceAsStream("/static-data/transit.json")) {
      if (data == null) throw new IOException("Transit data missing");
      transit = mapper.readTree(data);
    }
    try (var in = getClass().getResourceAsStream("/static-data/world.json")) {
      if (in == null) throw new IOException("Canonical world content missing");
      world = (ObjectNode) mapper.readTree(in);
    }
    world.put("startingCash", 150);
    for (JsonNode c : world.withArray("cities")) {
      ObjectNode city = (ObjectNode) c;
      int n = 0;
      for (JsonNode nh : city.withArray("neighborhoods")) {
        String id = city.path("id").asText();
        ((ObjectNode) nh).put(
          "rent",
          n == 0 ? starterRent(id) : (id.equals("atl") ? 30 : id.equals("nyc") ? 45 : 50) + 10 * n
        );
        n++;
      }
      city
        .putObject("startingLife")
        .put("neighborhood", city.path("neighborhoods").get(0).path("id").asText())
        .put("rent", starterRent(city.path("id").asText()))
        .put("payPerShift", entryPay(city.path("id").asText()))
        .put("startingCash", 150);
      for (JsonNode l : city.withArray("landmarks")) {
        ObjectNode loc = (ObjectNode) l;
        ArrayNode labels = (ArrayNode) loc.get("actions"),
          actions = mapper.createArrayNode();
        for (int i = 0; i < labels.size(); i++) actions.add(expand(loc, labels.get(i).asText(), i));
        loc.set("actions", actions);
      }
      ArrayNode home = city.putArray("homeActions");
      home.add(
        action("sleep", "Get some sleep", "rest", "moon", 60, 0, 0, Map.of("energy", 48, "hunger", -5), Map.of())
      );
      home.add(
        action(
          "cook",
          "Cook a fresh meal",
          "food",
          "cooking-pot",
          30,
          0,
          0,
          Map.of("hunger", 38, "fun", 5),
          Map.of("cooking", 24)
        )
      );
      home.add(
        action("shower", "Take a shower", "rest", "droplets", 15, 0, 0, Map.of("hygiene", 65, "energy", 10, "fun", 6), Map.of())
      );
      home.add(
        action(
          "invite",
          "Invite a friend over",
          "social",
          "users",
          30,
          0,
          0,
          Map.of("social", 35, "fun", 10),
          Map.of("charisma", 18)
        )
      );
    }
    String[] effects = {
      "Non-flight airport rides cost $0.",
      "Parks stay open until midnight.",
      "Work activities pay 5% more.",
      "Culture activities are free after 18:00 and open until midnight.",
      "Daily rent is reduced by 20%.",
      "Nightlife venues stay open until 04:00.",
    };
    int policyIndex = 0;
    for (JsonNode policy : world.path("policies")) ((ObjectNode) policy).put("effect", effects[policyIndex++]);
    ArrayNode skills = world.putArray("skills");
    String[] icons = {
      "dumbbell",
      "cooking-pot",
      "music",
      "cpu",
      "messages-square",
      "palette",
      "chart-no-axes-combined",
    };
    for (int i = 0; i < SKILLS.length; i++) skills
      .addObject()
      .put("id", SKILLS[i])
      .put("label", title(SKILLS[i]))
      .put("icon", icons[i]);
    ArrayNode careers = world.putArray("careers");
    String[] workplaces = { "techVillage", "fox", "benz", "ponce", "techVillage", "high", "capitol", "grady" };
    String[] careerSkills = { "tech", "music", "fitness", "cooking", "business", "creativity", "charisma", "fitness" };
    String[][] titles = {
      { "Support Associate", "Developer", "Senior Engineer", "Technical Lead", "CTO" },
      { "Stage Assistant", "Session Musician", "Touring Artist", "Headliner", "Music Director" },
      { "Team Assistant", "Trainer", "Athlete", "Team Captain", "Champion" },
      { "Kitchen Porter", "Line Cook", "Sous Chef", "Head Chef", "Restaurateur" },
      { "Office Assistant", "Analyst", "Advisor", "Portfolio Manager", "Partner" },
      { "Gallery Assistant", "Studio Artist", "Curator", "Art Director", "Creative Director" },
      { "Community Aide", "Organizer", "Policy Analyst", "Chief of Staff", "City Director" },
      { "Care Assistant", "Health Educator", "Clinician", "Department Lead", "Medical Director" },
    };
    for (int t = 0; t < TRACKS.length; t++) {
      ObjectNode career = careers
        .addObject()
        .put("track", TRACKS[t])
        .put("label", title(TRACKS[t]))
        .put("icon", t == 7 ? "heart-pulse" : "briefcase");
      ArrayNode levels = career.putArray("levels");
      for (int level = 1; level <= 5; level++) {
        ObjectNode row = levels
          .addObject()
          .put("level", level)
          .put("title", titles[t][level - 1])
          .put("city", "atl")
          .put("loc", workplaces[t])
          .put("payPerHour", new int[] { 70, 100, 140, 190, 250 }[level - 1])
          .put("shiftsToPromote", 3 + level);
        row
          .putObject("requires")
          .putObject("skills")
          .put(careerSkills[t], (level - 1) * 2);
      }
      ObjectNode shift = action(
        "shift-" + TRACKS[t],
        "Work a shift",
        "work",
        "briefcase",
        240,
        0,
        120,
        Map.of("energy", -10, "hunger", -7, "fun", -3, "hygiene", -8),
        Map.of(careerSkills[t], 75)
      );
      shift.putObject("requires").put("job", TRACKS[t]);
      ArrayNode workplaceActions = landmark("atl", workplaces[t]).withArray("actions");
      boolean existingShift = false;
      for (JsonNode existing : workplaceActions)
        if (
          existing.path("label").asText().equals("Work a shift") &&
          existing.path("requires").path("job").asText().equals(TRACKS[t])
        ) existingShift = true;
      if (!existingShift) workplaceActions.add(shift);
      for (String other : new String[] { "nyc", "bay" }) {
        ArrayNode actions = landmark(other, workplace(other, TRACKS[t])).withArray("actions");
        boolean exists = false;
        for (JsonNode a : actions) if (a.path("requires").path("job").asText().equals(TRACKS[t])) exists = true;
        if (!exists) actions.add(shift.deepCopy());
      }
    }
    for (JsonNode city : world.path("cities"))
      for (JsonNode place : city.path("landmarks")) {
        boolean workplace = false;
        for (String track : TRACKS)
          if (workplace(city.path("id").asText(), track).equals(place.path("id").asText())) workplace = true;
        if (workplace) {
          ((ObjectNode) place).putArray("open").add(0).add(24);
          ((ObjectNode) place)
            .withArray("actions")
            .add(
              action("visit-workplace", "Visit the workplace", "rest", "footprints", 1, 0, 0, Map.of(), Map.of()).put(
                "xp",
                0
              )
            );
        }
      }
    for (JsonNode row : world.path("cities")) {
      ObjectNode city = (ObjectNode) row;
      JsonNode bus = transit.path("cities").path(city.path("id").asText()).path("bus");
      ObjectNode stop = city
        .withArray("landmarks")
        .addObject()
        .put("id", bus.path("id").asText())
        .put("name", bus.path("name").asText())
        .put("area", "Downtown")
        .put("category", "transport")
        .put("icon", "train-front")
        .put(
          "blurb",
          "Shared intercity departures. A bus ride costs a quarter of the plane fare and advances the shared clock by eight game hours."
        )
        .put("transitHub", true);
      stop.putArray("open").add(0).add(24);
      stop.putArray("actions");
    }
    // Legacy action callers use the same booking service; publish the same fare/game-time facts.
    for (JsonNode city : world.path("cities"))
      for (JsonNode place : city.path("landmarks"))
        for (JsonNode node : place.path("actions"))
          if (node.has("to")) {
            ObjectNode a = (ObjectNode) node;
            String from = city.path("id").asText(),
              to = a.path("to").asText();
            int fare = transit
              .path("fares")
              .path(from + ":" + to)
              .asInt(
                transit
                  .path("fares")
                  .path(to + ":" + from)
                  .asInt()
              );
            a.put("cost", fare)
              .put("durationMin", transit.path("modes").path("plane").path("gameMinutes").asInt())
              .put("xp", 0);
            a.putObject("needs");
            a.putObject("skills");
          }
    String[] pitches = {
      "Turn a small idea into a thriving studio. First, discover three places and earn your seed money.",
      "Find your sound, take a small stage and work toward a sold-out show.",
      "Meet your neighbours, build trust and earn a voice at the Gold Dome.",
      "Cook your first good meal, master the kitchen and build a place people gather.",
      "Train a little every day, join the team and make the crowd rise.",
      "Find inspiration in the galleries, make your own work and build a collection.",
      "Save your first spare dollar, claim a small plot and build a neighbourhood legacy.",
    };
    ArrayNode aspirations = world.putArray("aspirations");
    for (int i = 0; i < ASPIRATIONS.length; i++) {
      ObjectNode aspiration = aspirations
        .addObject()
        .put("id", ASPIRATIONS[i])
        .put("label", ASPIRATION_NAMES[i])
        .put("icon", new String[] { "rocket", "mic-vocal", "landmark", "utensils", "trophy", "palette", "house" }[i])
        .put("blurb", pitches[i]);
      ArrayNode milestones = aspiration.putArray("milestones");
      for (int step = 0; step < 6; step++) {
        ObjectNode m = milestones
          .addObject()
          .put("id", ASPIRATIONS[i] + "-" + step)
          .put("text", Progression.TEXTS[i][step]);
        m.putObject("reward")
          .put("cash", 150 * (step + 1))
          .put("xp", 50 * (step + 1));
      }
    }
    for (JsonNode c : world.path("cities"))
      for (JsonNode l : c.path("landmarks"))
        for (JsonNode a : l.path("actions"))
          if (CareerRhythm.job(a)) ((ObjectNode) a).put("durationMin", 240);
          else if (CareerRhythm.gig(a)) ((ObjectNode) a).put("durationMin", 60);
    LandmarkLife.install(this);
    DisplayNames.apply(world);
    for (JsonNode city : world.path("cities"))
      for (JsonNode place : city.path("landmarks"))
        if (DisplayNames.data.path("venues").has(place.path("id").asText())) ((ObjectNode) place).put(
          "name",
          DisplayNames.data.path("venues").path(place.path("id").asText()).asText()
        );
  }

  ObjectNode action(
    String id,
    String label,
    String kind,
    String icon,
    int duration,
    int cost,
    int pay,
    Map<String, Integer> needs,
    Map<String, Integer> skills
  ) {
    ObjectNode a = mapper
      .createObjectNode()
      .put("id", id)
      .put("label", label)
      .put("kind", kind)
      .put("icon", icon)
      .put("durationMin", duration)
      .put("cost", cost)
      .put("pay", pay)
      .put("xp", 15);
    a.set("needs", mapper.valueToTree(needs));
    a.set("skills", mapper.valueToTree(skills));
    return a;
  }

  private ObjectNode expand(ObjectNode loc, String label, int index) {
    String s = label.toLowerCase(Locale.ROOT),
      cat = loc.path("category").asText();
    String kind = "fun",
      skill = "",
      icon = loc.path("icon").asText();
    int cost = 10,
      pay = 0;
    Map<String, Integer> needs = Map.of("fun", 20, "energy", -3);
    if (s.startsWith("fly to")) return action(
      "a" + index,
      label,
      "travel",
      "plane",
      90,
      180,
      0,
      Map.of("energy", -8, "fun", 5),
      Map.of()
    ).put("to", s.contains("new york") ? "nyc" : s.contains("atlanta") ? "atl" : "bay");
    if (
      s.matches(
        ".*(work |shift|usher|busk|sell |bartend|intern|ship a feature|trade the open|play a set|dj a set|play an open mic|perform at).*"
      )
    ) {
      kind = "work";
      cost = 0;
      pay = 22;
      needs = Map.of("energy", -10, "hunger", -7, "fun", -3, "hygiene", -6);
      skill =
        s.contains("kitchen") || s.contains("line")
          ? "cooking"
          : cat.equals("music") || cat.equals("nightlife")
            ? "music"
            : "business";
    } else if (s.matches(".*(eat |meal|dumplings|burrito|chowder|dim sum|food hall|get a slice|grab ).*")) {
      kind = "food";
      cost = 12;
      needs = Map.of("hunger", 35, "fun", 7);
      skill = "";
    } else if (s.matches(".*(class|study|hackathon|co-work|sketch|interview|pitch|raise a seed|start something).*")) {
      kind = "learn";
      cost = 15;
      needs = Map.of("fun", 10, "energy", -5);
      skill = cat.equals("culture")
        ? "creativity"
        : cat.equals("tech") || cat.equals("education")
          ? "tech"
          : "business";
    } else if (s.matches(".*(run |jog |bike |tennis|swim|shoot around|cycle).*")) {
      kind = "learn";
      cost = 0;
      needs = Map.of("fun", 15, "energy", -8, "hunger", -5, "hygiene", -10);
      skill = "fitness";
    } else if (s.matches(".*(friends|network|club|debate|co-founder|meet |share ).*")) {
      kind = "social";
      cost = 0;
      needs = Map.of("social", 30, "fun", 10);
      skill = "charisma";
    } else if (cat.equals("civic")) {
      kind = "civic";
      cost = 0;
      needs = Map.of("social", 20);
      skill = "charisma";
    } else if (s.contains("reflect") || s.contains("check-up")) {
      kind = "rest";
      cost = s.contains("check-up") ? 35 : 0;
      needs = Map.of("energy", 25, "fun", 10);
    } else if (cat.equals("park") || cat.equals("sight") || cat.equals("waterfront")) cost = 0;
    icon = s.contains("pitch")
      ? "rocket"
      : s.contains("co-work")
        ? "laptop"
        : s.contains("co-founder")
          ? "users"
          : kind.equals("food")
            ? "utensils"
            : kind.equals("social")
              ? "users"
              : kind.equals("work")
                ? "briefcase"
                : kind.equals("learn")
                  ? "book-open"
                  : s.contains("ride") || s.contains("bike")
                    ? "bike"
                    : s.contains("watch") || s.contains("tour")
                      ? "eye"
                      : icon;
    ObjectNode a = action(
      "a" + index,
      label,
      kind,
      icon,
      kind.equals("work") ? 60 : 30,
      cost,
      pay,
      needs,
      skill.isBlank() ? Map.of() : Map.of(skill, 20)
    );
    if (s.equals("work a shift")) {
      a.putObject("requires").put("job", "health");
      a.putObject("skills").put("fitness", 75);
    }
    return a;
  }

  ObjectNode city(String id) {
    for (JsonNode c : world.path("cities")) if (c.path("id").asText().equals(id)) return (ObjectNode) c;
    throw new ApiException(400, "Choose Atlanta, New York or the Bay Area");
  }

  ObjectNode landmark(String city, String id) {
    for (JsonNode l : city(city).path("landmarks")) if (l.path("id").asText().equals(id)) return (ObjectNode) l;
    throw new ApiException(404, "That place could not be found");
  }

  ObjectNode neighborhood(String city, String id) {
    for (JsonNode n : city(city).path("neighborhoods")) if (n.path("id").asText().equals(id)) return (ObjectNode) n;
    throw new ApiException(400, "Choose a neighborhood in this city");
  }

  ObjectNode aspiration(String id) {
    for (JsonNode a : world.path("aspirations")) if (a.path("id").asText().equals(id)) return (ObjectNode) a;
    throw new ApiException(400, "Choose an aspiration");
  }

  static int starterRent(String city) {
    return city.equals("atl") ? 15 : city.equals("nyc") ? 22 : 25;
  }

  static int entryPay(String city) {
    return city.equals("atl") ? 70 : city.equals("nyc") ? 100 : 110;
  }

  static int cityPay(String city, int base) {
    return (int) Math.round((base * entryPay(city)) / 70.0);
  }

  static String title(String s) {
    return s.substring(0, 1).toUpperCase(Locale.ROOT) + s.substring(1);
  }

  static String workplace(String city, String track) {
    String[] places = city.equals("nyc")
      ? new String[] { "dumbo", "apollo", "yankee", "chinatown", "wallStreet", "met", "cityHall", "presbyterian" }
      : city.equals("bay")
        ? new String[] {
            "techCampus",
            "fillmore",
            "chaseCenter",
            "missionEats",
            "sandHill",
            "sfCityHall",
            "sfCityHall",
            "ucsf",
          }
        : new String[] { "techVillage", "fox", "benz", "ponce", "techVillage", "high", "capitol", "grady" };
    return places[Arrays.asList(TRACKS).indexOf(track)];
  }
}
