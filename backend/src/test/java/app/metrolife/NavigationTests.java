package app.metrolife;
import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.io.TempDir;
import java.nio.file.Path;
import static org.junit.jupiter.api.Assertions.*;

class NavigationTests {
 @TempDir Path dir;ObjectMapper m=new ObjectMapper();GameService g;String token;long now=1000000000;
 ObjectNode sim(){return g.sim(g.session(token,true));}
 @BeforeEach void setup()throws Exception{g=new GameService(new JsonStore(m,dir.resolve("save.json").toString()),new Content(m),m);g.time=()->now;token=g.guest(null,g.object()).token();ActivityFixture.setup(g,token,g.object().put("city","atl").put("neighborhood","midtown").put("aspiration","founder"));}
 ObjectNode move(double x,double z){return g.movePosition(token,g.object().put("city","atl").put("x",x).put("z",z).put("face",0));}
 @Test void walkingIsBoundedByServerTimeAndRejectedMovesLeavePositionUntouched(){ObjectNode p=g.navigation.position(sim()).deepCopy();now+=200;move(p.path("x").asDouble()+1,p.path("z").asDouble());assertThrows(ApiException.class,()->move(100,100));assertEquals(p.path("x").asDouble()+1,sim().path("position").path("x").asDouble());for(int i=0;i<30;i++)assertThrows(ApiException.class,()->move(100,100));}
 @Test void wallsWaterAndSweptCrossingsAreBlocked(){assertFalse(g.navigation.stand("atl",-22,-63,""));assertFalse(g.navigation.stand("atl",24,-36,""));assertFalse(g.navigation.stand("nyc",-80,0,""));assertFalse(g.navigation.stand("bay",40,30,""));assertTrue(g.navigation.stand("atl",-22,-58.9,""));ObjectNode p=g.navigation.position(sim());p.put("x",-22).put("z",-65.1);now+=1000;assertThrows(ApiException.class,()->move(-22,-62.4));assertEquals(-65.1,p.path("z").asDouble());}
 @Test void busyAndCityMismatchCannotMove(){ObjectNode p=g.navigation.position(sim());sim().put("busyUntil",now+10000);assertThrows(ApiException.class,()->move(p.path("x").asDouble()+.1,p.path("z").asDouble()));sim().putNull("busyUntil");assertThrows(ApiException.class,()->g.movePosition(token,g.object().put("city","nyc").put("x",0).put("z",0).put("face",0)));}
 @Test void everyHomeSpawnIsOnWalkableLand(){for(String city:new String[]{"atl","nyc","bay"})for(JsonNode home:g.navigation.city(city).path("homes"))assertTrue(g.navigation.stand(city,home.path("x").asDouble(),home.path("z").asDouble(),""),city+home);}
}
