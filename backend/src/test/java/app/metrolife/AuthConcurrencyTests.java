package app.metrolife;

import com.fasterxml.jackson.databind.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.io.TempDir;
import java.nio.file.Path;
import java.util.concurrent.*;
import static org.junit.jupiter.api.Assertions.*;

class AuthConcurrencyTests {
    @TempDir Path directory;
    ObjectMapper mapper=new ObjectMapper();
    GameService game;
    @BeforeEach void setup()throws Exception{game=new GameService(new JsonStore(mapper,directory.resolve("save.json").toString()),new Content(mapper),mapper);}
    JsonNode account(String name)throws Exception{return mapper.readTree("{\"username\":\""+name+"\",\"password\":\"long password\"}");}
    @Test void hashingAndVerificationDoNotOwnTheWorldMonitor()throws Exception{
        CountDownLatch hashing=new CountDownLatch(1),release=new CountDownLatch(1);
        game.hashPassword=password->{hashing.countDown();try{assertTrue(release.await(5,TimeUnit.SECONDS));}catch(InterruptedException e){throw new RuntimeException(e);}return "test-hash";};
        try(var pool=Executors.newFixedThreadPool(2)){
            JsonNode body=account("Account One");var signup=pool.submit(()->game.signup(null,body,"one"));assertTrue(hashing.await(2,TimeUnit.SECONDS));
            assertNotNull(pool.submit(()->game.me(null)).get(1,TimeUnit.SECONDS));release.countDown();signup.get(2,TimeUnit.SECONDS);
            CountDownLatch verifying=new CountDownLatch(1),verified=new CountDownLatch(1);
            game.verifyPassword=(password,hash)->{verifying.countDown();try{assertTrue(verified.await(5,TimeUnit.SECONDS));}catch(InterruptedException e){throw new RuntimeException(e);}return true;};
            var login=pool.submit(()->game.login(null,body,"two"));assertTrue(verifying.await(2,TimeUnit.SECONDS));
            assertNotNull(pool.submit(()->game.me(null)).get(1,TimeUnit.SECONDS));verified.countDown();assertNotNull(login.get(2,TimeUnit.SECONDS).token());
        }
    }
    @Test void attemptsAreLimitedByBothAddressAndCanonicalUsernameAndExpire()throws Exception{
        long[] now={1_000_000};game.time=()->now[0];
        for(int i=0;i<8;i++){String ip="ip"+i;assertEquals(401,assertThrows(ApiException.class,()->game.login(null,account("SAME NAME"),ip)).status);}
        assertEquals(429,assertThrows(ApiException.class,()->game.login(null,account("same name"),"new-ip")).status);
        for(int i=0;i<20;i++){String name="Different "+i;assertEquals(401,assertThrows(ApiException.class,()->game.login(null,account(name),"shared-ip")).status);}
        assertEquals(429,assertThrows(ApiException.class,()->game.signup(null,account("New account"),"shared-ip")).status);
        now[0]+=60_001;assertEquals(401,assertThrows(ApiException.class,()->game.login(null,account("same name"),"shared-ip")).status);
    }
    @Test void loggedOutGuestCannotBeRevivedByPendingUpgrade()throws Exception{
        var guest=game.guest(null,account("Guest Before"));CountDownLatch hashing=new CountDownLatch(1),release=new CountDownLatch(1);
        game.hashPassword=p->{hashing.countDown();try{release.await(3,TimeUnit.SECONDS);}catch(InterruptedException e){throw new RuntimeException(e);}return "test";};
        try(var pool=Executors.newSingleThreadExecutor()){
            JsonNode body=account("Saved After");var pending=pool.submit(()->game.signup(guest.token(),body,"one"));assertTrue(hashing.await(2,TimeUnit.SECONDS));game.logout(guest.token());release.countDown();
            var e=assertThrows(ExecutionException.class,()->pending.get(2,TimeUnit.SECONDS));assertEquals(409,((ApiException)e.getCause()).status);
            assertTrue(game.store.data.path("users").path(guest.user().path("id").asText()).path("guest").asBoolean());
        }
    }
}
