package app.metrolife;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import java.util.Arrays;

/** Lets a frontend on another origin (for example a static host) call the API with credentials. */
@Configuration
public class WebConfig implements WebMvcConfigurer {
    @Value("${metro.origins}") String origins;

    static String[] split(String origins) {
        return Arrays.stream(origins.split(",")).map(String::trim).filter(s -> !s.isEmpty()).toArray(String[]::new);
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
            .allowedOriginPatterns(split(origins))
            .allowedMethods("GET", "POST", "OPTIONS")
            .allowedHeaders("Content-Type", SessionHeaderFilter.HEADER, SessionHeaderFilter.FALLBACK_HEADER)
            .allowCredentials(true)
            .maxAge(3600);
    }
}
