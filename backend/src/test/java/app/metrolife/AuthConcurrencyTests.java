package app.metrolife;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.io.TempDir;
import java.nio.file.Path;
import java.util.concurrent.*;
import static org.junit.jupiter.api.Assertions.*;
class AuthConcurrencyTests {
 @TempDir Path directory;GameService g;ObjectMapper m=new ObjectMapper();
 @BeforeEach void setup()throws Exception{g=new GameService(new JsonStore(m,directory.resolve("save.json").toString()),new Content(m),m);}
 @Test void concurrentReloadsReuseTheCookieWithoutCreatingLives()throws Exception{var life=g.guest(null,g.object());try(var pool=Executors.newFixedThreadPool(4)){var rows=new java.util.ArrayList<Future<GameService.AuthResult>>();for(int i=0;i<20;i++)rows.add(pool.submit(()->g.guest(life.token(),g.object())));for(var row:rows)assertEquals(life.token(),row.get(3,TimeUnit.SECONDS).token());}assertEquals(1,g.table("users").size());assertEquals(1,g.table("sessions").size());assertFalse(g.table("users").elements().next().has("passwordHash"));}
 @Test void newLifeRequiresConfirmationAndRevokesAllPreviousSessions(){var old=g.guest(null,g.object());assertEquals(400,assertThrows(ApiException.class,()->g.newLife(old.token(),g.object())).status);assertNotNull(g.session(old.token(),false));var next=g.newLife(old.token(),g.object().put("confirm",true));assertNull(g.session(old.token(),false));assertNotEquals(old.user().path("id"),next.user().path("id"));assertEquals("public",g.me(next.token()).path("world").path("id").asText());assertEquals(1,g.table("users").size());}
}
