package app.metrolife;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.List;

/** Symmetric friendships persist with each life; accepted social actions build familiarity. */
final class Relationships {
 final GameService g;
 Relationships(GameService g){this.g=g;}
 String label(int value){return value>=80?"Close friend":value>=50?"Friend":value>=25?"Friendly":value>=8?"Acquaintance":"Stranger";}
 int next(int value){return value>=80?100:value>=50?80:value>=25?50:value>=8?25:8;}
 ObjectNode relationship(JsonNode actor,String target){int value=Math.clamp(actor.path("relationships").path(target).path("value").asInt(),0,100);return g.object().put("value",value).put("label",label(value)).put("nextAt",next(value)).put("nextLabel",value>=80?"Close friend":label(next(value))).put("lastAt",actor.path("relationships").path(target).path("lastAt").asLong()).put("lastGain",actor.path("relationships").path(target).path("lastGain").asInt());}
 ObjectNode read(ObjectNode actor){ObjectNode out=g.object();var fields=actor.path("relationships").fields();while(fields.hasNext()){var field=fields.next();out.set(field.getKey(),relationship(actor,field.getKey()));}return out;}
 void chat(ObjectNode from,ObjectNode target){ObjectNode row=from.withObject("relationships").withObject(target.path("userId").asText());if(row.has("chatAt")&&g.now()-row.path("chatAt").asLong()<30000)return;social(from,target,"chat");for(ObjectNode actor:List.of(from,target))actor.withObject("relationships").withObject((actor==from?target:from).path("userId").asText()).put("chatAt",g.now());}
 void social(ObjectNode from,ObjectNode target,String kind){int gain=kind.equals("hangout")?10:kind.equals("gift")?5:kind.equals("chat")?3:2;for(ObjectNode actor:List.of(from,target)){String id=(actor==from?target:from).path("userId").asText();ObjectNode row=actor.withObject("relationships").withObject(id);int previous=row.path("value").asInt();row.put("value",Math.min(100,previous+gain)).put("lastGain",gain).put("lastAt",g.now()).put("label",label(Math.min(100,previous+gain)));}}
}
