package app.lagoslife;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Plain persisted records. The whole {@link State} is serialised to data/state.json. */
public final class Model {
    private Model() {}

    public static class State {
        public int schema = 1;
        public long visits;
        public Map<String, UserRec> users = new LinkedHashMap<>();
        public Map<String, SessionRec> sessions = new LinkedHashMap<>();
        public GovRec gov = new GovRec();
        public List<SeaAdRec> seaAds = new ArrayList<>();
        public List<int[]> holds = new ArrayList<>();
        public int seaPrice = 500;
        public int seaDays = 7;
        /** Area in which plots may be bought: minX, minY, maxX (exclusive), maxY (exclusive). */
        public int[] seaLimit = {-128, -128, 300, 150};
        public List<BillboardRec> billboards = new ArrayList<>();
        public List<Integer> billboardSlots = new ArrayList<>();
        public int billboardPrice = 250000;
        public int billboardDays = 7;
        public List<HomeRec> homes = new ArrayList<>();
        public List<LocVisitRec> locVisits = new ArrayList<>();
    }

    public static class UserRec {
        public String id;
        public String username;
        public String passwordHash;
        public Map<String, Object> look = new LinkedHashMap<>();
        public long cash;
        public long xp;
        public String home;
        public boolean verified;
        public long createdAt;
    }

    public static class SessionRec {
        public String userId;
        public long createdAt;
        public long lastSeen;
    }

    public static class GovRec {
        public int termId = 1;
        public long termEnds;
        public String governorId;
        public String governorSlogan;
        public long governorVotes;
        public String policy;
        public Long policyAt;
        public String announcement;
        public Long announcementAt;
        public int electionTerm = 2;
        public List<CandidateRec> candidates = new ArrayList<>();
        /** voter user id -> candidate user id, for the current election term. */
        public Map<String, String> votes = new LinkedHashMap<>();
    }

    public static class CandidateRec {
        public String userId;
        public String name;
        public String slogan;
        public long votes;
    }

    public static class SeaAdRec {
        public String id;
        public String ownerId;
        public String title;
        public String link;
        public int x, y, w, h;
        public long endsAt;
        public int v;
    }

    public static class BillboardRec {
        public String id;
        public String ownerId;
        public int slot;
        public String title;
        public String link;
        public long startsAt;
        public long endsAt;
        public int v;
    }

    public static class HomeRec {
        public String id;
        public String userId;
        public String estate;
        public int plot;
    }

    public static class LocVisitRec {
        public String userId;
        public String loc;
        public long at;
    }
}
