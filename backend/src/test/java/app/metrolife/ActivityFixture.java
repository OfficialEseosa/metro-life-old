package app.metrolife;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
/** Rule tests establish physical arrival separately from the movement/door authority tests. */
final class ActivityFixture {
 static ObjectNode setup(GameService g,String token,JsonNode body){if(g.table("sims").isEmpty())g.world(g.session(token,true)).put("startedAt",g.now());ObjectNode input=((ObjectNode)body).deepCopy();String name=g.user(g.session(token,true)).path("username").asText();if(name.length()>20)name=name.substring(0,20).strip();input.put("username",name);ObjectNode out=g.setup(token,input),sim=g.sim(g.session(token,true));sim.put("cash",2500).put("introDone",true);sim.remove("firstDay");sim.withObject("home").remove("kind");sim.withObject("home").put("rent",g.content.neighborhood(sim.path("city").asText(),sim.path("home").path("neighborhood").asText()).path("rent").asInt());g.store.save();out.set("sim",g.publicSim(sim));return out;}
 static ObjectNode apply(GameService g,String token,JsonNode body){ObjectNode ses=g.session(token,true),s=g.sim(ses);g.decay(s,g.world(ses));for(JsonNode job:g.jobs(token,s.path("city").asText()).path("jobs"))if(job.path("id").equals(body.path("jobId"))&&s.path("loc").equals(job.path("loc"))&&s.path("busyUntil").isNull()){s.remove("position");for(JsonNode station:g.navigation.layout(s.path("city").asText(),g.navigation.type(s.path("city").asText(),job.path("loc").asText())).path("stations"))if(station.path("id").asText().equals("desk"))g.navigation.position(s).put("room",g.navigation.roomId(s,job.path("loc").asText())).put("x",station.path("x").asDouble()).put("z",station.path("z").asDouble());}return g.applyJob(token,body);}
 static ObjectNode act(GameService g,String token,JsonNode body){
  ObjectNode ses=g.session(token,true),s=g.sim(ses);g.decay(s,g.world(ses));
  if(body.path("city").equals(s.path("city"))&&body.path("loc").asText().equals("home")&&s.path("home").path("city").equals(s.path("city"))&&s.path("busyUntil").isNull()){
   for(JsonNode station:g.navigation.layout(s.path("city").asText(),"home").path("stations"))if(station.path("action").equals(body.path("action"))){s.put("loc","home");g.navigation.position(s).put("room","home:"+s.path("userId").asText()).put("x",station.path("x").asDouble()).put("z",station.path("z").asDouble());}
  }
  if(body.path("city").equals(s.path("city"))&&!body.path("loc").asText().equals("home")&&s.path("busyUntil").isNull()){
   String loc=body.path("loc").asText(),type=g.navigation.type(s.path("city").asText(),loc);s.put("loc",loc);s.remove("position");ObjectNode p=g.navigation.position(s);if(!type.isEmpty()){p.put("room",g.navigation.roomId(s,loc));JsonNode station=g.navigation.layout(s.path("city").asText(),type).path("stations").get(0);for(JsonNode a:g.content.landmark(s.path("city").asText(),loc).path("actions"))if(a.path("id").equals(body.path("action")))for(JsonNode row:g.navigation.layout(s.path("city").asText(),type).path("stations"))if(a.path("requires").has("job")&&row.path("id").asText().equals("desk")||!a.path("requires").has("job")&&type.equals("club")&&a.path("kind").asText().equals("work")&&row.path("id").asText().equals("stage"))station=row;p.put("x",station.path("x").asDouble()).put("z",station.path("z").asDouble());}
  }
  return g.act(token,body);
 }
}
