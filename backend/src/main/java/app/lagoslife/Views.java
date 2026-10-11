package app.lagoslife;

import app.lagoslife.Model.BillboardRec;
import app.lagoslife.Model.SeaAdRec;
import app.lagoslife.Model.UserRec;
import java.util.LinkedHashMap;
import java.util.Map;

/** JSON shapes from SPEC.md. */
public final class Views {
    private Views() {}

    public static Map<String, Object> user(UserRec u) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", u.id);
        m.put("username", u.username);
        m.put("look", u.look);
        m.put("cash", u.cash);
        m.put("xp", u.xp);
        m.put("home", u.home);
        m.put("verified", u.verified);
        m.put("createdAt", u.createdAt);
        return m;
    }

    public static Map<String, Object> seaAd(SeaAdRec a) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", a.id);
        m.put("x", a.x);
        m.put("y", a.y);
        m.put("w", a.w);
        m.put("h", a.h);
        m.put("title", a.title);
        m.put("link", a.link);
        m.put("image", "/api/sea/" + a.id + "/image?v=" + a.v);
        m.put("endsAt", a.endsAt);
        return m;
    }

    public static Map<String, Object> billboard(BillboardRec b) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", b.id);
        m.put("link", b.link);
        m.put("image", "/api/ads/" + b.id + "/image?v=" + b.v);
        m.put("endsAt", b.endsAt);
        return m;
    }
}
