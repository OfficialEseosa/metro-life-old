package app.lagoslife;

import app.lagoslife.Model.BillboardRec;
import app.lagoslife.Model.CandidateRec;
import app.lagoslife.Model.HomeRec;
import app.lagoslife.Model.SeaAdRec;
import app.lagoslife.Model.State;
import app.lagoslife.Model.UserRec;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Random;
import java.util.Set;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

/**
 * Builds the first-start data set. Everything here is synthetic (invented names, slogans,
 * ad titles, example.com links); only the sea-grid geometry and billboard slot numbers
 * come from the captured reference so the layout matches the live map.
 */
@Component
public class Seeder {
    public static final List<String> ESTATES =
            List.of("mushin", "yaba", "lekki", "ikoyi", "bananaIsland", "ikateTerrace", "magodo");

    private static final long DAY = 86_400_000L;
    private static final int SEED_USERS = 64;
    private static final int SEED_CANDIDATES = 40;

    private static final String[] FIRST = {
        "Tunde", "Chioma", "Emeka", "Bisi", "Kelechi", "Yetunde", "Obinna", "Folake", "Segun", "Amaka",
        "Ibrahim", "Zainab", "Dayo", "Ngozi", "Femi", "Halima", "Uche", "Sade", "Kunle", "Ifeoma",
        "Tobi", "Aisha", "Chidi", "Bukola", "Wale", "Nneka", "Gbenga", "Funke", "Musa", "Adaeze",
        "Lanre", "Temi", "Ikenna", "Simi", "Bola", "Efe", "Jide", "Kemi", "Nonso", "Ronke"};
    private static final boolean[] FEMALE = {
        false, true, false, true, false, true, false, true, false, true,
        false, true, false, true, false, true, false, true, false, true,
        false, true, false, true, false, true, false, true, false, true,
        false, true, false, true, true, false, false, true, false, true};
    private static final String[] SURNAME = {
        "Bakare", "Okonkwo", "Adeyemi", "Eze", "Balogun", "Nwosu", "Olawale", "Danjuma", "Ogunleye", "Okafor",
        "Lawal", "Umeh", "Adebayo", "Ibekwe", "Salami", "Onyeka", "Afolabi", "Bello", "Chukwu", "Oyelaran"};
    private static final String[] SUFFIX = {
        "_lagos", "Vibes", "OfLekki", "_ng", "TheGreat", "001", "Fresh", "_yaba",
        "Boss", "Online", "xo", "_gidi", "Speaks", "Runs", "Daily", "HQ"};

    private static final String[] SLOGANS = {
        "Steady light, steady hustle",
        "Lagos for everybody, not just the island",
        "No more go-slow on my watch",
        "Jollof in every pot",
        "Fix the roads, then we talk",
        "Mainland to the world",
        "Danfo fares you can smile at",
        "Soft life is a right",
        "Work hard, owambe harder",
        "One Lagos, one generator less",
        "Clean gutters, clear minds",
        "Your hustle, my priority",
        "Third Mainland, first class",
        "Light, water, good roads. Simple.",
        "Make rent make sense again",
        "Okada riders deserve respect",
        "Less talk, more tarred roads",
        "Every street a safe street",
        "Suya for the people",
        "Eko o ni baje, for real this time",
        "A Lagos that works on Monday morning",
        "Fuel the dreams, not the queues",
        "Markets open, pockets full",
        "Small chops, big plans",
        "The lagoon is for all of us",
        "Bring back the weekend",
        "Wages up, wahala down",
        "Tech hub in every area",
        "Vote sense, not noise",
        "From Yaba with love",
        "Affordable everything",
        "Traffic lights that actually work",
        "Your governor next door",
        "We move, together",
        "Shine your eye, vote wisely",
        "More parks, fewer potholes",
        "Stadium nights are coming back",
        "Hospitals that answer on time",
        "Books before billboards",
        "Lagos no dey carry last",
        "Calm seas and calm streets"};

    private static final String[] AD_PREFIX = {
        "Mama Nkechi", "Iya Basira", "Oga Tunde", "Aunty Bisi", "Chief Okoro", "Sisi Eko", "Uncle Dele",
        "Madam Kofo", "Alhaji Sule", "Bros Emeka", "Lekki", "Yaba", "Surulere", "Ikeja", "Mainland",
        "Island", "Third Mainland", "Eko", "Gidi", "Naija", "Danfo", "Okada", "Lagoon", "Marina",
        "Ajah", "Festac", "Ojuelegba", "Mushin", "Ikoyi", "Harmattan"};
    private static final String[] AD_BUSINESS = {
        "Fabrics", "Suya Spot", "Barbing Salon", "Phone Repairs", "Small Chops", "Tailoring", "Logistics",
        "Jollof Kitchen", "Laundry", "Photo Studio", "Bookshop", "Cakes", "Wigs and Hair", "Sneakers",
        "Car Wash", "Gym", "Thrift Store", "Events", "Dev Shop", "Radio", "Tutors", "Realty", "Zobo Bar",
        "Print Works", "Bikes", "Game Lounge", "Skincare", "Pharmacy", "Furniture", "Drinks Depot"};

