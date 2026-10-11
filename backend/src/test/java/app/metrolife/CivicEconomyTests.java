package app.metrolife;

import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.io.TempDir;
import java.nio.file.Path;
import java.io.ByteArrayInputStream;
import javax.imageio.ImageIO;
import static org.junit.jupiter.api.Assertions.*;

class CivicEconomyTests {
    @TempDir Path dir;ObjectMapper mapper=new ObjectMapper();GameService g;Content content;String token;long now=System.currentTimeMillis();
    JsonNode j(String s)throws Exception{return mapper.readTree(s);}
    ObjectNode sim(){return g.sim(g.session(token,true));}ObjectNode world(){return g.world(g.session(token,true));}
    @BeforeEach void setup()throws Exception{content=new Content(mapper);g=new GameService(new JsonStore(mapper,dir.resolve("save.json").toString()),content,mapper);g.time=()->now;token=g.guest(null,j("{}")).token();g.createWorld(token,j("{\"name\":\"A civic life\",\"mode\":\"private\"}"));g.setup(token,j("{\"city\":\"atl\",\"neighborhood\":\"midtown\",\"aspiration\":\"mayor\"}"));}
    void run()throws Exception{sim().withObject("skills").withObject("charisma").put("level",2);g.mayorAction(token,"run",j("{\"city\":\"atl\",\"slogan\":\"A greener block for everyone\"}"));}
    void settle(JsonNode r){now=r.path("sim").path("busyUntil").asLong();g.getSim(token);}
    @Test void ballotValidationCampaignSettlementElectionAndAuthority()throws Exception{
        assertEquals(403,assertThrows(ApiException.class,()->g.mayorAction(token,"run",j("{\"city\":\"atl\",\"slogan\":\"Hello city\"}"))).status);run();String uid=sim().path("userId").asText();
        assertEquals(409,assertThrows(ApiException.class,()->run()).status);assertEquals(404,assertThrows(ApiException.class,()->g.mayorAction(token,"vote",j("{\"city\":\"atl\",\"candidateId\":\"forged\"}"))).status);
        g.mayorAction(token,"vote",g.object().put("city","atl").put("candidateId",uid));assertEquals(409,assertThrows(ApiException.class,()->g.mayorAction(token,"vote",g.object().put("city","atl").put("candidateId",uid))).status);
        JsonNode activity=g.act(token,j("{\"city\":\"atl\",\"loc\":\"capitol\",\"action\":\"a1\"}"));assertEquals(1,g.mayor(token,"atl").path("candidates").get(0).path("votes").asInt());settle(activity);assertEquals(2,g.mayor(token,"atl").path("candidates").get(0).path("votes").asInt());g.chooseStory(token,j("{\"beatId\":\"atl-community:0\",\"choice\":\"steady\"}"));assertEquals(409,assertThrows(ApiException.class,()->g.act(token,j("{\"city\":\"atl\",\"loc\":\"capitol\",\"action\":\"a1\"}"))).status);
        assertEquals(403,assertThrows(ApiException.class,()->g.mayorAction(token,"policy",j("{\"city\":\"atl\",\"policy\":\"parks\"}"))).status);
        now=g.civic.dayAt(world(),4);JsonNode result=g.mayor(token,"atl");assertTrue(result.path("isMayor").asBoolean());assertEquals(uid,result.path("mayor").path("id").asText());assertEquals(0,result.path("candidates").size());g.getSim(token);assertEquals(1,sim().path("_externalMetrics").path("electionWins").asInt());g.mayor(token,"atl");assertEquals(1,sim().path("_externalMetrics").path("electionWins").asInt());assertTrue(g.mayor(token,"nyc").path("mayor").isNull());
        g.mayorAction(token,"policy",j("{\"city\":\"atl\",\"policy\":\"housing\"}"));g.mayorAction(token,"announce",j("{\"city\":\"atl\",\"text\":\"Meet your neighbours in the park this weekend.\"}"));assertEquals(409,assertThrows(ApiException.class,()->g.mayorAction(token,"policy",j("{\"city\":\"atl\",\"policy\":\"parks\"}"))).status);assertEquals(429,assertThrows(ApiException.class,()->g.mayorAction(token,"announce",j("{\"city\":\"atl\",\"text\":\"Another message\"}"))).status);
        g.store.save();GameService restored=new GameService(new JsonStore(mapper,dir.resolve("save.json").toString()),content,mapper);restored.time=()->now;assertEquals("housing",restored.mayor(token,"atl").path("mayor").path("policy").asText());
    }
    @Test void policiesChangeActualRulesAndRentIsOncePerDayWithArrears()throws Exception{
        g.mayor(token,"atl");ObjectNode mayor=g.civic.state(world(),"atl").putObject("mayor").put("policy","parks");assertTrue(g.civic.open(world(),"atl",content.landmark("atl","piedmont"),23));mayor.put("policy","arts");assertTrue(g.civic.open(world(),"atl",content.landmark("atl","high"),22));world().put("startedAt",now-10*60000);assertEquals(0,g.civic.action(world(),"atl",content.landmark("atl","high"),(ObjectNode)content.landmark("atl","high").path("actions").get(0)).path("cost").asInt());mayor.put("policy","transit");assertEquals(0,g.civic.action(world(),"atl",content.landmark("atl","atlAirport"),(ObjectNode)content.landmark("atl","atlAirport").path("actions").get(2)).path("cost").asInt());mayor.put("policy","nightlife");assertTrue(g.civic.open(world(),"atl",content.landmark("atl","l5p"),3));mayor.put("policy","smallbiz");assertEquals(126,g.civic.action(world(),"atl",content.landmark("atl","techVillage"),g.object().put("kind","work").put("pay",120)).path("pay").asInt());
        mayor.put("policy","housing");sim().put("cash",10);now=g.civic.dayAt(world(),2);JsonNode paid=g.getSim(token).path("sim");assertEquals(0,paid.path("cash").asInt());assertEquals(42,paid.path("rentDebt").asInt());assertEquals(10,paid.path("moneyToday").path("spent").asInt());g.getSim(token);assertEquals(42,sim().path("rentDebt").asInt());sim().put("cash",100);g.getSim(token);assertEquals(58,sim().path("cash").asInt());assertEquals(0,sim().path("rentDebt").asInt());
    }
    @Test void plotBoundsOverlapIsolationImagesAndRestart()throws Exception{
        JsonNode rectangle=j("{\"city\":\"atl\",\"x\":0,\"y\":0,\"w\":2,\"h\":2,\"title\":\"Neighbourhood garden\",\"link\":\"https://example.org\"}");JsonNode bought=g.buyPlot(token,rectangle);assertEquals(2360,bought.path("sim").path("cash").asInt());assertEquals(140,bought.path("sim").path("moneyToday").path("spent").asInt());assertEquals(409,assertThrows(ApiException.class,()->g.buyPlot(token,rectangle)).status);assertEquals(1,g.plots(token,"atl").path("ads").size());assertEquals(0,g.plots(token,"nyc").path("ads").size());assertEquals(0,g.plots(null,"atl").path("ads").size());
        for(String invalid:new String[]{"{\"city\":\"atl\",\"x\":-1,\"y\":0,\"w\":1,\"h\":1}","{\"city\":\"atl\",\"x\":48,\"y\":0,\"w\":1,\"h\":1}","{\"city\":\"atl\",\"x\":4.5,\"y\":0,\"w\":1,\"h\":1}"})assertEquals(400,assertThrows(ApiException.class,()->g.buyPlot(token,j(invalid))).status);
        var png=ImageIO.read(new ByteArrayInputStream(g.atlas(token,"atl",world().path("id").asText())));assertEquals(48*24,png.getWidth());assertEquals(28*24,png.getHeight());assertEquals(403,assertThrows(ApiException.class,()->g.atlas(token,"atl","public")).status);assertEquals(512,ImageIO.read(new ByteArrayInputStream(g.art(token,"plots",bought.path("ad").path("id").asText()))).getWidth());
        GameService restored=new GameService(new JsonStore(mapper,dir.resolve("save.json").toString()),content,mapper);restored.time=()->now;assertEquals(1,restored.plots(token,"atl").path("ads").size());now+=7*1440000L;assertEquals(0,restored.plots(token,"atl").path("ads").size());
    }
    @Test void billboardScheduleNoDuplicateAndHomeMoveCosts()throws Exception{
        JsonNode book=j("{\"city\":\"atl\",\"slot\":1,\"title\":\"Our corner book club\",\"link\":\"\"}");g.bookBillboard(token,book);assertEquals(409,assertThrows(ApiException.class,()->g.bookBillboard(token,book)).status);JsonNode slot=g.billboards(token,"atl").path("slots").get(0);assertFalse(slot.path("ad").isNull());assertEquals(0,slot.path("queue").asInt());assertEquals(2200,sim().path("cash").asInt());String first=token;String code=world().path("code").asText();token=g.guest(null,j("{}")).token();g.joinWorld(token,g.object().put("code",code));g.setup(token,j("{\"city\":\"atl\",\"neighborhood\":\"midtown\",\"aspiration\":\"founder\"}"));JsonNode queued=g.bookBillboard(token,book);assertEquals(slot.path("freeFrom").asLong(),queued.path("ad").path("startsAt").asLong());assertEquals(1,g.billboards(token,"atl").path("slots").get(0).path("queue").asInt());assertEquals(2,g.homes(token,"atl").path("total").asInt());
        g.moveHome(token,j("{\"city\":\"atl\",\"neighborhood\":\"buckhead\"}"));assertEquals(2120,sim().path("cash").asInt());assertEquals(380,sim().path("moneyToday").path("spent").asInt());assertEquals("buckhead",sim().path("home").path("neighborhood").asText());assertEquals(403,assertThrows(ApiException.class,()->g.moveHome(token,j("{\"city\":\"nyc\",\"neighborhood\":\"harlem\"}"))).status);now+=3*1440000L;assertEquals(sim().path("username").asText(),g.billboards(token,"atl").path("slots").get(0).path("ad").path("owner").asText());assertNotEquals(first,token);
    }
    @Test void mogulAndMayorMilestonesUseAuthoritativeEventsOnce()throws Exception{
        g.setAspiration(token,j("{\"aspiration\":\"mogul\"}"));sim().withObject("skills").withObject("business").put("level",2);sim().put("cash",6000);g.finishProgress(sim());assertEquals(2,sim().path("aspiration").path("step").asInt());g.buyPlot(token,j("{\"city\":\"atl\",\"x\":0,\"y\":0,\"w\":1,\"h\":1,\"title\":\"First garden\"}"));assertEquals(3,sim().path("aspiration").path("step").asInt());g.bookBillboard(token,j("{\"city\":\"atl\",\"slot\":1,\"title\":\"Our garden club\"}"));assertEquals(4,sim().path("aspiration").path("step").asInt());g.buyPlot(token,j("{\"city\":\"atl\",\"x\":1,\"y\":0,\"w\":1,\"h\":1,\"title\":\"Second garden\"}"));assertEquals(5,sim().path("aspiration").path("step").asInt());double cash=sim().path("cash").asDouble();g.getSim(token);assertEquals(cash,sim().path("cash").asDouble());assertFalse(g.getSim(token).path("sim").has("_externalMetrics"));
    }
    @Test void mayorDreamIncludesRunningWinningAndStoryWithoutDuplicateRewards()throws Exception{
        sim().withObject("skills").withObject("charisma").put("level",2);sim().withObject("_metrics").put("civic",3);sim().putObject("job").put("track","civic").put("level",2);
        run();g.mayorAction(token,"vote",g.object().put("city","atl").put("candidateId",sim().path("userId").asText()));assertEquals(4,sim().path("aspiration").path("step").asInt());now=g.civic.dayAt(world(),4);g.getSim(token);assertEquals(5,sim().path("aspiration").path("step").asInt());
        Stories.Story story=g.stories.all.stream().filter(st->st.id().equals("atl-community")).findFirst().orElseThrow();sim().withObject("_stories").put(story.id(),2);sim().set("pendingBeat",g.stories.beat(story,2));g.chooseStory(token,g.object().put("beatId",story.id()+":2").put("choice","steady"));assertEquals(6,sim().path("aspiration").path("step").asInt());double cash=sim().path("cash").asDouble();g.getSim(token);assertEquals(cash,sim().path("cash").asDouble());
    }
    @Test void rentReservesAcceptedFlightCostAndCannotMakeCashNegative()throws Exception{
        sim().put("cash",180);world().put("startedAt",now-(15*60000-1000));JsonNode accepted=g.act(token,j("{\"city\":\"atl\",\"loc\":\"atlAirport\",\"action\":\"a0\"}"));now+=1200;JsonNode before=g.getSim(token).path("sim");assertEquals(180,before.path("cash").asInt());assertEquals(65,before.path("rentDebt").asInt());settle(accepted);assertEquals(0,sim().path("cash").asInt());assertEquals("nyc",sim().path("city").asText());assertEquals(65,sim().path("rentDebt").asInt());
    }

