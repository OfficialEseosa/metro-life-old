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
    @Test void criticalNeedsAllowWorkWithReducedPaySettledAtCompletion()throws Exception{
        worldAndSim();game.sim(game.session(token,true)).put("loc","techVillage");ActivityFixture.apply(game,token,json("{\"jobId\":\"tech-1\"}"));ObjectNode s=game.sim(game.session(token,true));s.withObject("needs").put("energy",0);
        long acceptedAt=now;JsonNode started=ActivityFixture.act(game,token,json("{\"city\":\"atl\",\"loc\":\"techVillage\",\"action\":\"shift-tech\"}"));
        assertEquals(25000,started.path("sim").path("busyUntil").asLong()-acceptedAt);
        assertEquals(2500,started.path("sim").path("cash").asInt());assertEquals(54,started.path("result").path("deltas").path("cash").asInt());now=started.path("sim").path("busyUntil").asLong();assertEquals(2554,game.getSim(token).path("sim").path("cash").asInt());
    }
    @Test void actionAcrossMidnightPaysTodaysLedgerWithoutRestoringOldDailyGoals()throws Exception{
        worldAndSim();now+=15*60000-1000;JsonNode started=ActivityFixture.act(game,token,json("{\"city\":\"atl\",\"loc\":\"home\",\"action\":\"cook\"}"));long end=started.path("sim").path("busyUntil").asLong();
        now+=1200;JsonNode midnight=game.getSim(token).path("sim");assertEquals(2465,midnight.path("cash").asInt());
        now=end;JsonNode paid=game.getSim(token).path("sim");assertEquals(2470,paid.path("cash").asInt());assertEquals(5,paid.path("moneyToday").path("income").asInt());assertEquals(35,paid.path("moneyToday").path("spent").asInt());
        for(JsonNode goal:paid.path("daily"))assertFalse(goal.path("done").asBoolean());
    }
}
