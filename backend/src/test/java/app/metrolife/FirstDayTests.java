package app.metrolife;
import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.io.TempDir;
import java.nio.file.*;
import static org.junit.jupiter.api.Assertions.*;
class FirstDayTests {
 @TempDir Path dir;ObjectMapper m=new ObjectMapper();GameService g;String token;long now=System.currentTimeMillis();
 @BeforeEach void start()throws Exception{g=new GameService(new JsonStore(m,dir.resolve("save.json").toString()),new Content(m),m);g.time=()->now;g.world(null).put("startedAt",now);token=g.guest(null,g.object()).token();}
 ObjectNode input(String name){return g.object().put("username",name).put("pronouns","they").put("city","atl").put("neighborhood","midtown").put("aspiration","founder");}
 ObjectNode sim(){return g.sim(g.session(token,true));}
 void create(){g.setup(token,input("River O'Neil"));}
 void settle(JsonNode started){now=started.path("sim").path("busyUntil").asLong();g.getSim(token);}
 
 
 @Test void shiftAndMealGoalsAndMoneyWaitForCompletionThenPersist()throws Exception{create();sim().put("loc","techVillage");ActivityFixture.apply(g,token,g.object().put("jobId","tech-1"));assertTrue(sim().path("firstDay").path("job").asBoolean());var shift=ActivityFixture.act(g,token,g.object().put("city","atl").put("loc","techVillage").put("action","shift-tech"));assertFalse(sim().path("firstDay").path("shift").asBoolean());assertEquals(150,sim().path("cash").asInt());settle(shift);assertTrue(sim().path("firstDay").path("shift").asBoolean());var meal=ActivityFixture.act(g,token,g.object().put("city","atl").put("loc","krog").put("action","a0"));assertFalse(sim().path("firstDay").path("meal").asBoolean());g.store.save();now=meal.path("sim").path("busyUntil").asLong();var restored=new GameService(new JsonStore(m,g.store.path.toString()),g.content,m);restored.time=()->now;assertTrue(restored.getSim(token).path("sim").path("firstDay").path("meal").asBoolean());assertTrue(restored.getSim(token).path("sim").path("pendingBeat").isNull());}
 
 @Test void firstRentCannotDoubleChargeAtNextMidnight(){create();g.finishIntro(token);g.payFirstRent(token);assertEquals(115,sim().path("cash").asInt());assertThrows(ApiException.class,()->g.payFirstRent(token));now=g.civic.dayAt(g.world(null),2)-1000;sim().put("updatedAt",now);now+=2000;g.getSim(token);assertEquals(115,sim().path("cash").asInt());assertTrue(sim().path("firstDay").path("rent").asBoolean());}
 
 
 @Test void migrationBacksUpBeforeDroppingTestWorldsAndKeepsMainLife()throws Exception{create();sim().put("loc","fox");sim().remove("position");g.navigation.position(sim()).put("room","work:fox").put("x",0).put("z",0);g.store.data.put("schema",1);g.table("worlds").putObject("test").put("id","test");g.table("sims").putObject("test:test").put("worldId","test");g.user(g.session(token,true)).put("passwordHash","obsolete");g.store.save();byte[] before=Files.readAllBytes(g.store.path);var migrated=new JsonStore(m,g.store.path.toString());assertEquals(2,migrated.data.path("schema").asInt());assertEquals(1,migrated.data.path("worlds").size());assertEquals(1,migrated.data.path("sims").size());assertFalse(migrated.data.path("users").elements().next().has("passwordHash"));try(var paths=Files.list(dir)){Path backup=paths.filter(p->p.getFileName().toString().contains("before-v2")).findFirst().orElseThrow();assertArrayEquals(before,Files.readAllBytes(backup));}var again=new GameService(migrated,g.content,m);assertEquals("River O'Neil",again.me(token).path("sim").path("username").asText());JsonNode at=again.getSim(token).path("sim").path("position");assertEquals("theatre:fox",at.path("room").asText());assertTrue(again.navigation.stand("atl",at.path("x").asDouble(),at.path("z").asDouble(),at.path("room").asText()));}
 
}
