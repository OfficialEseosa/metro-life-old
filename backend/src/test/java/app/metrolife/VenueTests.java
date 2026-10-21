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
 void station(String type,String id){for(JsonNode row:g.navigation.layout(sim().path("city").asText(),type).path("stations"))if(row.path("id").asText().equals(id))g.navigation.position(sim()).put("x",row.path("x").asDouble()).put("z",row.path("z").asDouble());}
 @Test void cafeMealRequiresRoomAndCounterAndSettlesOnlyOnCompletion(){arrive("krog");assertThrows(ApiException.class,()->act("krog","a0"));enter("krog");assertEquals("cafe:krog",sim().path("position").path("room").asText());assertThrows(ApiException.class,()->act("krog","a0"));station("cafe","counter");double cash=sim().path("cash").asDouble();ObjectNode r=act("krog","a0");assertEquals(cash,sim().path("cash").asDouble());assertEquals("food",sim().path("busyKind").asText());now=r.path("sim").path("busyUntil").asLong();assertTrue(g.getSim(token).path("sim").path("needs").path("hunger").asDouble()>90);assertFalse(sim().path("cash").asDouble()==cash);}
 @Test void clubLobbyIsSharedButClosedActivitiesAreRefused(){arrive("l5p");enter("l5p");assertEquals("club:l5p",sim().path("position").path("room").asText());station("club","dance");assertEquals(409,assertThrows(ApiException.class,()->act("l5p","a0")).status);now+=8*60000;g.decay(sim(),g.world(g.session(token,true)));assertNotNull(act("l5p","a0").path("result"));assertEquals("fun",sim().path("busyKind").asText());
 {
now=sim().path("busyUntil").asLong();g.getSim(token);station("club","dance");String performance="";for(JsonNode a:g.content.landmark("atl","l5p").path("actions"))if(a.path("kind").asText().equals("work")&&!a.path("requires").has("job"))performance=a.path("id").asText();final String id=performance;assertFalse(id.isEmpty());assertThrows(ApiException.class,()->act("l5p",id));station("club","stage");act("l5p",id);assertEquals("work",sim().path("busyKind").asText());
 }
}
 
 
 @Test void cafeWorkplaceRetainsItsDesk(){sim().put("city","nyc").put("loc","chinatown");sim().remove("position");enter("chinatown");assertEquals("cafe:chinatown",sim().path("position").path("room").asText());assertThrows(ApiException.class,()->g.applyJob(token,g.object().put("jobId","nyc-food-1")));station("cafe","desk");assertTrue(g.applyJob(token,g.object().put("jobId","nyc-food-1")).path("hired").asBoolean());}
 
 @Test void publicSeatsAreReservedWithoutOverlappingHumans(){
  arrive("krog");enter("krog");station("cafe","table");act("krog","a0");String first=sim().path("activitySlot").path("id").asText();
  String other=g.guest(null,g.object()).token();ActivityFixture.setup(g,other,g.object().put("city","atl").put("neighborhood","midtown").put("aspiration","founder"));ActivityFixture.act(g,other,g.object().put("city","atl").put("loc","krog").put("action","a0"));assertNotEquals(first,g.sim(g.session(other,true)).path("activitySlot").path("id").asText());
  String third=g.guest(null,g.object()).token();ActivityFixture.setup(g,third,g.object().put("city","atl").put("neighborhood","midtown").put("aspiration","founder"));assertEquals(409,assertThrows(ApiException.class,()->ActivityFixture.act(g,third,g.object().put("city","atl").put("loc","krog").put("action","a0"))).status);
 }
 
 @Test void parkSeatingRejectsRemoteAndForgedSeatsAndClearsOnMovement(){
  assertEquals(400,assertThrows(ApiException.class,()->g.posture(token,g.object().put("bench","invented"))).status);var parks=g.residentMotion.data.path("cities").path("atl").path("parks").fields();var park=parks.next();JsonNode bench=park.getValue().path("benches").get(0);String id=park.getKey()+":0";
  assertEquals(409,assertThrows(ApiException.class,()->g.posture(token,g.object().put("bench",id))).status);ObjectNode p=g.navigation.position(sim());p.putNull("room").put("x",bench.get(0).asDouble()).put("z",bench.get(1).asDouble());double cash=sim().path("cash").asDouble();assertTrue(g.posture(token,g.object().put("bench",id)).path("sim").path("activitySlot").path("bench").asBoolean());assertEquals(cash,sim().path("cash").asDouble());g.movePosition(token,g.object().put("city","atl").put("x",p.path("x").asDouble()).put("z",p.path("z").asDouble()+.1).put("face",0));assertTrue(sim().path("activitySlot").isNull());
 
 {

  var rejoinParks=g.residentMotion.data.path("cities").path("atl").path("parks").fields();var rejoinPark=rejoinParks.next();JsonNode rejoinBench=rejoinPark.getValue().path("benches").get(0);String rejoinBenchId=rejoinPark.getKey()+":0",wid=sim().path("worldId").asText(),uid=sim().path("userId").asText();ObjectNode at=g.navigation.position(sim());at.putNull("room").put("x",rejoinBench.get(0).asDouble()).put("z",rejoinBench.get(1).asDouble());g.community.online.put(wid+":"+uid,now);g.posture(token,g.object().put("bench",rejoinBenchId));
  assertEquals(rejoinBenchId,g.me(token).path("sim").path("activitySlot").path("id").asText());now+=13000;
  String other=g.guest(null,g.object()).token();ActivityFixture.setup(g,other,g.object().put("city","atl").put("neighborhood","midtown").put("aspiration","founder"));ObjectNode next=g.sim(g.session(other,true));g.navigation.position(next).putNull("room").put("x",rejoinBench.get(0).asDouble()).put("z",rejoinBench.get(1).asDouble());g.community.online.put(wid+":"+next.path("userId").asText(),now);g.posture(other,g.object().put("bench",rejoinBenchId));
  assertTrue(g.me(token).path("sim").path("activitySlot").isNull());assertTrue(g.getSim(token).path("sim").path("activitySlot").isNull());assertEquals(rejoinBenchId,next.path("activitySlot").path("id").asText());
 
 }
}
 
 @Test void multipleHumansCanDanceTogetherWithoutSharingTheSameSlot(){
  now+=8*60000;java.util.Set<String> slots=new java.util.HashSet<>();for(int i=0;i<3;i++){String person=g.guest(null,g.object()).token();ActivityFixture.setup(g,person,g.object().put("city","atl").put("neighborhood","midtown").put("aspiration","founder"));ObjectNode r=ActivityFixture.act(g,person,g.object().put("city","atl").put("loc","l5p").put("action","a0"));assertEquals("Dance",r.path("sim").path("activitySlot").path("pose").asText());assertTrue(slots.add(r.path("sim").path("activitySlot").path("id").asText()));}
 }
 

}
