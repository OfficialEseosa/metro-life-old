package app.metrolife;

import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.io.TempDir;
import java.nio.file.Path;
import static org.junit.jupiter.api.Assertions.*;

class ProgressionTests {
    @TempDir Path dir;
    ObjectMapper mapper=new ObjectMapper();Content content;JsonStore store;GameService game;String token;long now=System.currentTimeMillis();
    JsonNode json(String text)throws Exception{return mapper.readTree(text);}
    ObjectNode sim(){return game.sim(game.session(token,true));}
    @BeforeEach void setup()throws Exception{
        content=new Content(mapper);store=new JsonStore(mapper,dir.resolve("save.json").toString());game=new GameService(store,content,mapper);game.time=()->now;
        token=game.guest(null,json("{}")).token();game.createWorld(token,json("{\"name\":\"Progression\",\"mode\":\"solo\"}"));game.setup(token,json("{\"city\":\"atl\",\"neighborhood\":\"midtown\",\"aspiration\":\"founder\"}"));
    }
    JsonNode hire(JsonNode body){String track=body.path("jobId").asText().split("-")[0];sim().put("loc",Content.workplace(sim().path("city").asText(),track));game.world(game.session(token,true)).put("startedAt",now-4*60000);return ActivityFixture.apply(game,token,body);}
    void refresh(){for(String n:Content.NEEDS)sim().withObject("needs").put(n,100);sim().put("updatedAt",now);}
    JsonNode shift(String track)throws Exception{
        refresh();String city=sim().path("city").asText(),loc=sim().path("job").path("loc").asText();
        ObjectNode w=game.world(game.session(token,true));w.put("startedAt",now-4*60000); // 08:00 + four game hours
        String action="shift-"+track;for(JsonNode a:content.landmark(city,loc).path("actions"))if(a.path("requires").path("job").asText().equals(track)){action=a.path("id").asText();break;}
        return ActivityFixture.act(game,token,json("{\"city\":\""+city+"\",\"loc\":\""+loc+"\",\"action\":\""+action+"\"}"));
    }
    @Test void everyTrackEarnsAllFiveLevelsOnlyAtCompletion()throws Exception{
        for(String track:Content.TRACKS){
            hire(json("{\"jobId\":\""+track+"-1\"}"));
            for(int level=1;level<5;level++){
                sim().withObject("job").put("shifts",3+level-1);
                for(String skill:Content.SKILLS)sim().withObject("skills").withObject(skill).put("level",10);
                JsonNode accepted=shift(track);assertEquals(level,accepted.path("sim").path("job").path("level").asInt());assertTrue(accepted.path("result").path("promoted").isTextual());
                now=accepted.path("sim").path("busyUntil").asLong()-1;assertEquals(level,game.getSim(token).path("sim").path("job").path("level").asInt());now++;
                JsonNode promoted=game.getSim(token).path("sim");assertEquals(level+1,promoted.path("job").path("level").asInt());assertEquals(0,promoted.path("job").path("shifts").asInt());assertEquals(75+(level+1)*45,promoted.path("job").path("payPerHour").asInt());assertTrue(promoted.path("pendingBeat").isNull());
            }
            JsonNode cap=shift(track);now=cap.path("sim").path("busyUntil").asLong();assertEquals(5,game.getSim(token).path("sim").path("job").path("level").asInt());game.quitJob(token);
        }
    }
    @Test void ShiftsAloneCannotPromoteAndRestartSettlesOnce()throws Exception{
        hire(json("{\"jobId\":\"tech-1\"}"));sim().withObject("job").put("shifts",10);
        JsonNode accepted=shift("tech");now=accepted.path("sim").path("busyUntil").asLong();assertEquals(1,game.getSim(token).path("sim").path("job").path("level").asInt());
        sim().withObject("skills").withObject("tech").put("level",2);accepted=shift("tech");now=accepted.path("sim").path("busyUntil").asLong();
        GameService restarted=new GameService(new JsonStore(mapper,dir.resolve("save.json").toString()),content,mapper);restarted.time=()->now;
        JsonNode paid=restarted.getSim(token).path("sim");assertEquals(2,paid.path("job").path("level").asInt());assertEquals(paid,restarted.getSim(token).path("sim"));assertFalse(paid.has("_claims"));
    }
    @Test void aspirationsAreOrderedChangeableAndRewardsCannotReplay()throws Exception{
        sim().withObject("skills").withObject("tech").put("level",10);ArrayNode done=mapper.createArrayNode();game.progression.evaluate(sim(),done);assertEquals(0,done.size());
        sim().withArray("visited").add("ponce").add("high").add("benz");game.progression.evaluate(sim(),done);assertEquals(2,done.size());assertEquals(2950,sim().path("cash").asInt());assertEquals(2,sim().path("aspiration").path("step").asInt());
        game.setAspiration(token,json("{\"aspiration\":\"athlete\"}"));game.setAspiration(token,json("{\"aspiration\":\"founder\"}"));assertEquals(2,sim().path("aspiration").path("step").asInt());game.progression.evaluate(sim(),mapper.createArrayNode());assertEquals(2950,sim().path("cash").asInt());
        assertEquals(400,assertThrows(ApiException.class,()->game.setAspiration(token,json("{\"aspiration\":\"forged\"}"))).status);
        game.store.save();GameService restarted=new GameService(new JsonStore(mapper,dir.resolve("save.json").toString()),content,mapper);restarted.time=()->now;assertEquals(2,restarted.getSim(token).path("sim").path("aspiration").path("step").asInt());
        game.createWorld(token,json("{\"name\":\"Other life\",\"mode\":\"solo\"}"));game.setup(token,json("{\"city\":\"atl\",\"neighborhood\":\"midtown\",\"aspiration\":\"founder\"}"));assertEquals(0,sim().path("aspiration").path("step").asInt());assertEquals(2500,sim().path("cash").asInt());
        assertEquals(7,content.world.path("aspirations").size());var text=new java.util.HashSet<String>();for(JsonNode a:content.world.path("aspirations")){assertEquals(6,a.path("milestones").size());text.add(a.path("milestones").toString());}assertEquals(7,text.size());
    }
    @Test void activityTriggersAndDreamRewardsWaitForCompletionThenStorySurvivesRestart()throws Exception{
        sim().withArray("visited").add("piedmont").add("high");sim().withObject("skills").withObject("tech").put("level",2);
        JsonNode started=ActivityFixture.act(game,token,json("{\"city\":\"atl\",\"loc\":\"techVillage\",\"action\":\"a0\"}"));
        assertEquals(0,started.path("sim").path("aspiration").path("step").asInt());assertTrue(started.path("sim").path("pendingBeat").isNull());assertEquals(2500,started.path("sim").path("cash").asInt());
        assertEquals(409,assertThrows(ApiException.class,()->game.chooseStory(token,json("{\"beatId\":\"atl-startup:0\",\"choice\":\"steady\"}"))).status);
        now=started.path("sim").path("busyUntil").asLong();JsonNode finished=game.getSim(token).path("sim");assertEquals(2,finished.path("aspiration").path("step").asInt());assertEquals(2935,finished.path("cash").asInt());assertEquals("atl-startup:0",finished.path("pendingBeat").path("id").asText());
        assertEquals(409,assertThrows(ApiException.class,()->game.setAspiration(token,json("{\"aspiration\":\"athlete\"}"))).status);
        game.chooseStory(token,json("{\"beatId\":\"atl-startup:0\",\"choice\":\"steady\"}"));
        GameService restarted=new GameService(new JsonStore(mapper,dir.resolve("save.json").toString()),content,mapper);restarted.time=()->now;assertTrue(restarted.getSim(token).path("sim").path("pendingBeat").isNull());assertEquals("waiting",restarted.getSim(token).path("sim").path("stories").get(0).path("status").asText());
        JsonNode breakTime=ActivityFixture.act(restarted,token,json("{\"city\":\"atl\",\"loc\":\"home\",\"action\":\"shower\"}"));now=breakTime.path("sim").path("busyUntil").asLong();restarted.getSim(token);
        JsonNode next=ActivityFixture.act(restarted,token,json("{\"city\":\"atl\",\"loc\":\"techVillage\",\"action\":\"a0\"}"));now=next.path("sim").path("busyUntil").asLong();assertEquals("atl-startup:1",restarted.getSim(token).path("sim").path("pendingBeat").path("id").asText());
    }
    @Test void nineStoriesChainSkillChecksAndRejectReplayAndForgery()throws Exception{
        assertEquals(9,game.stories.all.size());
        for(Stories.Story story:game.stories.all){
            sim().put("city",story.city());game.stories.trigger(sim(),story.city(),story.loc());
            for(int step=0;step<3;step++){
                if(step>0){assertTrue(sim().path("pendingBeat").isNull());game.stories.trigger(sim(),story.city(),story.loc());assertTrue(sim().path("pendingBeat").isNull());game.stories.depart(sim(),story.city(),"home");game.stories.trigger(sim(),story.city(),story.loc());}
                String id=story.id()+":"+step;
                assertEquals(400,assertThrows(ApiException.class,()->game.chooseStory(token,json("{\"beatId\":\""+id+"\",\"choice\":\"forged\"}"))).status);
                if(step==1)sim().withObject("skills").withObject(story.skill()).put("level",10);else if(step==0)sim().withObject("skills").withObject(story.skill()).put("level",0);
                double before=sim().path("cash").asDouble();JsonNode out=game.chooseStory(token,json("{\"beatId\":\""+id+"\",\"choice\":\""+(step==2?"steady":"bold")+"\"}"));assertEquals(step!=0,out.path("outcome").path("win").asBoolean());assertEquals(before+out.path("outcome").path("deltas").path("cash").asDouble(),sim().path("cash").asDouble());
                assertEquals(409,assertThrows(ApiException.class,()->game.chooseStory(token,json("{\"beatId\":\""+id+"\",\"choice\":\"steady\"}"))).status);
            }
            assertTrue(sim().path("pendingBeat").isNull());game.stories.trigger(sim(),story.city(),story.loc());assertTrue(sim().path("pendingBeat").isNull());
        }
        game.store.save();GameService restarted=new GameService(new JsonStore(mapper,dir.resolve("save.json").toString()),content,mapper);restarted.time=()->now;assertTrue(restarted.getSim(token).path("sim").path("pendingBeat").isNull());
        JsonNode early=restarted.getSim(token).path("sim").path("aspiration").path("milestones").get(5);assertEquals("ready",early.path("status").asText());assertEquals(900,early.path("reward").path("cash").asInt());
    }
    @Test void firstPromotionTakesFourHealthyShifts()throws Exception{
        hire(json("{\"jobId\":\"tech-1\"}"));for(int i=1;i<=4;i++){JsonNode accepted=shift("tech");now=accepted.path("sim").path("busyUntil").asLong();assertEquals(i<4?1:2,game.getSim(token).path("sim").path("job").path("level").asInt());}
        game.quitJob(token);assertEquals("ready",game.getSim(token).path("sim").path("aspiration").path("milestones").get(2).path("status").asText());assertFalse(game.getSim(token).path("sim").has("_readyClaims"));
    }
}
