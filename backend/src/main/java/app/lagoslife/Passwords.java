package app.lagoslife;

import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;

/** PBKDF2-HMAC-SHA256 password hashing, stored as pbkdf2$iterations$salt$hash. */
public final class Passwords {
    private static final SecureRandom RNG = new SecureRandom();
    private static final int ITERATIONS = 120_000;

    private Passwords() {}

    public static String hash(String password) {
        byte[] salt = new byte[16];
        RNG.nextBytes(salt);
        return "pbkdf2$" + ITERATIONS + "$" + b64(salt) + "$" + b64(derive(password, salt, ITERATIONS));
    }

    public static boolean verify(String password, String stored) {
        if (stored == null || password == null) return false;
        String[] p = stored.split("\\$");
        if (p.length != 4 || !p[0].equals("pbkdf2")) return false;
        try {
            byte[] salt = Base64.getDecoder().decode(p[2]);
            byte[] want = Base64.getDecoder().decode(p[3]);
            return MessageDigest.isEqual(want, derive(password, salt, Integer.parseInt(p[1])));
        } catch (RuntimeException e) {
            return false;
        }
    }

    private static byte[] derive(String password, byte[] salt, int iterations) {
        try {
            PBEKeySpec spec = new PBEKeySpec(password.toCharArray(), salt, iterations, 256);
            return SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).getEncoded();
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private static String b64(byte[] b) {
        return Base64.getEncoder().encodeToString(b);
    }
}
