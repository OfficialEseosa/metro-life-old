package app.metrolife;

import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;

final class Passwords {
    private static final SecureRandom RANDOM = new SecureRandom();
    static String hash(String password) {
        byte[] salt = new byte[16]; RANDOM.nextBytes(salt);
        return "210000:" + Base64.getEncoder().encodeToString(salt) + ":" + derive(password, salt, 210000);
    }
    static boolean verify(String password, String encoded) {
        if (encoded == null || encoded.isBlank()) return false;
        String[] parts = encoded.split(":");
        return MessageDigest.isEqual(derive(password, Base64.getDecoder().decode(parts[1]), Integer.parseInt(parts[0])).getBytes(java.nio.charset.StandardCharsets.UTF_8), parts[2].getBytes(java.nio.charset.StandardCharsets.UTF_8));
    }
    private static String derive(String password, byte[] salt, int iterations) {
        PBEKeySpec spec = new PBEKeySpec(password.toCharArray(), salt, iterations, 256);
        try { return Base64.getEncoder().encodeToString(SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).getEncoded()); }
        catch (Exception e) { throw new IllegalStateException("Password hashing unavailable", e); }
        finally { spec.clearPassword(); }
    }
}
