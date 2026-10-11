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
    void worldAndSim()throws Exception{game.createWorld(token,json("{\"name\":\"My life\",\"mode\":\"solo\"}"));game.setup(token,json("{\"city\":\"atl\",\"neighborhood\":\"midtown\",\"aspiration\":\"founder\"}"));}
    @Test void guestUpgradeLoginLogoutAndPasswordProtection()throws Exception{
        worldAndSim();String uid=game.me(token).path("user").path("id").asText(),wid=game.me(token).path("world").path("id").asText();
        var upgraded=game.signup(token,json("{\"username\":\"Permanent Neighbor\",\"password\":\"very good password\"}"));
        assertEquals(uid,upgraded.user().path("id").asText());assertFalse(upgraded.user().has("passwordHash"));assertFalse(upgraded.user().path("guest").asBoolean());assertNull(game.session(token,false));
        assertEquals(2500,game.getSim(upgraded.token()).path("sim").path("cash").asInt());
        game.logout(upgraded.token());assertNull(game.session(upgraded.token(),false));
        assertEquals(401,assertThrows(ApiException.class,()->game.login(null,json("{\"username\":\"Permanent Neighbor\",\"password\":\"wrong\"}"))).status);
        var login=game.login(null,json("{\"username\":\"Permanent Neighbor\",\"password\":\"very good password\"}"));assertEquals(wid,game.me(login.token()).path("world").path("id").asText());
        assertTrue(store.data.path("users").path(uid).path("passwordHash").asText().startsWith("210000:"));
    }
    @Test void worldsAreIsolatedAndSoloCannotBeJoined()throws Exception{
        worldAndSim();String solo=game.me(token).path("world").path("id").asText();
        String other=game.guest(null,json("{\"username\":\"Other Neighbor\"}")).token();
        assertEquals(403,assertThrows(ApiException.class,()->game.selectWorld(other,json("{\"worldId\":\""+solo+"\"}"))).status);
        var privateWorld=game.createWorld(token,json("{\"name\":\"Friends\",\"mode\":\"private\"}"));String code=privateWorld.path("world").path("code").asText();
        game.joinWorld(other,json("{\"code\":\""+code.toLowerCase()+"\"}"));assertTrue(game.me(other).path("sim").isNull());
        game.setup(other,json("{\"city\":\"atl\",\"neighborhood\":\"midtown\",\"aspiration\":\"founder\"}"));assertEquals(2500,game.getSim(other).path("sim").path("cash").asInt());
        game.selectWorld(token,json("{\"worldId\":\""+solo+"\"}"));assertEquals(2500,game.getSim(token).path("sim").path("cash").asInt());
        assertEquals(2,game.worlds(other).path("worlds").size());
    }
    @Test void actionsRejectForgeryWrongCityClosedBusyAndInsufficientCash()throws Exception{
        worldAndSim();
        assertEquals(400,assertThrows(ApiException.class,()->game.act(token,json("{\"city\":\"atl\",\"loc\":\"home\",\"action\":\"free-money\"}"))).status);
        assertEquals(403,assertThrows(ApiException.class,()->game.act(token,json("{\"city\":\"nyc\",\"loc\":\"home\",\"action\":\"sleep\"}"))).status);
        assertEquals(409,assertThrows(ApiException.class,()->game.act(token,json("{\"city\":\"atl\",\"loc\":\"fox\",\"action\":\"a0\"}"))).status);
        game.act(token,json("{\"city\":\"atl\",\"loc\":\"home\",\"action\":\"sleep\"}"));
        assertEquals(409,assertThrows(ApiException.class,()->game.act(token,json("{\"city\":\"atl\",\"loc\":\"home\",\"action\":\"sleep\"}"))).status);
        now+=7000;game.sim(game.session(token,true)).put("cash",0);
        assertEquals(402,assertThrows(ApiException.class,()->game.act(token,json("{\"city\":\"atl\",\"loc\":\"home\",\"action\":\"cook\"}"))).status);
        assertEquals(409,assertThrows(ApiException.class,()->game.setup(token,json("{\"city\":\"atl\",\"neighborhood\":\"midtown\",\"aspiration\":\"founder\"}"))).status);
    }
    @Test void decayUsesGameTimeCapsOfflineAndDerivesMood()throws Exception{
        worldAndSim();now+=60000;JsonNode sim=game.getSim(token).path("sim");assertEquals(82,sim.path("needs").path("energy").asDouble(),.01);assertEquals(81,sim.path("needs").path("hunger").asDouble(),.01);
        now+=24*3600000;sim=game.getSim(token).path("sim");assertEquals(57,sim.path("needs").path("hunger").asDouble(),.01);assertFalse(sim.path("mood").asText().isBlank());assertEquals(3,sim.path("daily").size());
    }
    @Test void fiveActionsPersistWithSessionsAcrossNewStore()throws Exception{
        worldAndSim();String[] actions={"sleep","cook","shower","invite","cook"};
        for(String action:actions){game.act(token,json("{\"city\":\"atl\",\"loc\":\"home\",\"action\":\""+action+"\"}"));now+=7000;}
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
        JsonNode result=game.act(token,json("{\"city\":\"atl\",\"loc\":\"home\",\"action\":\"shower\"}"));
        assertEquals(68,result.path("sim").path("needs").path("energy").asDouble(),.01);assertEquals(62,result.path("sim").path("needs").path("fun").asDouble(),.01);
        assertTrue(result.path("result").path("text").asText().contains("Energy +18"));assertTrue(result.path("result").path("text").asText().contains("Fun +12"));
        now+=12345;JsonNode rounded=game.getSim(token).path("sim").path("needs");for(String need:Content.NEEDS)assertEquals(Math.round(rounded.path(need).asDouble()*10),rounded.path(need).asDouble()*10,.00001);
    }
    @Test void jobShiftRequiresHiringAndPaysAuthoritativeRate()throws Exception{
        worldAndSim();assertEquals(40,game.jobs(token,"atl").path("jobs").size());
        assertEquals(403,assertThrows(ApiException.class,()->game.act(token,json("{\"city\":\"atl\",\"loc\":\"techVillage\",\"action\":\"shift-tech\"}"))).status);
        assertEquals(403,assertThrows(ApiException.class,()->game.applyJob(token,json("{\"jobId\":\"tech-5\"}"))).status);
        assertEquals(404,assertThrows(ApiException.class,()->game.applyJob(token,json("{\"jobId\":\"forged\"}"))).status);
        JsonNode hired=game.applyJob(token,json("{\"jobId\":\"tech-1\"}"));assertTrue(hired.path("hired").asBoolean());assertEquals("techVillage",hired.path("sim").path("loc").asText());
        JsonNode shift=game.act(token,json("{\"city\":\"atl\",\"loc\":\"techVillage\",\"action\":\"shift-tech\"}"));assertEquals(2665,shift.path("sim").path("cash").asInt());assertEquals(1,shift.path("sim").path("job").path("shifts").asInt());
        assertEquals(409,assertThrows(ApiException.class,()->game.quitJob(token)).status);now+=7000;assertTrue(game.quitJob(token).path("sim").path("job").isNull());
        long healthShifts=java.util.stream.StreamSupport.stream(content.landmark("atl","grady").path("actions").spliterator(),false).filter(a->a.path("label").asText().equals("Work a shift")).count();assertEquals(1,healthShifts);
        game.applyJob(token,json("{\"jobId\":\"health-1\"}"));JsonNode care=game.act(token,json("{\"city\":\"atl\",\"loc\":\"grady\",\"action\":\"a2\"}"));assertEquals(120,care.path("result").path("deltas").path("cash").asInt());
    }
}
