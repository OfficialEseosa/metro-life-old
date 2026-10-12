package app.metrolife;

import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.io.TempDir;
import java.nio.file.Path;
import static org.junit.jupiter.api.Assertions.*;

class CoreTests {
    @TempDir Path directory;
    ObjectMapper mapper;
    JsonStore store;
    Content content;
    GameService game;
    long now;
    String token;
    JsonNode json(String text)throws Exception{return mapper.readTree(text);}
    @BeforeEach void setup()throws Exception {
        mapper=new ObjectMapper();store=new JsonStore(mapper,directory.resolve("save.json").toString());content=new Content(mapper);game=new GameService(store,content,mapper);
        now=System.currentTimeMillis();game.time=()->now;
        token=game.guest(null,json("{\"username\":\"Test Neighbor\"}")).token();
    }
    void worldAndSim()throws Exception{ActivityFixture.setup(game,token,json("{\"city\":\"atl\",\"neighborhood\":\"midtown\",\"aspiration\":\"founder\"}"));}
    @Test void profilesAutomaticallyShareOneCityButKeepSeparateLives()throws Exception{
        worldAndSim();String other=game.guest(null,game.object().put("username","Other Neighbor")).token();
        ActivityFixture.setup(game,other,game.object().put("city","atl").put("neighborhood","midtown").put("aspiration","founder"));
        assertEquals("public",game.me(token).path("world").path("id").asText());assertEquals(game.me(token).path("world").path("id"),game.me(other).path("world").path("id"));
        game.sim(game.session(token,true)).put("cash",42);assertEquals(2500,game.getSim(other).path("sim").path("cash").asInt());assertEquals(1,game.table("worlds").size());
    }
    @Test void actionsRejectForgeryWrongCityClosedBusyAndInsufficientCash()throws Exception{
        worldAndSim();
        assertEquals(400,assertThrows(ApiException.class,()->ActivityFixture.act(game,token,json("{\"city\":\"atl\",\"loc\":\"home\",\"action\":\"free-money\"}"))).status);
        assertEquals(403,assertThrows(ApiException.class,()->ActivityFixture.act(game,token,json("{\"city\":\"nyc\",\"loc\":\"home\",\"action\":\"sleep\"}"))).status);
        assertEquals(409,assertThrows(ApiException.class,()->ActivityFixture.act(game,token,json("{\"city\":\"atl\",\"loc\":\"l5p\",\"action\":\"a0\"}"))).status);
        ActivityFixture.act(game,token,json("{\"city\":\"atl\",\"loc\":\"home\",\"action\":\"sleep\"}"));
        assertEquals(409,assertThrows(ApiException.class,()->ActivityFixture.act(game,token,json("{\"city\":\"atl\",\"loc\":\"home\",\"action\":\"sleep\"}"))).status);
        now+=7000;game.sim(game.session(token,true)).put("cash",0);
        assertEquals(402,assertThrows(ApiException.class,()->ActivityFixture.act(game,token,json("{\"city\":\"atl\",\"loc\":\"krog\",\"action\":\"a0\"}"))).status);
        assertEquals(409,assertThrows(ApiException.class,()->ActivityFixture.setup(game,token,json("{\"city\":\"atl\",\"neighborhood\":\"midtown\",\"aspiration\":\"founder\"}"))).status);
    }
    @Test void decayUsesGameTimeCapsOfflineAndDerivesMood()throws Exception{
        worldAndSim();now+=60000;JsonNode sim=game.getSim(token).path("sim");assertEquals(82,sim.path("needs").path("energy").asDouble(),.01);assertEquals(81,sim.path("needs").path("hunger").asDouble(),.01);
        now+=24*3600000;sim=game.getSim(token).path("sim");assertEquals(57,sim.path("needs").path("hunger").asDouble(),.01);assertFalse(sim.path("mood").asText().isBlank());assertEquals(3,sim.path("daily").size());
    }
    @Test void fiveActionsPersistWithSessionsAcrossNewStore()throws Exception{
        worldAndSim();String[] actions={"sleep","cook","shower","invite","cook"};
        for(String action:actions){ActivityFixture.act(game,token,json("{\"city\":\"atl\",\"loc\":\"home\",\"action\":\""+action+"\"}"));now+=7000;}
        JsonNode before=game.getSim(token).path("sim");assertTrue(before.path("skills").path("cooking").path("xp").asInt()>0);assertTrue(before.path("xp").asInt()>0);
        JsonStore reopened=new JsonStore(mapper,directory.resolve("save.json").toString());GameService restarted=new GameService(reopened,content,mapper);restarted.time=()->now;
        assertEquals(before,restarted.getSim(token).path("sim"));assertEquals(game.me(token).path("world"),restarted.me(token).path("world"));
    }
    @Test void canonicalContentExpandsEveryActionAndDefinesCompleteShapes(){
        assertEquals(3,content.world.path("cities").size());assertEquals(8,content.world.path("careers").size());assertEquals(7,content.world.path("aspirations").size());
        for(JsonNode career:content.world.path("careers"))for(JsonNode level:career.path("levels"))assertNotNull(content.landmark(level.path("city").asText(),level.path("loc").asText()));
        for(JsonNode city:content.world.path("cities")){assertEquals(4,city.path("homeActions").size());for(JsonNode loc:city.path("landmarks"))for(JsonNode action:loc.path("actions")){assertTrue(action.has("durationMin"));assertTrue(action.path("needs").isObject());assertFalse(action.path("id").asText().isEmpty());}for(JsonNode n:city.path("neighborhoods"))assertTrue(n.path("rent").asInt()>0);}
    }
    @Test void auditNeedsNamesAndShowerFeedback()throws Exception{
        var anonymous=game.guest(null,json("{}"));assertTrue(anonymous.user().path("username").asText().matches("[A-Za-z]+ [A-Za-z]+(?: [0-9]+)?"));
        worldAndSim();ObjectNode sim=game.sim(game.session(token,true));sim.withObject("needs").put("energy",50).put("fun",50);
        JsonNode result=ActivityFixture.act(game,token,json("{\"city\":\"atl\",\"loc\":\"home\",\"action\":\"shower\"}"));
        assertEquals(50,result.path("sim").path("needs").path("energy").asDouble(),.01);
        now=result.path("sim").path("busyUntil").asLong();JsonNode completed=game.getSim(token).path("sim");
        assertEquals(68,completed.path("needs").path("energy").asDouble(),.2);assertEquals(62,completed.path("needs").path("fun").asDouble(),.2);
        assertTrue(result.path("result").path("text").asText().contains("Energy +18"));assertTrue(result.path("result").path("text").asText().contains("Fun +12"));
        now+=12345;JsonNode rounded=game.getSim(token).path("sim").path("needs");for(String need:Content.NEEDS)assertEquals(Math.round(rounded.path(need).asDouble()*10),rounded.path(need).asDouble()*10,.00001);
    }
    @Test void travelCostsCashArrivesAtAirportAndKeepsHomeAndWorld()throws Exception{
        worldAndSim();JsonNode before=game.getSim(token).path("sim");
        assertEquals(403,assertThrows(ApiException.class,()->ActivityFixture.act(game,token,json("{\"city\":\"nyc\",\"loc\":\"nycAirport\",\"action\":\"a0\"}"))).status);
        JsonNode flight=ActivityFixture.act(game,token,json("{\"city\":\"atl\",\"loc\":\"atlAirport\",\"action\":\"a0\"}"));
        assertEquals("atl",flight.path("sim").path("city").asText());assertEquals(2500,flight.path("sim").path("cash").asInt());
        assertEquals(409,assertThrows(ApiException.class,()->ActivityFixture.apply(game,token,json("{\"jobId\":\"nyc-tech-1\"}"))).status);now+=7000;flight=game.getSim(token);
        assertEquals("nyc",flight.path("sim").path("city").asText());assertEquals("nycAirport",flight.path("sim").path("loc").asText());assertEquals(2320,flight.path("sim").path("cash").asInt());assertEquals(before.path("home"),flight.path("sim").path("home"));assertEquals(before.path("worldId"),flight.path("sim").path("worldId"));
        assertEquals(403,assertThrows(ApiException.class,()->ActivityFixture.act(game,token,json("{\"city\":\"nyc\",\"loc\":\"home\",\"action\":\"sleep\"}"))).status);
        assertEquals(40,game.jobs(token,"nyc").path("jobs").size());game.sim(game.session(token,true)).put("loc","dumbo");assertEquals("dumbo",ActivityFixture.apply(game,token,json("{\"jobId\":\"nyc-tech-1\"}")).path("sim").path("job").path("loc").asText());game.quitJob(token);
        ActivityFixture.act(game,token,json("{\"city\":\"nyc\",\"loc\":\"nycAirport\",\"action\":\"a1\"}"));now+=7000;assertEquals("bayAirport",game.getSim(token).path("sim").path("loc").asText());
        game.sim(game.session(token,true)).put("cash",0);assertEquals(402,assertThrows(ApiException.class,()->ActivityFixture.act(game,token,json("{\"city\":\"bay\",\"loc\":\"bayAirport\",\"action\":\"a0\"}"))).status);
        for(String city:new String[]{"atl","nyc","bay"})for(String track:Content.TRACKS)assertNotNull(content.landmark(city,Content.workplace(city,track)));
    }
    @Test void jobShiftRequiresHiringAndPaysAuthoritativeRate()throws Exception{
        worldAndSim();assertEquals(40,game.jobs(token,"atl").path("jobs").size());
        assertEquals(403,assertThrows(ApiException.class,()->ActivityFixture.act(game,token,json("{\"city\":\"atl\",\"loc\":\"techVillage\",\"action\":\"shift-tech\"}"))).status);
        assertEquals(403,assertThrows(ApiException.class,()->ActivityFixture.apply(game,token,json("{\"jobId\":\"tech-5\"}"))).status);
        assertEquals(404,assertThrows(ApiException.class,()->ActivityFixture.apply(game,token,json("{\"jobId\":\"forged\"}"))).status);
        game.sim(game.session(token,true)).put("loc","techVillage");JsonNode hired=ActivityFixture.apply(game,token,json("{\"jobId\":\"tech-1\"}"));assertTrue(hired.path("hired").asBoolean());assertEquals("techVillage",hired.path("sim").path("loc").asText());
        JsonNode shift=ActivityFixture.act(game,token,json("{\"city\":\"atl\",\"loc\":\"techVillage\",\"action\":\"shift-tech\"}"));assertEquals(2500,shift.path("sim").path("cash").asInt());assertEquals(0,shift.path("sim").path("job").path("shifts").asInt());
        assertEquals(409,assertThrows(ApiException.class,()->game.quitJob(token)).status);now+=7000;JsonNode paid=game.getSim(token).path("sim");assertEquals(2575,paid.path("cash").asInt());assertEquals(1,paid.path("job").path("shifts").asInt());assertTrue(game.quitJob(token).path("sim").path("job").isNull());
        long healthShifts=java.util.stream.StreamSupport.stream(content.landmark("atl","grady").path("actions").spliterator(),false).filter(a->a.path("label").asText().equals("Work a shift")).count();assertEquals(1,healthShifts);
        game.sim(game.session(token,true)).put("loc","grady");ActivityFixture.apply(game,token,json("{\"jobId\":\"health-1\"}"));JsonNode care=ActivityFixture.act(game,token,json("{\"city\":\"atl\",\"loc\":\"grady\",\"action\":\"a2\"}"));assertEquals(70,care.path("result").path("deltas").path("cash").asInt());
    }
    @Test void acceptedActivitySettlesOnceAtDeadlineAndSurvivesRestart()throws Exception{
        worldAndSim();game.sim(game.session(token,true)).put("loc","techVillage");ActivityFixture.apply(game,token,json("{\"jobId\":\"tech-1\"}"));
        JsonNode started=ActivityFixture.act(game,token,json("{\"city\":\"atl\",\"loc\":\"techVillage\",\"action\":\"shift-tech\",\"pay\":999999}"));
        long end=started.path("sim").path("busyUntil").asLong();assertFalse(started.path("sim").has("_pendingAction"));
        now=end-1;assertEquals(2500,game.getSim(token).path("sim").path("cash").asInt());
        JsonStore reopened=new JsonStore(mapper,directory.resolve("save.json").toString());GameService restarted=new GameService(reopened,content,mapper);restarted.time=()->now;
        assertEquals(2500,restarted.getSim(token).path("sim").path("cash").asInt());now=end;
        JsonNode completed=restarted.getSim(token).path("sim");assertEquals(2575,completed.path("cash").asInt());assertTrue(completed.path("busyUntil").isNull());assertEquals(1,completed.path("job").path("shifts").asInt());
        assertEquals(2575,restarted.getSim(token).path("sim").path("cash").asInt());
        assertFalse(restarted.sim(restarted.session(token,true)).has("_pendingAction"));
        assertEquals(75,completed.path("moneyToday").path("income").asInt());assertEquals(0,completed.path("moneyToday").path("spent").asInt());
        JsonNode cooking=ActivityFixture.act(restarted,token,json("{\"city\":\"atl\",\"loc\":\"home\",\"action\":\"cook\"}"));now=cooking.path("sim").path("busyUntil").asLong();
        JsonNode meal=restarted.getSim(token).path("sim");assertEquals(80,meal.path("moneyToday").path("income").asInt());assertEquals(0,meal.path("moneyToday").path("spent").asInt());
        now+=24*60000;JsonNode nextDay=restarted.getSim(token).path("sim");assertEquals(0,nextDay.path("moneyToday").path("income").asInt());assertEquals(0,nextDay.path("moneyToday").path("spent").asInt()); // Offline window ends before midnight; rent is capped with needs.
    }
    @Test void criticalNeedsBlockWorkAndLowMoodPayStillSettlesAtCompletion()throws Exception{
        worldAndSim();game.sim(game.session(token,true)).put("loc","techVillage");ActivityFixture.apply(game,token,json("{\"jobId\":\"tech-1\"}"));ObjectNode s=game.sim(game.session(token,true));s.withObject("needs").put("energy",0);
        assertEquals(409,assertThrows(ApiException.class,()->ActivityFixture.act(game,token,json("{\"city\":\"atl\",\"loc\":\"techVillage\",\"action\":\"shift-tech\"}"))).status);
        s.withObject("needs").put("energy",10);JsonNode started=ActivityFixture.act(game,token,json("{\"city\":\"atl\",\"loc\":\"techVillage\",\"action\":\"shift-tech\"}"));
        assertEquals(2500,started.path("sim").path("cash").asInt());assertEquals(54,started.path("result").path("deltas").path("cash").asInt());now=started.path("sim").path("busyUntil").asLong();assertEquals(2554,game.getSim(token).path("sim").path("cash").asInt());
    }
    @Test void actionAcrossMidnightPaysTodaysLedgerWithoutRestoringOldDailyGoals()throws Exception{
        worldAndSim();now+=15*60000-1000;JsonNode started=ActivityFixture.act(game,token,json("{\"city\":\"atl\",\"loc\":\"home\",\"action\":\"cook\"}"));long end=started.path("sim").path("busyUntil").asLong();
        now+=1200;JsonNode midnight=game.getSim(token).path("sim");assertEquals(2435,midnight.path("cash").asInt());
        now=end;JsonNode paid=game.getSim(token).path("sim");assertEquals(2440,paid.path("cash").asInt());assertEquals(5,paid.path("moneyToday").path("income").asInt());assertEquals(65,paid.path("moneyToday").path("spent").asInt());
        for(JsonNode goal:paid.path("daily"))assertFalse(goal.path("done").asBoolean());
    }
}
