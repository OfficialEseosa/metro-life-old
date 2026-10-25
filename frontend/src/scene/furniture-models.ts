import type { Prop } from "./kaykit-props";

/** Which home furniture kinds are KayKit models (the rest stay procedural). */
export const MODELLED_KINDS = new Set([
  "bed",
  "chair",
  "sofa",
  "bench",
  "table",
  "desk",
  "stove",
  "fridge",
  "sink",
  "lamp",
  "rug",
  "shelf",
]);

type Piece = {
  id?: string;
  kind: string;
  x: number;
  z: number;
  w: number;
  d: number;
  angle: number;
  color?: string;
};
/** Soft upholstery tint: halfway between the model's own colours and the catalogue colour. */
const soften = (hex?: string) => {
  if (!hex) return undefined;
  const n = parseInt(hex.slice(1), 16),
    mix = (c: number) => Math.round(255 - (255 - c) * 0.45);
  const r = mix((n >> 16) & 255),
    g = mix((n >> 8) & 255),
    b = mix(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
};

/**
 * KayKit models fitted to the server footprint (w along local x, d along local z,
 * front towards +z). The collision box is the truth; models scale to it.
 */
export function furnitureProps(piece: Piece): Prop[] {
  const { kind, w, d, angle } = piece,
    out: Prop[] = [],
    c = Math.cos(angle),
    s = Math.sin(angle);
  const put = (
    pack: Prop["pack"],
    name: string,
    lx: number,
    ly: number,
    lz: number,
    ry: number,
    scale: Prop["s"],
    tint?: string,
  ) =>
    out.push({
      pack,
      name,
      // Rotate the local offset by the piece angle (three.js Y rotation).
      x: piece.x + lx * c + lz * s,
      y: ly,
      z: piece.z - lx * s + lz * c,
      ry: angle + ry,
      s: scale,
      tint,
    });
  const id = piece.id ?? "";
  switch (kind) {
    case "bed":
      // The model's head is at -z; the home layout puts the head at +x.
      put("furniture", "bed_double_A", 0, 0, 0, -Math.PI / 2, [d / 3.1, 0.62, w / 3], soften(piece.color));
      break;
    case "chair":
      put("furniture", "armchair_pillows", 0, 0, 0, 0, [w / 1.8, 0.58, d / 1.6], soften(piece.color));
      break;
    case "sofa":
    case "bench":
      put("furniture", "couch_pillows", 0, 0, 0, 0, [w / 3, 0.58, d / 1.6], soften(piece.color));
      break;
    case "table":
      if (w < 0.8)
        put("furniture", "cabinet_small_decorated", 0, 0, 0, 0, [w / 1.05, 0.42, d / 1.1]);
      else {
        put("furniture", "table_medium", 0, 0, 0, 0, [w / 2, 0.76, d / 2]);
        put("restaurant", "plate", 0, 0.76, 0, 0, 0.5);
      }
      break;
    case "desk":
      put("furniture", "table_medium_long", 0, 0, 0, 0, [w / 3, 0.76, d / 2]);
      put("furniture", "chair_B", 0, 0, d / 2 + 0.25, Math.PI, 0.62);
      put("furniture", "lamp_table", w * 0.38, 0.76, -d * 0.2, 0, 0.32);
      put("furniture", "book_set", -w * 0.36, 0.76 + 0.08, -d * 0.18, 0.3, 0.5);
      break;
    case "stove":
      put(
        "restaurant",
        id === "range" || w >= 1.15 ? "stove_multi_decorated" : "stove_single",
        0,
        0,
        0,
        0,
        [w / 2, 0.78, d / 2.29],
      );
      put("restaurant", "pot_A_stew", -w * 0.2, 0.78 * 1.0, -d * 0.18, 0.4, 0.42);
      break;
    case "fridge":
      put("restaurant", "fridge_A_decorated", 0, 0, 0, 0, [w / 2, 0.76, d / 2.24]);
      break;
    case "sink":
      put("restaurant", "kitchencounter_sink_backsplash", 0, 0, 0, 0, [w / 2, 0.86, d / 2.04]);
      break;
    case "lamp":
      put("furniture", "lamp_standing", 0, 0, 0, 0, [w * 1.15, 0.66, d * 1.15]);
      break;
    case "rug":
      put(
        "furniture",
        /round|oval/.test(id) ? "rug_oval_A" : "rug_rectangle_stripes_A",
        0,
        0.005,
        0,
        0,
        [w / 3, 0.4, d / 2],
        soften(piece.color),
      );
      break;
    case "shelf":
      put("furniture", "cabinet_medium_decorated", 0, 0, 0, 0, [w / 2.04, 0.92, d / 1.0]);
      break;
  }
  return out;
}
