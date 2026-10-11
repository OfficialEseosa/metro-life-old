package app.metrolife;

import com.fasterxml.jackson.databind.*;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@AutoConfigureMockMvc
class HttpContractTests {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @DynamicPropertySource static void properties(DynamicPropertyRegistry registry){registry.add("metro.data",()->System.getProperty("java.io.tmpdir")+"/metro-http-"+java.util.UUID.randomUUID()+".json");}
    @Test void guestCookieAndAuthoritativeSetupContract()throws Exception{
        mvc.perform(get("/api/sim")).andExpect(status().isUnauthorized()).andExpect(jsonPath("$.error").value("Please log in"));
        mvc.perform(get("/api/world")).andExpect(status().isOk()).andExpect(jsonPath("$.cities[0].landmarks[0].actions[0].id").isString()).andExpect(jsonPath("$.careers.length()").value(8));
        var guest=mvc.perform(post("/api/auth/guest").contentType("application/json").content("{}")).andExpect(status().isOk()).andExpect(jsonPath("$.user.guest").value(true)).andReturn();
        String header=guest.getResponse().getHeader("Set-Cookie");assertNotNull(header);assertTrue(header.contains("HttpOnly"));assertTrue(header.contains("SameSite=Lax"));
        Cookie cookie=new Cookie("ml_session",header.split(";")[0].split("=",2)[1]);
        mvc.perform(post("/api/worlds").cookie(cookie).contentType("application/json").content("{\"name\":\"HTTP world\",\"mode\":\"solo\"}")).andExpect(status().isOk()).andExpect(jsonPath("$.world.mode").value("solo"));
        mvc.perform(post("/api/sim/setup").cookie(cookie).contentType("application/json").content("{\"city\":\"atl\",\"neighborhood\":\"midtown\",\"aspiration\":\"founder\"}")).andExpect(status().isOk()).andExpect(jsonPath("$.sim.cash").value(2500)).andExpect(jsonPath("$.sim.needs.energy").value(85.0)).andExpect(jsonPath("$.sim.pendingBeat").isEmpty()).andExpect(jsonPath("$.sim.updatedAt").doesNotExist());
        mvc.perform(post("/api/act").cookie(cookie).contentType("application/json").content("{\"city\":\"atl\",\"loc\":\"home\",\"action\":\"cook\",\"pay\":1000000}")).andExpect(status().isOk()).andExpect(jsonPath("$.sim.cash").value(2500)).andExpect(jsonPath("$.result.deltas.cash").value(33)).andExpect(jsonPath("$.sim.busyUntil").isNumber()).andExpect(jsonPath("$.sim.busyStartedAt").isNumber()).andExpect(jsonPath("$.sim._pendingAction").doesNotExist());
        mvc.perform(post("/api/act").cookie(cookie).contentType("application/json").content("{\"city\":\"atl\",\"loc\":\"home\",\"action\":\"cook\"}")).andExpect(status().isConflict());
        mvc.perform(post("/api/auth/logout").cookie(cookie)).andExpect(status().isOk()).andExpect(header().string("Set-Cookie",org.hamcrest.Matchers.containsString("Max-Age=0")));
        mvc.perform(get("/api/auth/me").cookie(cookie)).andExpect(jsonPath("$.user").isEmpty());
    }
    @Test void badJsonReturnsStructuredError()throws Exception{mvc.perform(post("/api/auth/guest").contentType("application/json").content("{")).andExpect(status().isBadRequest()).andExpect(jsonPath("$.error").isString());}
}
