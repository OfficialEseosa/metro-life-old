package app.metrolife;

import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import java.nio.file.Path;
import java.util.*;
import org.springframework.web.socket.WebSocketSession;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.junit.jupiter.api.Assertions.*;

/** Browser-cookie journeys through real controllers and a durable save, without Spring startup or sleeps. */
class HttpContractTests {
 @TempDir Path directory;final ObjectMapper mapper=new ObjectMapper();GameService game;MockMvc mvc;Cookie cookie;long now=1_800_000_000_000L;
 @BeforeEach void start()throws Exception{game=new GameService(new JsonStore(mapper,directory.resolve("save.json").toString()),new Content(mapper),mapper);game.time=()->now;ActivityFixture.classicClock(game);game.world(null).put("startedAt",now-4*60000);controller();}
 void restart()throws Exception{game.checkpoint();game=new GameService(new JsonStore(mapper,directory.resolve("save.json").toString()),game.content,mapper);game.time=()->now;controller();}
 void controller(){mvc=MockMvcBuilders.standaloneSetup(new ApiController(game,game.content)).setControllerAdvice(new ErrorHandler()).build();}
 ObjectNode body(){return game.object();}
 JsonNode postTo(String route,JsonNode body)throws Exception{var request=post("/api/"+route).contentType("application/json");if(cookie!=null)request.cookie(cookie);if(body!=null)request.content(body.toString());var response=mvc.perform(request).andExpect(status().isOk()).andReturn().getResponse();return mapper.readTree(response.getContentAsString());}
 JsonNode read(String route)throws Exception{return mapper.readTree(mvc.perform(get("/api/"+route).cookie(cookie)).andExpect(status().isOk()).andReturn().getResponse().getContentAsString());}
 void guest()throws Exception{String header=mvc.perform(post("/api/auth/guest").contentType("application/json").content("{}")).andExpect(status().isOk()).andReturn().getResponse().getHeader("Set-Cookie");assertNotNull(header);assertTrue(header.contains("HttpOnly"));cookie=new Cookie("ml_session",header.split(";")[0].split("=",2)[1]);}
 JsonNode settle(JsonNode accepted)throws Exception{now=accepted.path("sim").path("busyUntil").asLong();return read("sim").path("sim");}
 void walk(double targetX,double targetZ)throws Exception{
  ObjectNode sim=game.sim(game.session(cookie.getValue(),true));JsonNode at=sim.path("position");String room=at.path("room").asText("");double startX=at.path("x").asDouble(),startZ=at.path("z").asDouble(),step=.4;
  ArrayDeque<int[]> queue=new ArrayDeque<>();Map<String,String> parents=new HashMap<>();Map<String,int[]> cells=new HashMap<>();queue.add(new int[]{0,0});parents.put("0:0",null);cells.put("0:0",new int[]{0,0});String found=null;
  while(!queue.isEmpty()&&cells.size()<16000){int[] cell=queue.remove();double x=startX+cell[0]*step,z=startZ+cell[1]*step;String key=cell[0]+":"+cell[1];if(Math.hypot(targetX-x,targetZ-z)<.6&&clearWalk(sim,room,x,z,targetX,targetZ)){found=key;break;}for(int[] dir:new int[][]{{1,0},{-1,0},{0,1},{0,-1}}){int nx=cell[0]+dir[0],nz=cell[1]+dir[1];String next=nx+":"+nz;double px=startX+nx*step,pz=startZ+nz*step;if(!parents.containsKey(next)&&clearWalk(sim,room,x,z,px,pz)){parents.put(next,key);cells.put(next,new int[]{nx,nz});queue.add(new int[]{nx,nz});}}}
  assertNotNull(found,"No authored walking route to furniture");List<double[]> points=new ArrayList<>();for(String key=found;key!=null;key=parents.get(key)){int[] cell=cells.get(key);points.add(new double[]{startX+cell[0]*step,startZ+cell[1]*step});}Collections.reverse(points);points.add(new double[]{targetX,targetZ});for(double[] point:points){JsonNode current=read("sim").path("sim").path("position");double dx=point[0]-current.path("x").asDouble(),dz=point[1]-current.path("z").asDouble();if(Math.hypot(dx,dz)<.001)continue;now+=200;postTo("move",body().put("city",sim.path("city").asText()).put("x",point[0]).put("z",point[1]).put("face",Math.atan2(dx,dz)));}
 }
 boolean clearWalk(ObjectNode sim,String room,double x,double z,double tx,double tz){int count=Math.max(1,(int)Math.ceil(Math.hypot(tx-x,tz-z)/.1));for(int i=1;i<=count;i++)if(!game.navigation.stand(sim.path("city").asText(),x+(tx-x)*i/count,z+(tz-z)*i/count,room))return false;return true;}
 void station(String type,String id)throws Exception{for(JsonNode station:game.navigation.layoutFor(game.sim(game.session(cookie.getValue(),true)),type).path("stations"))if(station.path("id").asText().equals(id)){walk(station.path("x").asDouble(),station.path("z").asDouble());return;}fail("Missing approach "+id);}
 @Test void createChooseCityCookCancelWorkAndResumeTheSameBrowserLife()throws Exception{
  mvc.perform(get("/api/sim")).andExpect(status().isUnauthorized());guest();ObjectNode setup=body().put("username","Rowan Flow").put("pronouns","they").put("city","atl").put("neighborhood","midtown").put("aspiration","restaurateur");mvc.perform(post("/api/sim/setup").cookie(cookie).contentType("application/json").content(body().put("username","A").put("city","atl").put("neighborhood","midtown").put("aspiration","founder").toString())).andExpect(status().isBadRequest());setup.putArray("traits").add("foodie").add("active").add("curious");setup.putObject("look").put("body","m").put("skin","#603c2d").put("hair","braids").put("face","freckled").put("hairColor","#a64f35");
  JsonNode created=postTo("sim/setup",setup).path("sim");assertEquals(150,created.path("cash").asInt());assertEquals("braids",created.path("look").path("hair").asText());postTo("intro/complete",null);assertTrue(read("sim").path("sim").path("position").path("room").asText().startsWith("home:"));
  station("home","stove");JsonNode before=read("sim").path("sim");JsonNode accepted=postTo("act",body().put("city","atl").put("loc","home").put("action","cook"));assertEquals(before.path("cash"),accepted.path("sim").path("cash"));JsonNode cancelled=postTo("action/cancel",null).path("sim");assertTrue(cancelled.path("busyUntil").isNull());assertEquals(before.path("skills"),cancelled.path("skills"));
  JsonNode meal=settle(postTo("act",body().put("city","atl").put("loc","home").put("action","cook")));assertTrue(meal.path("needs").path("hunger").asDouble()>before.path("needs").path("hunger").asDouble());assertTrue(meal.path("skills").path("cooking").path("xp").asInt()>0);
  restart();assertTrue(read("sim").path("sim").path("position").path("room").asText().startsWith("home:"));
  JsonNode exit=game.navigation.layoutFor(game.sim(game.session(cookie.getValue(),true)),"home").path("exit");walk(exit.path("x").asDouble(),exit.path("z").asDouble());postTo("door",body().put("enter",false));settle(postTo("travel",body().put("city","atl").put("loc","techVillage")));postTo("door",body().put("loc","techVillage").put("enter",true));station(game.navigation.type("atl","techVillage"),"desk");
  assertTrue(postTo("jobs/apply",body().put("jobId","tech-1")).path("hired").asBoolean());now=ActivityFixture.nextWorkOpening(game,game.sim(game.session(cookie.getValue(),true)));double balance=read("sim").path("sim").path("cash").asDouble();JsonNode shift=postTo("act",body().put("city","atl").put("loc","techVillage").put("action","shift-tech"));assertEquals(balance,shift.path("sim").path("cash").asDouble());JsonNode paid=settle(shift);assertEquals(1,paid.path("job").path("shifts").asInt());assertTrue(paid.path("cash").asDouble()>balance);assertFalse(paid.has("_pendingAction"));
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
 @Test void quickStartInviteSharedEmotesOpenHouseAndLikesSurviveCookieReload()throws Exception{
  // This new journey deliberately exercises the default seven-minute clock, unlike classic boundary fixtures.
  ObjectNode world=game.world(null);world.remove(List.of("minuteMs","clockAnchorAt","clockAnchorMinutes"));guest();Cookie hostCookie=cookie;
  JsonNode host=postTo("quick-start",body().put("city","atl").put("username","Maple Host")).path("sim");String hostId=host.path("userId").asText();assertTrue(host.path("introDone").asBoolean());assertEquals("ponce",host.path("loc").asText());assertTrue(host.path("position").path("room").isNull());assertEquals(420000.0/1440,read("sim").path("clock").path("msPerMinute").asDouble(),.001);String code=postTo("invite",null).path("code").asText();assertFalse(code.isBlank());
  guest();Cookie visitorCookie=cookie;JsonNode visitor=postTo("quick-start",body().put("city","nyc").put("username","Rowan Visitor").put("invite",code)).path("sim");String visitorId=visitor.path("userId").asText();assertEquals("atl",visitor.path("city").asText());assertEquals("ponce",visitor.path("loc").asText());JsonNode originalHome=visitor.path("home").deepCopy();assertEquals("nyc",originalHome.path("city").asText());
  LiveWire wire=new LiveWire(game);try{
   int index=0;for(Cookie person:List.of(hostCookie,visitorCookie)){WebSocketSession socket=mock(WebSocketSession.class);when(socket.getId()).thenReturn("quick-social-flow-"+(index++));when(socket.isOpen()).thenReturn(true);when(socket.getAttributes()).thenReturn(Map.of("token",person.getValue(),"wid","public"));wire.afterConnectionEstablished(socket);}
   cookie=hostCookie;postTo("emote",body().put("kind","wave"));cookie=visitorCookie;JsonNode seen=null;for(JsonNode player:read("players?city=atl").path("players"))if(player.path("id").asText().equals(hostId))seen=player;assertNotNull(seen);assertTrue(seen.path("online").asBoolean());assertEquals("Wave",seen.path("lifeAction").path("pose").asText());assertFalse(seen.has("relationships"));
   postTo("emote",body().put("kind","dance"));now+=1000;cookie=hostCookie;JsonNode dance=postTo("emote",body().put("kind","dance")).path("sim");assertEquals("Dance",dance.path("lifeAction").path("pose").asText());assertTrue(dance.path("lifeAction").path("text").asText().contains("2"));postTo("open-house",body().put("open",true));
   cookie=visitorCookie;JsonNode visit=postTo("open-house/visit",body().put("ownerId",hostId)).path("sim");assertEquals("home:"+hostId,visit.path("position").path("room").asText());assertEquals(originalHome,visit.path("home"));postTo("open-house/like",body().put("ownerId",hostId));mvc.perform(post("/api/open-house/like").cookie(cookie).contentType("application/json").content(body().put("ownerId",hostId).toString())).andExpect(status().isConflict());
   JsonNode openHome=null;for(JsonNode home:read("social-life?city=atl").path("openHouses"))if(home.path("ownerId").asText().equals(hostId))openHome=home;assertNotNull(openHome);assertEquals(1,openHome.path("likes").asInt());wire.close();restart();
   cookie=visitorCookie;JsonNode resumed=read("auth/me").path("sim");assertEquals(visitorId,resumed.path("userId").asText());assertEquals("home:"+hostId,resumed.path("position").path("room").asText());assertEquals(originalHome,resumed.path("home"));assertTrue(resumed.path("relationships").path(hostId).path("value").asInt()>=2);
   cookie=hostCookie;JsonNode hostReload=read("auth/me").path("sim");assertEquals(hostId,hostReload.path("userId").asText());assertTrue(hostReload.path("openHouse").asBoolean());assertEquals(1,hostReload.path("homeLikes").asInt());assertEquals(code,postTo("invite",null).path("code").asText());
  }finally{wire.close();}
 }

}
