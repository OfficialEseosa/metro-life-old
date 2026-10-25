package app.metrolife;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.*;
import java.util.*;

/** Original, compact three-beat city stories. All rewards and checks stay on the server. */
final class Stories {

  record Story(
    String id,
    String city,
    String loc,
    String skill,
    String title,
    String[] bodies,
    String[] risks,
    String[] wins,
    String[] losses
  ) {}

  final GameService game;
  final List<Story> all = List.of(
    new Story(
      "atl-startup",
      "atl",
      "techVillage",
      "tech",
      "A porch-sized launch",
      new String[] {
        "A local shop needs an easier way to manage pickup orders. Your co-working neighbour asks you to sketch a tiny first version.",
        "The shop agrees to try it on Saturday. A test order vanishes while the queue grows. Your neighbour looks to you.",
        "The first customers are happy. Tonight the founders are showing community-built tools to a room of local backers.",
      },
      new String[] { "Build a working demo", "Trace the missing order", "Lead the live demo" },
      new String[] {
        "Your demo makes the shopkeeper smile.",
        "You find the duplicate order key before the rush.",
        "The room follows every click. Your little launch earns its first backer.",
      },
      new String[] {
        "The demo stalls. A paper sketch still gets the idea across.",
        "The fix needs more testing. The shop uses its notebook today.",
        "The demo crashes, but the shopkeeper tells the room why the idea matters.",
      }
    ),
    new Story(
      "atl-music",
      "atl",
      "fox",
      "music",
      "One spare microphone",
      new String[] {
        "A neighbourhood showcase has one empty slot. The stage manager offers you a microphone and a very short soundcheck.",
        "The opener misses their cue. You have a moment to help the room settle.",
        "The audience asks for one more song. The musicians turn toward you.",
      },
      new String[] { "Try an original verse", "Carry the opening melody", "Lead the encore" },
      new String[] {
        "Your verse lands cleanly.",
        "The band catches your melody and the crowd relaxes.",
        "The encore ends in a wave of applause. You are invited back.",
      },
      new String[] {
        "You lose a line, then recover with a grin.",
        "The timing slips. The drummer helps everyone find the beat.",
        "The last note wobbles. The crowd cheers the effort anyway.",
      }
    ),
    new Story(
      "atl-community",
      "atl",
      "capitol",
      "charisma",
      "A cooler block",
      new String[] {
        "Neighbours have brought a plan for more shade near a busy bus stop. They need someone to introduce it at an open meeting.",
        "Two residents disagree about where the trees should go. Everyone wants to be heard.",
        "The committee has time for one closing statement before choosing a pilot project.",
      },
      new String[] { "Present the neighbourhood plan", "Find a shared priority", "Make the closing case" },
      new String[] {
        "You make the daily wait feel real to the room.",
        "Both neighbours agree on a safer, cooler crossing.",
        "The committee chooses your block for its first shade pilot.",
      },
      new String[] {
        "You rush the opening. The written plan still reaches the committee.",
        "The discussion tangles. A walking tour is scheduled to help.",
        "The vote is postponed. Your neighbours promise to return with you.",
      }
    ),
    new Story(
      "nyc-startup",
      "nyc",
      "dumbo",
      "tech",
      "Under the bridge, online",
      new String[] {
        "A makers' market under the bridge has no shared stock list. A stallholder asks whether you can help before the weekend.",
        "Three stalls use different names for the same items. The shared list is filling with duplicates.",
        "The market organiser asks you to show the system to the rest of the vendors.",
      },
      new String[] { "Make a stock-list demo", "Write a matching tool", "Run a live vendor demo" },
      new String[] {
        "The first stall updates its stock in seconds.",
        "Your matching tool untangles the list.",
        "Vendors sign up together. Your weekend project has a future.",
      },
      new String[] {
        "The first version is awkward. The stallholder helps simplify it.",
        "A few duplicates remain. The vendors label them by hand.",
        "The connection drops. Printed screenshots keep the conversation going.",
      }
    ),
    new Story(
      "nyc-music",
      "nyc",
      "apollo",
      "music",
      "The waiting-list song",
      new String[] {
        "An open-mic host has a cancellation. You can take the slot if you are ready for a quick rehearsal.",
        "Backstage, another performer has forgotten a bridge. They ask you to help find it.",
        "The host calls your name. You step into a bright circle on a very famous stage.",
      },
      new String[] { "Rehearse your own arrangement", "Work out the missing bridge", "Perform the full arrangement" },
      new String[] {
        "Your arrangement fits the short slot beautifully.",
        "You find a transition that lets the song breathe.",
        "The room stays with you to the last note. The host offers another date.",
      },
      new String[] {
        "A tricky phrase catches you. You choose a simpler arrangement.",
        "The bridge stays elusive. A familiar chord change will do tonight.",
        "Nerves steal a line. You finish the song and leave a little braver.",
      }
    ),
    new Story(
      "nyc-community",
      "nyc",
      "cityHall",
      "charisma",
      "The last crossing",
      new String[] {
        "A volunteer group is collecting stories about a difficult street crossing. They ask you to interview a few neighbours.",
        "The evidence is ready, but the group has only two minutes on the public agenda.",
        "A council aide asks which change the neighbourhood wants first.",
      },
      new String[] { "Lead the neighbour interviews", "Tell the strongest story", "Build agreement on a first step" },
      new String[] {
        "Residents share details the traffic counts missed.",
        "Your short account holds the room.",
        "A crossing review is commissioned, with residents at the table.",
      },
      new String[] {
        "The interviews wander. Written comments fill the gaps.",
        "The clock runs out. The group submits its full notes.",
        "Priorities remain split. A site visit becomes the next step.",
      }
    ),
    new Story(
      "bay-startup",
      "bay",
      "sandHill",
      "tech",
      "The small demo day",
      new String[] {
        "A friend's repair-shop app has a demo slot on Sand Hill Road. They need someone to help explain the first working build.",
        "A rehearsal reveals that the booking flow breaks on a small screen. There is still time for one fix.",
        "The doors open. A room of potential backers wants to see the app solve a real problem.",
      },
      new String[] { "Rebuild the opening demo", "Repair the mobile flow", "Lead the live pitch" },
      new String[] {
        "The demo starts with the customer's problem, clearly.",
        "The booking now works with one thumb.",
        "A backer offers a paid pilot. The repair shop gets the first call.",
      },
      new String[] {
        "The opening is too technical. Your friend supplies a simple example.",
        "The fix needs another day. A recorded walkthrough covers the gap.",
        "Questions expose a rough edge. You leave with useful feedback and a next meeting.",
      }
    ),
    new Story(
      "bay-music",
      "bay",
      "fillmore",
      "music",
      "A borrowed amp",
      new String[] {
        "A local band is missing its rhythm player at a small showcase. There is a spare amp and a set list on the floor.",
        "During rehearsal, the singer wants a quieter middle section. The band tries a new texture.",
        "The showcase is full. The singer nods for you to open the final song.",
      },
      new String[] { "Learn the unfamiliar set", "Arrange the quiet section", "Open with a solo phrase" },
      new String[] {
        "You lock in with the drummer.",
        "The softer texture gives the singer room.",
        "The band lifts the phrase into a powerful finale. You earn a regular rehearsal invite.",
      },
      new String[] {
        "One change slips past. The bass player guides you back.",
        "The texture feels thin. A familiar groove saves the section.",
        "Your first note clips. The band carries on and you find your place.",
      }
    ),
    new Story(
      "bay-community",
      "bay",
      "sfCityHall",
      "charisma",
      "Room for a bench",
      new String[] {
        "A neighbourhood group wants a small seating area on a steep walking route. They ask you to help gather support.",
        "Shop owners worry about deliveries. Residents want somewhere to rest. A workable plan needs both.",
        "At the public workshop, you are asked to sum up the compromise.",
      },
      new String[] { "Speak with the whole block", "Negotiate a shared layout", "Present the final proposal" },
      new String[] {
        "The signatures include walkers and shopkeepers.",
        "A movable bench leaves the delivery entrance clear.",
        "The workshop backs a trial seating area. Your neighbours plan a first picnic.",
      },
      new String[] {
        "Some doors stay closed. A weekend table collects more comments.",
        "The layout still needs work. Everyone agrees to measure the site together.",
        "The proposal returns for revision. The new relationships make the next try easier.",
      }
    )
  );

