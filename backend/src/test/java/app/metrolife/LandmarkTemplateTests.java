package app.metrolife;

import com.fasterxml.jackson.databind.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.io.TempDir;
import java.nio.file.Path;
import static org.junit.jupiter.api.Assertions.*;

/** A few distinctive venue visits cover their actual action/slot contract without scanning every floor cell. */
class LandmarkTemplateTests {
 @TempDir Path dir;GameService g;String token;long now=1000000000;
 @BeforeEach void setup()throws Exception{var mapper=new ObjectMapper();g=new GameService(new JsonStore(mapper,dir.resolve("save.json").toString()),new Content(mapper),mapper);g.time=()->now;token=g.guest(null,g.object()).token();ActivityFixture.setup(g,token,g.object().put("city","atl").put("neighborhood","midtown").put("aspiration","founder"));}
 @Test void marketMealTheatreShowAndAquariumVisitUseTheirAuthoredFurniture()throws Exception{
  for(String[] visit:new String[][]{{"ponce","a0","foodhall","Eat"},{"fox","venue-show","theatre","Sit"},{"aquarium","venue-view","aquarium","Sit"}}){
   JsonNode accepted=ActivityFixture.act(g,token,g.object().put("city","atl").put("loc",visit[0]).put("action",visit[1]));
   assertEquals(visit[2]+":"+visit[0],accepted.path("sim").path("position").path("room").asText());assertEquals(visit[3],accepted.path("sim").path("activitySlot").path("pose").asText());
   JsonNode point=accepted.path("sim").path("position");assertTrue(g.navigation.stand("atl",point.path("x").asDouble(),point.path("z").asDouble(),point.path("room").asText()));
   now=accepted.path("sim").path("busyUntil").asLong();JsonNode settled=g.getSim(token).path("sim");assertTrue(settled.path("busyUntil").isNull());if(settled.path("pendingBeat").isObject())g.chooseStory(token,g.object().put("beatId",settled.path("pendingBeat").path("id").asText()).put("choice","steady"));
  }
  assertEquals("Peacock Palace",g.content.landmark("atl","fox").path("name").asText());g.checkpoint();GameService restored=new GameService(new JsonStore(g.mapper,g.store.path.toString()),g.content,g.mapper);restored.time=()->now;assertEquals("aquarium:aquarium",restored.getSim(token).path("sim").path("position").path("room").asText());
 }
}
