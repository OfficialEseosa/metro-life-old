import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Builder } from './geometry'
import { atlSites } from './cities/atl'

const noPick = () => {}
type Placement = { x: number; y: number; z: number; sx: number; sy: number; sz: number; angle: number; color: string }

function Instances({ geometry, placements, emissive = false, night }: { geometry: THREE.BufferGeometry; placements: Placement[]; emissive?: boolean; night: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const mesh = ref.current!, dummy = new THREE.Object3D()
    placements.forEach((p, i) => {
      dummy.position.set(p.x, p.y, p.z); dummy.scale.set(p.sx, p.sy, p.sz); dummy.rotation.set(0, p.angle, 0); dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix); mesh.setColorAt(i, new THREE.Color(p.color))
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.computeBoundingSphere(); mesh.updateMatrix(); mesh.matrixAutoUpdate = false
  }, [placements])
  return <instancedMesh ref={ref} args={[geometry, undefined, placements.length]} castShadow={!emissive} receiveShadow={!emissive} raycast={noPick}>
    <meshStandardMaterial vertexColors roughness={.85} emissive={emissive ? '#ffe0a0' : '#000000'} emissiveIntensity={night && emissive ? 1.4 : 0} />
  </instancedMesh>
}

function fabricData() {
  let seed = 421
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 }
  const homes: Placement[] = [], blocks: Placement[] = [], towers: Placement[] = [], trees: Placement[] = [], lamps: Placement[] = [], cars: Placement[] = []
  const windows = new Builder(), streets = new Builder(), signature = new Builder(), glows=new Builder()
  const p = (x: number, y: number, z: number, sx = 1, sy = 1, sz = 1, color = '#ffffff', angle = 0) => ({ x, y, z, sx, sy, sz, color, angle })
  const clear = (x: number, z: number, margin = 3) => Object.values(atlSites).every(site => Math.hypot((site.x - x), (site.z - z)) > site.size / 2 + margin)
  // Peachtree spine, cross streets and the curving Downtown Connector are explicit geography.
  for (let x = -60; x <= 60; x += 20) streets.box(x, .025, 0, 2.6, .05, 142, '#a4aaa0').box(x, .055, 0, 1.9, .03, 142, '#737e79')
  for (let z = -70; z <= 70; z += 20) streets.box(0, .025, z, 134, .05, 2.6, '#a4aaa0').box(0, .055, z, 134, .03, 1.9, '#737e79')
  streets.box(0, .06, -12, 4, .05, 127, '#737a73')
  const highway = (z: number) => -13 + Math.sin(z / 27) * 5
  for(let z=-73;z<69;z+=2.5){const x=highway(z);streets.box(x,.13,z,5.2,.12,2.8,'#68756e',-.18*Math.cos(z/27)).box(x,.21,z,.15,.04,1.4,'#b6b39b')}
  const loop=new THREE.CatmullRomCurve3([[35,-60],[48,-40],[52,-10],[50,15],[38,34],[18,45],[-12,48],[-35,36],[-45,6],[-40,-25],[-20,-45],[5,-52]].map(([x,z])=>new THREE.Vector3(x,.2,z)),true)
  const trail=loop.getPoints(100);for(let i=1;i<trail.length;i++){const a=trail[i-1],b=trail[i],m=a.clone().add(b).multiplyScalar(.5),length=a.distanceTo(b);streets.box(m.x,.12,m.z,2.8,.08,length+.15,'#7f9b69',Math.atan2(b.x-a.x,b.z-a.z)).box(m.x,.19,m.z,1.3,.04,length+.12,'#dbcfb5',Math.atan2(b.x-a.x,b.z-a.z))}
  for (let z = -64; z <= 64; z += 9) for (let x = -63; x <= 63; x += 9) {
    const px = x + (rand() - .5) * 2, pz = z + (rand() - .5) * 2
    if (!clear(px, pz) || Math.abs(px - highway(pz)) < 5 || Math.abs(px) < 5 || Math.abs(px % 20) < 3 || Math.abs(pz % 20) < 3) continue
    const center = Math.abs(px) < 20 && pz > -45 && pz < 40,buckhead=pz<-48&&px>-5&&px<35,oldFourth=px>22&&px<45&&pz>-25&&pz<35,westEnd=px<-25&&pz>10,decatur=px>45&&pz<-25
    const kind = (center&&rand()>.3||buckhead&&rand()>.45) ? towers : oldFourth||decatur||rand()>.7&&!westEnd ? blocks : homes
    const height = kind === towers ? (buckhead?9:8) + rand() * (buckhead?8:16) : kind === blocks ? (oldFourth?2.5:3) + rand() * 3 : 1.3 + rand() * 1.2
    const w = 2.3 + rand() * 2.5, d = 2.2 + rand() * 2
    const colors = kind === towers ? ['#afc4d1', '#8ca8be', '#e5e2d9', '#acc3c6'] : oldFourth ? ['#bb775f','#9f604c','#caa88c'] : westEnd ? ['#ab7056','#b5947b','#d5c9ad'] : decatur ? ['#e7dfca','#d4d8ce','#bdc8c5'] : ['#e1d4bb', '#d0cbbf', '#c99b7e', '#bdd0b7', '#e1d8c7']
    kind.push(p(px, 0, pz, w, height, d, colors[Math.floor(rand() * colors.length)]))
    for (let y = .7; y < height; y += 1.4) for (let xx = -w / 2 + .6; xx < w / 2; xx += 1) if(rand()>.4)windows.box(px + xx, y, pz + d / 2 + .025, .4, .55, .05, '#acbfc0')
  }
  // Three different Atlanta skyline silhouettes: stepped golden crown, cylindrical hotel, terraced office.
  signature.box(-7,12,-30,4.5,24,4.5,'#b7b2a3').box(-7,25,-30,3.5,2,3.5,'#c8b99a').roof(-7,26,-30,3.4,4,3.4,'#d5bd83').cylinder(-7,31,-30,.08,2,'#c8bd9a',5)
  signature.cylinder(-5,10.5,13,2.2,21,'#849aa8',24).cylinder(-5,21.3,13,2.3,.6,'#dce2db',24)
  for(let t=0;t<4;t++)signature.box(11,3+t*5,-6,6-t*.8,6,5-t*.6,'#b6bdc0')
  for (let i = 0; i < 420; i++) {
    const angle=rand()*Math.PI*2,radius=Math.sqrt(rand()),x=Math.cos(angle)*110*radius,z=Math.sin(angle)*115*radius
    if ((!clear(x, z, 0) && Math.hypot(x - 20, z + 35) > 13) || Math.abs(x - highway(z)) < 4 || Math.abs(x) < 3) continue
    // Keep the water, stone bridge and boathouse free of intersecting trees.
    if (Math.pow((x-22)/9,2)+Math.pow((z+36)/6.5,2)<1 || Math.hypot(x-25,z+30)<4 || Math.hypot(x-15,z+36)<3) continue
    const scale = .7 + rand() * .9
    trees.push(p(x, 0, z, scale, scale * (.8 + rand() * .5), scale, ['#77965c', '#5e845b', '#8c9e65', '#6c8f62'][Math.floor(rand() * 4)]))
  }
  for (let z = -65; z <= 60; z += 8) {lamps.push(p(2.7, 0, z));lamps.push(p(-2.7, 0, z));for(const x of[-2.7,2.7]){glows.sphere(x+.5,2.2,z,.15,'#ffe5b6').sphere(x+.5,.12,z,1,'#ac8f65',1,.02,1)}cars.push(p(rand() > .5 ? -.9 : .9, .15, z + rand() * 5, 1, 1, 1, ['#e0c384', '#cddbd4', '#ae775d', '#6c9199'][Math.floor(rand() * 4)]))}
  return { homes, blocks, towers, trees, lamps, cars, streets: streets.build(), windows: windows.build(),signature:signature.build(),glows:glows.build() }
}

