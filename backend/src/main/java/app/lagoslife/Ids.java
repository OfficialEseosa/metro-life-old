package app.lagoslife;

import java.security.SecureRandom;
import java.util.HexFormat;
import java.util.Random;

public final class Ids {
    private static final SecureRandom RNG = new SecureRandom();

    private Ids() {}

    /** 20 hex chars, same shape as ids on the live site. */
    public static String id() {
        return hex(RNG, 10);
    }

    /** Opaque 256-bit session token. */
    public static String token() {
        return hex(RNG, 32);
    }

    public static String hex(Random rng, int bytes) {
        byte[] b = new byte[bytes];
        rng.nextBytes(b);
        return HexFormat.of().formatHex(b);
    }
}
