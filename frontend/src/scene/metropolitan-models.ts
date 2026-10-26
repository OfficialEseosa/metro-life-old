import * as THREE from "three";
import { Builder } from "./geometry";
import { busStationGeometry } from "./bus-station";
const stone = "#d9d3c2",
  glass = "#54788b",
  brick = "#ac6854",
  white = "#eeeae0",
  roof = "#758b82",
  green = "#7da06a";
function arch(
  b: Builder,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  c = stone,
  point = false,
) {
  const outer = new THREE.Shape()
      .moveTo(-w / 2, 0)
      .lineTo(w / 2, 0)
      .lineTo(w / 2, h)
      .lineTo(-w / 2, h)
      .closePath(),
    hole = new THREE.Path(),
    t = w * 0.16,
    top = h * 0.68;
  hole.moveTo(-w / 2 + t, 0).lineTo(-w / 2 + t, top);
  if (point) hole.lineTo(0, h - t).lineTo(w / 2 - t, top);
  else hole.absarc(0, top, w / 2 - t, Math.PI, 0, true);
  hole.lineTo(w / 2 - t, 0).closePath();
  outer.holes.push(hole);
  return b.add(
    new THREE.ExtrudeGeometry(outer, {
      depth: d,
      bevelEnabled: false,
      curveSegments: 6,
    }),
    c,
    x,
    y,
    z - d / 2,
  );
}
function classic(b: Builder, w = 14, h = 5, d = 7) {
  b.box(0, h / 2, 0, w, h, d, stone)
    .roof(0, h, 0, w + 0.6, 1.4, d + 0.5, stone)
    .box(0, 0.2, d / 2 + 1, w + 1, 0.4, 3, stone);
  for (let x = -w / 2 + 1; x < w / 2; x += 2)
    b.cylinder(x, h * 0.48, d / 2 + 0.35, 0.24, h * 0.85, white, 8);
  b.windows(0, h * 0.55, 0, w - 1, h * 0.7, d, 7, 2, glass);
  return b;
}
function tower(b: Builder, w: number, h: number, d: number, c = glass) {
  b.box(0, h / 2, 0, w, h, d, c);
  for (let y = 1; y < h; y += 1.2)
    b.box(0, y, 0, w + 0.06, 0.09, d + 0.06, "#b4c2c8");
  for (let x = -w / 2 + 0.5; x < w / 2; x += 0.85)
    b.box(x, h / 2, d / 2 + 0.03, 0.07, h, 0.05, "#c8d0d1");
  return b;
}
function theater(b: Builder, name = "FOX", w = 10) {
  b.box(0, 3, 0, w, 6, 5, brick)
    .box(0, 6.2, 0, w + 0.7, 0.5, 5.5, stone)
    .box(0, 1, 2.7, 5, 2, 0.4, glass)
    .box(0, 2.5, 3.2, 7, 0.4, 2, "#ceb587")
    .box(-w / 2 + 1, 5.5, 3, 1.4, 5, 0.8, "#9b3f34");
  for (let i = 0; i < name.length; i++)
    b.text(-w / 2 + 1, 7.2 - i * 0.9, 3.43, name[i], 0.14, white);
  b.windows(0, 4.5, 0, w - 2, 2, 5, 5, 1);
  return b;
}
function park(b: Builder, w = 20, d = 15) {
  b.box(0, 0.13, 0, w, 0.25, d, green)
    .box(0, 0.3, 0, 1, 0.08, d, stone)
    .box(0, 0.3, 0, w, 0.08, 0.8, stone);
  for (let x = -w / 2 + 2; x < w / 2; x += 3)
    for (const z of [-d / 2 + 1, d / 2 - 1])
      b.cylinder(x, 1, z, 0.1, 2, "#73634b", 5).add(
        new THREE.SphereGeometry(1.1, 8, 5),
        "#62865c",
        x,
        2.4,
        z,
      );
  return b;
}
/** A parked airliner: white fuselage, swept wings and a coloured tail. */
function plane(b: Builder, x: number, z: number, ry: number, tail: string) {
  const p = new Builder();
  p.add(new THREE.CylinderGeometry(0.42, 0.42, 6.4, 10), "#f4f2ec", 0, 0.95, 0, Math.PI / 2);
  p.add(new THREE.SphereGeometry(0.42, 10, 6), "#f4f2ec", 0, 0.95, 3.2, 0, 0, 0);
  p.add(new THREE.ConeGeometry(0.42, 1.2, 10), "#f4f2ec", 0, 0.95, -3.8, -Math.PI / 2);
  p.box(0, 0.85, 0.3, 6.6, 0.1, 1.3, "#e6e3da");
  p.box(0, 1.0, -3.6, 2.6, 0.08, 0.8, "#e6e3da");
  p.box(0, 1.75, -3.7, 0.1, 1.5, 1.0, tail);
  p.box(0, 1.03, 2.1, 0.86, 0.12, 0.5, "#3c5664");
  for (const ex of [-1.8, 1.8]) p.add(new THREE.CylinderGeometry(0.22, 0.22, 0.8, 8), "#c9ccc8", ex, 0.6, 0.6, Math.PI / 2);
  for (const [gx, gz] of [[0, 2.4], [-1, 0], [1, 0]]) p.cylinder(gx, 0.25, gz, 0.07, 0.5, "#55606a", 6);
  const g = p.build();
  g.rotateY(ry);
  return b.add(g, "#ffffff", x, 0, z) && restoreColours(b, g);
}
/** Builder.add paints a flat colour; keep the per-part colours of a sub-build. */
function restoreColours(b: Builder, g: THREE.BufferGeometry) {
  const added = b.parts.at(-1)!;
  added.setAttribute("color", g.getAttribute("color").clone());
  return b;
}