    @Test void electionProgressSurvivesAnActivityAcceptedInThePreviousTerm()throws Exception{
        sim().withObject("skills").withObject("charisma").put("level",2);sim().withObject("_metrics").put("civic",3);sim().putObject("job").put("track","civic").put("level",2);run();g.mayorAction(token,"vote",g.object().put("city","atl").put("candidateId",sim().path("userId").asText()));
        now=g.civic.dayAt(world(),4)-1000;JsonNode accepted=g.act(token,j("{\"city\":\"atl\",\"loc\":\"home\",\"action\":\"cook\"}"));settle(accepted);assertEquals(5,sim().path("aspiration").path("step").asInt());assertEquals(1,sim().path("_externalMetrics").path("electionWins").asInt());
    }

    @Test void expiredPlotsDoNotCountAsTwoCurrentlyOwnedPlotsAndLargeCoordinatesCannotWrap()throws Exception{
        g.buyPlot(token,j("{\"city\":\"atl\",\"x\":0,\"y\":0,\"w\":1,\"h\":1,\"title\":\"First garden\"}"));now+=7*1440000L;sim().put("cash",2500);sim().put("lastDay",g.clock(world()).path("day").asInt());g.getSim(token);assertEquals(0,sim().path("_externalMetrics").path("plots").asInt());g.buyPlot(token,j("{\"city\":\"atl\",\"x\":0,\"y\":0,\"w\":1,\"h\":1,\"title\":\"A new garden\"}"));assertEquals(1,sim().path("_externalMetrics").path("plots").asInt());assertEquals(400,assertThrows(ApiException.class,()->g.buyPlot(token,j("{\"city\":\"atl\",\"x\":4294967296,\"y\":0,\"w\":1,\"h\":1,\"title\":\"Bad coordinate\"}"))).status);
    }

}
