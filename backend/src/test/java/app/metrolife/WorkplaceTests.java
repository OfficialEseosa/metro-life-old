package app.metrolife;
import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.io.TempDir;
import java.nio.file.Path;
import static org.junit.jupiter.api.Assertions.*;

class WorkplaceTests {
 @TempDir Path dir;ObjectMapper m=new ObjectMapper();GameService g;String token;long now=1000000000;
 ObjectNode sim(){return g.sim(g.session(token,true));}
 @BeforeEach void setup()throws Exception{g=new GameService(new JsonStore(m,dir.resolve("save.json").toString()),new Content(m),m);g.time=()->now;token=g.guest(null,g.object()).token();g.createWorld(token,g.object().put("mode","solo").put("name","Work checks"));g.setup(token,g.object().put("city","atl").put("neighborhood","midtown").put("aspiration","founder"));}
 void arrive(){sim().put("loc","techVillage");sim().remove("position");g.navigation.position(sim());}
 void enter(){g.door(token,g.object().put("loc","techVillage").put("enter",true));}
 ObjectNode apply(){return g.applyJob(token,g.object().put("jobId","tech-1"));}
 void desk(){g.navigation.position(sim()).put("x",0).put("z",-.8);}
 @Test void enteringRequiresTheActualDoor(){assertThrows(ApiException.class,this::enter);arrive();enter();assertEquals("work:techVillage",sim().path("position").path("room").asText());assertEquals(409,assertThrows(ApiException.class,this::enter).status);}
 @Test void applyingRequiresInsideAndDesk(){arrive();assertThrows(ApiException.class,this::apply);enter();assertThrows(ApiException.class,this::apply);desk();assertTrue(apply().path("hired").asBoolean());}
 @Test void shiftPayAndPromotionRemainCompletionOnly(){arrive();enter();desk();apply();ObjectNode r=g.act(token,g.object().put("city","atl").put("loc","techVillage").put("action","shift-tech"));assertEquals(2500,r.path("sim").path("cash").asInt());assertEquals(0,r.path("sim").path("job").path("shifts").asInt());now=r.path("sim").path("busyUntil").asLong();JsonNode paid=g.getSim(token).path("sim");assertTrue(paid.path("cash").asInt()>2500);assertEquals(1,paid.path("job").path("shifts").asInt());}
 @Test void actionsAtRemoteLandmarksDoNotTeleport(){assertEquals(409,assertThrows(ApiException.class,()->g.act(token,g.object().put("city","atl").put("loc","centennial").put("action","a0"))).status);assertEquals("home",sim().path("loc").asText());}
 @Test void shortcutIsTimedDurableAndCannotCrossCities()throws Exception{ObjectNode r=g.travel(token,g.object().put("city","atl").put("loc","techVillage"));assertEquals("home",r.path("sim").path("loc").asText());assertFalse(r.path("sim").has("_pendingTravel"));GameService restored=new GameService(new JsonStore(m,g.store.path.toString()),g.content,m);restored.time=()->now;now=r.path("sim").path("busyUntil").asLong();assertEquals("techVillage",restored.getSim(token).path("sim").path("loc").asText());assertThrows(ApiException.class,()->restored.travel(token,g.object().put("city","nyc").put("loc","dumbo")));}
 @Test void everyCityHasSharedWorkplaces(){for(String city:new String[]{"atl","nyc","bay"})for(String track:Content.TRACKS)assertFalse(g.navigation.type(city,Content.workplace(city,track)).isEmpty());}
}
