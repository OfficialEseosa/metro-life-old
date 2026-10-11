package app.metrolife;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.*;
import java.util.*;

/** Mutates only the accepted future state until an activity is settled. */
final class Progression {
    private final Content content;
    Progression(Content content){this.content=content;}
    static final String[][] RULES={
        {"visits:3","skill:tech:2","job:tech:2","count:pitch:1","cash:5000","story:startup"},
        {"skill:music:2","count:music:3","job:music:2","visit:apollo","job:music:4","story:music"},
        {"skill:charisma:2","count:civic:3","job:civic:2","count:campaign:1","count:electionWins:1","story:community"},
        {"skill:cooking:1","count:cook:3","job:food:2","visit:missionEats","cash:5000","job:food:4"},
        {"skill:fitness:2","count:fitness:5","job:sports:2","visit:yankee","job:sports:4","cash:8000"},
        {"skill:creativity:2","count:creativity:3","job:arts:2","visit:met","job:arts:4","cash:5000"},
        {"skill:business:2","cash:4000","count:plots:1","count:billboards:1","count:plots:2","cash:8000"}
    };
    static final String[][] TEXTS={
        {"Explore three places","Reach Tech level 2","Become a Developer","Pitch on Sand Hill Road","Save $5,000","Finish a startup story"},
        {"Reach Music level 2","Complete three music activities","Become a Session Musician","Visit the Apollo Theater","Become a Headliner","Finish a music story"},
        {"Reach Charisma level 2","Complete three civic activities","Become a Community Organizer","Run for mayor","Win a city election","Finish a community story"},
        {"Reach Cooking level 1","Cook three meals at home","Become a Line Cook","Visit Mission Eats","Save $5,000","Become a Head Chef"},
        {"Reach Fitness level 2","Complete five fitness activities","Become a Trainer","Visit Yankee Stadium","Become a Team Captain","Save $8,000"},
        {"Reach Creativity level 2","Complete three creative activities","Become a Studio Artist","Visit the Metropolitan Museum","Become an Art Director","Save $5,000"},
        {"Reach Business level 2","Save $4,000","Buy your first plot","Book a billboard","Own two plots","Save $8,000"}
    };
    void select(ObjectNode s,String id){
        JsonNode definition=content.aspiration(id);int step=0;
        while(step<6&&s.path("_claims").path(id+"-"+step).asBoolean())step++;
        ObjectNode a=s.putObject("aspiration").put("id",id).put("label",definition.path("label").asText()).put("step",step).put("total",6);
        if(step<6)a.set("current",definition.path("milestones").get(step).deepCopy());else a.putNull("current");
    }
    String activity(ObjectNode s,JsonNode action,String loc){
        count(s,action.path("kind").asText());
        if(loc.equals("sandHill")&&action.path("label").asText().toLowerCase(Locale.ROOT).contains("pitch"))count(s,"pitch");
        action.path("skills").fieldNames().forEachRemaining(k->count(s,k));
        if(loc.equals("home")&&action.path("id").asText().equals("cook"))count(s,"cook");
        String promoted=null;
        if(action.path("requires").has("job")){
            JsonNode job=s.path("job");int level=job.path("level").asInt();
            if(level<5&&job.path("shifts").asInt()>=job.path("shiftsToPromote").asInt()){
                JsonNode next=career(job.path("track").asText()).path("levels").get(level);
                boolean ready=true;var skills=next.path("requires").path("skills").fields();
                while(skills.hasNext()){var e=skills.next();if(skill(s,e.getKey())<e.getValue().asInt())ready=false;}
                if(ready){ObjectNode upgraded=((ObjectNode)next).deepCopy();String city=job.path("city").asText(),track=job.path("track").asText();
                    upgraded.put("id",(city.equals("atl")?"":city+"-")+track+"-"+(level+1)).put("track",track).put("city",city).put("loc",Content.workplace(city,track)).put("shifts",0);
                    s.set("job",upgraded);promoted=upgraded.path("title").asText();count(s,"promotions");
                }
            }
        }
        return promoted;
    }
    JsonNode career(String track){for(JsonNode c:content.world.path("careers"))if(c.path("track").asText().equals(track))return c;throw new IllegalArgumentException(track);}
    void count(ObjectNode s,String key){ObjectNode metrics=s.withObject("_metrics");metrics.put(key,metrics.path(key).asInt()+1);}
    int skill(ObjectNode s,String key){return s.path("skills").path(key).path("level").asInt();}
    boolean met(ObjectNode s,String rule){String[] r=rule.split(":");return switch(r[0]){
        case "visits"->s.path("visited").size()-1>=Integer.parseInt(r[1]);
        case "skill"->skill(s,r[1])>=Integer.parseInt(r[2]);
        case "count"->(s.path("_metrics").path(r[1]).asInt()+s.path("_externalMetrics").path(r[1]).asInt())>=Integer.parseInt(r[2]);
        case "job"->s.path("job").path("track").asText().equals(r[1])&&s.path("job").path("level").asInt()>=Integer.parseInt(r[2]);
        case "visit"->{boolean found=false;for(JsonNode v:s.path("visited"))if(v.asText().equals(r[1]))found=true;yield found;}
        case "cash"->s.path("cash").asDouble()>=Integer.parseInt(r[1]);
        case "story"->{boolean found=false;var names=s.path("_stories").fieldNames();while(names.hasNext()){String name=names.next();if(name.endsWith("-"+r[1])&&s.path("_stories").path(name).asInt()>=3)found=true;}yield found;}
        default->false;
    };}
    ArrayNode milestones(ObjectNode s){
        String id=s.path("aspiration").path("id").asText();int index=Arrays.asList(Content.ASPIRATIONS).indexOf(id),step=s.path("aspiration").path("step").asInt();ArrayNode rows=content.mapper.createArrayNode();
        if(index<0)return rows;
        for(int i=0;i<6;i++){
            String rule=RULES[index][i];String[] r=rule.split(":");ObjectNode row=((ObjectNode)content.aspiration(id).path("milestones").get(i)).deepCopy();
            row.put("status",i<step?"done":(s.path("_readyClaims").path(id+"-"+i).asBoolean()||met(s,rule))?"ready":i==step?"current":"locked");
            int target=switch(r[0]){case "visits","cash"->Integer.parseInt(r[1]);case "skill","job","count"->Integer.parseInt(r[2]);default->1;};
            int value=switch(r[0]){case "visits"->s.path("visited").size()-1;case "cash"->s.path("cash").asInt();case "skill"->skill(s,r[1]);case "job"->s.path("job").path("track").asText().equals(r[1])?s.path("job").path("level").asInt():0;case "count"->(s.path("_metrics").path(r[1]).asInt()+s.path("_externalMetrics").path(r[1]).asInt());default->met(s,rule)?1:0;};
            row.put("progress",i<step||s.path("_readyClaims").path(id+"-"+i).asBoolean()?target:Math.min(value,target)).put("target",target);rows.add(row);
        }
        return rows;
    }
    void rememberReady(ObjectNode s,String id,int index){for(int i=0;i<6;i++)if(met(s,RULES[index][i]))s.withObject("_readyClaims").put(id+"-"+i,true);}
    void evaluate(ObjectNode s,ArrayNode completed){
        String id=s.path("aspiration").path("id").asText();int index=Arrays.asList(Content.ASPIRATIONS).indexOf(id);if(index<0)return;
        rememberReady(s,id,index);select(s,id);int step=s.path("aspiration").path("step").asInt();
        while(step<6&&(s.path("_readyClaims").path(id+"-"+step).asBoolean()||met(s,RULES[index][step]))){
            JsonNode milestone=content.aspiration(id).path("milestones").get(step);
            s.withObject("_claims").put(id+"-"+step,true);
            s.put("cash",s.path("cash").asDouble()+milestone.path("reward").path("cash").asDouble()).put("xp",s.path("xp").asInt()+milestone.path("reward").path("xp").asInt());
            completed.add("Dream step: "+milestone.path("text").asText());step++;
        }
        rememberReady(s,id,index);select(s,id);
    }
}
