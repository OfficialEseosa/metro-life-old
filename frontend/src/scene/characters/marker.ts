/**
 * The player's own marker: a soft glowing ring at the feet and a small floating chevron above
 * the head, in the brand greens. Deliberately not a diamond.
 */
import * as THREE from "three";

let ringTexture: THREE.CanvasTexture | undefined;
let chevronTexture: THREE.CanvasTexture | undefined;
function ring() {
  if (!ringTexture) {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const x = c.getContext("2d")!,
      g = x.createRadialGradient(64, 64, 36, 64, 64, 63);
    g.addColorStop(0, "rgba(110,209,154,0)");
    g.addColorStop(0.42, "rgba(110,209,154,.95)");
    g.addColorStop(0.62, "rgba(110,209,154,.55)");
    g.addColorStop(1, "rgba(110,209,154,0)");
    x.fillStyle = g;
    x.fillRect(0, 0, 128, 128);
    ringTexture = new THREE.CanvasTexture(c);
    ringTexture.colorSpace = THREE.SRGBColorSpace;
  }
  return ringTexture;
}
function chevron() {
  if (!chevronTexture) {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const x = c.getContext("2d")!;
    x.lineJoin = "round";
    x.lineCap = "round";
    const path = () => {
      x.beginPath();
      x.moveTo(30, 44);
      x.lineTo(64, 84);
      x.lineTo(98, 44);
    };
    x.strokeStyle = "#fff7ea";
    x.lineWidth = 36;
    path();
    x.stroke();
    x.strokeStyle = "#216546";
    x.lineWidth = 22;
    path();
    x.stroke();
    chevronTexture = new THREE.CanvasTexture(c);
    chevronTexture.colorSpace = THREE.SRGBColorSpace;
  }
  return chevronTexture;
}

export class SelectionMarker {
  readonly group = new THREE.Group();
  private ring: THREE.Mesh;
  private chevron: THREE.Sprite;
  constructor() {
    this.group.name = "player-marker";
    this.ring = new THREE.Mesh(
      new THREE.PlaneGeometry(1.15, 1.15).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({
        map: ring(),
        transparent: true,
        depthWrite: false,
        opacity: 0.85,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        toneMapped: false,
      }),
    );
    this.ring.position.y = 0.02;
    this.ring.renderOrder = 2;
    this.ring.raycast = () => {};
    this.chevron = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: chevron(),
        transparent: true,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    this.chevron.scale.setScalar(0.32);
    this.chevron.renderOrder = 10;
    this.chevron.raycast = () => {};
    this.group.add(this.ring, this.chevron);
  }
  /** headY: height of the head top in the character's local frame. */
  update(time: number, headY: number, visible = true) {
    this.group.visible = visible;
    const pulse = 1 + Math.sin(time * ((Math.PI * 2) / 1.6)) * 0.03;
    this.ring.scale.set(pulse, 1, pulse);
    this.chevron.position.y = headY + 0.42 + Math.sin(time * Math.PI * 1.6) * 0.06;
  }
  dispose() {
    this.ring.geometry.dispose();
    (this.ring.material as THREE.Material).dispose();
    this.chevron.material.dispose();
  }
}