  Stories(GameService game) {
    this.game = game;
  }

  void depart(ObjectNode s, String city, String loc) {
    for (Story story : all)
      if (
        s.path("_stories").has(story.id) &&
        s.path("_stories").path(story.id).asInt() < 3 &&
        (!story.city.equals(city) || !story.loc.equals(loc))
      ) s.withObject("_storyDeparted").put(story.id, true);
  }

  void trigger(ObjectNode s, String city, String loc) {
    if (!s.path("pendingBeat").isNull()) return;
    for (Story story : all)
      if (story.city.equals(city) && story.loc.equals(loc) && s.path("_stories").path(story.id).asInt(0) < 3) {
        int step = s.path("_stories").path(story.id).asInt(0);
        if (step > 0 && !s.path("_storyDeparted").path(story.id).asBoolean()) return;
        s.withObject("_storyDeparted").put(story.id, false);
        s.withObject("_stories").put(story.id, step);
        s.set("pendingBeat", beat(story, step));
        return;
      }
  }

  ArrayNode journal(ObjectNode s) {
    ArrayNode rows = game.mapper.createArrayNode();
    for (Story story : all)
      if (s.path("_stories").has(story.id)) {
        int completed = s.path("_stories").path(story.id).asInt();
        String status =
          completed >= 3
            ? "complete"
            : s
                  .path("pendingBeat")
                  .path("id")
                  .asText()
                  .startsWith(story.id + ":")
              ? "choice"
              : "waiting";
        rows
          .addObject()
          .put("id", story.id)
          .put("title", story.title)
          .put("city", story.city)
          .put("loc", story.loc)
          .put("completedBeats", completed)
          .put("total", 3)
          .put("status", status)
          .put("canContinue", s.path("_storyDeparted").path(story.id).asBoolean());
      }
    return rows;
  }

