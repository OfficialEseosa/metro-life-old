package app.metrolife;
import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.io.TempDir;
import java.nio.file.Path;
import static org.junit.jupiter.api.Assertions.*;

class VenueTests {
 @TempDir Path dir;GameService g;String token;long now=1000000000;
 ObjectNode sim(){return g.sim(g.session(token,true));}
 @BeforeEach void setup()throws Exception{ObjectMapper m=new ObjectMapper();g=new GameService(new JsonStore(m,dir.resolve("save.json").toString()),new Content(m),m);g.time=()->now;token=g.guest(null,g.object()).token();ActivityFixture.setup(g,token,g.object().put("city","atl").put("neighborhood","midtown").put("aspiration","founder"));}
 void arrive(String loc){sim().put("loc",loc);sim().remove("position");g.navigation.position(sim());}
 void enter(String loc){g.door(token,g.object().put("loc",loc).put("enter",true));}
 ObjectNode act(String loc,String action){return g.act(token,g.object().put("city",sim().path("city").asText()).put("loc",loc).put("action",action));}
 void station(String type,String id){for(JsonNode row:g.navigation.interiors.path(type).path("stations"))if(row.path("id").asText().equals(id))g.navigation.position(sim()).put("x",row.path("x").asDouble()).put("z",row.path("z").asDouble());}
 @Test void cafeMealRequiresRoomAndCounterAndSettlesOnlyOnCompletion(){arrive("krog");assertThrows(ApiException.class,()->act("krog","a0"));enter("krog");assertEquals("cafe:krog",sim().path("position").path("room").asText());assertThrows(ApiException.class,()->act("krog","a0"));station("cafe","counter");double cash=sim().path("cash").asDouble();ObjectNode r=act("krog","a0");assertEquals(cash,sim().path("cash").asDouble());assertEquals("food",sim().path("busyKind").asText());now=r.path("sim").path("busyUntil").asLong();assertTrue(g.getSim(token).path("sim").path("needs").path("hunger").asDouble()>90);assertFalse(sim().path("cash").asDouble()==cash);}
 @Test void clubLobbyIsSharedButClosedActivitiesAreRefused(){arrive("l5p");enter("l5p");assertEquals("club:l5p",sim().path("position").path("room").asText());station("club","dance");assertEquals(409,assertThrows(ApiException.class,()->act("l5p","a0")).status);now+=8*60000;g.decay(sim(),g.world(g.session(token,true)));assertNotNull(act("l5p","a0").path("result"));assertEquals("fun",sim().path("busyKind").asText());}
 @Test void performanceRequiresTheStage(){now+=8*60000;arrive("l5p");enter("l5p");station("club","dance");String performance="";for(JsonNode a:g.content.landmark("atl","l5p").path("actions"))if(a.path("kind").asText().equals("work")&&!a.path("requires").has("job"))performance=a.path("id").asText();final String id=performance;assertFalse(id.isEmpty());assertThrows(ApiException.class,()->act("l5p",id));station("club","stage");act("l5p",id);assertEquals("work",sim().path("busyKind").asText());}
 @Test void socialRequiresSameRoomAndWalkingDistance(){arrive("l5p");enter("l5p");String friend=g.guest(null,g.object()).token();ActivityFixture.setup(g,friend,g.object().put("city","atl").put("neighborhood","midtown").put("aspiration","founder"));ObjectNode t=g.sim(g.session(friend,true));t.put("loc","l5p");t.remove("position");g.navigation.position(t);String uid=t.path("userId").asText();g.community.online.put(t.path("worldId").asText()+":"+uid,now);ObjectNode request=g.object().put("targetId",uid).put("kind","wave");assertThrows(ApiException.class,()->g.social(token,request));g.door(friend,g.object().put("loc","l5p").put("enter",true));g.navigation.position(t).put("x",4).put("z",-2);assertThrows(ApiException.class,()->g.social(token,request));g.navigation.position(t).put("x",1).put("z",3.7);assertTrue(g.social(token,request).path("text").asText().contains(t.path("username").asText()));}
 @Test void cafeWorkplaceRetainsItsDesk(){sim().put("city","nyc").put("loc","chinatown");sim().remove("position");enter("chinatown");assertEquals("cafe:chinatown",sim().path("position").path("room").asText());assertThrows(ApiException.class,()->g.applyJob(token,g.object().put("jobId","nyc-food-1")));station("cafe","desk");assertTrue(g.applyJob(token,g.object().put("jobId","nyc-food-1")).path("hired").asBoolean());}
}
