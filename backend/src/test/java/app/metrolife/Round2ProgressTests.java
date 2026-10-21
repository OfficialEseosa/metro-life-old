package app.metrolife;

import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.io.TempDir;
import java.nio.file.Path;
import static org.junit.jupiter.api.Assertions.*;

/** Real travel/door operations reproduce the auditor's route without crediting map previews. */
class Round2ProgressTests {
 @TempDir Path dir;
 final ObjectMapper mapper=new ObjectMapper();
 GameService g;String token;long now=1_800_000_000_000L;
 ObjectNode sim(){return g.sim(g.session(token,true));}
 JsonNode goal(String id){for(JsonNode row:sim().path("daily"))if(row.path("id").asText().equals(id))return row;throw new AssertionError(id);}
 @BeforeEach void start()throws Exception{
  g=new GameService(new JsonStore(mapper,dir.resolve("save.json").toString()),new Content(mapper),mapper);g.time=()->now;
  g.world(null).put("startedAt",now-4*60000); // 13:00, all tested public venues open.
  token=g.guest(null,g.object()).token();g.setup(token,g.object().put("username","Rowan Progress").put("pronouns","they").put("city","atl").put("neighborhood","midtown").put("aspiration","founder"));g.finishIntro(token);
 }
 void arrive(String loc){JsonNode accepted=g.travel(token,g.object().put("city",sim().path("city").asText()).put("loc",loc));now=accepted.path("sim").path("busyUntil").asLong();g.getSim(token);}
 void enter(String loc){g.door(token,g.object().put("loc",loc).put("enter",true));}
 void exit(){g.door(token,g.object().put("enter",false));}
 void settle(JsonNode accepted){now=accepted.path("sim").path("busyUntil").asLong();g.getSim(token);}

 @Test void travellingAndEnteringThreeVenuesCompletesDailyAndFirstDreamBeforeFirstDayEnds(){
  int count=0;
  for(String loc:new String[]{"fox","ponce","high"}){
   JsonNode accepted=g.travel(token,g.object().put("city","atl").put("loc",loc));
   assertEquals(count,goal("explore").path("progress").asInt(),"Booking alone is not arrival");
   now=accepted.path("sim").path("busyUntil").asLong();g.getSim(token);enter(loc);count++;
   assertEquals(count,goal("explore").path("progress").asInt());
   assertEquals(count,g.publicSim(sim()).path("aspiration").path("milestones").get(0).path("progress").asInt());
  }
  assertTrue(goal("explore").path("done").asBoolean());assertEquals(1,sim().path("aspiration").path("step").asInt());
  assertFalse(sim().path("firstDay").path("complete").asBoolean());assertTrue(sim().path("firstDay").path("outside").asBoolean());
  assertEquals(305,sim().path("cash").asInt());assertEquals(155,sim().path("moneyToday").path("income").asInt());
 }

 @Test void repeatedEntryTravelAndReadsNeverInflateOneVenueOrReplayRewards(){
  arrive("fox");enter("fox");exit();enter("fox");exit();arrive("fox");enter("fox");
  for(int read=0;read<5;read++)g.getSim(token);
  assertEquals(1,goal("explore").path("progress").asInt());assertEquals(1,g.progression.visitCount(sim()));
  assertEquals(150,sim().path("cash").asInt());assertEquals(1,sim().path("dailyVisited").size());
 }

 

 

 @Test void completedTripAndDreamRewardSurviveRestartAndNeverPayTwice()throws Exception{
  arrive("fox");enter("fox");arrive("ponce");enter("ponce");
  JsonNode accepted=g.travel(token,g.object().put("city","atl").put("loc","high"));now=accepted.path("sim").path("busyUntil").asLong();
  g=new GameService(new JsonStore(mapper,dir.resolve("save.json").toString()),g.content,mapper);g.time=()->now;
  assertEquals(305,g.getSim(token).path("sim").path("cash").asInt());enter("high");g.checkpoint();
  g=new GameService(new JsonStore(mapper,dir.resolve("save.json").toString()),g.content,mapper);g.time=()->now;
  assertEquals(305,g.getSim(token).path("sim").path("cash").asInt());assertEquals(3,goal("explore").path("progress").asInt());
  assertEquals(1,sim().path("aspiration").path("step").asInt());
 }

 @Test void dailyDistinctVisitsResetButLifetimeDreamDoesNot(){
  for(String loc:new String[]{"fox","ponce","high"})arrive(loc);
  now=g.civic.dayAt(g.world(null),g.civic.day(g.world(null))+1)+13*60000;g.getSim(token);
  assertEquals(0,goal("explore").path("progress").asInt());
  for(String loc:new String[]{"fox","ponce","high"})arrive(loc);
  assertEquals(3,goal("explore").path("progress").asInt());assertEquals(3,g.progression.visitCount(sim()));
  assertEquals(5,sim().path("moneyToday").path("income").asInt());assertEquals(1,sim().path("aspiration").path("step").asInt());
 }

 @Test void acceptedOutdoorWalkingMarksOutsideAndRecordsTheActualNearbyLandmark(){
  exit();sim().withObject("firstDay").put("outside",false);
  JsonNode door=g.navigation.door(sim(),"fox");ObjectNode p=g.navigation.position(sim());p.put("x",door.path("x").asDouble()).put("z",door.path("z").asDouble());
  now+=1000;g.movePosition(token,g.object().put("city","atl").put("x",p.path("x").asDouble()).put("z",p.path("z").asDouble()).put("face",0));
  assertTrue(sim().path("firstDay").path("outside").asBoolean());assertEquals(1,goal("explore").path("progress").asInt());
 }

 @Test void boughtFoodHallMealAndHomeCookingCountOnlyWhenTheirActivityFinishes(){
  arrive("ponce");enter("ponce");JsonNode food=null;for(JsonNode a:g.content.landmark("atl","ponce").path("actions"))if(a.path("kind").asText().equals("food")&&a.path("cost").asInt()>0){food=a;break;}
  assertNotNull(food);JsonNode meal=ActivityFixture.act(g,token,g.object().put("city","atl").put("loc","ponce").put("action",food.path("id").asText()));
  assertFalse(sim().path("firstDay").path("meal").asBoolean());settle(meal);assertTrue(sim().path("firstDay").path("meal").asBoolean());
  JsonNode cooking=ActivityFixture.act(g,token,g.object().put("city","atl").put("loc","home").put("action","cook"));
  assertEquals(0,goal("cook").path("progress").asInt());settle(cooking);assertTrue(goal("cook").path("done").asBoolean());assertEquals(1,sim().path("_metrics").path("cook").asInt());
 }

 
}
