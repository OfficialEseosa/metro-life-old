package app.lagoslife;

import java.awt.BasicStroke;
import java.awt.Color;
import java.awt.Font;
import java.awt.FontMetrics;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.Shape;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.ArrayList;
import java.util.List;
import javax.imageio.ImageIO;

/**
 * Deterministic placeholder artwork: a curated two-tone palette picked from the ad id,
 * one quiet geometric motif, and the title set in bold sans-serif with generous padding.
 */
public final class Art {
    private Art() {}

    /** background, foreground (text), accent (motif). */
    private static final int[][] PALETTE = {
        {0x0F2D40, 0xF4EDE0, 0x1F5673},
        {0xF4EDE0, 0x1D2A33, 0xE3D5BD},
        {0x0B6E4F, 0xF6F3E7, 0x128A63},
        {0xC8553D, 0xFFF4E6, 0xDA6F58},
        {0xF2B134, 0x2B2118, 0xF7C968},
        {0x1F3B8F, 0xF2F5FF, 0x3555B5},
        {0x2B2D42, 0xEDF2F4, 0x444763},
        {0xE8E4D9, 0x0B6E4F, 0xD6D0BF},
        {0x6B1424, 0xF9E9D9, 0x8A2A3C},
        {0x13505B, 0xEAF6F4, 0x1D6C79},
        {0xFAF3DD, 0xC8553D, 0xEFE3BE},
        {0x3A2E5F, 0xF3EEFF, 0x55478A}};

    public static final Color HOLD = new Color(0x4F, 0x6D, 0x7A, 170);

    public static byte[] png(int width, int height, String id, String title) {
        BufferedImage img = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = img.createGraphics();
        try {
            hints(g);
            draw(g, 0, 0, width, height, id, title);
        } finally {
            g.dispose();
        }
        return encode(img);
    }

    public static byte[] encode(BufferedImage img) {
        try {
            ByteArrayOutputStream out = new ByteArrayOutputStream(1 << 16);
            ImageIO.write(img, "png", out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    public static void hints(Graphics2D g) {
        g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        g.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
        g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
        g.setRenderingHint(RenderingHints.KEY_FRACTIONALMETRICS, RenderingHints.VALUE_FRACTIONALMETRICS_ON);
    }

    /** Paint one piece of artwork into the given rectangle (clipped to it). */
    public static void draw(Graphics2D g, int x, int y, int w, int h, String id, String title) {
        int hash = mix(id);
        int[] pal = PALETTE[Math.floorMod(hash, PALETTE.length)];
        Color bg = new Color(pal[0]), fg = new Color(pal[1]), accent = new Color(pal[2]);
        int motif = Math.floorMod(hash >>> 8, 5);
        int min = Math.min(w, h);

        Shape oldClip = g.getClip();
        g.clipRect(x, y, w, h);
        g.setColor(bg);
        g.fillRect(x, y, w, h);

        g.setColor(accent);
        switch (motif) {
            case 0 -> { // quarter disc, bottom right
                int r = Math.round(min * 0.62f);
                g.fillOval(x + w - r, y + h - r, r * 2, r * 2);
            }
            case 1 -> { // quarter disc, top left
                int r = Math.round(min * 0.5f);
                g.fillOval(x - r, y - r, r * 2, r * 2);
            }
            case 2 -> { // diagonal band
                int band = Math.max(2, Math.round(min * 0.22f));
                g.fillPolygon(
                        new int[] {x + w - band * 3, x + w - band * 2, x + w, x + w},
                        new int[] {y, y, y + band * 2, y + band * 3}, 4);
            }
            case 3 -> { // footer bar
                int bar = Math.max(1, Math.round(h * 0.09f));
                g.fillRect(x, y + h - bar, w, bar);
            }
            default -> { // thin inset frame
                float sw = Math.max(1f, min * 0.025f);
                int inset = Math.max(1, Math.round(min * 0.06f));
                g.setStroke(new BasicStroke(sw));
                g.drawRect(x + inset, y + inset, w - inset * 2, h - inset * 2);
            }
        }

        drawTitle(g, x, y, w, h, title, fg);
        g.setClip(oldClip);
    }

    private static void drawTitle(Graphics2D g, int x, int y, int w, int h, String title, Color fg) {
        if (title == null) return;
        // Artwork is text-only: drop emoji / pictographs (astral code points, symbols, joiners).
        title = title.codePoints()
                .filter(cp -> cp < 0x10000 && Character.getType(cp) != Character.OTHER_SYMBOL
                        && cp != 0x200D && cp != 0xFE0F)
                .collect(StringBuilder::new, StringBuilder::appendCodePoint, StringBuilder::append)
                .toString();
        if (title.isBlank()) return;
        int pad = Math.max(2, Math.round(Math.min(w, h) * 0.12f));
        int boxW = w - pad * 2, boxH = h - pad * 2;
        if (boxW < 14 || boxH < 7) return;
        String[] words = title.trim().split("\\s+");
        int start = Math.min(Math.round(h * 0.26f), Math.round(w * 0.2f));
        for (int size = Math.max(start, 7); size >= 6; size -= size > 24 ? 2 : 1) {
            Font font = new Font(Font.SANS_SERIF, Font.BOLD, size);
            FontMetrics fm = g.getFontMetrics(font);
            List<String> lines = wrap(words, fm, boxW);
            if (lines == null) continue;
            int lineH = Math.round(size * 1.16f);
            int total = lineH * (lines.size() - 1) + fm.getAscent();
            if (total > boxH) continue;
            g.setFont(font);
            g.setColor(fg);
            int ty = y + pad + (boxH - total) / 2 + fm.getAscent();
            for (String line : lines) {
                g.drawString(line, x + pad, ty);
                ty += lineH;
            }
            return;
        }
        // Too small to set legibly: leave the colour block on its own.
    }

    /** Greedy word wrap; null when a single word is wider than the box. */
    private static List<String> wrap(String[] words, FontMetrics fm, int maxW) {
        List<String> lines = new ArrayList<>();
        StringBuilder cur = new StringBuilder();
        for (String word : words) {
            if (fm.stringWidth(word) > maxW) return null;
            if (cur.length() == 0) {
                cur.append(word);
            } else if (fm.stringWidth(cur + " " + word) <= maxW) {
                cur.append(' ').append(word);
            } else {
                lines.add(cur.toString());
                cur = new StringBuilder(word);
            }
        }
        if (cur.length() > 0) lines.add(cur.toString());
        return lines;
    }

    private static int mix(String id) {
        int h = 0x811C9DC5;
        for (int i = 0; i < id.length(); i++) {
            h ^= id.charAt(i);
            h *= 0x01000193;
        }
        h ^= h >>> 15;
        return h;
    }
}