    private static final String[] SKIN = {"#8d5a3b", "#c68a62", "#7a4a2c", "#a86f4c", "#653c24", "#3d2416", "#51301d"};
    private static final String[] HAIR_M = {"lowcut", "afro", "locs", "bald", "short", "fringe", "default"};
    private static final String[] HAIR_F = {"bonestraight", "braids", "curly", "bob", "long", "pixie", "afro", "locs"};
    private static final String[] HAIR_COLOR = {"#101010", "#15110e", "#161616", "#2e1f16", "#3b2314", "#4a2f1f", "#6b1424", "#c8913a"};
    private static final String[] OUTFIT = {"plain", "plain", "adire", "ankara", "jersey", "asooke"};
    private static final String[] CLOTH = {
        "#0f2557", "#0d0d0d", "#6b1424", "#f4f4f2", "#0b6e4f", "#1d2433", "#f4efe6", "#1f3b8f",
        "#f59e42", "#1f8a4c", "#c8102e", "#2f7de1", "#22b573", "#8b5cf6", "#d4a93a", "#2f4a7a"};
    private static final String[] STYLE = {"casual", "smart", "street", "party"};
    private static final String[] SHOES_M = {"oxfords", "suedeLoafers", "redSneakers", "slides", "tanLoafers", "patentBlack", "palmSlippers", "whiteSneakers"};
    private static final String[] SHOES_F = {"whiteSneakers", "crystalHeels", "goldHeels", "pinkHeels", "slides", "palmSlippers", "diamondSneakers"};
    private static final String[] SHOE_COLOR = {"#f4f4f2", "#111111", "#6b1424", "#3b2314", "#0d0d0d", "#d4a93a", "#8b5a2b", "#1f3b8f"};

    private final ObjectMapper mapper = new ObjectMapper();
    private final String seedPassword;

    public Seeder(@Value("${lagos.seed-password:lagos123}") String seedPassword) {
        this.seedPassword = seedPassword;
    }

    public static Map<String, Object> defaultLook() {
        Map<String, Object> l = new LinkedHashMap<>();
        l.put("skin", "#7a4a2c");
        l.put("hair", "lowcut");
        l.put("hairColor", "#161616");
        l.put("outfit", "plain");
        l.put("top", "#f4f4f2");
        l.put("bottom", "#2f4a7a");
        l.put("body", "m");
        l.put("style", "casual");
        l.put("shoes", "whiteSneakers");
        l.put("shoeColor", "#f4f4f2");
        return l;
    }

