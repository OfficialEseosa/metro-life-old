package app.lagoslife;

import app.lagoslife.Model.SeaAdRec;
import app.lagoslife.Model.State;
import app.lagoslife.Model.UserRec;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.zip.CRC32;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/sea")
public class SeaController {
    private static final long DAY = 86_400_000L;
    static final int ATLAS_CELL_TARGET = 16;
    static final int ATLAS_MAX_SIDE = 4096;

    private final Store store;
    private final Object atlasLock = new Object();
    private Atlas atlas;

    public SeaController(Store store) {
        this.store = store;
    }

    public record BuyBody(
            @NotNull(message = "x is required") Integer x,
            @NotNull(message = "y is required") Integer y,
            @NotNull(message = "w is required") @Min(value = 1, message = "Plots are 1-12 cells wide")
            @Max(value = 12, message = "Plots are 1-12 cells wide") Integer w,
            @NotNull(message = "h is required") @Min(value = 1, message = "Plots are 1-12 cells tall")
            @Max(value = 12, message = "Plots are 1-12 cells tall") Integer h,
            @NotBlank(message = "Give your plot a title") @Size(max = 60, message = "Titles can be at most 60 characters") String title,
            @NotBlank(message = "Add a link for your plot") @Size(max = 300, message = "That link is too long")
            @Pattern(regexp = "^https?://[^\\s.]+\\.[^\\s]{2,}$", message = "Links must start with http:// or https://") String link) {}

    /** Immutable snapshot of what is on the water right now. */
    private record Snapshot(List<SeaAdRec> ads, List<int[]> holds, int minX, int minY, int maxX, int maxY, int cell, String version) {}

    private record Atlas(String version, byte[] png, int width, int height) {}

    @GetMapping
    public Map<String, Object> get() {
        Snapshot snap = snapshot();
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("ads", snap.ads.stream().map(Views::seaAd).toList());
        out.put("holds", snap.holds.stream().map(SeaController::rect).toList());
        out.put("price", store.read(s -> s.seaPrice));
        out.put("days", store.read(s -> s.seaDays));
        Map<String, Object> bounds = new LinkedHashMap<>();
        bounds.put("minX", snap.minX);
        bounds.put("minY", snap.minY);
        bounds.put("maxX", snap.maxX);
        bounds.put("maxY", snap.maxY);
        out.put("bounds", bounds);
        out.put("atlasCell", snap.cell);
        out.put("atlas", "/api/sea/atlas.png?v=" + snap.version);
        return out;
    }

    @PostMapping
    public Map<String, Object> buy(@Valid @RequestBody BuyBody b, HttpServletRequest req) {
        return store.tx(s -> {
            UserRec me = Auth.require(s, req);
            long now = System.currentTimeMillis();
            int[] lim = s.seaLimit;
            if (b.x() < lim[0] || b.y() < lim[1] || (long) b.x() + b.w() > lim[2] || (long) b.y() + b.h() > lim[3]) {
                throw ApiException.bad("That plot is outside Lagos waters");
            }
            for (SeaAdRec a : s.seaAds) {
                if (a.endsAt > now && overlaps(b, a.x, a.y, a.w, a.h)) throw new ApiException(409, "That water is already taken");
            }
            for (int[] h : s.holds) {
                if (overlaps(b, h[0], h[1], h[2], h[3])) throw new ApiException(409, "That water is reserved");
            }
            long cost = (long) s.seaPrice * b.w() * b.h();
            if (me.cash < cost) {
                throw new ApiException(402, "Not enough cash: this plot costs " + cost + " and you have " + me.cash);
            }
            me.cash -= cost;
            SeaAdRec a = new SeaAdRec();
            a.id = Ids.id();
            a.ownerId = me.id;
            a.title = b.title().trim();
            a.link = b.link().trim();
            a.x = b.x();
            a.y = b.y();
            a.w = b.w();
            a.h = b.h();
            a.endsAt = now + s.seaDays * DAY;
            s.seaAds.add(a);
            return Map.of("ad", Views.seaAd(a));
        });
    }

    @GetMapping("/{id}/image")
    public ResponseEntity<byte[]> image(@PathVariable String id) {
        SeaAdRec a = store.read(s -> s.seaAds.stream().filter(x -> x.id.equals(id)).findFirst().orElse(null));
        if (a == null) throw new ApiException(404, "Not found");
        // 64 px per cell, longest side kept between 256 and 512 px.
        int longest = Math.max(a.w, a.h);
        double scale = Math.max(256.0, Math.min(512.0, longest * 64.0)) / longest;
        byte[] png = Art.png((int) Math.round(a.w * scale), (int) Math.round(a.h * scale), a.id, a.title);
        return ResponseEntity.ok()
                .contentType(MediaType.IMAGE_PNG)
                .cacheControl(CacheControl.maxAge(Duration.ofDays(1)).cachePublic())
                .body(png);
    }

