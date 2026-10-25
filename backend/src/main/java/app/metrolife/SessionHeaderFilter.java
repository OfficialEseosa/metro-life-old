package app.metrolife;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import java.io.IOException;
import java.util.Arrays;
import java.util.regex.Pattern;

/**
 * Session fallback for browsers that block third-party cookies. When a request carries no
 * {@code ml_session} cookie but does carry the {@code X-Metro-Session} header, the header value
 * is presented to the rest of the application as if it were the cookie, so every
 * {@code @CookieValue("ml_session")} handler keeps working unchanged.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 20)
public class SessionHeaderFilter extends OncePerRequestFilter {
    static final String COOKIE = "ml_session";
    static final String HEADER = "X-Metro-Session";
    static final String FALLBACK_HEADER = "X-Metro-Token-Fallback";
    static final Pattern TOKEN = Pattern.compile("[A-Za-z0-9_-]{16,128}");

    static boolean validToken(String value) {
        return value != null && TOKEN.matcher(value).matches();
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !request.getRequestURI().startsWith("/api/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String header = request.getHeader(HEADER);
        Cookie[] cookies = request.getCookies();
        boolean hasCookie = cookies != null
            && Arrays.stream(cookies).anyMatch(c -> COOKIE.equals(c.getName()) && !c.getValue().isEmpty());
        if (hasCookie || !validToken(header)) {
            chain.doFilter(request, response);
            return;
        }
        Cookie[] merged = cookies == null ? new Cookie[1] : Arrays.copyOf(cookies, cookies.length + 1);
        merged[merged.length - 1] = new Cookie(COOKIE, header);
        chain.doFilter(new HttpServletRequestWrapper(request) {
            @Override
            public Cookie[] getCookies() {
                return merged.clone();
            }
        }, response);
    }
}
