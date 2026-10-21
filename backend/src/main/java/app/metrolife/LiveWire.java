package app.metrolife;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.web.socket.*;
import org.springframework.web.socket.config.annotation.*;
import org.springframework.web.socket.handler.*;
import org.springframework.web.socket.server.HandshakeInterceptor;
import org.springframework.http.server.*;
import jakarta.annotation.PreDestroy;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;

/** World-bound subscriptions. No network write holds the simulation monitor. */
@Configuration @EnableWebSocket @EnableScheduling
public class LiveWire extends TextWebSocketHandler implements WebSocketConfigurer {
 @org.springframework.beans.factory.annotation.Value("${metro.ws.origins:http://localhost:5173,http://127.0.0.1:5173,http://localhost:8080,http://127.0.0.1:8080}")
 String origins="http://localhost:5173,http://127.0.0.1:5173,http://localhost:8080,http://127.0.0.1:8080";
 long lastCheckpoint;
 final GameService g;
 final ConcurrentHashMap<String,Client> clients=new ConcurrentHashMap<>();
 final ExecutorService sends=Executors.newVirtualThreadPerTaskExecutor();
 static final class Client {final WebSocketSession ws;final String token,wid;String uid="",city="atl",presence="",positions="",sim="",clock="";final Set<String> chatSeen=new LinkedHashSet<>();final Queue<String> outgoing=new ConcurrentLinkedQueue<>();final AtomicBoolean draining=new AtomicBoolean();final Map<String,Integer> resources=new HashMap<>();Client(WebSocketSession ws,String token,String wid){this.ws=new ConcurrentWebSocketSessionDecorator(ws,2000,65536);this.token=token;this.wid=wid;}}
 LiveWire(GameService g){this.g=g;}
 @Override public void registerWebSocketHandlers(WebSocketHandlerRegistry registry){registry.addHandler(this,"/ws").setAllowedOrigins(origins.split(",")).addInterceptors(new HandshakeInterceptor(){
  public boolean beforeHandshake(ServerHttpRequest request,ServerHttpResponse response,WebSocketHandler handler,Map<String,Object> attributes){String token="";for(String cookie:request.getHeaders().getOrEmpty("Cookie"))for(String part:cookie.split(";"))if(part.trim().startsWith("ml_session="))token=part.trim().substring(11);synchronized(g){ObjectNode session=g.session(token,false);if(session==null){response.setStatusCode(org.springframework.http.HttpStatus.UNAUTHORIZED);return false;}attributes.put("token",token);attributes.put("wid",g.world(session).path("id").asText());return true;}}
  public void afterHandshake(ServerHttpRequest request,ServerHttpResponse response,WebSocketHandler handler,Exception exception){}
 });}
 @Override public void afterConnectionEstablished(WebSocketSession session){Client c=new Client(session,(String)session.getAttributes().get("token"),(String)session.getAttributes().get("wid"));clients.put(session.getId(),c);synchronized(g){ObjectNode ses=g.session(c.token,true),w=g.world(ses);g.community.touch(w);String uid=ses.path("userId").asText();c.uid=uid;JsonNode s=g.table("sims").get(g.simKey(ses));if(s instanceof ObjectNode sim){g.navigation.resumePosture(sim);c.city=sim.path("city").asText();}g.community.online.put(c.wid+":"+uid,g.now());send(c,g.object().put("type","hello").put("worldId",c.wid).set("clock",g.clock(w)).toString());}}
 @Override protected void handleTextMessage(WebSocketSession session,TextMessage message)throws Exception{Client c=clients.get(session.getId());if(c==null)return;if(message.getPayloadLength()>1024){session.close(CloseStatus.TOO_BIG_TO_PROCESS);return;}try{JsonNode frame=g.mapper.readTree(message.getPayload());if(frame.path("type").asText().equals("view")){String city=frame.path("city").asText();synchronized(g){g.content.city(city);c.city=city;c.presence="";c.positions="";c.resources.clear();c.chatSeen.clear();}}else if(!frame.path("type").asText().equals("ping"))session.close(CloseStatus.BAD_DATA);}catch(Exception e){session.close(CloseStatus.BAD_DATA);}}
 void drop(Client c){clients.values().remove(c);synchronized(g){if(clients.values().stream().noneMatch(other->other.wid.equals(c.wid)&&other.uid.equals(c.uid)&&other.ws.isOpen()))g.community.online.remove(c.wid+":"+c.uid);}}
 @Override public void afterConnectionClosed(WebSocketSession session,CloseStatus status){Client c=clients.get(session.getId());if(c!=null)drop(c);}
 void send(Client c,String frame){if(c.outgoing.size()>64){drop(c);sends.submit(()->{try{c.ws.close(CloseStatus.SESSION_NOT_RELIABLE);}catch(Exception ignored){}});return;}c.outgoing.add(frame);drain(c);}
 void drain(Client c){if(!c.draining.compareAndSet(false,true))return;sends.submit(()->{try{String text;while((text=c.outgoing.poll())!=null)if(c.ws.isOpen())c.ws.sendMessage(new TextMessage(text));}catch(Exception e){drop(c);try{c.ws.close(CloseStatus.SESSION_NOT_RELIABLE);}catch(Exception ignored){}}finally{c.draining.set(false);if(!c.outgoing.isEmpty()&&c.ws.isOpen())drain(c);}});}
 @Scheduled(fixedDelay=200) public void motionTick(){List<Map.Entry<Client,String>> frames=new ArrayList<>();synchronized(g){g.residentMotion.tick();for(String wid:clients.values().stream().map(c->c.wid).distinct().toList())g.community.preparePresence(wid);for(Client c:clients.values()){ObjectNode ses=g.session(c.token,false);if(ses==null||!g.world(ses).path("id").asText().equals(c.wid))continue;var points=g.mapper.createArrayNode();for(JsonNode table:List.of(g.table("sims"),g.community.residents().path(c.wid)))for(JsonNode row:table)if(row.path("worldId").asText().equals(c.wid)&&row.path("city").asText().equals(c.city)&&row.has("position")&&(row.path("npc").asBoolean()||g.community.isOnline(c.wid,row.path("userId").asText()))){ObjectNode p=points.addObject().put("socialBusy",g.community.socialBusy(row)).put("id",row.path("userId").asText()).put("loc",row.path("loc").asText()).put("activity",row.path("npc").asBoolean()?row.path("activity").asText("walk"):row.path("busyKind").asText("idle"));p.set("position",row.path("position").deepCopy());p.set("activitySlot",row.path("activitySlot").isMissingNode()?g.mapper.nullNode():row.path("activitySlot").deepCopy());}String text=points.toString();if(!text.equals(c.positions)){c.positions=text;ObjectNode f=g.object().put("type","positions").put("city",c.city).put("at",g.now());f.set("players",points);frames.add(Map.entry(c,f.toString()));}}}for(var frame:frames)send(frame.getKey(),frame.getValue());}
 @Scheduled(fixedDelay=1000) public void tick(){List<Map.Entry<Client,String>> frames=new ArrayList<>();List<Client> invalid=new ArrayList<>();synchronized(g){
  for(Client c:clients.values()){ObjectNode session=g.session(c.token,false);if(!c.ws.isOpen()||session==null||!g.world(session).path("id").asText().equals(c.wid)){invalid.add(c);continue;}g.community.online.put(c.wid+":"+session.path("userId").asText(),g.now());g.community.activeWorlds.put(c.wid,g.now());}
  g.community.tick();
  for(Client c:clients.values()){if(invalid.contains(c))continue;ObjectNode ses=g.session(c.token,false),w=g.world(ses);ObjectNode p=g.community.players(w,c.city);String presence=p.path("players").toString();if(!presence.equals(c.presence)){c.presence=presence;ObjectNode f=g.object().put("type","presence").put("city",c.city);f.set("players",p.path("players"));frames.add(Map.entry(c,f.toString()));}
   JsonNode time=g.clock(w);String clock=time.path("day").asText()+":"+time.path("hour").asText();if(!clock.equals(c.clock)){c.clock=clock;ObjectNode f=g.object().put("type","clock");f.set("clock",time);frames.add(Map.entry(c,f.toString()));}
   JsonNode s=g.table("sims").get(g.simKey(ses));if(s instanceof ObjectNode sim){g.decay(sim,w);String key=sim.path("cash")+":"+sim.path("busyUntil")+":"+sim.path("loc")+":"+sim.path("pendingBeat")+":"+sim.path("job")+":"+sim.path("aspiration")+":"+sim.path("_socialAt");if(!key.equals(c.sim)){boolean initial=c.sim.isEmpty();c.sim=key;ObjectNode f=g.object().put("type","event").put("kind","story").put("city",sim.path("city").asText());if(!initial&&!sim.path("_socialFrom").asText().equals(sim.path("userId").asText())&&sim.path("_socialAt").asLong()>g.now()-5000)f.put("text",sim.path("_socialText").asText());frames.add(Map.entry(c,f.toString()));}}
   for(String kind:List.of("mayor","plots","billboards","homes")){JsonNode resource=kind.equals("mayor")?g.civic.state(w,c.city):kind.equals("homes")?g.property.homes(c.token,c.city):g.property.state(w,c.city).path(kind.equals("plots")?"plots":"billboards");int hash=resource.hashCode();Integer old=c.resources.put(kind,hash);if(old==null||old!=hash)frames.add(Map.entry(c,g.object().put("type","event").put("kind",kind).put("city",c.city).toString()));}
   for(JsonNode m:g.community.history(w,c.city)){if(c.chatSeen.add(m.path("id").asText())){ObjectNode f=g.object().put("type","chat");f.set("message",m);frames.add(Map.entry(c,f.toString()));}}while(c.chatSeen.size()>100)c.chatSeen.remove(c.chatSeen.iterator().next());
  }
  if(g.now()-lastCheckpoint>=5000&&(!clients.isEmpty()||!g.community.activeWorlds.isEmpty())){g.checkpoint();lastCheckpoint=g.now();}
 }for(Client c:invalid){drop(c);sends.submit(()->{try{c.ws.close(CloseStatus.POLICY_VIOLATION);}catch(Exception ignored){}});}for(var frame:frames)send(frame.getKey(),frame.getValue());}
 @PreDestroy void close(){for(Client c:clients.values())try{c.ws.close();}catch(Exception ignored){}sends.shutdownNow();}
}
