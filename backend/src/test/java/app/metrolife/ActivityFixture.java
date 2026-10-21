package app.metrolife;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
/** Arrange a settled life or furniture arrival for API flows that focus on timing and durable state. */
final class ActivityFixture {
 /** Older boundary journeys explicitly use classic pace; quick-start flows exercise the default showcase pace. */
 static void classicClock(GameService g){ObjectNode w=g.world(null);w.put("minuteMs",1000);w.remove("clockAnchorAt");w.remove("clockAnchorMinutes");}
 static long nextWorkOpening(GameService g,ObjectNode sim){ObjectNode w=g.world(null);if(CareerRhythm.jobReason(g,sim,w).isEmpty())return g.now();long current=g.absoluteMinutes(w),day=(current/1440),target=day*1440+CareerRhythm.hours(sim.path("job").path("track").asText())[0]*60L;if(target<=current||sim.path("_workRhythm").path("lastShiftDay").asInt(-1)==g.civic.day(w))target+=1440;return Math.max(g.now(),g.gameInstant(w,target));}
 static JsonNode station(GameService g,ObjectNode sim,String id){String type=g.navigation.type(sim.path("city").asText(),sim.path("loc").asText());for(JsonNode point:g.navigation.layoutFor(sim,type).path("stations"))if(point.path("id").asText().equals(id))return point;throw new AssertionError("Missing station "+id);}
 static ObjectNode setup(GameService g,String token,JsonNode body){if(g.table("sims").isEmpty()){classicClock(g);g.world(g.session(token,true)).put("startedAt",g.now());}ObjectNode input=((ObjectNode)body).deepCopy();String name=g.user(g.session(token,true)).path("username").asText();if(name.length()>20)name=name.substring(0,20).strip();input.put("username",name);ObjectNode out=g.setup(token,input),sim=g.sim(g.session(token,true));sim.put("cash",2500).put("introDone",true);sim.remove("firstDay");sim.withObject("home").remove("kind");sim.withObject("home").put("rent",g.content.neighborhood(sim.path("city").asText(),sim.path("home").path("neighborhood").asText()).path("rent").asInt());g.store.save();out.set("sim",g.publicSim(sim));return out;}
 static ObjectNode apply(GameService g,String token,JsonNode body){ObjectNode ses=g.session(token,true),s=g.sim(ses);g.decay(s,g.world(ses));for(JsonNode job:g.jobs(token,s.path("city").asText()).path("jobs"))if(job.path("id").equals(body.path("jobId"))&&s.path("loc").equals(job.path("loc"))&&s.path("busyUntil").isNull()){s.remove("position");for(JsonNode station:g.navigation.layoutFor(s,g.navigation.type(s.path("city").asText(),job.path("loc").asText())).path("stations"))if(station.path("id").asText().equals("desk"))g.navigation.position(s).put("room",g.navigation.roomId(s,job.path("loc").asText())).put("x",station.path("x").asDouble()).put("z",station.path("z").asDouble());}return g.applyJob(token,body);}
 static ObjectNode act(GameService g,String token,JsonNode body){
  ObjectNode ses=g.session(token,true),s=g.sim(ses);g.decay(s,g.world(ses));
  if(body.path("city").equals(s.path("city"))&&body.path("loc").asText().equals("home")&&s.path("home").path("city").equals(s.path("city"))&&s.path("busyUntil").isNull()){
   for(JsonNode station:g.navigation.layoutFor(s,"home").path("stations"))if(station.path("action").equals(body.path("action"))){s.put("loc","home");g.navigation.position(s).put("room","home:"+s.path("userId").asText()).put("x",station.path("x").asDouble()).put("z",station.path("z").asDouble());}
  }
  if(body.path("city").equals(s.path("city"))&&!body.path("loc").asText().equals("home")&&s.path("busyUntil").isNull()){
   String loc=body.path("loc").asText(),type=g.navigation.type(s.path("city").asText(),loc);s.put("loc",loc);s.remove("position");ObjectNode p=g.navigation.position(s);if(!type.isEmpty()){p.put("room",g.navigation.roomId(s,loc));JsonNode station=g.navigation.layoutFor(s,type).path("stations").get(0);for(JsonNode a:g.content.landmark(s.path("city").asText(),loc).path("actions"))if(a.path("id").equals(body.path("action"))){String required=g.navigation.activityUse(s.path("city").asText(),type,a).path("station").asText();for(JsonNode row:g.navigation.layoutFor(s,type).path("stations"))if(row.path("id").asText().equals(required))station=row;}p.put("x",station.path("x").asDouble()).put("z",station.path("z").asDouble());}
  }
  ObjectNode confirmed=((ObjectNode)body).deepCopy();confirmed.put("confirm",true);return g.act(token,confirmed);
 }
}
