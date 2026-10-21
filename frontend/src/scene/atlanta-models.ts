import skyline from './atlanta-skyline-manifest.json'
import landmarks from './atlanta-landmarks-manifest.json'

// Section 1.7's 0.30 core projection, reduced uniformly by 0.1 for this
// existing diorama. Five Points is anchored at (0, 31); north remains -Z.
export const ATLANTA_MAP_REDUCTION = .1
// Skyscrapers keep the compact map footprint and rise above the surrounding city.
export const ATLANTA_TOWER_HEIGHT_SCALE = .18
export function projectAtlanta(east: number, north: number) {
  const distance = Math.hypot(east, north)
  const radius = distance <= 4500 ? .30 * distance : 1350 + .08 * (distance - 4500)
  const factor = distance ? radius / distance * ATLANTA_MAP_REDUCTION : 0
  return { x: east * factor, z: 31 - north * factor }
}

// Bounds measured from the supplied glTF hierarchy, including podiums.
const towerBounds: Record<string, {size:[number,number,number];min:[number,number,number]}> = {
  'atl-bofa-plaza.glb': {size:[70,312,70],min:[-35,0,-35]},
  'atl-truist-plaza.glb': {size:[90,275,71],min:[-45,0,-35]},
  'atl-westin-peachtree.glb': {size:[76,269,72],min:[-38,0,-48]},
  'atl-191-peachtree.glb': {size:[66,256.3999938964844,124],min:[-33,0,-62]},
  'atl-one-atlantic-center.glb': {size:[64,256,64],min:[-32,0,-32]},
}
export const ATLANTA_TOWERS = skyline.towers.map(tower => {
  const bounds = towerBounds[tower.file]
  const position = projectAtlanta(tower.realOffset.x, tower.realOffset.n)
  return {
    ...tower, ...position,
    id: tower.file.replace('.glb', ''),
    url: `/models/skyline/${tower.file}`,
    angle: tower.file === 'atl-bofa-plaza.glb' ? Math.PI / 4 : 0,
    footprintScale: .40 * ATLANTA_MAP_REDUCTION,
    // Correct tiny authored-height discrepancies against the manifest's real tip.
    heightScale: tower.realHeightToTip * ATLANTA_TOWER_HEIGHT_SCALE / bounds.size[1],
    width: bounds.size[0] * .40 * ATLANTA_MAP_REDUCTION,
    depth: bounds.size[2] * .40 * ATLANTA_MAP_REDUCTION,
    // Podiums/elevators can be asymmetric about the authored tower origin.
    // Reserve measured bounds while retaining the real-position origin.
    footprintX: position.x + (bounds.min[0]+bounds.size[0]/2) * .40 * ATLANTA_MAP_REDUCTION,
    footprintZ: position.z + (bounds.min[2]+bounds.size[2]/2) * .40 * ATLANTA_MAP_REDUCTION,
    height: tower.realHeightToTip * ATLANTA_TOWER_HEIGHT_SCALE,
  }
})
export const ATLANTA_BLENDER_LANDMARKS = Object.fromEntries(landmarks.landmarks.map(landmark => [landmark.replaces, {
  ...landmark, url: `/models/landmarks-blender/${landmark.file}`,
  nightColour: landmark.replaces === 'benz' ? '#90c9ff' : landmark.replaces === 'arena' ? '#ff8070' : '#ffd59a',
}]))

/** Reserve the actual tower footprints before scattering buildings/trees/roads. */
export function outsideAtlantaTowers(x: number, z: number, pad = 0) {
  return ATLANTA_TOWERS.every(tower => {
    const dx = x - tower.footprintX, dz = z - tower.footprintZ, c = Math.cos(tower.angle), s = Math.sin(tower.angle)
    return Math.abs(dx * c - dz * s) > tower.width / 2 + pad || Math.abs(dx * s + dz * c) > tower.depth / 2 + pad
  })
}