export function terminalFront(
  b: Builder,
  { z, width, height }: { z: number; width: number; height: number },
) {
  const trim = "#d5cbb5",
    pane = "#6a9bb0",
    darkGlass = "#345966",
    canopyFront = Math.min(z + 3, 9.7),
    canopyBack = canopyFront - 3,
    canopyCenter = (canopyBack + canopyFront) / 2,
    curbZ = Math.min(canopyFront + 0.3, 9.65),
    bollardZ = Math.min(curbZ + 0.19, 9.84),
    taxiZ = Math.min(curbZ + 0.2, 9.84),
    taxiX = width / 2 + 1.2,
    glassHeight = height - 0.3;
  b.box(0, glassHeight / 2 + 0.15, z + 0.055, width, glassHeight, 0.08, pane);
  for (let x = -width / 2 + 1.2; x < width / 2; x += 1.2)
    b.box(x, height / 2, z + 0.12, 0.08, glassHeight, 0.1, trim);
  for (const y of [height * 0.38, height * 0.72])
    b.box(0, y, z + 0.12, width, 0.08, 0.1, trim);
  b.box(0, height - 0.13, z + 0.15, width + 0.3, 0.26, 0.24, trim);
  const doorHeight = Math.min(2.15, height - 0.55);
  for (const pair of [-0.29, 0, 0.29])
    for (const side of [-1, 1])
      b.box(
        pair * width + side * 0.4,
        doorHeight / 2 + 0.08,
        z + 0.18,
        0.72,
        doorHeight,
        0.07,
        darkGlass,
      );
  b.box(
    0,
    3.15,
    canopyCenter,
    width + 1.2,
    0.18,
    3,
    "#d9e3e1",
  ).box(
    0,
    3.2,
    canopyFront - 0.06,
    width + 1.2,
    0.6,
    0.12,
    "#435f62",
  );
  for (let x = -width / 2 + 0.6; x < width / 2; x += Math.max(4.2, width / 5))
    b.cylinder(x, 1.6, canopyFront - 0.08, 0.075, 3.2, "#9aa7a6", 6);
  b.box(0, 0.075, curbZ, width + 1.8, 0.15, 0.32, "#7d8784");
  for (let x = -width / 2 + 0.8; x < width / 2; x += 1.8)
    b.cylinder(x, 0.33, bollardZ, 0.08, 0.66, "#66736f", 6);
  for (const x of [-0.42, -0.35, 0.35, 0.42].map((offset) => offset * width)) {
    const planterZ = canopyFront - 0.45;
    b.box(x, 0.23, planterZ, 0.9, 0.46, 0.62, "#b49b79").sphere(
      x,
      0.78,
      planterZ,
      0.42,
      "#66845c",
      1.1,
      0.72,
      0.9,
    );
  }
  const bayX = taxiX - 3.8;
  for (const x of [bayX - 2.4, bayX + 2.4])
    b.box(x, 0.025, taxiZ - 0.02, 0.06, 0.03, 0.22, "#e2b937");
  b.box(bayX, 0.025, taxiZ + 0.09, 4.86, 0.03, 0.06, "#e2b937")
    .cylinder(taxiX, 0.9, taxiZ, 0.07, 1.8, "#435f62", 6)
    .box(taxiX, 1.8, taxiZ, 1.4, 0.7, 0.08, "#e2b937");
  return b;
}

