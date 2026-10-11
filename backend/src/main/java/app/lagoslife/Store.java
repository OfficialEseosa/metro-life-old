package app.lagoslife;

import app.lagoslife.Model.State;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import java.io.IOException;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.function.Function;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Single-file JSON store. All state lives in memory behind one lock and is written
 * atomically (tmp file + rename) to {data-dir}/state.json.
 */
@Component
public class Store {
    private static final Logger log = LoggerFactory.getLogger(Store.class);

    private final ObjectMapper mapper = new ObjectMapper()
            .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
    private final Path file;
    private final Seeder seeder;
    private final Object lock = new Object();
    private State state;
    private boolean dirty;
    private ScheduledExecutorService flusher;

    public Store(@Value("${lagos.data-dir:data}") String dataDir, Seeder seeder) {
        this.file = Path.of(dataDir).toAbsolutePath().normalize().resolve("state.json");
        this.seeder = seeder;
    }

    @PostConstruct
    void init() throws IOException {
        synchronized (lock) {
            Files.createDirectories(file.getParent());
            if (Files.exists(file)) {
                state = mapper.readValue(file.toFile(), State.class);
                long cutoff = System.currentTimeMillis() - Auth.SESSION_TTL_MS;
                state.sessions.values().removeIf(s -> s.lastSeen < cutoff);
                log.info("Loaded store {} ({} users, {} sea ads)", file, state.users.size(), state.seaAds.size());
            } else {
                state = seeder.seed();
                write();
                log.info("Seeded new store at {} ({} users, {} sea ads)", file, state.users.size(), state.seaAds.size());
            }
        }
        flusher = Executors.newSingleThreadScheduledExecutor(r -> {
            Thread t = new Thread(r, "store-flush");
            t.setDaemon(true);
            return t;
        });
        flusher.scheduleWithFixedDelay(this::flush, 5, 5, TimeUnit.SECONDS);
    }

    /** Read-only access under the lock. */
    public <T> T read(Function<State, T> fn) {
        synchronized (lock) {
            return fn.apply(state);
        }
    }

    /** Mutation that is persisted before returning. Validate before mutating: there is no rollback. */
    public <T> T tx(Function<State, T> fn) {
        synchronized (lock) {
            T out;
            try {
                out = fn.apply(state);
            } catch (RuntimeException e) {
                dirty = true; // session touches etc. made before a rejected request still get flushed
                throw e;
            }
            write();
            return out;
        }
    }

    /** Low-value mutation (counters, last-seen) flushed in the background within a few seconds. */
    public <T> T lazy(Function<State, T> fn) {
        synchronized (lock) {
            T out = fn.apply(state);
            dirty = true;
            return out;
        }
    }

    public void flush() {
        synchronized (lock) {
            if (dirty) write();
        }
    }

    @PreDestroy
    void shutdown() {
        if (flusher != null) flusher.shutdownNow();
        flush();
    }

    private void write() {
        try {
            Path tmp = file.resolveSibling("state.json.tmp");
            mapper.writeValue(tmp.toFile(), state);
            try {
                Files.move(tmp, file, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
            } catch (AtomicMoveNotSupportedException e) {
                Files.move(tmp, file, StandardCopyOption.REPLACE_EXISTING);
            }
            dirty = false;
        } catch (IOException e) {
            dirty = true;
            log.error("Could not write store {}", file, e);
        }
    }
}
