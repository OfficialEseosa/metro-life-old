// Offline source-asset measurement with the same Three glTF loader as the game.
import fs from 'node:fs'
import { createHash } from 'node:crypto'
import { Box3, Mesh, Vector3 } from '../frontend/node_modules/three/build/three.module.js'
import { GLTFLoader } from '../frontend/node_modules/three/examples/jsm/loaders/GLTFLoader.js'
const rows=[],manifests=[]
for(const directory of ['skyline','landmarks-blender']){
 const manifestPath=`frontend/public/models/${directory}/manifest.json`,mirrorPath=`frontend/src/scene/atlanta-${directory==='skyline'?'skyline':'landmarks'}-manifest.json`,manifestBytes=fs.readFileSync(manifestPath),mirrorBytes=fs.readFileSync(mirrorPath)
 if(!manifestBytes.equals(mirrorBytes))throw Error(`Stale source manifest mirror: ${mirrorPath}`)
 manifests.push({source:manifestPath,mirror:mirrorPath,sha256:createHash('sha256').update(manifestBytes).digest('hex'),mirrorMatches:true})
 const manifest=JSON.parse(manifestBytes.toString('utf8'))
 for(const asset of manifest.towers??manifest.landmarks){
  const source=`frontend/public/models/${directory}/${asset.file}`,bytes=fs.readFileSync(source)
  const {scene}=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')
  const box=new Box3().setFromObject(scene),meshes=[],batches=new Set();let triangles=0
  scene.traverse(object=>{
   if(!(object instanceof Mesh))return
   triangles+=(object.geometry.index?.count??object.geometry.attributes.position.count)/3;meshes.push(object.name)
   const m=object.material
   batches.add(object.name===asset.glowMesh?asset.glowMesh:JSON.stringify([m.roughness,m.metalness,m.color.getHex(),m.side]))
  })
  if(asset.glowMesh&&!meshes.includes(asset.glowMesh))throw Error(`Missing named glow in ${source}`)
  if(triangles!==asset.triangles)throw Error(`Manifest triangle mismatch in ${source}`)
  rows.push({source,sha256:createHash('sha256').update(bytes).digest('hex'),triangles,meshes,mergedBeautyDraws:batches.size,size:box.getSize(new Vector3()).toArray(),min:box.min.toArray(),glowMesh:asset.glowMesh})
 }
}
const report={capturedAt:new Date().toISOString(),method:'Three GLTFLoader; hierarchy bounds; indexed triangles; equal non-glow material batches merged at runtime. Beauty calls exclude shadow/effect passes; full scene measured separately in browser.',manifests,totals:{triangles:rows.reduce((s,r)=>s+r.triangles,0),mergedBeautyDraws:rows.reduce((s,r)=>s+r.mergedBeautyDraws,0)},models:rows}
fs.mkdirSync('evidence/round1',{recursive:true});fs.writeFileSync('evidence/round1/item3-model-metrics.json',JSON.stringify(report,null,2)+'\n')
console.log(JSON.stringify(report,null,2))