function airport(b: Builder, curved = false) {
  const hall = "#ebe7dc",
    trim = "#d5cbb5",
    pane = "#6a9bb0";
  b.box(0, 0.06, -4, 37, 0.12, 31, "#a7aea9");
  b.box(0, 1.6, 1, 17, 3.2, 7, hall);
  terminalFront(b, { z: 4.53, width: 17, height: 3.2 });
  if (curved) {
    // Two vaulted shells, the classic winged terminal roof.
    for (const x of [-4.2, 4.2]) {
      const vault = new THREE.CylinderGeometry(3.4, 3.4, 7.6, 18, 1, true, -Math.PI / 2, Math.PI);
      vault.scale(1, 0.42, 1);
      b.add(vault, "#f6f2e8", x, 3.2, 1, Math.PI / 2, 0, Math.PI / 2);
    }
    b.box(0, 3.3, 1, 0.5, 0.4, 7.2, trim);
  } else {
    b.box(0, 3.5, 1, 18.4, 0.35, 8.4, "#f2eee4");
    for (let x = -8; x <= 8; x += 4) b.box(x, 3.75, 1, 2.2, 0.25, 6, "#cfd9d6");
  }
  // Piers with glazed sides and jet bridges.
  for (const x of [-10, 0, 10]) {
    b.box(x, 0.9, -8, 2.6, 1.8, 11, hall);
    for (const side of [-1, 1]) b.box(x + side * 1.31, 1.05, -8, 0.06, 0.8, 10.4, pane);
    b.box(x, 1.9, -8, 2.9, 0.16, 11.3, trim);
    for (const z of [-6, -11]) {
      for (const side of [-1, 1]) {
        b.box(x + side * 2.4, 1.15, z, 2.2, 0.6, 0.6, "#c9cec9");
        b.cylinder(x + side * 3.4, 0.55, z, 0.08, 1.1, "#7b8585", 6);
      }
    }
  }
  plane(b, -5, -6.3, Math.PI / 2, "#3f7fb3");
  plane(b, 5, -11.2, -Math.PI / 2, "#d4774f");
  plane(b, 15, -6.3, -Math.PI / 2, "#5aa587");
  plane(b, -15, -11.2, Math.PI / 2, "#c95f6f");
  b.box(0, 0.08, -19, 37, 0.15, 2.6, "#5b6670");
  for (let x = -16; x < 17; x += 3)
    b.box(x, 0.18, -19, 1, 0.04, 0.12, "#f4f2ea");
  b.cylinder(-15, 4, 3, 0.5, 8, "#d8d3c4", 10)
    .cylinder(-15, 8.3, 3, 1.4, 1.1, "#4f7b8f", 10, 1.6)
    .cylinder(-15, 8.95, 3, 1.75, 0.2, "#f0ece2", 10);
  return b;
}
function ballpark(b: Builder, w = 20) {
  b.box(0, 0.1, 0, w, 0.2, w, green);
  const a = -w * 0.4,
    z = w * 0.4;
  for (let i = 0; i < 20; i++) {
    const t = (i * Math.PI) / 2 / 20,
      t2 = ((i + 1) * Math.PI) / 2 / 20;
    b.triangle(
      [
        a,
        0.23,
        z,
        a + Math.cos(t) * w * 0.75,
        0.23,
        z - Math.sin(t) * w * 0.75,
        a + Math.cos(t2) * w * 0.75,
        0.23,
        z - Math.sin(t2) * w * 0.75,
      ],
      "#759e66",
      false,
    );
  }
  b.box(
    -w * 0.18,
    0.27,
    w * 0.18,
    w * 0.23,
    0.03,
    w * 0.23,
    "#c6a47c",
    Math.PI / 4,
  );
  for (const t of [0, 1, 2, 3]) {
    const s = (w * 0.25) / Math.sqrt(2);
    b.box(
      -w * 0.18 + Math.sin((t * Math.PI) / 2) * s,
      0.31,
      w * 0.18 + Math.cos((t * Math.PI) / 2) * s,
      0.3,
      0.03,
      0.3,
      white,
    );
  }
  for (let i = 0; i < 5; i++) {
    b.box(
      -w * 0.44,
      1 + i * 0.65,
      -w * 0.03,
      1,
      0.7 + i * 0.1,
      w * 0.85,
      "#405b69",
    ).box(
      w * 0.03,
      1 + i * 0.65,
      w * 0.44,
      w * 0.85,
      0.7 + i * 0.1,
      1,
      "#405b69",
    );
  }
  for (let x = -w * 0.45; x < w * 0.45; x += 1.2)
    arch(b, x, 0, w * 0.5, 1.1, 4, 0.5, stone);
  for (const x of [-w * 0.4, w * 0.4])
    b.cylinder(x, 4, -w * 0.35, 0.1, 8, "#6c7477", 5).box(
      x,
      8,
      -w * 0.35,
      2,
      0.5,
      0.4,
      white,
    );
  return b;
}
export function suspension(
  b: Builder,
  color: string,
  length = 44,
  height = 18,
  gothic = false,
) {
  b.box(0, 3.4, 0, 5, 0.5, length, "#62747b").box(
    0,
    3.75,
    0,
    0.9,
    0.2,
    length,
    "#c8b99d",
  );
  for (const z of [-length * 0.25, length * 0.25]) {
    if (gothic) {
      for (const x of [-1.3, 1.3])
        arch(b, x, 0, z, 2.5, height, 1.8, color, true);
      b.box(0, height + 0.4, z, 6, 0.8, 2.1, color);
    } else {
      for (const x of [-2.2, 2.2])
        b.box(x, height / 2, z, 0.8, height, 1.2, color);
      for (const y of [5, 9, 13, height - 1])
        b.box(0, y, z, 5, 0.6, 1.3, color);
    }
    b.box(0, 0.6, z, 7, 1.2, 3, "#bcc1b2");
  }
  const cable = (z: number) =>
    Math.abs(z) <= length * 0.25
      ? 7 + (height - 7) * (z / (length * 0.25)) ** 2
      : height -
        ((height - 3) * (Math.abs(z) - length * 0.25)) / (length * 0.25);
  for (const x of [-2.25, 2.25])
    for (let z = -length * 0.5; z < length * 0.5; z += 1) {
      b.line([x, cable(z), z], [x, cable(z + 1), z + 1], 0.075, color);
      if (Math.abs(z) < length * 0.49)
        b.line([x, 3.7, z], [x, cable(z), z], 0.035, color);
      if (gothic && Math.abs(z) < length * 0.22)
        b.line(
          [x, height, z < 0 ? -length * 0.25 : length * 0.25],
          [x, 3.7, z],
          0.035,
          color,
        );
    }
  return b;
}
export function nycGeometry(id: string) {
  if (id === "nycBus") return busStationGeometry("nyc");
  const b = new Builder();
  switch (id) {
    case "empire": {
      b.box(0, 2, 0, 11, 4, 8, stone);
      for (const [w, h, y] of [
        [8, 6, 7],
        [6.5, 16, 18],
        [4.8, 4, 28],
        [3.3, 3, 31.5],
      ]) {
        const first = b.parts.length;
        tower(b, w, h, 5, stone);
        const part = b.parts.splice(first);
        for (const g of part) {
          g.translate(0, y - h / 2, 0);
          b.parts.push(g);
        }
      }
      b.cylinder(0, 34, 0, 0.7, 3, "#b4bcb9", 12).cylinder(
        0,
        36,
        0,
        0.15,
        3,
        "#d4d8d5",
        6,
      );
      break;
    }
    case "oneWtc": {
      b.box(0, 2, 0, 8, 4, 8, "#afbbc0");
      const corners = [
          [-4, 4, -4],
          [4, 4, -4],
          [4, 4, 4],
          [-4, 4, 4],
        ],
        top = [
          [0, 34, -4],
          [4, 34, 0],
          [0, 34, 4],
          [-4, 34, 0],
        ];
      for (let i = 0; i < 4; i++) {
        const a = corners[i],
          c = corners[(i + 1) % 4],
          d = top[i],
          e = top[(i + 1) % 4];
        b.triangle([...a, ...c, ...d], i % 2 ? "#7699af" : "#a8c6d4").triangle(
          [...c, ...e, ...d],
          i % 2 ? "#a8c6d4" : "#7699af",
        );
      }
      b.box(0, 34.2, 0, 5.6, 0.4, 5.6, "#c0d0d5", Math.PI / 4).cylinder(
        0,
        37.5,
        0,
        0.15,
        7,
        "#c9d6d9",
        8,
      );
      for (const x of [-6, 6])
        b.box(x, 0.1, 6, 4, 0.2, 4, "#486572").box(
          x,
          0.21,
          6,
          3,
          0.04,
          3,
          "#264957",
        );
      break;
    }
    case "brooklynBridge":
      suspension(b, stone, 42, 15, true);
      break;
    case "liberty": {
      b.cylinder(0, 0.3, 0, 6, 0.6, green, 10);
      for (let i = 0; i < 10; i++) {
        const a = (i * Math.PI) / 5;
        b.box(Math.sin(a) * 4, 0.6, Math.cos(a) * 4, 3, 0.4, 2, stone, -a);
      }
      b.box(0, 2, 0, 5, 3, 5, stone)
        .box(0, 4, 0, 3.5, 1, 3.5, stone)
        .cylinder(0, 6, 0, 1.6, 3, stone, 4, 1.1)
        .cylinder(0, 11, 0, 1.3, 7, "#65a293", 16, 0.7)
        .sphere(0, 15.6, 0, 0.9, "#78b5a3", 0.8, 1.2, 0.8)
        .line([0.6, 14, 0], [2.2, 17.3, 0], 0.32, "#6da999")
        .line([2.2, 17.3, 0], [2, 19.3, 0], 0.22, "#6da999")
        .cylinder(2, 19.5, 0, 0.38, 0.5, "#8cb4a0", 8)
        .sphere(2, 20.2, 0, 0.5, "#e0ba66", 0.7, 1.3, 0.7)
        .line([-0.6, 13.5, 0], [-1.3, 12.5, 0.3], 0.35, "#6da999")
        .box(-1.25, 13.2, 0.6, 0.9, 1.5, 0.2, "#78b5a3", -0.15);
      for (let i = 0; i < 7; i++) {
        const a = (i / 6 - 0.5) * Math.PI;
        b.line(
          [Math.sin(a) * 0.65, 16 + Math.cos(a) * 0.5, 0.15],
          [Math.sin(a) * 1.5, 16 + Math.cos(a) * 1.5, 0.15],
          0.08,
          "#78b5a3",
        );
      }
      for (let i = 0; i < 10; i++) {
        const a = (i * Math.PI) / 5;
        b.line(
          [Math.sin(a) * 0.55, 14, Math.cos(a) * 0.55],
          [Math.sin(a) * 1.2, 8, Math.cos(a) * 1.2],
          0.06,
          "#477d70",
        );
      }
      break;
    }
    case "grandCentral":
      classic(b, 16, 5, 8);
      for (const x of [-4, 0, 4]) {
        b.box(x, 3, 4.1, 2.5, 4, 0.2, glass);
        arch(b, x, 1, 4.3, 3, 4, 0.4);
      }
      b.roof(0, 5, 0, 15, 1.8, 8, roof)
        .cylinder(0, 7, 4.1, 0.7, 0.3, "#ae965f", 16)
        .sphere(0, 7.8, 3.7, 0.4, stone);
      break;
    case "met":
      classic(b, 17, 5, 8);
      for (const x of [-5, 0, 5]) {
        b.box(x, 2.5, 4.1, 2.3, 3.3, 0.1, glass);
        arch(b, x, 1, 4.25, 3, 3.5, 0.5);
      }
      for (let i = 0; i < 5; i++)
        b.box(0, 0.1 + i * 0.12, 5.4 - i * 0.25, 18, 0.2, 3 - i * 0.4, stone);
      break;
    case "timesSquare": {
      // One Times Square's narrow wedge and stacked luminous screens.
      const shape = new THREE.Shape()
          .moveTo(-2.5, -4)
          .lineTo(2.5, -4)
          .lineTo(0.8, 4)
          .lineTo(-0.8, 4)
          .closePath(),
        g = new THREE.ExtrudeGeometry(shape, {
          depth: 17,
          bevelEnabled: false,
        });
      g.rotateX(-Math.PI / 2);
      b.add(g, "#a8b4b8")
        .box(0, 17.3, 0, 3, 0.6, 5, stone)
        .cylinder(0, 18.4, 1, 0.12, 1.6, white, 6)
        .sphere(0, 19.4, 1, 0.35, "#e4c784");
      for (const [y, h, c] of [
        [2, 2.6, "#e9bc52"],
        [5.4, 3.2, "#569fc0"],
        [9.1, 3.3, "#cd688b"],
        [12.6, 2.8, "#76b3ac"],
        [15.4, 1.8, "#e29a68"],
      ] as const) {
        b.box(0, y, 4.05, 1.9, h, 0.15, c);
        for (const x of [-1, 1])
          b.box(x * 1.5, y, 1.2, 0.12, h, 5.6, c, -x * 0.21);
        b.box(0, y, 4.16, 1.1, 0.12, 0.04, white);
      }
      for (const x of [-5, 5])
        b.box(x, 5.5, 0, 2.4, 11, 5, glass).windows(x, 6, 0, 2, 9, 5, 2, 6);
      b.box(0, 0.12, 6, 9, 0.24, 7, "#d8d3bf");
      for (const x of [-3, 3])
        for (const z of [4, 7, 9]) b.box(x, 0.5, z, 1.1, 0.7, 0.5, "#aa5550");
      break;
    }
    case "centralPark":
      park(b, 20, 30)
        .sphere(1, 0.35, -6, 1, "#497f88", 5, 0.08, 6)
        .sphere(-3, 0.35, 7, 1, "#497f88", 4, 0.08, 3);
      b.box(4, 0.35, 3, 7, 0.2, 1, stone);
      break;
    case "msg":
      b.cylinder(0, 2.5, 0, 4.8, 5, "#bdc6c7", 40);
      for (const y of [1, 2.5, 4]) b.cylinder(0, y, 0, 4.9, 0.2, glass, 40);
      b.cylinder(0, 5.1, 0, 5, 0.25, white, 40);
      for (let i = 0; i < 16; i++) {
        const a = (i * Math.PI) / 8;
        b.line(
          [0, 5.25, 0],
          [Math.sin(a) * 4.8, 5.25, Math.cos(a) * 4.8],
          0.04,
          "#a7b1ae",
        );
      }
      break;
    case "broadway":
      b.text(0, 5, 2.2, "THEATRE", 0.18, white);
      for (const [x, c] of [
        [-4, "#b27460"],
        [0, "#d2c3a0"],
        [4, "#99776c"],
      ] as const) {
        b.box(x, 3, 0, 3.8, 6, 4, c)
          .box(x, 6.3, 0, 4, 0.5, 4.3, stone)
          .box(x, 2, 2.8, 3.5, 0.4, 2, "#d5b46c")
          .windows(x, 4.3, 0, 3, 2, 4, 2, 2);
        for (let y = 1; y < 7; y += 0.6)
          b.box(x - 1.4, y, 2.3, 0.1, 0.1, 0.1, "#efd3a1");
      }
      break;
    case "apollo":
      theater(b, "APOLLO", 9);
      break;
    case "columbia":
      classic(b, 14, 5, 8)
        .cylinder(0, 5.7, 0, 3.2, 1.4, stone, 24)
        .dome(0, 6.4, 0, 3.3, roof, 0.6);
      break;
    case "highLine":
      for (let z = -9; z < 10; z += 2) {
        b.box(1, 2.6, z, 0.6, 0.2, 1, green).box(
          -1,
          2.65,
          z,
          0.12,
          0.25,
          0.7,
          "#8a7663",
        );
        b.line([-1.4, 2.4, z], [-1.4, 2.4, z + 2], 0.035, "#6c6257");
      }
      b.box(0, 2, 0, 3, 0.5, 20, "#5e6a65")
        .box(0, 2.35, 0, 2.3, 0.2, 20, green)
        .box(0, 2.5, 0, 0.9, 0.1, 20, stone);
      for (let z = -9; z < 10; z += 3)
        for (const x of [-1.1, 1.1]) b.box(x, 1, z, 0.15, 2, 0.2, "#52615e");
      break;
    case "wallStreet":
      for (const x of [-0.4, 0.4])
        for (const z of [4.7, 5.3])
          b.line([x, 0, z], [x, 0.6, z], 0.09, "#8b7961");
      b.sphere(0.65, 0.65, 5, 0.3, "#8b7961")
        .line([0.8, 0.8, 4.8], [1, 0.95, 4.6], 0.05, "#8b7961")
        .line([0.8, 0.8, 5.2], [1, 0.95, 5.4], 0.05, "#8b7961");
      classic(b, 11, 5, 6);
      for (const x of [-5, 5]) b.box(x, 8, -3, 3, 16, 4, "#b5bbbd");
      b.sphere(0, 0.6, 5, 0.6, "#8b7961", 1.3, 0.6, 0.7).line(
        [-0.5, 0.5, 5],
        [0.4, 0.8, 5],
        0.2,
        "#8b7961",
      );
      break;
    case "dumbo":
      for (const x of [-4, 4])
        b.box(x, 4, 0, 5, 8, 10, brick).windows(x, 4, 0, 4, 6, 10, 3, 4);
      arch(b, 0, 0, -7, 8, 13, 1, "#668295");
      b.box(0, 13, -7, 9, 0.6, 1.4, "#668295");
      for (const x of [-4, 4]) b.box(x, 7, -7, 0.8, 14, 1.4, "#668295");
      b.box(0, 0.1, 0, 3, 0.2, 12, "#b9b3a4");
      break;
    case "williamsburgVenue":
      theater(b, "MUSIC", 10);
      break;
    case "chinatown":
    case "sfChinatown": {
      for (const x of [-4, 4])
        b.box(x, 2.5, 0, 3, 5, 7, x < 0 ? "#bcaa7b" : brick).windows(
          x,
          3,
          0,
          3,
          3,
          7,
          3,
          3,
        );
      for (const x of [-2.5, 2.5])
        b.cylinder(x, 2.3, 4, 0.2, 4.6, "#9c4439", 8);
      b.roof(0, 4.6, 4, 7, 1.2, 2, "#52775a");
      for (let x = -2; x <= 2; x++) b.sphere(x, 3.8, 4.3, 0.25, "#be5346");
      break;
    }
    case "fifthAve":
      b.box(0, 0.12, 4.5, 12, 0.2, 3, stone);
      for (const x of [-5, 5])
        b.cylinder(x, 1.3, 5, 0.08, 2.6, "#7b705c", 5).add(
          new THREE.SphereGeometry(0.8, 8, 5),
          green,
          x,
          2.9,
          5,
        );
      b.box(0, 5, 0, 8, 10, 6, stone)
        .box(0, 10.5, 0, 6, 1, 4, stone)
        .windows(0, 6, 0, 7, 7, 6, 4, 4);
      for (let x = -3; x < 4; x += 2) b.box(x, 2, 3.4, 1.8, 0.2, 1, "#485958");
      break;
    case "cityHall": {
      classic(b, 14, 4, 7);
      for (const x of [-6, 6])
        b.box(x, 2.5, -1, 4, 5, 6, stone).windows(
          x,
          2.6,
          -1,
          3.4,
          3.5,
          6,
          3,
          2,
        );
      b.box(0, 5.2, -1, 3, 2.2, 3, stone).box(0, 6.6, -1, 2.5, 0.5, 2.5, white);
      for (const x of [-0.8, 0.8]) b.cylinder(x, 7.5, 0, 0.12, 1.5, white, 6);
      b.box(0, 7.5, -1, 2, 1.6, 2, stone)
        .add(new THREE.CircleGeometry(0.48, 12), white, 0, 7.5, 0.02)
        .line([0, 7.5, 0.04], [0, 7.85, 0.04], 0.04, "#394f50")
        .roof(0, 8.4, -1, 2.8, 1.1, 2.8, roof)
        .cylinder(0, 10, -1, 0.12, 1, white, 6);
      break;
    }
    case "yankee":
      ballpark(b, 20);
      for (let x = -9; x < 10; x += 0.7)
        b.box(x, 4.4, 10, 0.4, 0.7, 0.2, white);
      break;
    case "coney": {
      b.box(0, 0.05, 0, 25, 0.1, 12, "#d5c49f")
        .box(0, 0.15, 4, 26, 0.2, 3, "#b49a78")
        .torus(-6, 6, 0, 5, 0.2, "#d3c9a6");
      for (let i = 0; i < 12; i++) {
        const a = (i * Math.PI) / 6;
        b.line(
          [-6, 6, 0],
          [-6 + Math.sin(a) * 5, 6 + Math.cos(a) * 5, 0],
          0.05,
          white,
        ).box(
          -6 + Math.sin(a) * 5,
          6 + Math.cos(a) * 5,
          0,
          0.6,
          0.5,
          0.6,
          i % 2 ? "#ac6653" : "#668a9a",
        );
      }
      for (let x = 0; x < 12; x += 1) {
        const y = 3 + Math.sin(x * 0.7) * 2;
        b.line([x, 0, -1], [x, y, -1], 0.12, "#aa8866");
        if (x < 11)
          b.line(
            [x, y, -1],
            [x + 1, 3 + Math.sin((x + 1) * 0.7) * 2, -1],
            0.15,
            "#c9b698",
          );
      }
      break;
    }
    case "presbyterian":
      tower(b, 6, 16, 6, "#d6d7cb")
        .box(0, 2, 0, 11, 4, 10, stone)
        .box(0, 14, 3.1, 2, 0.4, 0.2, "#a9574c")
        .box(0, 14, 3.1, 0.4, 2, 0.2, "#a9574c");
      break;
    case "nycAirport":
      airport(b, true);
      break;
    default:
      throw Error("Missing New York model " + id);
  }
  return b.build();
}
export function bayGeometry(id: string) {
  if (id === "bayBus") return busStationGeometry("bay");
  const b = new Builder();
  switch (id) {
    case "goldenGate":
      suspension(b, "#bd563e", 52, 21);
      break;
    case "ferryBuilding":
      classic(b, 17, 3.5, 5);
      b.roof(0, 3.5, 0, 17, 1, 5, "#b17d64").box(0, 6, 0, 2.8, 5, 2.8, stone);
      for (const y of [4, 7, 9]) b.box(0, y, 0, 3.2, 0.3, 3.2, white);
      b.box(0, 9, 0, 2.6, 2, 2.6, stone).roof(0, 10.2, 0, 3, 1.8, 3, roof);
      for (const z of [-1.32, 1.32]) {
        b.add(
          new THREE.CircleGeometry(0.8, 24),
          white,
          0,
          9,
          z,
          0,
          z < 0 ? Math.PI : 0,
        )
          .line([0, 9, z * 1.01], [0, 9.5, z * 1.01], 0.04, "#394f50")
          .line([0, 9, z * 1.01], [0.4, 9, z * 1.01], 0.04, "#394f50");
      }
      break;
    case "salesforce": {
      const points = [];
      for (let i = 0; i <= 24; i++) {
        const y = (i / 24) * 34,
          r =
            y < 29
              ? 3.6 - y * 0.035
              : Math.sqrt(Math.max(0, 1 - ((y - 29) / 5) ** 2)) * 2.6;
        points.push(new THREE.Vector2(Math.max(0.08, r), y));
      }
      b.add(new THREE.LatheGeometry(points, 32), glass);
      for (let i = 0; i < 32; i++) {
        const a = (i * Math.PI) / 16;
        b.line(
          [Math.sin(a) * 3.55, 0.2, Math.cos(a) * 3.55],
          [Math.sin(a) * 2.65, 29, Math.cos(a) * 2.65],
          0.045,
          "#c1d1d4",
        );
      }
      for (let y = 1; y < 29; y += 1)
        b.cylinder(0, y, 0, 3.6 - y * 0.035, 0.06, "#9ab1bd", 32);
      b.box(5, 0.5, 0, 3, 1, 15, green);
      break;
    }
    case "paintedLadies": {
      const colors = [
        "#b7c7ca",
        "#dfb5ac",
        "#d8c79b",
        "#bbc3a5",
        "#bcb0c8",
        "#d2c1ad",
      ];
      for (let i = 0; i < 6; i++) {
        const x = (i - 2.5) * 2.8,
          y = i * 0.12;
        b.box(x, 2.1 + y, 0, 2.5, 4.2, 4, colors[i])
          .roof(x, 4.2 + y, 0, 2.7, 1.5, 4.3, "#797a70")
          .box(x, 2.4 + y, 2.3, 1.5, 2.8, 0.7, colors[i])
          .roof(x, 3.8 + y, 2.4, 1.7, 0.7, 1, white)
          .box(x, 0.4 + y, 2.6, 2.5, 0.3, 1, stone)
          .windows(x, 2.4 + y, 2.35, 1.2, 2.2, 0.75, 2, 2);
        for (const h of [1.3, 2.7, 4.1])
          b.box(x, h + y, 2.72, 2.5, 0.12, 0.12, white);
        for (const dx of [-1, 1])
          b.cylinder(x + dx, 0.9 + y, 2.7, 0.06, 1.2, white, 5);
      }
      break;
    }
    case "alcatraz":
      b.sphere(0, 0.2, 0, 1, "#b1b1a1", 10, 1, 7)
        .box(0, 3, 0, 13, 4, 6, "#c8bfa6")
        .windows(0, 3, 0, 12, 2.5, 6, 12, 3, "#5f6b66")
        .box(4, 2, 5, 5, 3, 3, "#c7b39b")
        .cylinder(-6, 5, 1, 0.65, 7, white, 12)
        .cylinder(-6, 8.7, 1, 0.9, 0.6, "#7a9698", 12)
        .dome(-6, 9, 1, 0.9, "#b7c3be", 0.5);
      for (const x of [6, 7.5])
        for (const z of [-4, -2.5])
          b.line([x, 1, z], [x, 6, z], 0.08, "#897e68");
      b.cylinder(6.75, 6.5, -3.25, 1.3, 1.3, "#a9a394", 16).box(
        0,
        0.5,
        7,
        9,
        0.3,
        2,
        "#8a8473",
      );
      break;
    case "sfCityHall":
      classic(b, 20, 6, 9)
        .cylinder(0, 7, 0, 3.3, 2, stone, 24)
        .cylinder(0, 9.5, 0, 2.8, 3, stone, 24)
        .dome(0, 11, 0, 2.9, "#8d9d9b", 1.2)
        .cylinder(0, 15, 0, 0.55, 1.5, "#c8ac69", 12)
        .sphere(0, 16, 0, 0.3, "#d0b66f");
      for (let i = 0; i < 16; i++) {
        const a = (i * Math.PI) / 8;
        b.cylinder(
          Math.sin(a) * 2.9,
          9.5,
          Math.cos(a) * 2.9,
          0.12,
          3,
          white,
          6,
        ).line(
          [Math.sin(a) * 2.8, 11, Math.cos(a) * 2.8],
          [0, 14.5, 0],
          0.04,
          "#c9b475",
        );
      }
      break;
    case "pier39":
      b.box(0, 0.6, 0, 8, 0.5, 17, "#ae9474");
      for (const x of [-2.5, 2.5])
        for (const z of [-5, 0, 5])
          b.box(x, 1.5, z, 2.8, 1.5, 3, "#c2a47d").roof(
            x,
            2.25,
            z,
            3.2,
            1,
            3.3,
            "#738d9a",
          );
      b.box(6, 0.3, 3, 3, 0.2, 6, "#998467");
      for (let i = 0; i < 8; i++)
        b.sphere(5.5 + (i % 2), 0.65, i * 0.6, 0.3, "#766d5b", 1, 0.6, 1.8);
      break;
    case "ggPark":
      park(b, 25, 13)
        .box(0, 1, 0, 10, 2, 3, white)
        .dome(0, 2, 0, 2, white)
        .cylinder(0, 3.9, 0, 0.3, 1, white, 8)
        .sphere(-7, 0.35, 1, 1, "#497f88", 3, 0.08, 3);
      for (let i = 0; i < 3; i++)
        b.box(8, 1 + i, 0, 2 - i * 0.3, 0.8, 2 - i * 0.3, brick).roof(
          8,
          1.5 + i,
          0,
          3 - i * 0.4,
          0.5,
          3 - i * 0.4,
          roof,
        );
      break;
    case "dolores":
      park(b, 17, 13).box(-4, 0.3, 0, 5, 0.1, 8, "#5e8b7c");
      for (const x of [-6, 6])
        for (let z = -5; z < 6; z += 2.5) {
          b.cylinder(x, 2, z, 0.1, 4, "#8b8063", 6);
          for (let i = 0; i < 5; i++) {
            const a = (i * Math.PI) / 2.5;
            b.line(
              [x, 4, z],
              [x + Math.sin(a) * 1.2, 4.3, z + Math.cos(a) * 1.2],
              0.12,
              "#68835c",
            );
          }
        }
      break;
    case "missionEats":
      for (let x = -5; x < 6; x += 2)
        b.box(
          x,
          1.4,
          2.7,
          1,
          0.8,
          0.06,
          ["#ae6c54", "#5f9f98", "#d8b65d"][Math.abs(x) % 3],
        );
      for (let i = 0; i < 4; i++) {
        const x = (i - 1.5) * 3;
        b.box(
          x,
          1.6,
          0,
          2.9,
          3.2,
          5,
          ["#be935f", "#63968e", "#bd7761", "#d4bd84"][i],
        )
          .box(x, 3.3, 0, 3.1, 0.3, 5.1, white)
          .box(x, 1.5, 2.6, 2, 0.9, 0.1, glass)
          .box(x, 2.3, 3, 2.8, 0.15, 1, "#a45c46");
      }
      break;
    case "chaseCenter": {
      b.box(0, 0.15, 6, 18, 0.3, 6, stone).box(0, 1.5, 5.6, 9, 2, 0.15, glass);
      const oval = (
        y: number,
        h: number,
        w: number,
        d: number,
        x: number,
        c: string,
      ) => {
        const g = new THREE.CylinderGeometry(1, 1, h, 40);
        g.scale(w, 1, d);
        b.add(g, c, x, y, 0);
      };
      oval(2.4, 4.4, 7.5, 5.7, 0, glass);
      for (const [y, w, d, x] of [
        [1.2, 8, 6, 0],
        [2.6, 8.2, 6.1, 0.15],
        [4.1, 8, 5.9, 0.4],
        [5.3, 7.6, 5.5, 0.7],
      ] as const)
        oval(y, 0.65, w, d, x, white);
      oval(5.8, 0.35, 7.3, 5.2, 0.7, "#bcc6c6");
      for (const x of [-5, 5]) b.box(x, 1, 6, 1.2, 1.8, 0.25, glass);
      break;
    }
    case "oraclePark":
      ballpark(b, 17);
      b.box(0, 2, 8.5, 17, 4, 0.8, brick);
      for (let x = -7.5; x < 8.5; x += 1.5)
        arch(b, x, 0, 9, 1.2, 3, 0.4, stone);
      break;
    case "sfChinatown":
      return nycGeometry("sfChinatown");
    case "fillmore":
      theater(b, "FILLMORE", 10);
      arch(b, 0, 2, 2.6, 4, 3.5, 0.4, stone);
      break;
    case "berkeleyCampus":
      classic(b, 15, 3.5, 7).box(0, 10, -1, 2.6, 13, 2.6, stone);
      for (const x of [-0.9, 0.9]) b.box(x, 17, -1, 0.4, 2, 1.8, stone);
      b.roof(0, 18, -1, 3, 1, 3, "#b98b67").box(
        0,
        14,
        -1,
        2.8,
        0.3,
        2.8,
        white,
      );
      break;
    case "lakeMerritt":
      park(b, 21, 18)
        .sphere(0, 0.4, 0, 1, "#568b91", 7, 0.08, 6)
        .sphere(3, 0.4, 2, 1, "#568b91", 4, 0.08, 5);
      for (let x = -5; x < 6; x += 1.5)
        b.cylinder(x, 1.4, 7, 0.15, 2.4, stone, 8);
      b.box(0, 2.7, 7, 12, 0.3, 0.7, stone);
      break;
    case "oaklandFox":
      theater(b, "FOX", 11);
      for (const x of [-4, 4])
        b.cylinder(x, 7, 0, 1, 2, stone, 12).dome(x, 8, 0, 1.2, "#8eaa9a", 0.8);
      arch(b, 0, 1, 2.8, 4, 4, 0.4, stone);
      break;
    case "stanford": {
      for (const x of [-7, 7])
        b.box(x, 2, 0, 3, 4, 13, "#c4ad85").roof(
          x,
          4,
          0,
          3.5,
          1,
          13.5,
          "#b36f52",
        );
      for (let x = -5; x < 6; x += 1.3)
        arch(b, x, 0, 5, 1.2, 3.5, 1, "#ceb68c");
      b.box(6, 8, -3, 3, 14, 3, "#c8b38c")
        .roof(6, 15, -3, 3.5, 1, 3.5, "#ac6a4e")
        .box(0, 2.5, -5, 6, 5, 3, "#d1b890")
        .roof(0, 5, -5, 6.4, 2, 3.4, "#a65e46");
      break;
    }
    case "sandHill":
      b.box(0, 0.18, 0, 2, 0.2, 12, "#9b9c8b")
        .box(0, 0.22, 2, 2, 0.1, 3, stone)
        .cylinder(0, 0.5, -3, 0.7, 0.6, "#6b8a68", 12);
      for (const x of [-4, 4])
        b.box(x, 1.2, 0, 6, 2.4, 6, "#c4b394")
          .roof(x, 2.4, 0, 6.5, 1.4, 6.5, "#947661")
          .windows(x, 1.2, 0, 5, 1.5, 6, 5, 1);
      for (const x of [-6, 6])
        b.cylinder(x, 3, -5, 0.15, 6, "#7f755b", 5).cylinder(
          x,
          5,
          -5,
          1.7,
          4,
          "#5f7c59",
          7,
          0,
        );
      break;
    case "techCampus": {
      const shape = new THREE.Shape(),
        hole = new THREE.Path();
      shape.absarc(0, 0, 12, 0, Math.PI * 2, false);
      hole.absarc(0, 0, 9, 0, Math.PI * 2, true);
      shape.holes.push(hole);
      const g = new THREE.ExtrudeGeometry(shape, {
        depth: 3,
        bevelEnabled: false,
        curveSegments: 48,
      });
      g.rotateX(-Math.PI / 2);
      b.add(g, "#a8b9bd", 0, 0.5, 0).cylinder(0, 0.2, 0, 8.8, 0.2, green, 48);
      for (const y of [1, 2, 3.4])
        b.torus(0, y, 0, 10.5, 0.08, white, Math.PI / 2);
      for (let i = 0; i < 24; i++) {
        const a = (i * Math.PI) / 12;
        b.box(
          Math.sin(a) * 10.5,
          3.6,
          Math.cos(a) * 10.5,
          1.5,
          0.15,
          1.8,
          "#547688",
          a,
        );
      }
      break;
    }
    case "ucsf":
      tower(b, 5, 11, 5, white);
      for (const x of [-4, 4])
        b.box(x, 3, 0, 4, 6, 8, stone).windows(x, 3, 0, 4, 4, 8, 4, 3);
      b.box(0, 9, 2.6, 2, 0.4, 0.2, "#a9574c").box(
        0,
        9,
        2.6,
        0.4,
        2,
        0.2,
        "#a9574c",
      );
      break;
    case "bayAirport":
      airport(b);
      b.sphere(0, 2.6, 0, 1, white, 8, 0.7, 4);
      break;
    default:
      throw Error("Missing Bay model " + id);
  }
  return b.build();
}
