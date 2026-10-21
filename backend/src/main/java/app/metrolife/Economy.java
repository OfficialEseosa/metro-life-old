package app.metrolife;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.*;
import java.util.*;

/** Itemised, durable money journal and a small daily budget forecast. */
final class Economy {
 final GameService g;
 Economy(GameService g){this.g=g;}
 void ensure(ObjectNode s){if(!s.path("ledger").isArray()){s.putArray("ledger");s.put("_ledgerBalance",s.path("cash").asDouble());append(s,s.path("cash").asDouble(),"Balance when this journal began");}}
 void append(ObjectNode s,double amount,String reason){if(Math.abs(amount)<.005)return;ObjectNode w=(ObjectNode)g.table("worlds").get(s.path("worldId").asText());ObjectNode row=s.withArray("ledger").addObject().put("id",g.id()).put("at",g.now()).put("day",w==null?1:g.civic.day(w)).put("amount",Math.round(amount*100)/100.0).put("reason",reason).put("balance",Math.round(s.path("cash").asDouble()*100)/100.0);if(w!=null)row.set("clock",g.clock(w));ArrayNode rows=s.withArray("ledger");while(rows.size()>300)rows.remove(0);}
 /** Called after a money mutation. Splitting a shift into cost/pay/reward keeps each reason visible. */
 void record(ObjectNode s,double amount,String reason){if(!s.path("ledger").isArray()){s.putArray("ledger");double before=s.path("cash").asDouble()-amount;s.put("_ledgerBalance",before);append(s,before,"Balance when this journal began");}append(s,amount,reason);s.put("_ledgerBalance",s.path("cash").asDouble());}
 void capture(ObjectNode s){ensure(s);double change=s.path("cash").asDouble()-s.path("_ledgerBalance").asDouble(s.path("cash").asDouble());if(Math.abs(change)>.005){String reason=s.path("_moneyReason").asText();if(reason.isEmpty())reason=change>0?"Goal, story or milestone reward":"Activity or household expense";record(s,change,reason);}s.remove("_moneyReason");}
 void credit(ObjectNode s,double amount,String reason){capture(s);s.put("cash",s.path("cash").asDouble()+amount);s.withObject("moneyToday").put("income",s.path("moneyToday").path("income").asDouble()+amount);record(s,amount,reason);}
 void decayNeeds(ObjectNode s,double hours){double[] rates={.75,1,.7,.6};for(int i=0;i<Content.NEEDS.length;i++){String need=Content.NEEDS[i];s.withObject("needs").put(need,Math.max(0,s.path("needs").path(need).asDouble()-rates[i]*hours*Personality.needDecayMultiplier(s,need)));}s.withObject("needs").put("hygiene",Math.max(0,s.path("needs").path("hygiene").asDouble(85)-.65*hours));}
 ObjectNode read(ObjectNode s,ObjectNode w){capture(s);ObjectNode out=g.object();out.set("entries",s.path("ledger").deepCopy());double rent=s.path("home").path("rent").asDouble(),food=24,pay=0;JsonNode job=s.path("job");if(job.isObject()){pay=job.path("payPerHour").asDouble(job.path("hourlyPay").asDouble(job.path("pay").asDouble()));if(pay==0){String track=job.path("track").asText();for(JsonNode career:g.content.world.path("careers"))if(career.path("track").asText().equals(track))for(JsonNode level:career.path("levels"))if(level.path("level").asInt()==job.path("level").asInt())pay=level.path("payPerHour").asDouble();}}
  int day=g.civic.day(w);long next=g.civic.dayAt(w,day+1);boolean low=s.path("cash").asDouble()<rent+food+s.path("rentDebt").asDouble();ObjectNode forecast=out.putObject("forecast").put("rent",rent).put("food",food).put("expectedPay",pay).put("dailyNet",pay-rent-food).put("nextRentAt",next).put("rentDebt",s.path("rentDebt").asDouble()).put("lowRent",low).put("warning",low?"Your balance may not cover the next rent and meals. Work a shift or choose a cheaper home.":"");forecast.put("payAssumption",job.isObject()?"One healthy shift; actual pay depends on your job and mood":"No job income assumed");out.putObject("ratesPerGameHour").put("energy",.75).put("hunger",1).put("fun",.7).put("social",.6).put("hygiene",.65);return out;
 }
}
