package app.metrolife;

import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import java.nio.file.Path;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class RequestedSlotTests {
 @TempDir Path dir;final ObjectMapper mapper=new ObjectMapper();GameService g;String token;long now=1_800_000_000_000L;
 ObjectNode sim(String token){return g.sim(g.session(token,true));}
 @BeforeEach void start()throws Exception{
  g=new GameService(new JsonStore(mapper,dir.resolve("save.json").toString()),new Content(mapper),mapper);g.time=()->now;token=create();g.world(null).put("startedAt",now-4*60000);
 }
 String create(){String t=g.guest(null,g.object()).token();ActivityFixture.setup(g,t,g.object().put("city","atl").put("neighborhood","midtown").put("aspiration","founder"));return t;}
 List<JsonNode> tables(){List<JsonNode> result=new ArrayList<>();for(JsonNode s:g.navigation.layout("atl","foodhall").path("slots"))if(s.path("pose").asText().equals("Eat"))result.add(s);return result;}
 void approach(String token,JsonNode slot){
  ObjectNode s=sim(token);s.put("loc","ponce");s.remove("position");ObjectNode p=g.navigation.position(s);p.put("room","foodhall:ponce");
  for(double distance:new double[]{.4,.7,1,1.3})for(int angle=0;angle<16;angle++){
   double direction=slot.path("face").asDouble()+Math.PI+angle*Math.PI/8,x=slot.path("x").asDouble()+Math.sin(direction)*distance,z=slot.path("z").asDouble()+Math.cos(direction)*distance;
   if(g.navigation.stand("atl",x,z,"foodhall:ponce")){p.put("x",x).put("z",z);return;}
  }
  fail("No legal approach for "+slot.path("id"));
 }
 ObjectNode body(String id){return g.object().put("city","atl").put("loc","ponce").put("action","a0").put("slotId",id);}
 ObjectNode act(String token,String id){return g.act(token,body(id));}

 @Test void clickedTablesReserveTheirExactAuthoredSlotRatherThanTheGenericStation()throws Exception{
  var mvc=MockMvcBuilders.standaloneSetup(new ApiController(g,g.content)).setControllerAdvice(new ErrorHandler()).build();
  List<JsonNode> choices=tables();assertTrue(choices.size()>1);
  for(JsonNode slot:List.of(choices.get(0),choices.get(choices.size()-1))){
   approach(token,slot);ObjectNode position=g.navigation.position(sim(token)).deepCopy();
   mvc.perform(post("/api/act").cookie(new Cookie("ml_session",token)).contentType("application/json").content(body(slot.path("id").asText()).toString()))
    .andExpect(status().isOk()).andExpect(jsonPath("$.sim.activitySlot.id").value(slot.path("id").asText())).andExpect(jsonPath("$.sim.activitySlot.pose").value("Eat"));
   assertEquals(position.path("x"),sim(token).path("position").path("x"));assertEquals(position.path("z"),sim(token).path("position").path("z"));
   assertEquals(slot.path("x"),sim(token).path("activitySlot").path("x"));assertEquals(slot.path("z"),sim(token).path("activitySlot").path("z"));g.cancelAction(token);
  }
 }

 @Test void clickedFurnitureRejectsForgedRemoteAndBlockedApproachesWithoutSpending(){
  approach(token,tables().get(0));
  for(String id:new String[]{"not-a-slot","service-0",""})assertEquals(400,assertThrows(ApiException.class,()->act(token,id)).status,id);
  ObjectNode numeric=body("table-0").put("slotId",42);assertEquals(400,assertThrows(ApiException.class,()->g.act(token,numeric)).status);
  assertFalse(sim(token).has("_pendingAction"));assertTrue(sim(token).path("busyUntil").isNull());assertEquals(2500,sim(token).path("cash").asInt());
 
 {

  JsonNode slot=tables().get(0);approach(token,slot);ObjectNode p=g.navigation.position(sim(token));p.put("room","theatre:fox");
  assertEquals(409,assertThrows(ApiException.class,()->act(token,slot.path("id").asText())).status);
  p.put("room","foodhall:ponce").put("x",4.8).put("z",4);assertTrue(Math.hypot(4.8-slot.path("x").asDouble(),4-slot.path("z").asDouble())>1.45);
  assertEquals(409,assertThrows(ApiException.class,()->act(token,slot.path("id").asText())).status);assertFalse(sim(token).has("_pendingAction"));
 
 }

 {

  JsonNode slot=tables().get(0);approach(token,slot);JsonNode blocked=null;
  for(JsonNode box:g.navigation.layout("atl","foodhall").path("boxes"))if(Math.hypot(box.path("x").asDouble()-slot.path("x").asDouble(),box.path("z").asDouble()-slot.path("z").asDouble())<=1.45){blocked=box;break;}
  assertNotNull(blocked);g.navigation.position(sim(token)).put("x",blocked.path("x").asDouble()).put("z",blocked.path("z").asDouble());
  assertEquals(409,assertThrows(ApiException.class,()->act(token,slot.path("id").asText())).status);assertFalse(sim(token).has("_pendingAction"));
 
 }
}

 

 

 @Test void occupiedExactSlotRejectsInsteadOfFallingBackAndCancellationReleasesIt(){
  JsonNode slot=tables().get(0);approach(token,slot);act(token,slot.path("id").asText());String other=create();approach(other,slot);
  assertEquals(409,assertThrows(ApiException.class,()->act(other,slot.path("id").asText())).status);assertFalse(sim(other).has("_pendingAction"));
  g.cancelAction(token);JsonNode accepted=act(other,slot.path("id").asText());assertEquals(slot.path("id"),accepted.path("sim").path("activitySlot").path("id"));
 }

 

 @Test void explicitHomeSlotsKeepTheCanonicalFurnitureApproachRules(){
  ObjectNode s=sim(token);s.put("loc","home");s.remove("position");ObjectNode p=g.navigation.position(s);p.put("room","home:"+s.path("userId").asText()).put("x",-1.2).put("z",.1);
  ObjectNode request=g.object().put("city","atl").put("loc","home").put("action","cook").put("slotId","bed");assertEquals(400,assertThrows(ApiException.class,()->g.act(token,request)).status);
  request.put("slotId","stove");assertEquals("stove",g.act(token,request).path("sim").path("activitySlot").path("id").asText());g.cancelAction(token);
  p.put("x",0).put("z",2.3);assertEquals(409,assertThrows(ApiException.class,()->g.act(token,request)).status);
 }
}
