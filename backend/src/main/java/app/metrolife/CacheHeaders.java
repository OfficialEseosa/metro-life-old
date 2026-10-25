package app.metrolife;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Cache rules for API responses. Static content (the world catalogue, the build tag) may be reused
 * for a few minutes; generated images are addressed by revision or booking id; everything else is
 * personal, live state and is never stored.
 */
@Component
class CacheHeaders extends OncePerRequestFilter {

  @Override
  protected boolean shouldNotFilter(HttpServletRequest request) {
    return !request.getRequestURI().startsWith("/api/");
  }

  @Override
  protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
    throws ServletException, IOException {
    String path = req.getRequestURI();
    boolean read = "GET".equals(req.getMethod());
    if (read && (path.equals("/api/world") || path.equals("/api/version"))) res.setHeader(
      "Cache-Control",
      "public, max-age=300"
    );
    else if (read && path.equals("/api/plots/atlas.png") && req.getParameter("v") != null) res.setHeader(
      "Cache-Control",
      "private, max-age=86400"
    );
    else if (read && path.matches("/api/(plots|billboards)/[^/]+/image")) res.setHeader(
      "Cache-Control",
      "private, max-age=3600"
    );
    else res.setHeader("Cache-Control", "no-store");
    chain.doFilter(req, res);
  }
}
