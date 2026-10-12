package app.metrolife;
import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.io.TempDir;
import java.nio.file.Path;
import static org.junit.jupiter.api.Assertions.*;

class InteriorTests {
 @TempDir Path dir;ObjectMapper m=new ObjectMapper();GameService g;String token;long now=1000000000;
 ObjectNode sim(){return g.sim(g.session(token,true));}
 @BeforeEach void setup()throws Exception{g=new GameService(new JsonStore(m,dir.resolve("save.json").toString()),new Content(m),m);g.time=()->now;token=g.guest(null,g.object()).token();ActivityFixture.setup(g,token,g.object().put("city","atl").put("neighborhood","midtown").put("aspiration","founder"));}
 void enter(){g.door(token,g.object().put("loc","home").put("enter",true));}
 ObjectNode act(String action){return g.act(token,g.object().put("city","atl").put("loc","home").put("action",action));}
 void walk(double x,double z){for(int i=0;i<100;i++){ObjectNode p=g.navigation.position(sim());double dx=x-p.path("x").asDouble(),dz=z-p.path("z").asDouble(),d=Math.hypot(dx,dz);if(d<.01)return;double ratio=Math.min(1,.6/d);now+=200;g.movePosition(token,g.object().put("city","atl").put("x",p.path("x").asDouble()+dx*ratio).put("z",p.path("z").asDouble()+dz*ratio).put("face",Math.atan2(dx,dz)));}fail("Walk did not converge");}
 @Test void actionsRequireInsideAndTheCorrectFurniture(){assertEquals(409,assertThrows(ApiException.class,()->act("cook")).status);assertEquals(2500,sim().path("cash").asInt());enter();assertEquals(409,assertThrows(ApiException.class,()->act("cook")).status);walk(-1.25,.1);assertEquals(409,assertThrows(ApiException.class,()->act("sleep")).status);ObjectNode r=act("cook");assertEquals(0,r.path("result").path("activity").path("cost").asInt());assertEquals(0,r.path("result").path("activity").path("pay").asInt());assertEquals(5,r.path("result").path("activity").path("dailyCash").asInt());assertEquals(2500,r.path("sim").path("cash").asInt());now=r.path("sim").path("busyUntil").asLong();assertEquals(2505,g.getSim(token).path("sim").path("cash").asInt());}
 @Test void doorsRequireProximityAndLeavingRestoresTheOutsidePosition(){ObjectNode outside=g.navigation.position(sim()).deepCopy();sim().withObject("position").put("x",70);assertThrows(ApiException.class,this::enter);sim().set("position",outside.deepCopy());enter();walk(-1.25,.1);assertThrows(ApiException.class,()->g.door(token,g.object().put("enter",false)));walk(0,2.3);g.door(token,g.object().put("enter",false));assertEquals(outside,sim().path("position"));}
 @Test void furnitureAndRoomWallsBlockMovement(){enter();assertFalse(g.navigation.stand("atl",2.3,-2.4,"home:test"));assertFalse(g.navigation.stand("atl",6,0,"home:test"));assertFalse(g.navigation.stand("atl",-4.4,.1,"home:test"));assertTrue(g.navigation.stand("atl",-1.25,.1,"home:test"));}
 @Test void insideLocationSurvivesRestartAndIsPrivate()throws Exception{enter();walk(-1.25,.1);g.checkpoint();GameService restored=new GameService(new JsonStore(m,g.store.path.toString()),g.content,m);restored.time=()->now;JsonNode visible=restored.getSim(token).path("sim");assertEquals("home:"+sim().path("userId").asText(),visible.path("position").path("room").asText());assertFalse(visible.has("_outside"));assertEquals(-1.25,visible.path("position").path("x").asDouble(),.01);}
 @Test void aBusyResidentCannotLeaveOrWalk(){enter();walk(-1.25,.1);act("cook");assertThrows(ApiException.class,()->g.door(token,g.object().put("enter",false)));assertThrows(ApiException.class,()->walk(0,2.3));}
}
