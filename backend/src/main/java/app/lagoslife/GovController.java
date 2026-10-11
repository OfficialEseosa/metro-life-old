package app.lagoslife;

import app.lagoslife.Model.CandidateRec;
import app.lagoslife.Model.GovRec;
import app.lagoslife.Model.State;
import app.lagoslife.Model.UserRec;
import jakarta.servlet.http.HttpServletRequest;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/gov")
public class GovController {
    /** Policy ids from the original client. */
    public static final Set<String> POLICIES = Set.of("transport", "wages", "owambe", "food", "light");
    private static final long TERM_MS = 7 * 86_400_000L;

    private final Store store;

    public GovController(Store store) {
        this.store = store;
    }

    @GetMapping
    public Map<String, Object> get(HttpServletRequest req) {
        return store.lazy(s -> view(s, Auth.user(s, req)));
    }

    @PostMapping("/vote")
    public Map<String, Object> vote(@RequestBody Map<String, Object> body, HttpServletRequest req) {
        // SPEC.md names the field candidateId; the original client sends candidate. Accept both.
        Object raw = body.get("candidateId") != null ? body.get("candidateId") : body.get("candidate");
        return store.tx(s -> {
            UserRec me = Auth.require(s, req);
            rollover(s);
            if (!(raw instanceof String candidateId) || candidateId.isBlank()) throw ApiException.bad("Pick a candidate");
            CandidateRec target = candidate(s.gov, candidateId);
            if (target == null) throw new ApiException(404, "That candidate is not on the ballot");
            String previous = s.gov.votes.get(me.id);
            if (!candidateId.equals(previous)) {
                CandidateRec old = previous == null ? null : candidate(s.gov, previous);
                if (old != null && old.votes > 0) old.votes--;
                target.votes++;
                s.gov.votes.put(me.id, candidateId);
            }
            return view(s, me);
        });
    }

    @PostMapping("/run")
    public Map<String, Object> run(@RequestBody Map<String, Object> body, HttpServletRequest req) {
        String slogan = text(body.get("slogan"));
        return store.tx(s -> {
            UserRec me = Auth.require(s, req);
            rollover(s);
            if (slogan.length() < 3 || slogan.length() > 80) throw ApiException.bad("Your slogan must be 3-80 characters");
            if (me.id.equals(s.gov.governorId)) throw new ApiException(409, "You are already the Governor");
            CandidateRec mine = candidate(s.gov, me.id);
            if (mine == null) {
                mine = new CandidateRec();
                mine.userId = me.id;
                mine.name = me.username;
                mine.votes = 0;
                s.gov.candidates.add(mine);
            }
            mine.slogan = slogan; // running again just updates the slogan
            return view(s, me);
        });
    }

    @PostMapping("/policy")
    public Map<String, Object> policy(@RequestBody Map<String, Object> body, HttpServletRequest req) {
        Object policy = body.get("policy");
        return store.tx(s -> {
            UserRec me = governor(s, req);
            if (!(policy instanceof String id) || !POLICIES.contains(id)) throw ApiException.bad("Unknown policy");
            s.gov.policy = id;
            s.gov.policyAt = System.currentTimeMillis();
            return view(s, me);
        });
    }

    @PostMapping("/announce")
    public Map<String, Object> announce(@RequestBody Map<String, Object> body, HttpServletRequest req) {
        String text = text(body.get("text"));
        return store.tx(s -> {
            UserRec me = governor(s, req);
            if (text.length() > 200) throw ApiException.bad("Announcements can be at most 200 characters");
            // An empty text clears the announcement.
            s.gov.announcement = text.isEmpty() ? null : text;
            s.gov.announcementAt = text.isEmpty() ? null : System.currentTimeMillis();
            return view(s, me);
        });
    }

    private static UserRec governor(State s, HttpServletRequest req) {
        UserRec me = Auth.require(s, req);
        rollover(s);
        if (!me.id.equals(s.gov.governorId)) throw new ApiException(403, "Only the Governor can do that");
        return me;
    }

    private static String text(Object o) {
        return o instanceof String str ? str.trim() : "";
    }

    private static CandidateRec candidate(GovRec g, String userId) {
        for (CandidateRec c : g.candidates) if (c.userId.equals(userId)) return c;
        return null;
    }

    /**
     * When the term ends the leading candidate takes office: they leave the ballot, the
     * remaining candidates stay on it with votes reset, and everyone can vote again.
     */
    static void rollover(State s) {
        GovRec g = s.gov;
        long now = System.currentTimeMillis();
        while (now >= g.termEnds) {
            CandidateRec winner = g.candidates.stream().max(Comparator.comparingLong(c -> c.votes)).orElse(null);
            if (winner != null) {
                g.governorId = winner.userId;
                g.governorSlogan = winner.slogan;
                g.governorVotes = winner.votes;
                g.policy = null;
                g.policyAt = null;
                g.announcement = null;
                g.announcementAt = null;
                g.candidates.remove(winner);
            }
            g.candidates.forEach(c -> c.votes = 0);
            g.votes.clear();
            g.termId++;
            g.electionTerm++;
            g.termEnds += TERM_MS * Math.max(1, (now - g.termEnds) / TERM_MS + 1);
        }
    }

    static Map<String, Object> view(State s, UserRec me) {
        rollover(s);
        GovRec g = s.gov;
        Map<String, Object> out = new LinkedHashMap<>();

        Map<String, Object> term = new LinkedHashMap<>();
        term.put("id", g.termId);
        term.put("ends", g.termEnds);
        out.put("term", term);

        UserRec gov = g.governorId == null ? null : s.users.get(g.governorId);
        if (gov == null) {
            out.put("governor", null);
        } else {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", gov.id);
            m.put("username", gov.username);
            m.put("look", gov.look);
            m.put("slogan", g.governorSlogan);
            m.put("votes", g.governorVotes);
            m.put("policy", g.policy);
            m.put("policyAt", g.policyAt);
            m.put("announcement", g.announcement);
            m.put("announcementAt", g.announcementAt);
            out.put("governor", m);
        }

        List<Map<String, Object>> candidates = new ArrayList<>();
        g.candidates.stream()
                .sorted(Comparator.comparingLong((CandidateRec c) -> c.votes).reversed())
                .forEach(c -> {
                    UserRec u = s.users.get(c.userId);
                    if (u == null) return;
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("id", u.id);
                    m.put("username", u.username);
                    m.put("name", c.name);
                    m.put("slogan", c.slogan);
                    m.put("look", u.look);
                    m.put("votes", c.votes);
                    candidates.add(m);
                });

        boolean isGovernor = me != null && me.id.equals(g.governorId);
        boolean running = me != null && candidate(g, me.id) != null;
        Map<String, Object> election = new LinkedHashMap<>();
        election.put("term", g.electionTerm);
        election.put("closes", g.termEnds);
        election.put("candidates", candidates);
        election.put("myVote", me == null ? null : g.votes.get(me.id));
        election.put("running", running);
        election.put("canRun", me == null ? "Sign up to run for Governor"
                : isGovernor ? "You are already the Governor"
                : running ? "You are already on the ballot"
                : Boolean.TRUE);
        election.put("canVote", me == null ? "Sign up to vote" : Boolean.TRUE);
        out.put("election", election);
        out.put("isGovernor", isGovernor);
        return out;
    }
}
