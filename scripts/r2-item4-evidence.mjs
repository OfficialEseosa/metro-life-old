// Offline geometry regression and immutable supplied-asset inventory. No renderer.
import fs from 'node:fs'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import * as THREE from '../frontend/node_modules/three/build/three.module.js'
import {GLTFLoader} from '../frontend/node_modules/three/examples/jsm/loaders/GLTFLoader.js'
const output='evidence/round2';fs.mkdirSync(output,{recursive:true})
const models=[],manifests=[]
// Geometry/material scalar measurements need no atlas image. The nine supplied
// Blender models have none; the tree fixture has a separate palette texture.
async function load(source){const bytes=fs.readFileSync(source),loader=new GLTFLoader().register(()=>({name:'METRO_OFFLINE_GEOMETRY',loadTexture:()=>Promise.resolve(null)})),gltf=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');return {bytes,...gltf}}
for(const directory of ['skyline','landmarks-blender']){
 const source=`frontend/public/models/${directory}/manifest.json`,bytes=fs.readFileSync(source),mirror=`frontend/src/scene/atlanta-${directory==='skyline'?'skyline':'landmarks'}-manifest.json`
 assert(bytes.equals(fs.readFileSync(mirror)),`Stale mirror ${mirror}`)
 manifests.push({source,mirror,sha256:createHash('sha256').update(bytes).digest('hex'),mirrorMatches:true})
 const manifest=JSON.parse(bytes.toString())
 for(const item of manifest.towers??manifest.landmarks){
  const source=`frontend/public/models/${directory}/${item.file}`,{scene,bytes}=await load(source),box=new THREE.Box3().setFromObject(scene),meshes=[],batches=new Set();let triangles=0
  scene.traverse(o=>{if(!(o instanceof THREE.Mesh))return;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;meshes.push(o.name);const m=o.material;batches.add(o.name===item.glowMesh?item.glowMesh:JSON.stringify([m.roughness,m.metalness,m.color.getHex(),m.side]))})
  assert.equal(triangles,item.triangles,`${source}: manifest triangles`);if(item.glowMesh)assert(meshes.includes(item.glowMesh),`${source}: missing glow`)
  models.push({source,sha256:createHash('sha256').update(bytes).digest('hex'),triangles,mergedBeautyDraws:batches.size,meshes,size:box.getSize(new THREE.Vector3()).toArray(),min:box.min.toArray(),glowMesh:item.glowMesh})
 }
}
const inventory={capturedAt:new Date().toISOString(),method:'Production GLTFLoader; source SHA256; manifest counts/glows; matching non-glow materials merge. No supplied files modified.',manifests,totals:{triangles:models.reduce((s,m)=>s+m.triangles,0),mergedBeautyDraws:models.reduce((s,m)=>s+m.mergedBeautyDraws,0)},models}
fs.writeFileSync(`${output}/item4-models.json`,JSON.stringify(inventory,null,2)+'\n')
const {scene:high}=await load('frontend/public/models/landmarks/high.glb');high.position.set(-8,0,-44);high.updateMatrixWorld(true)
function check(scene,camera,target){
 const direction=target.clone().sub(camera),distance=direction.length(),raycaster=new THREE.Raycaster(camera,direction.normalize(),.01,distance-1.2),hits=[],boxNear=[]
 scene.traverse(mesh=>{if(!(mesh instanceof THREE.Mesh))return;mesh.geometry.computeBoundingBox();const worldBox=mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld),point=raycaster.ray.intersectBox(worldBox,new THREE.Vector3());if(worldBox.containsPoint(camera)||point&&point.distanceTo(camera)<=raycaster.far)boxNear.push(point?.distanceTo(camera)??0);THREE.Mesh.prototype.raycast.call(mesh,raycaster,hits)})
 return {camera:camera.toArray(),target:target.toArray(),far:raycaster.far,boxWouldFade:boxNear.length>0,surfaceConfirmed:hits.length>0,triangleHits:hits.length}
}
const emptyEntranceCases=[]
for(const angle of [0,.35,.61,1.2,-.35,-.61,-1.2])for(const height of [9,16,24]){
 const result=check(high,new THREE.Vector3(-8+Math.sin(angle)*32,height,-44+Math.cos(angle)*32),new THREE.Vector3(-8,1,-35.75))
 if(result.boxWouldFade&&!result.surfaceConfirmed)emptyEntranceCases.push(result)
}
assert(emptyEntranceCases.length>=6,'Expected actual High Museum courtyard/frontage false positives')
const foregroundMuseum=check(high,new THREE.Vector3(-8,4,-66),new THREE.Vector3(-8,1,-30));assert(foregroundMuseum.boxWouldFade&&foregroundMuseum.surfaceConfirmed,'A true foreground museum wall must still fade')
const behindMuseum=check(high,new THREE.Vector3(-8,10,-14),new THREE.Vector3(-8,1,-32));assert(!behindMuseum.surfaceConfirmed,'Building behind player must remain solid')
const {scene:tree}=await load('frontend/public/models/world/suburban/tree-large.glb'),treeBounds=new THREE.Box3().setFromObject(tree),treeSize=treeBounds.getSize(new THREE.Vector3()),treeCenter=treeBounds.getCenter(new THREE.Vector3())
tree.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry=o.geometry.clone();o.geometry.translate(-treeCenter.x,-treeBounds.min.y,-treeCenter.z)}});tree.scale.setScalar(8/treeSize.y);tree.position.set(0,0,5);tree.updateMatrixWorld(true)
const foregroundTree=check(tree,new THREE.Vector3(0,5,12),new THREE.Vector3(0,1,0));assert(foregroundTree.boxWouldFade&&foregroundTree.surfaceConfirmed,'Foreground tree must remain an occluder')
const report={capturedAt:new Date().toISOString(),result:'PASS',highMuseumFalsePositiveCount:emptyEntranceCases.length,emptyEntranceCases,foregroundMuseum,behindMuseum,foregroundTree,nativeTreeHeight:treeSize.y,worldTreeHeight:8,limit:'CPU actual-triangle confirmation applies to non-instanced landmarks. Instanced foliage keeps its existing shader local-box test; this fixture confirms a real foreground tree remains selected.'}
fs.writeFileSync(`${output}/item4-occlusion-geometry.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({models:inventory.totals,geometry:{result:report.result,falsePositivesPrevented:emptyEntranceCases.length}},null,2))
