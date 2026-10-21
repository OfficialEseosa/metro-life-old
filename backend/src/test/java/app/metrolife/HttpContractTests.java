package app.metrolife;

import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import org.springframework.web.socket.WebSocketSession;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.junit.jupiter.api.Assertions.*;

/** Browser-cookie journeys through real controllers and a durable save, without Spring startup or sleeps. */
class HttpContractTests {
 @TempDir Path directory;final ObjectMapper mapper=new ObjectMapper();GameService game;MockMvc mvc;Cookie cookie;long now=1_800_000_000_000L;
 @BeforeEach void start()throws Exception{game=new GameService(new JsonStore(mapper,directory.resolve("save.json").toString()),new Content(mapper),mapper);game.time=()->now;game.world(null).put("startedAt",now-4*60000);controller();}
 void restart()throws Exception{game.checkpoint();game=new GameService(new JsonStore(mapper,directory.resolve("save.json").toString()),game.content,mapper);game.time=()->now;controller();}
 void controller(){mvc=MockMvcBuilders.standaloneSetup(new ApiController(game,game.content)).setControllerAdvice(new ErrorHandler()).build();}
 ObjectNode body(){return game.object();}
 JsonNode postTo(String route,JsonNode body)throws Exception{var request=post("/api/"+route).contentType("application/json");if(cookie!=null)request.cookie(cookie);if(body!=null)request.content(body.toString());var response=mvc.perform(request).andExpect(status().isOk()).andReturn().getResponse();return mapper.readTree(response.getContentAsString());}
 JsonNode read(String route)throws Exception{return mapper.readTree(mvc.perform(get("/api/"+route).cookie(cookie)).andExpect(status().isOk()).andReturn().getResponse().getContentAsString());}
 void guest()throws Exception{String header=mvc.perform(post("/api/auth/guest").contentType("application/json").content("{}")).andExpect(status().isOk()).andReturn().getResponse().getHeader("Set-Cookie");assertNotNull(header);assertTrue(header.contains("HttpOnly"));cookie=new Cookie("ml_session",header.split(";")[0].split("=",2)[1]);}
 JsonNode settle(JsonNode accepted)throws Exception{now=accepted.path("sim").path("busyUntil").asLong();return read("sim").path("sim");}
 void walk(double x,double z)throws Exception{for(int i=0;i<80;i++){JsonNode position=read("sim").path("sim").path("position");double dx=x-position.path("x").asDouble(),dz=z-position.path("z").asDouble(),distance=Math.hypot(dx,dz);if(distance<.02)return;double step=Math.min(.4,distance)/distance;now+=200;postTo("move",body().put("city","atl").put("x",position.path("x").asDouble()+dx*step).put("z",position.path("z").asDouble()+dz*step).put("face",Math.atan2(dx,dz)));}fail("Timed walking did not reach furniture");}
 void station(String type,String id)throws Exception{for(JsonNode station:game.navigation.layoutFor(game.sim(game.session(cookie.getValue(),true)),type).path("stations"))if(station.path("id").asText().equals(id)){walk(station.path("x").asDouble(),station.path("z").asDouble());return;}fail("Missing approach "+id);}
 @Test void createChooseCityCookCancelWorkAndResumeTheSameBrowserLife()throws Exception{
  mvc.perform(get("/api/sim")).andExpect(status().isUnauthorized());guest();ObjectNode setup=body().put("username","Rowan Flow").put("pronouns","they").put("city","atl").put("neighborhood","midtown").put("aspiration","restaurateur");mvc.perform(post("/api/sim/setup").cookie(cookie).contentType("application/json").content(body().put("username","A").put("city","atl").put("neighborhood","midtown").put("aspiration","founder").toString())).andExpect(status().isBadRequest());setup.putArray("traits").add("foodie").add("active").add("curious");setup.putObject("look").put("body","m").put("skin","#603c2d").put("hair","braids").put("face","freckled").put("hairColor","#a64f35");
  JsonNode created=postTo("sim/setup",setup).path("sim");assertEquals(150,created.path("cash").asInt());assertEquals("braids",created.path("look").path("hair").asText());postTo("intro/complete",null);assertTrue(read("sim").path("sim").path("position").path("room").asText().startsWith("home:"));
  station("home","stove");JsonNode before=read("sim").path("sim");JsonNode accepted=postTo("act",body().put("city","atl").put("loc","home").put("action","cook"));assertEquals(before.path("cash"),accepted.path("sim").path("cash"));JsonNode cancelled=postTo("action/cancel",null).path("sim");assertTrue(cancelled.path("busyUntil").isNull());assertEquals(before.path("skills"),cancelled.path("skills"));
  JsonNode meal=settle(postTo("act",body().put("city","atl").put("loc","home").put("action","cook")));assertTrue(meal.path("needs").path("hunger").asDouble()>before.path("needs").path("hunger").asDouble());assertTrue(meal.path("skills").path("cooking").path("xp").asInt()>0);
  restart();assertTrue(read("sim").path("sim").path("position").path("room").asText().startsWith("home:"));
  JsonNode exit=game.navigation.layoutFor(game.sim(game.session(cookie.getValue(),true)),"home").path("exit");walk(exit.path("x").asDouble(),exit.path("z").asDouble());postTo("door",body().put("enter",false));settle(postTo("travel",body().put("city","atl").put("loc","techVillage")));postTo("door",body().put("loc","techVillage").put("enter",true));station("work","desk");
  assertTrue(postTo("jobs/apply",body().put("jobId","tech-1")).path("hired").asBoolean());double balance=read("sim").path("sim").path("cash").asDouble();JsonNode shift=postTo("act",body().put("city","atl").put("loc","techVillage").put("action","shift-tech"));assertEquals(balance,shift.path("sim").path("cash").asDouble());JsonNode paid=settle(shift);assertEquals(1,paid.path("job").path("shifts").asInt());assertTrue(paid.path("cash").asDouble()>balance);assertFalse(paid.has("_pendingAction"));
  restart();JsonNode resumed=read("auth/me").path("sim");assertEquals("Rowan Flow",resumed.path("username").asText());assertEquals(paid.path("cash"),resumed.path("cash"));assertEquals(paid.path("job"),resumed.path("job"));assertEquals(created.path("look"),resumed.path("look"));assertEquals(created.path("traits"),resumed.path("traits"));
 }
 @Test void eachHomeCityUsesItsPublishedLeaseAndKeepsItsOwnLife()throws Exception{
  JsonNode world=mapper.readTree(mvc.perform(get("/api/world")).andExpect(status().isOk()).andReturn().getResponse().getContentAsString());int index=0;
  for(String city:List.of("atl","nyc","bay")){guest();JsonNode published=null;for(JsonNode row:world.path("cities"))if(row.path("id").asText().equals(city))published=row;assertNotNull(published);JsonNode start=published.path("startingLife");JsonNode sim=postTo("sim/setup",body().put("username",List.of("Atlanta Flow","New York Flow","Bay Area Flow").get(index++)).put("city",city).put("neighborhood",start.path("neighborhood").asText()).put("aspiration","founder")).path("sim");assertEquals(start.path("rent"),sim.path("home").path("rent"));assertEquals(city,sim.path("home").path("city").asText());assertEquals(150,sim.path("cash").asInt());JsonNode position=sim.path("position");assertTrue(game.navigation.stand(city,position.path("x").asDouble(),position.path("z").asDouble(),""));assertEquals(start.path("payPerShift"),read("jobs?city="+city).path("jobs").get(0).path("payPerHour"));}
 }
 @Test void twoNeighboursChatDecorateTheirOwnHomeAndKeepFriendshipOnReload()throws Exception{
  guest();Cookie first=cookie;JsonNode a=postTo("sim/setup",body().put("username","Alder Friend").put("city","atl").put("neighborhood","midtown").put("aspiration","founder")).path("sim");postTo("intro/complete",null);
  guest();Cookie second=cookie;JsonNode b=postTo("sim/setup",body().put("username","Birch Friend").put("city","atl").put("neighborhood","midtown").put("aspiration","founder")).path("sim");postTo("intro/complete",null);
  LiveWire wire=new LiveWire(game);
  try{
   int index=0;for(Cookie person:List.of(first,second)){cookie=person;WebSocketSession socket=mock(WebSocketSession.class);when(socket.getId()).thenReturn("friend-flow-"+(index++));when(socket.isOpen()).thenReturn(true);when(socket.getAttributes()).thenReturn(Map.of("token",person.getValue(),"wid","public"));wire.afterConnectionEstablished(socket);settle(postTo("travel",body().put("city","atl").put("loc","krog")));postTo("door",body().put("loc","krog").put("enter",true));}
   cookie=first;postTo("social",body().put("targetId",b.path("userId").asText()).put("kind","wave"));now+=3500;postTo("chat",body().put("city","atl").put("text","See you around the neighbourhood"));JsonNode friendship=read("sim").path("sim").path("relationships").path(b.path("userId").asText());assertTrue(friendship.path("value").asInt()>=5);
   cookie=second;assertEquals("See you around the neighbourhood",read("chat?city=atl").path("messages").get(0).path("text").asText());
   cookie=first;settle(postTo("travel",body().put("city","atl").put("loc","home")));postTo("door",body().put("loc","home").put("enter",true));JsonNode home=read("home/design"),plant=null;for(JsonNode product:home.path("catalog").path("items"))if(product.path("category").asText().equals("plants")&&product.path("price").asInt()<=50){plant=product;break;}assertNotNull(plant);
   JsonNode furnished=postTo("home/design",body().put("op","buy").put("catalogId",plant.path("id").asText()).put("x",0).put("z",-2.5).put("rotation",0));assertEquals(home.path("design").path("items").size()+1,furnished.path("design").path("items").size());String colour=home.path("catalog").path("wallColors").get(1).asText();JsonNode painted=postTo("home/design",body().put("op","paint").put("wallColor",colour));
   wire.close();restart();JsonNode resumed=read("auth/me").path("sim");assertEquals(painted.path("design"),resumed.path("homeDesign"));assertEquals(friendship.path("value"),resumed.path("relationships").path(b.path("userId").asText()).path("value"));
   cookie=second;JsonNode neighbour=read("auth/me").path("sim");assertEquals(home.path("design").path("items").size(),neighbour.path("homeDesign").path("items").size());assertEquals(friendship.path("value"),neighbour.path("relationships").path(a.path("userId").asText()).path("value"));
  }finally{wire.close();}
 }
}
