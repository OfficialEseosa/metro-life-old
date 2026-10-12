package app.metrolife;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
/** Rule tests establish physical arrival separately from the movement/door authority tests. */
final class ActivityFixture {
 static ObjectNode act(GameService g,String token,JsonNode body){
  ObjectNode ses=g.session(token,true),s=g.sim(ses);g.decay(s,g.world(ses));
  if(body.path("city").equals(s.path("city"))&&body.path("loc").asText().equals("home")&&s.path("home").path("city").equals(s.path("city"))&&s.path("busyUntil").isNull()){
   for(JsonNode station:g.navigation.interiors.path("home").path("stations"))if(station.path("action").equals(body.path("action"))){s.put("loc","home");g.navigation.position(s).put("room","home:"+s.path("userId").asText()).put("x",station.path("x").asDouble()).put("z",station.path("z").asDouble());}
  }
  return g.act(token,body);
 }
}
