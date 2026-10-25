import * as THREE from "three";
import type { RoomLayout } from "../navigation";
import { Builder } from "./geometry";
import { buildBowl, type BowlSeat } from "./bowl-builder";

export type VenueSign = {
  text: string;
  x: number;
  y: number;
  z: number;
  color?: string;
};
export function buildVenueArchitecture(
  b: Builder,
  glow: Builder,
  glass: Builder,
  layout: RoomLayout,
  type: string,
  loc: string,
) {
  const w = layout.bounds?.w ?? 12,
    d = layout.bounds?.d ?? 10,
    h = layout.height ?? 4,
    signs: VenueSign[] = [],
    sports = ["stadium", "arena", "ballpark"].includes(type);
  let crowd: BowlSeat[] = [];
  const sign = (
    text: string,
    x: number,
    y: number,
    z: number,
    color = "#ffe2ac",
  ) => signs.push({ text, x, y, z, color });
  const column = (x: number, z: number, height: number, color = "#e6d5b8") => {
    b.cylinder(x, height / 2, z, 0.25, height, color, 12);
    b.cylinder(x, 0.15, z, 0.42, 0.3, color, 12);
    b.cylinder(x, height - 0.15, z, 0.4, 0.3, color, 12);
  };
  const painting = (x: number, y: number, z: number, colour: string) => {
    b.box(x, y, z, 2.6, 2.0, 0.16, "#a8875d");
    b.box(x, y, z + 0.11, 2.3, 1.7, 0.06, colour);
    b.sphere(x - 0.45, y + 0.3, z + 0.16, 0.42, "#f2d997", 1, 1, 0.06);
    b.box(x + 0.4, y - 0.2, z + 0.16, 0.7, 0.6, 0.025, "#688b87");
  };
  const rail = (x: number, y: number, z: number, width: number) => {
    b.box(x, y + 0.65, z, width, 0.055, 0.07, "#68626a");
    for (let xx = x - width / 2; xx <= x + width / 2; xx += 0.8)
      b.cylinder(xx, y + 0.32, z, 0.025, 0.65, "#68626a", 6);
  };
  const trees = (x: number, z: number, count = 3) => {
    for (let i = 0; i < count; i++) {
      const xx = x + (i - 1) * 1.6;
      b.cylinder(xx, 0.75, z, 0.12, 1.5, "#8e7052", 7);
      b.sphere(
        xx,
        2.0,
        z,
        0.85,
        ["#739775", "#8ca76f", "#568478"][i % 3],
        0.8,
        1.3,
        0.8,
      );
    }
  };
  if (sports) {
    crowd = buildBowl(b, glow, type);
    const sx = type === "arena" ? 17 : 23,
      z = type === "arena" ? 8 : 11;
    b.box(-sx, 1.5, z - 3, 6, 3, 0.25, "#31434e");
    sign("CONCOURSE KITCHEN", -sx, 3.7, z - 2.8);
    b.box(sx, 0.035, z, 8, 0.07, 8, "#56766b");
    sign(
      type === "arena" ? "BASELINE BAR" : "THE HUNDRED CLUB",
      sx,
      3.7,
      z - 2.8,
    );
    for (let i = 0; i < 8; i++) {
      b.cylinder(
        sx - 2.8 + i * 0.8,
        1.8,
        z - 3,
        0.12,
        0.55,
        ["#baa05f", "#739792", "#9b617c"][i % 3],
        8,
      );
      glow.box(sx, 2.4, z - 3, 6.5, 0.1, 0.12, "#eec98e");
    }
    if (type === "arena") {
      b.box(-17, 1.7, -11, 7, 3.4, 0.25, "#34333d");
      glow.box(-17, 1.7, -10.84, 6.6, 2.9, 0.05, "#669c7f");
      b.box(-17, 0.045, -7, 6, 0.09, 5, "#658a59");
      sign("SWING BAY", -17, 4, -10.5);
      for (let i = 0; i < 3; i++) {
        const x = 14.5 + i * 1.8;
        b.box(x, 0.5, -8, 0.85, 1, 1, "#3f4d57");
        b.box(x, 1.4, -8.4, 1.2, 1.8, 0.12, "#deded4");
        glass.box(x, 1.4, -8.31, 1, 1.6, 0.03, "#a7bec6");
      }
      sign("FRESH FADE", 17, 3.5, -9.1);
    } else if (type === "ballpark") {
      b.box(-18, 1.5, -18, 9, 3, 0.5, "#a58a63");
      for (let i = 0; i < 5; i++) {
        b.cylinder(-21 + i * 1.5, 0.75, -16, 0.18, 1.5, "#bcb7a6", 10);
        b.sphere(-21 + i * 1.5, 1.6, -16, 0.3, "#bcb7a6");
      }
      sign("MONUMENT GARDEN", -18, 3.7, -17);
    }
  } else if (type === "foodhall") {
    for (const x of [-20, -12, -4, 4, 12, 20])
      for (const z of [-4, 10]) {
        b.box(x, 3.8, z, 0.38, 7.6, 0.38, "#a97c50");
        b.box(x, 7.3, 3, 0.3, 0.45, 15, "#b58a5d");
      }
    for (const z of [-3, 2, 7]) {
      b.line([-21, 6.2, z], [21, 6.2, z], 0.025, "#4c4641");
      for (let x = -20; x <= 20; x += 2)
        glow.sphere(x, 6.1, z, 0.095, "#ffdda0", 1, 1.25, 1);
    }
    const stalls = [
      "Brick & Bun",
      "Noodle Lantern",
      "Pan Dulce",
      "Honeycomb",
      "Goat Hill Coffee",
      "Pho Avenue",
      "Melted Moon",
      "Peach Press",
    ];
    let n = 0;
    for (const z of [-1, 8])
      for (const x of [-17, -8, 1, 10]) {
        sign(
          stalls[n],
          x,
          3.6,
          z + 0.1,
          ["#fac27f", "#a4dad1", "#ef9cb2", "#d6baee"][n++ % 4],
        );
        b.box(x, 2.1, z - 1.2, 5.4, 4.2, 0.22, "#8a4a35");
        for (let shelf = 0; shelf < 3; shelf++) {
          b.box(x, 1.4 + shelf * 0.6, z - 1, 4.7, 0.12, 0.5, "#b98a55");
          for (let jar = 0; jar < 7; jar++)
            b.cylinder(
              x - 1.8 + jar * 0.6,
              1.65 + shelf * 0.6,
              z - 0.94,
              0.11,
              0.35,
              ["#d5ad73", "#a97760", "#77946e"][jar % 3],
              8,
            );
        }
      }
    for (const x of [-18, -13, -8]) {
      b.box(x, 2, -13, 4.6, 4, 0.3, "#536a65");
      glass.box(x, 1.7, -12.75, 4.1, 3.2, 0.05, "#a9c1ba");
      for (let i = 0; i < 7; i++)
        b.box(
          x - 1.7 + i * 0.5,
          0.9,
          -12.5,
          0.24,
          0.9,
          0.32,
          i % 2 ? "#aa775c" : "#d9bf80",
        );
    }
    sign("PAGE TURNER", -18, 4.7, -12.5);
    sign("TIN ROBOT TOYS", -13, 4.7, -12.5);
    sign("MAKERS CORNER", -8, 4.7, -12.5);
    for (const x of [-5, -1])
      for (const z of [-12, -8]) b.box(x, 4, z, 0.18, 8, 0.18, "#444948");
    for (let y = 0.5; y < 7.5; y += 0.65)
      b.box(-3, y, -12, 4, 0.055, 0.12, "#8b876e");
    sign("FREIGHT LIFT", -3, 8.4, -10);
    b.box(11, 2.8, -10, 20, 0.35, 9, "#ac876b");
    for (let step = 0; step < 12; step++)
      b.box(
        5,
        0.125 + step * 0.125,
        -3.5 - step / 6,
        6,
        0.25 + step * 0.25,
        0.22,
        "#ad8b6b",
      );
    rail(11, 3, -14.5, 20);
    rail(16, 3, -5.5, 10);
    b.box(5, 3.035, -10, 6, 0.07, 6, "#5a936e");
    for (const z of [-13, -7]) b.box(5, 3.15, z, 6, 0.2, 0.18, "#e6d7b4");
    for (const x of [2, 8]) b.box(x, 3.15, -10, 0.18, 0.2, 6, "#e6d7b4");
    b.cylinder(4, 3.11, -12, 0.13, 0.05, "#262d32", 12);
    b.cylinder(4, 3.7, -12, 0.025, 1.3, "#efe3ca", 6);
    b.box(4.35, 4.1, -12, 0.6, 0.4, 0.025, "#d27770");
    sign("ROOFTOP FAIR", 11, 8.2, -14.2, "#f8c67b");
    for (let i = 0; i < 3; i++) {
      const x = 12.5 + i * 1.5;
      b.box(x, 3.4, -10.5, 1.2, 0.7, 5, "#bd795a");
      b.box(x, 4.0, -12.5, 1.25, 1.7, 0.4, "#d7ba7f");
      for (const y of [3.7, 4.2, 4.7])
        b.torus(x, y, -12.22, 0.22, 0.035, "#f5e6c3");
    }
    for (const x of [18, 20]) {
      b.cylinder(x, 5.8, -10, 0.13, 5.6, "#e7c376", 8);
      b.box(x, 8.4, -10, 1.6, 0.2, 2, "#d3ae63");
    }
    b.line([18, 8.2, -9], [20, 3.5, -6], 0.55, "#d36d79");
    trees(18, -13, 2);
    sign("STATION NINE", 18, 5, -13.3);
  } else if (type === "aquarium") {
    b.box(0, 4.5, -12.8, 31, 9, 0.45, "#213c53");
    glow.box(0, 4.5, -12.52, 29.5, 8.1, 0.08, "#266d9b");
    glass.box(0, 4.5, -12.4, 29, 7.8, 0.035, "#55b8c9");
    b.box(0, 0.4, -10.4, 22, 0.8, 2, "#23384c");
    b.box(0, 0.17, -8.5, 20, 0.34, 1.4, "#405062");
    sign("OPEN OCEAN HALL", 0, 9.4, -12.2, "#b4eaf3");
    const tunnel = new THREE.CylinderGeometry(
      3.1,
      3.1,
      13,
      28,
      1,
      true,
      0,
      Math.PI,
    );
    tunnel.rotateX(Math.PI / 2);
    tunnel.rotateZ(Math.PI / 2);
    glass.add(tunnel, "#3c9dbb", -12, 0, 1);
    for (let z = -5; z <= 7; z += 2)
      b.torus(-12, 0, z, 3.1, 0.055, "#aec7cb", 0, Math.PI);
    for (let i = 0; i < 14; i++) {
      const x = 9 + (i % 5),
        z = -9 + Math.floor(i / 5);
      b.cylinder(
        x,
        0.7,
        z,
        0.12,
        1.4,
        ["#df9966", "#b17fbd", "#d8bd68"][i % 3],
        6,
      );
      for (const side of [-1, 1])
        b.line(
          [x, 0.5, z],
          [x + side * 0.45, 1.2, z + 0.1],
          0.1,
          ["#df9966", "#b17fbd", "#d8bd68"][i % 3],
        );
    }
    b.cylinder(12, 0.55, -1, 2.5, 1.1, "#d8cbb7", 32);
    glow.cylinder(12, 1.12, -1, 2.2, 0.035, "#4daab2", 32);
    sign("RAY DISCOVERY", 12, 3.3, -1, "#b8e7e3");
    sign("REEF GARDEN", 12, 4.4, -9.5, "#f6c38a");
  } else if (type === "theatre") {
    b.box(0, 5.5, -14.6, 26, 11, 0.3, "#19273f");
    for (const side of [-1, 1]) {
      b.box(side * 6.7, 3.8, -11.8, 0.5, 7.6, 0.7, "#e1bd72");
      for (let z = -11; z <= 4; z += 4) {
        column(side * 13, z, 6, "#b78c69");
        b.torus(side * 13, 4.7, z, 1.35, 0.15, "#cfb18a", Math.PI / 2, Math.PI);
      }
    }
    b.box(0, 7.8, -11.9, 14, 0.65, 0.7, "#a34257");
    b.box(0, 8.25, -11.9, 15, 0.2, 0.9, "#e7c47a");
    b.box(0, 10.1, -4, 28, 0.12, 22, "#1f2e53");
    for (let i = 0; i < 96; i++)
      glow.sphere(
        Math.sin(i * 7.3) * 12,
        9.9,
        -13 + (((i * 29) % 100) / 100) * 22,
        0.045,
        "#f8ddaf",
        1,
        0.55,
        1,
      );
    for (let row = 0; row < 6; row++)
      b.box(
        0,
        (row * 0.17) / 2,
        -4 + row * 1.2,
        11,
        row * 0.17 + 0.04,
        1.2,
        "#5f4857",
      );
    b.box(0, 3.8, 8.1, 24, 0.3, 5.4, "#aa8b66");
    rail(0, 3.95, 5.6, 24);
    for (let i = 0; i < 11; i++)
      b.cylinder(
        -11 + i * 0.4,
        2.6,
        -10,
        0.12,
        2.4 + (i % 3) * 0.5,
        "#d4bb81",
        8,
      );
    b.box(-9, 1, -8.7, 3, 1.9, 1.1, "#e4ca8c");
    for (let i = 0; i < 10; i++)
      b.box(
        -10 + i * 0.21,
        1.3,
        -8.06,
        0.18,
        0.08,
        0.4,
        i % 3 ? "#f7e6c8" : "#443d3e",
      );
    sign("BIG BERTHA", -9, 4, -10.5);
    for (const x of [8, 12])
      for (const z of [-10, -4]) column(x, z, 6, "#bd9b63");
    b.box(10, 0.055, -7, 8, 0.08, 8, "#b89765");
    sign("PHARAOH BALLROOM", 10, 6.7, -11);
  } else if (type === "museum") {
    for (let level = 0; level < 3; level++) {
      const shape = new THREE.Shape();
      shape.absarc(-8, -5, 5.8, 0, Math.PI / 2, false);
      shape.absarc(-8, -5, 4.8, Math.PI / 2, 0, true);
      shape.closePath();
      const ramp = new THREE.ExtrudeGeometry(shape, {
        depth: 0.2,
        bevelEnabled: false,
      });
      ramp.rotateX(-Math.PI / 2);
      b.add(ramp, "#f4f1e9", 0, 2.5 + level * 2.4, 0);
      const ring = new THREE.TorusGeometry(5.4, 0.045, 4, 40, Math.PI / 2);
      ring.rotateX(Math.PI / 2);
      b.add(ring, "#c7d2cf", -8, 3.4 + level * 2.4, 5);
    }
    glass.box(-14.8, 4.8, -2, 0.12, 9, 18, "#b8d8dc");
    for (let z = -11; z <= 7; z += 2.5)
      b.box(-14.6, 4.8, z, 0.18, 9, 0.09, "#eff1e8");
    for (let y = 2; y < 10; y += 2)
      b.box(-14.6, y, -2, 0.18, 0.1, 18, "#eff1e8");
    for (let i = 0; i < 5; i++)
      painting(
        -10 + i * 5,
        3,
        -12.6,
        ["#a2bcb0", "#d1a178", "#6e95ac", "#d8bd70", "#b285a0"][i],
      );
    b.box(0, 0.6, -6, 2, 1.2, 2, "#eee9dd");
    b.torus(0, 2.6, -6, 1.25, 0.25, "#9a8b77");
    b.torus(0, 3.8, -6, 0.8, 0.2, "#92a5a1", Math.PI / 2);
    for (let i = 0; i < 3; i++) {
      const x = 7 + i * 2;
      b.box(x, 1.3, -5, 0.1, 2.6, 0.1, "#9b805e");
      b.box(x, 1.8, -5, 0.95, 1.2, 0.12, "#f6e7c5");
      b.line([x, 1.5, -5], [x + 0.5, 0, -4.5], 0.04, "#9b805e");
    }
    sign("OPEN ART STUDIO", 10, 4, -5.7);
  } else if (type === "civic") {
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      column(Math.cos(a) * 8, Math.sin(a) * 8 - 4, 10, "#eadfca");
    }
    b.dome(0, 10, -4, 8.4, "#d9c89a", 0.55);
    glow.torus(0, 10.2, -4, 5.4, 0.14, "#f5dba3", Math.PI / 2);
    b.box(0, 1, -9, 3, 2, 1.5, "#987050");
    sign("THE GOLD ROTUNDA", 0, 12, -4);
    for (const x of [-12, 12])
      for (let i = 0; i < 5; i++) {
        b.box(
          x,
          0.1 + i * 0.14,
          -10 + i * 0.5,
          4,
          0.2 + i * 0.28,
          0.5,
          "#d0c8b7",
        );
        b.box(x, 3.4, -4, 5, 0.15, 11, "#d0c8b7");
      }
    sign("PUBLIC REGISTRY", -10, 4, 2);
    sign("COUNCIL CHAMBER", 10, 4, 2);
  } else if (type === "heritage") {
    if (loc === "alcatraz") {
      for (let cell = 0; cell < 4; cell++) {
        const x = -10 + cell * 6;
        for (let bar = 0; bar < 7; bar++)
          b.cylinder(x - 2.3 + bar * 0.7, 2.4, -9, 0.035, 4.8, "#748081", 7);
        b.box(x, 4.7, -9, 5, 0.2, 0.3, "#748081");
        b.box(x, 0.5, -10.5, 3, 1, 1.2, "#9d9e89");
      }
      sign("ISLAND HISTORY", 0, 6, -9);
    } else if (loc === "liberty") {
      b.cylinder(0, 1.1, -7, 3, 2.2, "#b5aa8c", 8);
      b.cylinder(0, 3.6, -7, 1.1, 3, "#6b9c8f", 8, 0.65);
      b.sphere(0, 5.6, -7, 0.65, "#6b9c8f");
      b.line([0.5, 4.3, -7], [2, 6.6, -7], 0.3, "#6b9c8f");
      glow.sphere(2, 7.2, -7, 0.6, "#eac27a", 0.65, 1.5, 0.65);
      sign("HARBOR STORIES", 0, 8.5, -9);
    } else {
      b.box(0, 0.08, -6, 9, 0.16, 3, "#c4c7b7");
      glow.box(0, 0.175, -6, 8.5, 0.025, 2.5, "#97b4bd");
      b.box(0, 2.7, -10, 18, 5.4, 0.3, "#d5c7aa");
      sign("REMEMBER. REFLECT. CONTINUE.", 0, 3, -9.75, "#4a5e5d");
      trees(-9, 2, 3);
      trees(9, 2, 3);
    }
  } else if (type === "airport") {
    if (loc === "grandCentral") {
      b.dome(0, 5, -2, 10, "#758f96", 0.35);
      b.cylinder(0, 1.3, 4, 1.3, 2.6, "#bba271", 12);
      b.sphere(0, 3.2, 4, 0.65, "#e0c990");
      sign("GRAND HALL", 0, 7.5, -6);
    } else {
      for (let z = -10; z <= 1; z += 2) {
        b.box(0, 5.4, z, 13, 0.18, 0.2, "#4b6b67");
        for (let x = -5; x <= 5; x += 1.3)
          glow.sphere(
            x,
            5.1 + Math.sin(x + z) * 0.25,
            z,
            0.25,
            (x + z) % 2 ? "#5cae8f" : "#81c8b3",
            1,
            0.2,
            1,
          );
      }
      sign("LANTERN FOREST", 0, 6.5, -10, "#b5e3bc");
    }
    b.box(15, 0.06, -5, 10, 0.12, 14, "#8c9b9c");
    for (let z = -11; z <= 1; z += 2)
      b.box(10, 1.3, z, 0.08, 2.6, 0.12, "#b9d3d2");
    b.box(-15, 4.5, 2, 10, 2.4, 0.2, "#293e4e");
    sign("DEPARTURES", -15, 5.5, 2.2, "#e7c286");
    sign("SKYTRAIN", 15, 4, -10, "#b4dce5");
  } else if (type === "campus") {
    for (let step = 0; step < 5; step++) {
      b.box(
        0,
        step * 0.14,
        -6 + step * 0.8,
        9,
        0.28 + step * 0.28,
        0.8,
        "#a28869",
      );
      for (let x = -3; x <= 3; x += 1.5)
        b.box(x, 0.5 + step * 0.28, -6 + step * 0.8, 1, 0.1, 0.6, "#4d7575");
    }
    b.box(0, 3.2, -11, 12, 3.8, 0.2, "#45655c");
    sign("IDEAS BEGIN HERE", 0, 3.4, -10.8);
    for (let i = 0; i < 3; i++) {
      b.sphere(
        8 + i * 0.8,
        1.6,
        -8,
        0.35,
        ["#83bfae", "#adb6d1", "#d6ac7a"][i],
      );
      b.cylinder(8 + i * 0.8, 1.2, -8, 0.14, 0.8, "#c0c9bb", 8);
    }
    sign("LEARNING LAB", 9, 4, -9);
  } else if (type === "skyoffice" || type === "work") {
    for (let i = 0; i < 10; i++) {
      const x = -w / 2 + 1 + (i * (w - 2)) / 10,
        hh = 2 + ((i * 7) % 6);
      b.box(x, hh / 2, -d / 2 + 0.2, 1.8, hh, 0.3, "#7894a2");
      for (let y = 0.6; y < hh; y += 0.85)
        glow.box(x, y, -d / 2 + 0.38, 1.2, 0.18, 0.015, "#f4d7a0");
    }
    for (const x of [-w / 2 + 2, w / 2 - 2])
      column(x, -d / 2 + 3, h - 0.2, "#c9d3cf");
    glass.box(0, h / 2, -d / 2 + 0.5, w - 1, h - 0.5, 0.04, "#b9d4d8");
    sign(
      type === "skyoffice" ? "SKYLINE LOUNGE" : "MAKE SOMETHING GOOD",
      0,
      h - 0.8,
      -d / 2 + 0.65,
    );
  } else if (type === "cafe" || type === "retail") {
    const colours = ["#bb7469", "#d0ae68", "#6f9993", "#8f7f9e"];
    for (let i = 0; i < 4; i++) {
      const x = -w / 2 + 3 + (i * (w - 6)) / 3;
      b.box(x, 2.1, -d / 2 + 0.5, 5, 4.2, 0.25, colours[i]);
      glass.box(x, 1.9, -d / 2 + 0.72, 4.4, 3.4, 0.04, "#acc8c0");
      sign(
        type === "retail"
          ? [
              "Thread & Leaf",
              "Paper Moon",
              "Tiny Treasures",
              "The Maker Shelf",
            ][i]
          : [
              "Dumpling Dynasty",
              "Smoke Ring BBQ",
              "Crumb & Honey",
              "Loop Coffee",
            ][i],
        x,
        4.8,
        -d / 2 + 0.9,
      );
    }
    if (type === "cafe") {
      for (let i = 0; i < 18; i++) {
        const x = -w / 2 + 0.16,
          z = -5 + i * 0.7;
        b.box(
          x,
          1.5 + Math.sin(i) * 0.8,
          z,
          0.06,
          0.7,
          0.8,
          colours[i % 4],
          Math.sin(i) * 0.4,
        );
      }
      sign("TAG TUNNEL", -8, 4, 0, "#ebbca5");
    }
    trees(w / 2 - 2, d / 2 - 3, 2);
  } else if (type === "club") {
    for (const x of [-8, 8])
      for (let z = -8; z <= 4; z += 3) {
        b.cylinder(x, 5.8, z, 0.2, 0.4, "#3a3445", 8);
        glow.cylinder(x, 5.55, z, 0.16, 0.04, z % 2 ? "#a393e0" : "#dc88bc", 8);
      }
    b.box(0, 5.6, -9, 11, 1.8, 0.3, "#2b2737");
    sign("THE LIVE ROOM", 0, 5.6, -8.8, "#e7b1d4");
    for (let i = 0; i < 8; i++)
      b.cylinder(
        -12 + i * 0.6,
        2,
        3,
        0.12,
        0.65,
        ["#c09e68", "#7eb2a4", "#ad7a91"][i % 3],
        8,
      );
  } else if (type === "hospital") {
    b.box(6, 1.5, -7, 11, 3, 0.12, "#bfd0c7");
    for (let i = 0; i < 5; i++) {
      b.box(
        3 + i * 1.7,
        1.3,
        -6.8,
        0.7,
        1.3,
        0.1,
        i % 2 ? "#9ec1b2" : "#d4d9c4",
      );
    }
    trees(8, 7, 2);
    sign("A LITTLE CARE GOES A LONG WAY", 0, 4.2, -9.6, "#5e8c88");
    b.box(-8, 2, -9, 1.1, 0.2, 0.12, "#6ba094");
    b.box(-8, 2, -9, 0.2, 1.1, 0.12, "#6ba094");
  } else {
    b.box(0, 0.025, -2, w - 2, 0.05, d - 2, "#8bab75");
    b.box(9, 0.07, 4, 8, 0.14, 10, "#9cbdb2");
    b.box(9, 0.15, 3.7, 6.8, 0.025, 8.6, "#719fba");
    for (let i = 0; i < 12; i++)
      b.box(5.4 + i * 0.65, 0.18, 8, 0.55, 0.12, 2, "#b79b73");
    trees(-9, -4, 4);
    trees(9, -7, 4);
    for (let x = -4; x <= 4; x += 2)
      b.cylinder(x, 0.3, -5, 0.8, 0.6, "#b9a783", 16);
    sign("MEET UNDER THE TREES", 0, 5, -10);
  }
  return { signs, crowd };
}