  ObjectNode beat(Story story, int step) {
    ObjectNode b = game
      .object()
      .put("id", story.id + ":" + step)
      .put("title", story.title)
      .put("chapter", step + 1)
      .put("total", 3)
      .put("icon", story.skill.equals("tech") ? "rocket" : story.skill.equals("music") ? "music" : "users")
      .put("body", story.bodies[step]);
    ArrayNode choices = b.putArray("choices");
    choices
      .addObject()
      .put("id", "bold")
      .put("label", story.risks[step])
      .put(
        "hint",
        Content.title(story.skill) + " " + (step + 1) + " succeeds · $" + 80 * (step + 1) + " reward; otherwise +10 XP"
      );
    choices
      .addObject()
      .put("id", "steady")
      .put(
        "label",
        step == 0
          ? "Start small, with a neighbour's help"
          : step == 1
            ? "Ask the group to help"
            : "Share the moment with the team"
      )
      .put("hint", "No skill level needed · $" + 20 * (step + 1) + " and practice XP");
    return b;
  }

  ObjectNode choose(ObjectNode s, String beatId, String choice) {
    GameService.require(
      s.path("pendingBeat").path("id").asText().equals(beatId),
      409,
      "That choice is not currently available"
    );
    GameService.require(choice.equals("bold") || choice.equals("steady"), 400, "Choose one of the offered paths");
    Story story = null;
    int step = -1;
    for (Story candidate : all)
      for (int i = 0; i < 3; i++) if ((candidate.id + ":" + i).equals(beatId)) {
        story = candidate;
        step = i;
      }
    GameService.require(
      story != null && s.path("_stories").path(story.id).asInt(-1) == step,
      409,
      "This story has moved on"
    );
    boolean safe = choice.equals("steady"),
      win = safe || game.progression.skill(s, story.skill) >= step + 1;
    int cash = win ? (safe ? 20 : 80) * (step + 1) : 0,
      xp = win ? 35 : 10;
    double before = s.path("cash").asDouble();
    int xpBefore = s.path("xp").asInt();
    s.put("cash", before + cash).put("xp", xpBefore + xp);
    game.addSkill((ObjectNode) s.path("skills").path(story.skill), 15);
    s.withObject("_stories").put(story.id, step + 1);
    s.putNull("pendingBeat");
    ArrayNode completed = game.mapper.createArrayNode();
    game.progression.evaluate(s, completed);
    game.updateLevel(s);
    int totalCash = (int) (s.path("cash").asDouble() - before);
    ObjectNode money = s.withObject("moneyToday");
    money.put("income", money.path("income").asDouble() + totalCash);
    String text = safe
      ? "You share the work. The team finds a practical way forward."
      : win
        ? story.wins[step]
        : story.losses[step];
    if (step == 2) text += " Story complete.";
    else text +=
      " Take a break elsewhere, then return to " +
      game.content.landmark(story.city, story.loc).path("name").asText() +
      ".";
    if (!completed.isEmpty()) text += " " + completed.get(0).asText() + ".";
    ObjectNode out = game.object().put("win", win).put("text", text);
    ObjectNode deltas = out
      .putObject("deltas")
      .put("cash", totalCash)
      .put("xp", s.path("xp").asInt() - xpBefore);
    deltas.putObject("needs");
    deltas.putObject("skills").put(story.skill, 15);
    out.set("next", s.path("pendingBeat").deepCopy());
    return out;
  }
}
