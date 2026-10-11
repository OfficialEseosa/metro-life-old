package app.metrolife;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import java.io.IOException;
import java.nio.channels.FileChannel;
import java.nio.file.*;

/** GameService serializes access. Flush before atomically replacing the last good snapshot. */
@Component
public class JsonStore {
    final ObjectMapper mapper;
    final Path path;
    final ObjectNode data;
    public JsonStore(ObjectMapper mapper, @Value("${metro.data:data/metro-life.json}") String path) throws IOException {
        this.mapper = mapper; this.path = Path.of(path).toAbsolutePath();
        Files.createDirectories(this.path.getParent());
        if (Files.exists(this.path)) {
            data = (ObjectNode)mapper.readTree(this.path.toFile());
            if (data.path("schema").asInt() != 1) throw new IOException("Unsupported save version");
        } else {
            data = mapper.createObjectNode().put("schema", 1).put("visits", 0);
            for (String key : new String[]{"users","sessions","worlds","sims"}) data.putObject(key);
            data.withObject("worlds").putObject("public").put("id","public").put("name","Metro Commons").put("mode","public").putNull("code").putNull("ownerId").put("startedAt",System.currentTimeMillis()).putArray("members");
            save();
        }
    }
    void save() {
        Path tmp = path.resolveSibling(path.getFileName() + ".next");
        try {
            Files.write(tmp, mapper.writerWithDefaultPrettyPrinter().writeValueAsBytes(data));
            try (FileChannel channel = FileChannel.open(tmp, StandardOpenOption.WRITE)) { channel.force(true); }
            try { Files.move(tmp,path,StandardCopyOption.ATOMIC_MOVE,StandardCopyOption.REPLACE_EXISTING); }
            catch (AtomicMoveNotSupportedException e) { Files.move(tmp,path,StandardCopyOption.REPLACE_EXISTING); }
        } catch (IOException e) { throw new IllegalStateException("Unable to save your world", e); }
    }
}