export function Fabric({ night }: { night: boolean }) {
  const data = useMemo(() => fabricData(), [])
  const geometry = useMemo(() => {
    const home = new Builder().box(0, .5, 0, 1, 1, 1, '#f4eee1').roof(0, 1, 0, 1.2, .45, 1.2, '#87786a').box(0, .4, .55, .7, .08, .25, '#e9e1c9').build()
    const block = new Builder().box(0, .5, 0, 1, 1, 1, '#e6e1d1').box(0, 1.04, 0, 1.08, .08, 1.08, '#a4b0a4').box(.25, 1.12, -.2, .3, .15, .3, '#c0c4b7').build()
    const tower = new Builder().box(0, .47, 0, 1, .94, 1, '#f2f1ec').box(0, .97, 0, 1.04, .06, 1.04, '#cbd5db').box(.25,1.03,-.2,.35,.06,.3,'#879aa5').build()
    const crown=new THREE.SphereGeometry(1.1,8,6);crown.scale(1,1.15,1)
    const tree = new Builder().cylinder(0, .85, 0, .12, 1.7, '#6f654b', 5).add(crown,'#ffffff',0,2,0).add(new THREE.SphereGeometry(.65,8,6),'#e4ead5',.5,1.7,.3).build()
    const lamp = new Builder().cylinder(0, 1.1, 0, .045, 2.2, '#525e54', 5).box(.25, 2.2, 0, .55, .07, .08, '#657363').sphere(.5, 2.2, 0, .1, '#edd5a0').build()
    const car = new Builder().box(0, .24, 0, .65, .35, 1.25, '#ffffff').box(0, .55, -.06, .5, .25, .65, '#657e7f').build()
    return { home, block, tower, tree, lamp, car }
  }, [])
  return <group>
    <mesh geometry={data.signature} matrixAutoUpdate={false} castShadow receiveShadow raycast={noPick}><meshStandardMaterial vertexColors roughness={.6}/></mesh>
    {night&&<mesh geometry={data.glows} matrixAutoUpdate={false} raycast={noPick}><meshBasicMaterial vertexColors/></mesh>}
    <mesh geometry={data.streets} matrixAutoUpdate={false} receiveShadow raycast={noPick}><meshStandardMaterial vertexColors roughness={1} /></mesh>
    <mesh geometry={data.windows} matrixAutoUpdate={false} raycast={noPick}><meshStandardMaterial vertexColors emissive="#e5bc77" emissiveIntensity={night ? 1.5 : 0} roughness={.5} /></mesh>
    <Instances geometry={geometry.home} placements={data.homes} night={night} />
    <Instances geometry={geometry.block} placements={data.blocks} night={night} />
    <Instances geometry={geometry.tower} placements={data.towers} night={night} />
    <Instances geometry={geometry.tree} placements={data.trees} night={night} />
    <Instances geometry={geometry.lamp} placements={data.lamps} night={night} />
    <Instances geometry={geometry.car} placements={data.cars} night={night} />
  </group>
}
