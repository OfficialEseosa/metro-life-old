package app.metrolife;

import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import java.nio.file.Path;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class ActionCancellationTests {
 @TempDir Path dir;final ObjectMapper mapper=new ObjectMapper();GameService g;String token;long now=1_800_000_000_000L;
 ObjectNode sim(){return g.sim(g.session(token,true));}
 @BeforeEach void start()throws Exception{
  g=new GameService(new JsonStore(mapper,dir.resolve("save.json").toString()),new Content(mapper),mapper);g.time=()->now;
  token=g.guest(null,g.object()).token();ActivityFixture.setup(g,token,g.object().put("city","atl").put("neighborhood","midtown").put("aspiration","founder"));g.world(null).put("startedAt",now-4*60000);
 }
 ObjectNode act(String loc,String action){return ActivityFixture.act(g,token,g.object().put("city","atl").put("loc",loc).put("action",action));}
 void assertIdle(JsonNode sim){for(String field:new String[]{"busyUntil","busyStartedAt","busyLabel","busyKind","activitySlot"})assertTrue(sim.path(field).isNull(),field);}

 @Test void cancellationDiscardsCookNeedsSkillsMoneyAndGoalPromisesButKeepsNormalTimeDecay(){
  ObjectNode before=sim().deepCopy();JsonNode accepted=act("home","cook");ObjectNode position=g.navigation.position(sim()).deepCopy();
  assertTrue(accepted.path("result").path("deltas").path("needs").path("hunger").asInt()>0);long deadline=sim().path("busyUntil").asLong();now+=1000;
  JsonNode cancelled=g.cancelAction(token).path("sim");assertIdle(cancelled);assertEquals(position,cancelled.path("position"));
  assertEquals(before.path("cash"),cancelled.path("cash"));assertEquals(before.path("skills"),cancelled.path("skills"));assertEquals(before.path("daily"),cancelled.path("daily"));
  assertEquals(before.path("needs").path("hunger").asDouble()-4.0/60,sim().path("needs").path("hunger").asDouble(),1e-6);
  assertEquals(before.path("actionsCount"),sim().path("actionsCount"));assertFalse(sim().has("_pendingAction"));
  now=deadline+10000;g.getSim(token);assertEquals(before.path("cash"),sim().path("cash"));assertEquals(before.path("skills"),sim().path("skills"));
 }

 @Test void cancellationOfPaidFoodDoesNotChargeOrRefundAndPersistsAfterRestart()throws Exception{
  double cash=sim().path("cash").asDouble();JsonNode accepted=act("ponce","a0");assertTrue(accepted.path("result").path("activity").path("cost").asInt()>0);
  long deadline=sim().path("busyUntil").asLong();g.cancelAction(token);g.cancelAction(token);assertEquals(cash,sim().path("cash").asDouble());assertEquals(0,sim().path("moneyToday").path("spent").asInt());
  g=new GameService(new JsonStore(mapper,dir.resolve("save.json").toString()),g.content,mapper);now=deadline+1000;g.time=()->now;
  JsonNode restored=g.getSim(token).path("sim");assertIdle(restored);assertEquals(cash,restored.path("cash").asDouble());assertEquals(0,restored.path("moneyToday").path("income").asInt());
 }

 @Test void cancelledShiftDoesNotPromoteOrAddShiftsButDueShiftSettlesExactlyOnce(){
  sim().put("loc","techVillage");ActivityFixture.apply(g,token,g.object().put("jobId","tech-1"));sim().withObject("job").put("shifts",3);sim().withObject("skills").withObject("tech").put("level",2);
  JsonNode first=act("techVillage","shift-tech");assertTrue(first.path("result").path("promoted").isTextual());g.cancelAction(token);
  assertEquals(1,sim().path("job").path("level").asInt());assertEquals(3,sim().path("job").path("shifts").asInt());
  JsonNode second=act("techVillage","shift-tech");double before=sim().path("cash").asDouble();now=sim().path("busyUntil").asLong();
  JsonNode paid=g.cancelAction(token).path("sim");assertIdle(paid);assertEquals(2,paid.path("job").path("level").asInt());assertEquals(before+second.path("result").path("deltas").path("cash").asDouble(),paid.path("cash").asDouble());
  double settled=paid.path("cash").asDouble();g.cancelAction(token);g.getSim(token);assertEquals(settled,sim().path("cash").asDouble());
 }

 @Test void aDueCookSettlesBeforeCancellationAndItsRewardCannotReplay(){
  JsonNode accepted=act("home","cook");double before=sim().path("cash").asDouble();now=sim().path("busyUntil").asLong();
  JsonNode paid=g.cancelAction(token).path("sim");assertIdle(paid);assertEquals(before+accepted.path("result").path("deltas").path("cash").asDouble(),paid.path("cash").asDouble());
  assertTrue(paid.path("daily").get(2).path("done").asBoolean());int cookCount=sim().path("_metrics").path("cook").asInt();
  g.cancelAction(token);assertEquals(cookCount,sim().path("_metrics").path("cook").asInt());assertEquals(paid.path("cash"),sim().path("cash"));
 }

 @Test void cancelledMapTripKeepsItsActualOutsideOriginAndDoesNotCreditTheDestination(){
  g.door(token,g.object().put("loc","home").put("enter",true));g.travel(token,g.object().put("city","atl").put("loc","fox"));
  ObjectNode outside=g.navigation.position(sim()).deepCopy();long deadline=sim().path("busyUntil").asLong();JsonNode cancelled=g.cancelAction(token).path("sim");
  assertIdle(cancelled);assertEquals(outside,cancelled.path("position"));assertTrue(cancelled.path("position").path("room").isNull());assertEquals("home",cancelled.path("loc").asText());
  now=deadline+1000;g.getSim(token);assertEquals("home",sim().path("loc").asText());assertEquals(0,sim().path("daily").get(0).path("progress").asInt());
 }

 @Test void aDueMapTripArrivesAndRecordsTheVisitBeforeCancellationReturns(){
  g.travel(token,g.object().put("city","atl").put("loc","fox"));now=sim().path("busyUntil").asLong();JsonNode cancelled=g.cancelAction(token).path("sim");
  assertIdle(cancelled);assertEquals("fox",cancelled.path("loc").asText());assertEquals(1,cancelled.path("daily").get(0).path("progress").asInt());
  ObjectNode position=g.navigation.position(sim()).deepCopy();g.cancelAction(token);assertEquals(position,sim().path("position"));assertEquals(1,sim().path("daily").get(0).path("progress").asInt());
 }

 @Test void cancellationCannotDiscardAnAlreadyDueStoryOrAnotherBrowserLife(){
  sim().withArray("visited").add("piedmont").add("high");act("techVillage","a0");now=sim().path("busyUntil").asLong();JsonNode due=g.cancelAction(token).path("sim");assertTrue(due.path("pendingBeat").isObject());
  JsonNode beat=due.path("pendingBeat").deepCopy();g.cancelAction(token);assertEquals(beat,sim().path("pendingBeat"));
  String other=g.guest(null,g.object()).token();ActivityFixture.setup(g,other,g.object().put("city","atl").put("neighborhood","midtown").put("aspiration","founder"));ActivityFixture.act(g,other,g.object().put("city","atl").put("loc","home").put("action","cook"));
  g.cancelAction(token);assertTrue(g.sim(g.session(other,true)).has("_pendingAction"));
 }

 @Test void httpCancellationNeedsOnlyTheBrowserCookieAndReturnsPublicSimAndClock()throws Exception{
  var mvc=MockMvcBuilders.standaloneSetup(new ApiController(g,g.content)).setControllerAdvice(new ErrorHandler()).build();act("home","cook");
  mvc.perform(post("/api/action/cancel")).andExpect(status().isUnauthorized());
  mvc.perform(post("/api/action/cancel").cookie(new Cookie("ml_session",token))).andExpect(status().isOk()).andExpect(jsonPath("$.sim.busyUntil").isEmpty()).andExpect(jsonPath("$.sim.activitySlot").isEmpty()).andExpect(jsonPath("$.clock.msPerMinute").value(1000)).andExpect(jsonPath("$.sim._pendingAction").doesNotExist());
 }
}
