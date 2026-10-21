import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { bakeContact } from './baked-contact'

/** Build static architecture into one vertex-coloured mesh per landmark. */
export class Builder {
  parts: THREE.BufferGeometry[] = []
  add(geometry: THREE.BufferGeometry, color: string, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
    let g = geometry.index ? geometry.toNonIndexed() : geometry.clone()
    geometry.dispose()
    g.deleteAttribute('uv'); g.deleteAttribute('uv1'); g.deleteAttribute('tangent')
    g.rotateX(rx); g.rotateY(ry); g.rotateZ(rz); g.translate(x, y, z)
    if (!g.getAttribute('normal')) g.computeVertexNormals()
    const c = new THREE.Color(color), values = new Float32Array(g.getAttribute('position').count * 3)
    for (let i = 0; i < values.length; i += 3) { values[i] = c.r; values[i + 1] = c.g; values[i + 2] = c.b }
    g.setAttribute('color', new THREE.BufferAttribute(values, 3)); this.parts.push(g)
    return this
  }
  box(x: number, y: number, z: number, w: number, h: number, d: number, color: string, ry = 0) { return this.add(new THREE.BoxGeometry(w, h, d), color, x, y, z, 0, ry) }
  cylinder(x: number, y: number, z: number, radius: number, h: number, color: string, segments = 16, top = radius) { return this.add(new THREE.CylinderGeometry(top, radius, h, segments), color, x, y, z) }
  dome(x: number, y: number, z: number, r: number, color: string, sy = 1) { const g = new THREE.SphereGeometry(r, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2); g.scale(1, sy, 1); return this.add(g, color, x, y, z) }
  sphere(x: number, y: number, z: number, r: number, color: string, sx = 1, sy = 1, sz = 1) { const g = new THREE.SphereGeometry(r, 12, 8); g.scale(sx, sy, sz); return this.add(g, color, x, y, z) }
  roof(x: number, y: number, z: number, w: number, h: number, d: number, color: string) {
    const shape = new THREE.Shape().moveTo(-w / 2, 0).lineTo(w / 2, 0).lineTo(0, h).closePath()
    const g = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false, steps: 1 }); return this.add(g, color, x, y, z - d / 2)
  }
  torus(x: number, y: number, z: number, r: number, tube: number, color: string, rx = 0, arc = Math.PI * 2) { return this.add(new THREE.TorusGeometry(r, tube, 5, 24, arc), color, x, y, z, rx) }
  triangle(points: number[], color: string, flip=false) {if(flip)for(let i=0;i<points.length;i+=9)for(let j=0;j<3;j++){const a=points[i+3+j];points[i+3+j]=points[i+6+j];points[i+6+j]=a}const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(points, 3)); return this.add(g, color) }
  line(a: number[], b: number[], width: number, color: string) {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), delta = end.clone().sub(start)
    const g = new THREE.CylinderGeometry(width, width, delta.length(), 5); g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize())); return this.add(g, color, ...start.add(end).multiplyScalar(.5).toArray())
  }
  /** Lettering is rendered with WorldText SDF; keep authored sign boards without pixel glyphs. */
  text(_x:number,_y:number,_z:number,_text:string,_scale:number,_color:string){return this}
  windows(x: number, y: number, z: number, w: number, h: number, d: number, columns: number, rows: number, color = '#557984') {
    for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
      const px = x - w / 2 + (col + .5) * w / columns, py = y - h / 2 + (row + .5) * h / rows
      this.box(px, py, z + d / 2 + .012, w / columns * .65, h / rows * .62, .035, color)
      this.box(px, py, z - d / 2 - .012, w / columns * .65, h / rows * .62, .035, color)
    }
    return this
  }
  build({bakeAO=false}:{bakeAO?:boolean}={}) { if(bakeAO)bakeContact(this.parts);const geometry = mergeGeometries(this.parts); this.parts.forEach(g => g.dispose()); if (!geometry) throw Error('Empty geometry'); geometry.computeBoundingSphere(); geometry.userData.bakedContact=bakeAO;return geometry }
}
