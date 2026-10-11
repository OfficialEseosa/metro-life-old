package app.metrolife;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.web.socket.*;
import java.nio.file.Path;
import java.util.*;
import java.util.concurrent.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class LiveWireTests {
 @TempDir Path dir; GameService g; LiveWire wire; String token,wid; ObjectMapper mapper=new ObjectMapper();
 @BeforeEach void setup()throws Exception{g=new GameService(new JsonStore(mapper,dir.resolve("save.json").toString()),new Content(mapper),mapper);token=g.guest(null,mapper.readTree("{}")).token();g.createWorld(token,mapper.readTree("{\"name\":\"Socket test\",\"mode\":\"private\"}"));g.setup(token,mapper.readTree("{\"city\":\"atl\",\"neighborhood\":\"midtown\",\"aspiration\":\"founder\"}"));wid=g.world(g.session(token,true)).path("id").asText();wire=new LiveWire(g);}
 @AfterEach void close(){wire.close();}
 WebSocketSession socket(String id){WebSocketSession ws=mock(WebSocketSession.class);when(ws.getId()).thenReturn(id);when(ws.isOpen()).thenReturn(true);when(ws.getAttributes()).thenReturn(Map.of("token",token,"wid",wid));return ws;}
 @Test void cityFramesAreFilteredAndInvalidMessagesClose()throws Exception{WebSocketSession ws=socket("city");List<String> frames=new CopyOnWriteArrayList<>();doAnswer(i->{frames.add(((TextMessage)i.getArgument(0)).getPayload());return null;}).when(ws).sendMessage(any());wire.afterConnectionEstablished(ws);wire.handleTextMessage(ws,new TextMessage("{\"type\":\"view\",\"city\":\"nyc\"}"));wire.tick();long until=System.nanoTime()+TimeUnit.SECONDS.toNanos(3);while(frames.stream().noneMatch(f->f.contains("presence"))&&System.nanoTime()<until)Thread.sleep(10);var presence=frames.stream().map(f->{try{return mapper.readTree(f);}catch(Exception e){throw new RuntimeException(e);}}).filter(f->f.path("type").asText().equals("presence")).findFirst().orElseThrow();assertEquals("nyc",presence.path("city").asText());for(var p:presence.path("players"))assertEquals("nyc",p.path("city").asText());wire.handleTextMessage(ws,new TextMessage("{\"type\":\"view\",\"city\":\"forged\"}"));verify(ws).close(CloseStatus.BAD_DATA);}
 @Test void worldSwitchAndLogoutRevokeBoundSubscriptions()throws Exception{WebSocketSession ws=socket("old-world");wire.afterConnectionEstablished(ws);g.createWorld(token,mapper.readTree("{\"name\":\"Other world\",\"mode\":\"solo\"}"));wire.tick();verify(ws,timeout(3000)).close(CloseStatus.POLICY_VIOLATION);assertFalse(wire.clients.containsKey("old-world"));WebSocketSession next=socket("logout");when(next.getAttributes()).thenReturn(Map.of("token",token,"wid",g.world(g.session(token,true)).path("id").asText()));wire.afterConnectionEstablished(next);g.logout(token);wire.tick();verify(next,timeout(3000)).close(CloseStatus.POLICY_VIOLATION);}
 @Test void blockedNetworkWriteDoesNotHoldSimulationOrOtherClients()throws Exception{CountDownLatch blocked=new CountDownLatch(1),release=new CountDownLatch(1);WebSocketSession slow=socket("slow"),fast=socket("fast");doAnswer(i->{blocked.countDown();release.await(4,TimeUnit.SECONDS);return null;}).when(slow).sendMessage(any());wire.afterConnectionEstablished(slow);assertTrue(blocked.await(2,TimeUnit.SECONDS));try{assertTimeoutPreemptively(java.time.Duration.ofSeconds(1),()->{synchronized(g){assertNotNull(g.getSim(token));}});wire.afterConnectionEstablished(fast);wire.tick();verify(fast,timeout(2000).atLeastOnce()).sendMessage(any());}finally{release.countDown();}}
}