    public State seed() {
        long now = System.currentTimeMillis();
        Random rng = new Random(20261010L);
        State s = new State();
        s.visits = 3_184_200L;
        String hash = Passwords.hash(seedPassword);

        // --- users + homes
        Set<String> names = new LinkedHashSet<>();
        Map<String, Integer> plots = new HashMap<>();
        List<UserRec> users = new ArrayList<>();
        List<String> displayNames = new ArrayList<>();
        for (int i = 0; users.size() < SEED_USERS; i++) {
            int f = i % FIRST.length;
            String username = FIRST[f] + SUFFIX[(i * 7 + i / FIRST.length * 3) % SUFFIX.length];
            if (!names.add(username.toLowerCase(Locale.ROOT))) continue;
            UserRec u = new UserRec();
            u.id = Ids.hex(rng, 10);
            u.username = username;
            u.passwordHash = hash;
            u.look = randomLook(rng, FEMALE[f]);
            u.cash = 20_000 + rng.nextInt(480) * 1_000L;
            u.xp = rng.nextInt(4_000);
            u.home = ESTATES.get(rng.nextInt(ESTATES.size()));
            u.verified = users.size() < 6;
            u.createdAt = now - (1 + rng.nextInt(120)) * DAY - rng.nextInt((int) DAY);
            s.users.put(u.id, u);
            users.add(u);
            displayNames.add(FIRST[f] + " " + SURNAME[rng.nextInt(SURNAME.length)]);
            s.homes.add(home(rng, u, plots));
        }

        // --- governor + election
        List<String> slogans = new ArrayList<>(List.of(SLOGANS));
        Collections.shuffle(slogans, rng);
        UserRec gov = users.get(0);
        s.gov.termId = 1;
        s.gov.electionTerm = 2;
        s.gov.termEnds = (now / 3_600_000L + 1) * 3_600_000L + 7 * DAY;
        s.gov.governorId = gov.id;
        s.gov.governorSlogan = slogans.get(0);
        s.gov.governorVotes = 5_120;
        s.gov.policy = "light";
        s.gov.policyAt = now - 6 * 3_600_000L;
        double votes = 4_300;
        for (int i = 1; i <= SEED_CANDIDATES; i++) {
            CandidateRec c = new CandidateRec();
            c.userId = users.get(i).id;
            c.name = rng.nextInt(3) == 0 ? users.get(i).username : displayNames.get(i);
            c.slogan = slogans.get(i % slogans.size());
            c.votes = Math.max(3, Math.round(votes));
            votes = votes * (i < 5 ? 0.72 : 0.86) - rng.nextInt(3);
            s.gov.candidates.add(c);
        }

        // --- sea plots: reference geometry, invented titles and links
        JsonNode geo = geometry();
        List<String> titles = adTitles(rng);
        int t = 0;
        int minX = Integer.MAX_VALUE, minY = Integer.MAX_VALUE, maxX = Integer.MIN_VALUE, maxY = Integer.MIN_VALUE;
        for (JsonNode r : geo.get("ads")) {
            SeaAdRec a = new SeaAdRec();
            a.id = Ids.hex(rng, 10);
            a.ownerId = users.get(rng.nextInt(users.size())).id;
            a.title = titles.get(t++ % titles.size());
            a.link = "https://example.com/sea/" + slug(a.title);
            a.x = r.get(0).asInt();
            a.y = r.get(1).asInt();
            a.w = r.get(2).asInt();
            a.h = r.get(3).asInt();
            a.endsAt = now + (30 + rng.nextInt(336)) * DAY + rng.nextInt((int) DAY);
            s.seaAds.add(a);
            minX = Math.min(minX, a.x);
            minY = Math.min(minY, a.y);
            maxX = Math.max(maxX, a.x + a.w);
            maxY = Math.max(maxY, a.y + a.h);
        }
        for (JsonNode r : geo.get("holds")) {
            int[] h = {r.get(0).asInt(), r.get(1).asInt(), r.get(2).asInt(), r.get(3).asInt()};
            s.holds.add(h);
            minX = Math.min(minX, h[0]);
            minY = Math.min(minY, h[1]);
            maxX = Math.max(maxX, h[0] + h[2]);
            maxY = Math.max(maxY, h[1] + h[3]);
        }
        s.seaPrice = geo.get("price").asInt();
        s.seaDays = geo.get("days").asInt();
        // Purchases are confined to the seeded bounding box so the atlas size stays fixed.
        s.seaLimit = new int[] {minX, minY, maxX, maxY};

        // --- billboards: reference slot numbers, about two thirds occupied
        JsonNode bb = geo.get("billboards");
        s.billboardPrice = bb.get("price").asInt();
        s.billboardDays = bb.get("days").asInt();
        for (JsonNode slotNode : bb.get("slots")) {
            int slot = slotNode.asInt();
            s.billboardSlots.add(slot);
            if (rng.nextInt(3) == 0) continue;
            int queued = 1 + rng.nextInt(3);
            long start = now;
            for (int q = 0; q < queued; q++) {
                BillboardRec b = new BillboardRec();
                b.id = Ids.hex(rng, 10);
                b.ownerId = users.get(rng.nextInt(users.size())).id;
                b.slot = slot;
                b.title = titles.get(t++ % titles.size());
                b.link = "https://example.com/ads/" + slug(b.title);
                b.startsAt = start;
                b.endsAt = start + (q == 0 ? (1 + rng.nextInt(7)) * DAY + rng.nextInt((int) DAY) : s.billboardDays * DAY);
                start = b.endsAt;
                s.billboards.add(b);
            }
        }
        return s;
    }

    public static HomeRec home(Random rng, UserRec u, Map<String, Integer> plots) {
        HomeRec h = new HomeRec();
        h.id = Ids.hex(rng, 10);
        h.userId = u.id;
        h.estate = u.home;
        h.plot = plots.merge(u.home, 1, Integer::sum) - 1;
        return h;
    }

    private JsonNode geometry() {
        try (InputStream in = new ClassPathResource("seed/geometry.json").getInputStream()) {
            return mapper.readTree(in);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    private static List<String> adTitles(Random rng) {
        List<String> out = new ArrayList<>();
        for (String p : AD_PREFIX) for (String b : AD_BUSINESS) out.add(p + " " + b);
        Collections.shuffle(out, rng);
        return out;
    }

    static String slug(String title) {
        return title.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "-").replaceAll("(^-|-$)", "");
    }

    private static Map<String, Object> randomLook(Random rng, boolean female) {
        Map<String, Object> l = new LinkedHashMap<>();
        l.put("skin", pick(rng, SKIN));
        l.put("hair", pick(rng, female ? HAIR_F : HAIR_M));
        l.put("hairColor", pick(rng, HAIR_COLOR));
        l.put("outfit", pick(rng, OUTFIT));
        l.put("top", pick(rng, CLOTH));
        l.put("bottom", pick(rng, CLOTH));
        l.put("body", female ? "f" : "m");
        l.put("style", pick(rng, STYLE));
        l.put("shoes", pick(rng, female ? SHOES_F : SHOES_M));
        l.put("shoeColor", pick(rng, SHOE_COLOR));
        return l;
    }

    private static String pick(Random rng, String[] arr) {
        return arr[rng.nextInt(arr.length)];
    }
}
