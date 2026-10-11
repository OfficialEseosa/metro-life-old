package app.lagoslife;

import app.lagoslife.Model.SessionRec;
import app.lagoslife.Model.State;
import app.lagoslife.Model.UserRec;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.time.Duration;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;

/** Cookie session: opaque random token in ll_session, looked up in the server-side store. */
public final class Auth {
    public static final String COOKIE = "ll_session";
    public static final long SESSION_TTL_MS = Duration.ofDays(30).toMillis();

    private Auth() {}

    public static String token(HttpServletRequest req) {
        Cookie[] cookies = req.getCookies();
        if (cookies == null) return null;
        for (Cookie c : cookies) {
            if (COOKIE.equals(c.getName()) && c.getValue() != null && !c.getValue().isBlank()) return c.getValue();
        }
        return null;
    }

    /** Resolve the logged-in user (or null). Call inside a store read/tx/lazy block. */
    public static UserRec user(State s, HttpServletRequest req) {
        String token = token(req);
        if (token == null) return null;
        SessionRec sess = s.sessions.get(token);
        if (sess == null) return null;
        long now = System.currentTimeMillis();
        if (now - sess.lastSeen > SESSION_TTL_MS) {
            s.sessions.remove(token);
            return null;
        }
        sess.lastSeen = now;
        return s.users.get(sess.userId);
    }

    public static UserRec require(State s, HttpServletRequest req) {
        UserRec u = user(s, req);
        if (u == null) throw new ApiException(401, "Please log in");
        return u;
    }

    public static String open(State s, UserRec u) {
        String token = Ids.token();
        SessionRec sess = new SessionRec();
        sess.userId = u.id;
        sess.createdAt = sess.lastSeen = System.currentTimeMillis();
        s.sessions.put(token, sess);
        return token;
    }

    public static void setCookie(HttpServletResponse res, String token) {
        res.addHeader(HttpHeaders.SET_COOKIE, cookie(token, Duration.ofMillis(SESSION_TTL_MS)));
    }

    public static void clearCookie(HttpServletResponse res) {
        res.addHeader(HttpHeaders.SET_COOKIE, cookie("", Duration.ZERO));
    }

    private static String cookie(String value, Duration maxAge) {
        return ResponseCookie.from(COOKIE, value).httpOnly(true).sameSite("Lax").path("/").maxAge(maxAge).build().toString();
    }
}
