package app.lagoslife;

import app.lagoslife.Model.UserRec;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private static final long START_CASH = 50_000;
    private static final java.util.regex.Pattern LOOK_VALUE = java.util.regex.Pattern.compile("^[#A-Za-z0-9_-]{1,24}$");

    private final Store store;

    public AuthController(Store store) {
        this.store = store;
    }

    public record SignupBody(
            @NotNull(message = "Username is required")
            @Pattern(regexp = "^[A-Za-z0-9_]{3,20}$", message = "Username must be 3-20 letters, numbers or underscores")
            String username,
            @NotNull(message = "Password is required")
            @Size(min = 6, max = 200, message = "Password must be at least 6 characters")
            String password,
            Map<String, Object> look) {}

    public record LoginBody(String username, String password) {}

    @GetMapping("/me")
    public Map<String, Object> me(HttpServletRequest req) {
        return store.lazy(s -> {
            UserRec u = Auth.user(s, req);
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("user", u == null ? null : Views.user(u));
            m.put("now", System.currentTimeMillis());
            return m;
        });
    }

    @PostMapping("/signup")
    public Map<String, Object> signup(@Valid @RequestBody SignupBody body, HttpServletResponse res) {
        String hash = Passwords.hash(body.password());
        Map<String, Object> look = look(body.look());
        String[] token = new String[1];
        Map<String, Object> user = store.tx(s -> {
            String wanted = body.username().toLowerCase(Locale.ROOT);
            if (s.users.values().stream().anyMatch(u -> u.username.toLowerCase(Locale.ROOT).equals(wanted))) {
                throw new ApiException(409, "That username is taken");
            }
            UserRec u = new UserRec();
            u.id = Ids.id();
            u.username = body.username();
            u.passwordHash = hash;
            u.look = look;
            u.cash = START_CASH;
            u.xp = 0;
            u.home = Seeder.ESTATES.get(ThreadLocalRandom.current().nextInt(Seeder.ESTATES.size()));
            u.verified = false;
            u.createdAt = System.currentTimeMillis();
            s.users.put(u.id, u);
            Map<String, Integer> plots = new HashMap<>();
            s.homes.forEach(h -> plots.merge(h.estate, 1, Integer::sum));
            s.homes.add(Seeder.home(ThreadLocalRandom.current(), u, plots));
            token[0] = Auth.open(s, u);
            return Views.user(u);
        });
        Auth.setCookie(res, token[0]);
        return Map.of("user", user);
    }

    @PostMapping("/login")
    public Map<String, Object> login(@RequestBody LoginBody body, HttpServletResponse res) {
        if (body.username() == null || body.password() == null) throw ApiException.bad("Username and password are required");
        String wanted = body.username().trim().toLowerCase(Locale.ROOT);
        UserRec found = store.read(s -> s.users.values().stream()
                .filter(u -> u.username.toLowerCase(Locale.ROOT).equals(wanted)).findFirst().orElse(null));
        // Verify outside the store lock; run the hash either way so timing does not reveal usernames.
        boolean ok = Passwords.verify(body.password(), found == null ? DUMMY_HASH : found.passwordHash);
        if (found == null || !ok) throw new ApiException(401, "Wrong username or password");
        String token = store.tx(s -> Auth.open(s, found));
        Auth.setCookie(res, token);
        return Map.of("user", store.read(s -> Views.user(found)));
    }

    @PostMapping("/logout")
    public Map<String, Object> logout(HttpServletRequest req, HttpServletResponse res) {
        String token = Auth.token(req);
        if (token != null) store.tx(s -> s.sessions.remove(token));
        Auth.clearCookie(res);
        return Map.of("ok", true);
    }

    private static final String DUMMY_HASH = Passwords.hash("not-a-real-password");

    /** Default look overlaid with any valid values the client supplied for the known keys. */
    private static Map<String, Object> look(Map<String, Object> supplied) {
        Map<String, Object> look = Seeder.defaultLook();
        if (supplied == null) return look;
        for (String key : look.keySet().toArray(String[]::new)) {
            if (!(supplied.get(key) instanceof String v) || !LOOK_VALUE.matcher(v).matches()) continue;
            if (key.equals("body") && !v.equals("f") && !v.equals("m")) continue;
            look.put(key, v);
        }
        return look;
    }
}