    /** One PNG of the whole grid: ad artwork at its cells, holds as a muted tile, open water transparent. */
    @GetMapping("/atlas.png")
    public ResponseEntity<byte[]> atlas(@RequestHeader(value = HttpHeaders.IF_NONE_MATCH, required = false) String ifNoneMatch) {
        Atlas a = currentAtlas();
        String etag = "\"" + a.version + "\"";
        // The URL handed out by /api/sea carries the version, so the bytes behind it never change.
        CacheControl cache = CacheControl.maxAge(Duration.ofDays(365)).cachePublic().immutable();
        if (ifNoneMatch != null && ifNoneMatch.contains(etag)) {
            return ResponseEntity.status(304).eTag(etag).cacheControl(cache).build();
        }
        return ResponseEntity.ok().contentType(MediaType.IMAGE_PNG).eTag(etag).cacheControl(cache).body(a.png);
    }

    /** Pixel size of the current atlas (rendering it if needed); used by tests and startup logging. */
    int[] atlasSize() {
        Atlas a = currentAtlas();
        return new int[] {a.width, a.height};
    }

    private Atlas currentAtlas() {
        synchronized (atlasLock) {
            Snapshot snap = snapshot();
            if (atlas == null || !atlas.version.equals(snap.version)) atlas = render(snap);
            return atlas;
        }
    }

    private static Atlas render(Snapshot snap) {
        int cell = snap.cell;
        int width = (snap.maxX - snap.minX) * cell, height = (snap.maxY - snap.minY) * cell;
        BufferedImage img = new BufferedImage(Math.max(1, width), Math.max(1, height), BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = img.createGraphics();
        try {
            Art.hints(g);
            g.setColor(Art.HOLD);
            for (int[] h : snap.holds) {
                g.fillRect((h[0] - snap.minX) * cell, (h[1] - snap.minY) * cell, h[2] * cell, h[3] * cell);
            }
            for (SeaAdRec a : snap.ads) {
                Art.draw(g, (a.x - snap.minX) * cell, (a.y - snap.minY) * cell, a.w * cell, a.h * cell, a.id, a.title);
            }
        } finally {
            g.dispose();
        }
        return new Atlas(snap.version, Art.encode(img), img.getWidth(), img.getHeight());
    }

    private Snapshot snapshot() {
        return store.read(SeaController::snapshot);
    }

    private static Snapshot snapshot(State s) {
        long now = System.currentTimeMillis();
        List<SeaAdRec> ads = new ArrayList<>();
        for (SeaAdRec a : s.seaAds) if (a.endsAt > now) ads.add(a);
        List<int[]> holds = List.copyOf(s.holds);
        // Bounds: the purchasable area (= bounding box of the seeded ads and holds) plus anything outside it.
        int minX = s.seaLimit[0], minY = s.seaLimit[1], maxX = s.seaLimit[2], maxY = s.seaLimit[3];
        CRC32 crc = new CRC32();
        for (SeaAdRec a : ads) {
            minX = Math.min(minX, a.x);
            minY = Math.min(minY, a.y);
            maxX = Math.max(maxX, a.x + a.w);
            maxY = Math.max(maxY, a.y + a.h);
            crc.update((a.id + ":" + a.v + ":" + a.x + "," + a.y + "," + a.w + "," + a.h + ":" + a.title + ";").getBytes(java.nio.charset.StandardCharsets.UTF_8));
        }
        for (int[] h : holds) {
            minX = Math.min(minX, h[0]);
            minY = Math.min(minY, h[1]);
            maxX = Math.max(maxX, h[0] + h[2]);
            maxY = Math.max(maxY, h[1] + h[3]);
            crc.update((h[0] + "," + h[1] + "," + h[2] + "," + h[3] + ";").getBytes(java.nio.charset.StandardCharsets.UTF_8));
        }
        int longest = Math.max(1, Math.max(maxX - minX, maxY - minY));
        int cell = Math.max(1, Math.min(ATLAS_CELL_TARGET, ATLAS_MAX_SIDE / longest));
        crc.update(("cell" + cell + "@" + minX + "," + minY + "," + maxX + "," + maxY).getBytes(java.nio.charset.StandardCharsets.UTF_8));
        return new Snapshot(ads, holds, minX, minY, maxX, maxY, cell, Long.toHexString(crc.getValue()));
    }

    private static boolean overlaps(BuyBody b, int x, int y, int w, int h) {
        return b.x() < x + w && x < b.x() + b.w() && b.y() < y + h && y < b.y() + b.h();
    }

    private static Map<String, Object> rect(int[] r) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("x", r[0]);
        m.put("y", r[1]);
        m.put("w", r[2]);
        m.put("h", r[3]);
        return m;
    }
}
