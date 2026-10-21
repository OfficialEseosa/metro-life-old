package app.metrolife;

import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.io.TempDir;
import java.nio.file.*;
import static org.junit.jupiter.api.Assertions.*;

class FinalRulesTests {
 @TempDir Path dir;ObjectMapper m=new ObjectMapper();GameService g;String token;long now=System.currentTimeMillis();
 JsonNode j(String text)throws Exception{return m.readTree(text);}ObjectNode sim(){return g.sim(g.session(token,true));}ObjectNode world(){return g.world(g.session(token,true));}
 @BeforeEach void setup()throws Exception{g=new GameService(new JsonStore(m,dir.resolve("save.json").toString()),new Content(m),m);g.time=()->now;token=g.guest(null,g.object()).token();ActivityFixture.setup(g,token,j("{\"city\":\"atl\",\"neighborhood\":\"midtown\",\"aspiration\":\"founder\"}"));}
 JsonNode act(String loc,String action){JsonNode r=ActivityFixture.act(g,token,g.object().put("city","atl").put("loc",loc).put("action",action));now=r.path("sim").path("busyUntil").asLong();return g.getSim(token).path("sim");}
 @Test void theSameThreePlacesCompleteExplorationOnConsecutiveDays(){for(int day=1;day<=2;day++){if(day==2){now=g.civic.dayAt(world(),2)+9*60000;g.getSim(token);}for(String place:new String[]{"centennial","piedmont","beltline"})act(place,"a0");assertTrue(sim().path("daily").get(0).path("done").asBoolean());assertEquals(3,sim().path("daily").get(0).path("progress").asInt());act("centennial","a0");assertEquals(3,sim().path("daily").get(0).path("progress").asInt());}assertEquals(4,sim().path("visited").size());}
 @Test void rentUsesOnlySixGameHoursAndPolicyAtEachEligibleMidnight(){
  g.mayor(token,"atl");long midnight=g.civic.dayAt(world(),2);now=midnight-60000;sim().put("updatedAt",now);g.civic.recordPolicy(world(),"atl","housing",now);now=midnight+1000;g.civic.recordPolicy(world(),"atl","parks",now);now+=86400000L;
  double cash=sim().path("cash").asDouble();g.getSim(token);assertEquals(cash-28,sim().path("cash").asDouble());assertEquals(0,sim().path("rentDebt").asInt());g.getSim(token);assertEquals(cash-28,sim().path("cash").asDouble());
 }
 @Test void returningAfterAFullDayDoesNotChargeMidnightsOutsideTheCappedWindow(){double cash=sim().path("cash").asDouble();now+=86400000L;g.getSim(token);assertEquals(cash,sim().path("cash").asDouble());assertEquals(0,sim().path("rentDebt").asInt());}
 @Test void newLivesCannotGiftOrVoteButBecomeEligibleAfterOneGameDay()throws Exception{
  g.players(token,"atl");ObjectNode target=(ObjectNode)g.community.residents().path(world().path("id").asText()).get("npc-atl-0");sim().put("loc",target.path("loc").asText());ObjectNode gift=g.object().put("kind","gift").put("targetId",target.path("userId").asText()).put("amount",25);
  assertEquals(403,assertThrows(ApiException.class,()->g.social(token,gift)).status);sim().withObject("skills").withObject("charisma").put("level",2);g.mayorAction(token,"run",g.object().put("city","atl").put("slogan","More places for neighbours"));ObjectNode vote=g.object().put("city","atl").put("candidateId",sim().path("userId").asText());assertEquals(403,assertThrows(ApiException.class,()->g.mayorAction(token,"vote",vote)).status);assertTrue(g.mayor(token,"atl").path("canVote").isTextual());now+=1440000L;g.social(token,gift);g.mayorAction(token,"vote",vote);assertEquals(sim().path("userId").asText(),g.mayor(token,"atl").path("myVote").asText());
 }
 @Test void skippedTermsDoNotCreditAnUnseatedWinner(){sim().put("createdAt",now-1440000L);sim().withObject("skills").withObject("charisma").put("level",2);g.mayorAction(token,"run",g.object().put("city","atl").put("slogan","More green places"));g.mayorAction(token,"vote",g.object().put("city","atl").put("candidateId",sim().path("userId").asText()));now=g.civic.dayAt(world(),7);assertTrue(g.mayor(token,"atl").path("mayor").isNull());assertEquals(0,sim().path("_externalMetrics").path("electionWins").asInt());}
 @Test void aCampaignCrossingMidnightConsumesItsAcceptanceDay(){g.mayor(token,"atl");ObjectNode c=g.civic.state(world(),"atl");c.withArray("candidates").addObject().put("id",sim().path("userId").asText()).put("support",0);now=g.civic.dayAt(world(),2)-1000;((ArrayNode)g.content.landmark("atl","capitol").path("open")).set(1,m.getNodeFactory().numberNode(24)); // Extended-hours fixture for the midnight boundary.
 sim().put("updatedAt",now);JsonNode accepted=ActivityFixture.act(g,token,g.object().put("city","atl").put("loc","capitol").put("action","a1"));now=accepted.path("sim").path("busyUntil").asLong();g.getSim(token);assertEquals(1,c.path("campaignDays").path(sim().path("userId").asText()).asInt());assertTrue(g.mayor(token,"atl").path("campaignReady").asBoolean());}
 @Test void applyingRequiresAnOpenWorkplaceAndDoesNotTeleport()throws Exception{
  ObjectNode apply=g.object().put("jobId","tech-1");assertEquals(409,assertThrows(ApiException.class,()->ActivityFixture.apply(g,token,apply)).status);assertEquals("home",sim().path("loc").asText());act("techVillage","visit-workplace");assertTrue(sim().path("pendingBeat").isNull());now=g.civic.dayAt(world(),2)+2*60000;((ObjectNode)g.content.landmark("atl","techVillage")).putArray("open").add(8).add(18);assertEquals(409,assertThrows(ApiException.class,()->ActivityFixture.apply(g,token,apply)).status);assertTrue(sim().path("job").isNull());now=g.civic.dayAt(world(),2)+9*60000;assertTrue(ActivityFixture.apply(g,token,apply).path("hired").asBoolean());assertEquals("techVillage",sim().path("loc").asText());
 }
 @Test void repeatedReadsDoNotSaveAndOnlineIsRealWhileSettlementsRemainReplayable()throws Exception{
  g.players(token,"atl");g.mayor(token,"atl");g.plots(token,"atl");g.billboards(token,"atl");g.checkpoint();byte[] before=Files.readAllBytes(g.store.path);String uid=sim().path("userId").asText();g.community.online.put(world().path("id").asText()+":"+uid,now);
  for(int i=0;i<20;i++){assertEquals(1,g.stats().path("online").asInt());g.me(token);g.getSim(token);g.mayor(token,"atl");g.plots(token,"atl");g.billboards(token,"atl");g.homes(token,"atl");g.chat(token,"atl");}assertArrayEquals(before,Files.readAllBytes(g.store.path));assertEquals(0,g.store.data.path("visits").asInt());
  JsonNode r=ActivityFixture.act(g,token,g.object().put("city","atl").put("loc","home").put("action","cook"));now=r.path("sim").path("busyUntil").asLong();JsonNode paid=g.getSim(token).path("sim");GameService restored=new GameService(new JsonStore(m,g.store.path.toString()),g.content,m);restored.time=()->now;assertEquals(paid,restored.getSim(token).path("sim"));g.checkpoint();GameService saved=new GameService(new JsonStore(m,g.store.path.toString()),g.content,m);saved.time=()->now;assertEquals(paid,saved.getSim(token).path("sim"));
 }
}
