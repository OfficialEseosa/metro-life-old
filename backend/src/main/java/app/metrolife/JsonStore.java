package app.metrolife;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.IOException;
import java.nio.channels.FileChannel;
import java.nio.file.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/** GameService serializes access. Flush before atomically replacing the last good snapshot. */
@Component
public class JsonStore {

  final ObjectMapper mapper;
  final Path path;
  final ObjectNode data;

  public JsonStore(ObjectMapper mapper, @Value("${metro.data:data/metro-life.json}") String path) throws IOException {
    this.mapper = mapper;
    this.path = Path.of(path).toAbsolutePath();
    Files.createDirectories(this.path.getParent());
    if (Files.exists(this.path)) {
      data = (ObjectNode) mapper.readTree(this.path.toFile());
      if (data.path("schema").asInt() == 1) {
        Path backup = this.path.resolveSibling(
          this.path.getFileName() + ".before-v2-" + System.currentTimeMillis() + ".json"
        );
        Files.copy(this.path, backup);
        migrateToSharedCity();
        save();
      }
      if (data.path("schema").asInt() != 2) throw new IOException("Unsupported save version");
    } else {
      data = mapper.createObjectNode().put("schema", 2).put("visits", 0);
      for (String key : new String[] { "users", "sessions", "worlds", "sims" }) data.putObject(key);
      data
        .withObject("worlds")
        .putObject("public")
        .put("id", "public")
        .put("name", "Metro Commons")
        .put("mode", "public")
        .putNull("code")
        .putNull("ownerId")
        .put("startedAt", System.currentTimeMillis())
        .putArray("members");
      save();
    }
  }

  private void migrateToSharedCity() {
    ObjectNode worlds = data.withObject("worlds");
    var mainValue = worlds.get("public");
    if (!(mainValue instanceof ObjectNode)) throw new IllegalStateException(
      "Main public world missing; backup retained"
    );
    ObjectNode main = (ObjectNode) mainValue.deepCopy();
    worlds.removeAll();
    worlds.set("public", main);
    main.put("mode", "public").putNull("code").putNull("ownerId").remove("members");
    for (String key : new String[] { "civic", "property", "residents", "chats", "communityMeta" }) {
      ObjectNode table = data.withObject(key);
      var retained = table.get("public");
      table.removeAll();
      if (retained != null) table.set("public", retained);
    }
    ObjectNode sims = data.withObject("sims");
    var ids = new java.util.ArrayList<String>();
    sims.fieldNames().forEachRemaining(ids::add);
    for (String id : ids) if (!sims.path(id).path("worldId").asText().equals("public")) sims.remove(id);
    for (var row : data.withObject("sessions")) ((ObjectNode) row).put("worldId", "public");
    for (var row : data.withObject("users")) {
      ObjectNode u = (ObjectNode) row;
      u.put("guest", true).remove(java.util.List.of("passwordHash", "lastWorld"));
    }
    data.put("schema", 2);
  }

  void save() {
    Path tmp = path.resolveSibling(path.getFileName() + ".next");
    try {
      Files.write(tmp, mapper.writerWithDefaultPrettyPrinter().writeValueAsBytes(data));
      try (FileChannel channel = FileChannel.open(tmp, StandardOpenOption.WRITE)) {
        channel.force(true);
      }
      try {
        Files.move(tmp, path, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
      } catch (AtomicMoveNotSupportedException e) {
        Files.move(tmp, path, StandardCopyOption.REPLACE_EXISTING);
      }
    } catch (IOException e) {
      throw new IllegalStateException("Unable to save your world", e);
    }
  }
}
