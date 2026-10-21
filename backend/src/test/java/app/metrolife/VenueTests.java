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
 @Test void clubLobbyIsSharedButClosedActivitiesAreRefused(){arrive("l5p");enter("l5p");assertEquals("club:l5p",sim().path("position").path("room").asText());station("club","dance");assertEquals(409,assertThrows(ApiException.class,()->act("l5p","a0")).status);now+=8*60000;g.decay(sim(),g.world(g.session(token,true)));assertNotNull(act("l5p","a0").path("result"));assertEquals("fun",sim().path("busyKind").asText());}
 @Test void performanceRequiresTheStage(){now+=8*60000;arrive("l5p");enter("l5p");station("club","dance");String performance="";for(JsonNode a:g.content.landmark("atl","l5p").path("actions"))if(a.path("kind").asText().equals("work")&&!a.path("requires").has("job"))performance=a.path("id").asText();final String id=performance;assertFalse(id.isEmpty());assertThrows(ApiException.class,()->act("l5p",id));station("club","stage");act("l5p",id);assertEquals("work",sim().path("busyKind").asText());}
 @Test void socialRequiresSameRoomAndWalkingDistance(){arrive("l5p");enter("l5p");String friend=g.guest(null,g.object()).token();ActivityFixture.setup(g,friend,g.object().put("city","atl").put("neighborhood","midtown").put("aspiration","founder"));ObjectNode t=g.sim(g.session(friend,true));t.put("loc","l5p");t.remove("position");g.navigation.position(t);String uid=t.path("userId").asText();g.community.online.put(t.path("worldId").asText()+":"+uid,now);ObjectNode request=g.object().put("targetId",uid).put("kind","wave");assertThrows(ApiException.class,()->g.social(token,request));g.door(friend,g.object().put("loc","l5p").put("enter",true));g.navigation.position(t).put("x",4).put("z",-2);assertThrows(ApiException.class,()->g.social(token,request));g.navigation.position(t).put("x",1).put("z",3.7);assertTrue(g.social(token,request).path("text").asText().contains(t.path("username").asText()));}
 @Test void cafeWorkplaceRetainsItsDesk(){sim().put("city","nyc").put("loc","chinatown");sim().remove("position");enter("chinatown");assertEquals("cafe:chinatown",sim().path("position").path("room").asText());assertThrows(ApiException.class,()->g.applyJob(token,g.object().put("jobId","nyc-food-1")));station("cafe","desk");assertTrue(g.applyJob(token,g.object().put("jobId","nyc-food-1")).path("hired").asBoolean());}
 @Test void activitySlotsAreAuthoritativePersistAndClearAtCompletion()throws Exception{
  arrive("home");enter("home");station("home","bed");double x=sim().path("position").path("x").asDouble();ObjectNode r=act("home","sleep");assertEquals("Sleep",r.path("sim").path("activitySlot").path("pose").asText());assertEquals(x,sim().path("position").path("x").asDouble());
  var mapper=new ObjectMapper();var restart=new GameService(new JsonStore(mapper,dir.resolve("save.json").toString()),new Content(mapper),mapper);restart.time=()->now;assertEquals("bed",restart.getSim(token).path("sim").path("activitySlot").path("id").asText());now=sim().path("busyUntil").asLong();assertTrue(g.getSim(token).path("sim").path("activitySlot").isNull());
 }
 @Test void publicSeatsAreReservedWithoutOverlappingHumans(){
  arrive("krog");enter("krog");station("cafe","table");act("krog","a0");String first=sim().path("activitySlot").path("id").asText();
  String other=g.guest(null,g.object()).token();ActivityFixture.setup(g,other,g.object().put("city","atl").put("neighborhood","midtown").put("aspiration","founder"));ActivityFixture.act(g,other,g.object().put("city","atl").put("loc","krog").put("action","a0"));assertNotEquals(first,g.sim(g.session(other,true)).path("activitySlot").path("id").asText());
  String third=g.guest(null,g.object()).token();ActivityFixture.setup(g,third,g.object().put("city","atl").put("neighborhood","midtown").put("aspiration","founder"));assertEquals(409,assertThrows(ApiException.class,()->ActivityFixture.act(g,third,g.object().put("city","atl").put("loc","krog").put("action","a0"))).status);
 }
 @Test void allCityApproachesAndFurnitureUseTheSameLayout(){
  for(String city:new String[]{"atl","nyc","bay"})for(String type:new String[]{"home","work","cafe","club"}){JsonNode layout=g.navigation.layout(city,type);assertTrue(layout.path("furniture").size()>0);for(JsonNode row:layout.path("stations"))assertTrue(g.navigation.stand(city,row.path("x").asDouble(),row.path("z").asDouble(),type+":test"),city+" "+type+" "+row.path("id").asText());}
 }
 @Test void parkSeatingRejectsRemoteAndForgedSeatsAndClearsOnMovement(){
  assertEquals(400,assertThrows(ApiException.class,()->g.posture(token,g.object().put("bench","invented"))).status);var parks=g.residentMotion.data.path("cities").path("atl").path("parks").fields();var park=parks.next();JsonNode bench=park.getValue().path("benches").get(0);String id=park.getKey()+":0";
  assertEquals(409,assertThrows(ApiException.class,()->g.posture(token,g.object().put("bench",id))).status);ObjectNode p=g.navigation.position(sim());p.putNull("room").put("x",bench.get(0).asDouble()).put("z",bench.get(1).asDouble());double cash=sim().path("cash").asDouble();assertTrue(g.posture(token,g.object().put("bench",id)).path("sim").path("activitySlot").path("bench").asBoolean());assertEquals(cash,sim().path("cash").asDouble());g.movePosition(token,g.object().put("city","atl").put("x",p.path("x").asDouble()).put("z",p.path("z").asDouble()+.1).put("face",0));assertTrue(sim().path("activitySlot").isNull());
 }
 @Test void changedRoomLayoutsReturnAnOldBlockedSaveToItsDoor()throws Exception{
  sim().put("city","nyc").put("loc","home");sim().withObject("home").put("city","nyc");sim().remove("position");g.navigation.position(sim()).put("room","home:"+sim().path("userId").asText()).put("x",-2.25).put("z",-1.65);g.checkpoint();ObjectMapper mapper=new ObjectMapper();var restarted=new GameService(new JsonStore(mapper,dir.resolve("save.json").toString()),new Content(mapper),mapper);restarted.time=()->now;JsonNode p=restarted.getSim(token).path("sim").path("position");assertEquals(0,p.path("x").asDouble());assertEquals(2.3,p.path("z").asDouble());assertTrue(restarted.navigation.stand("nyc",p.path("x").asDouble(),p.path("z").asDouble(),p.path("room").asText()));
 }
 @Test void multipleHumansCanDanceTogetherWithoutSharingTheSameSlot(){
  now+=8*60000;java.util.Set<String> slots=new java.util.HashSet<>();for(int i=0;i<3;i++){String person=g.guest(null,g.object()).token();ActivityFixture.setup(g,person,g.object().put("city","atl").put("neighborhood","midtown").put("aspiration","founder"));ObjectNode r=ActivityFixture.act(g,person,g.object().put("city","atl").put("loc","l5p").put("action","a0"));assertEquals("Dance",r.path("sim").path("activitySlot").path("pose").asText());assertTrue(slots.add(r.path("sim").path("activitySlot").path("id").asText()));}
 }
 @Test void expiredBenchPostureIsReleasedBeforeRejoiningPresence(){
  var parks=g.residentMotion.data.path("cities").path("atl").path("parks").fields();var park=parks.next();JsonNode bench=park.getValue().path("benches").get(0);String id=park.getKey()+":0",wid=sim().path("worldId").asText(),uid=sim().path("userId").asText();ObjectNode at=g.navigation.position(sim());at.putNull("room").put("x",bench.get(0).asDouble()).put("z",bench.get(1).asDouble());g.community.online.put(wid+":"+uid,now);g.posture(token,g.object().put("bench",id));
  assertEquals(id,g.me(token).path("sim").path("activitySlot").path("id").asText());now+=13000;
  String other=g.guest(null,g.object()).token();ActivityFixture.setup(g,other,g.object().put("city","atl").put("neighborhood","midtown").put("aspiration","founder"));ObjectNode next=g.sim(g.session(other,true));g.navigation.position(next).putNull("room").put("x",bench.get(0).asDouble()).put("z",bench.get(1).asDouble());g.community.online.put(wid+":"+next.path("userId").asText(),now);g.posture(other,g.object().put("bench",id));
  assertTrue(g.me(token).path("sim").path("activitySlot").isNull());assertTrue(g.getSim(token).path("sim").path("activitySlot").isNull());assertEquals(id,next.path("activitySlot").path("id").asText());
 }

}
