import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
// Offline authoring helper. Not imported by the application or production build.
export async function bakeResident(){
 const gltf=await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync('/models/chars/f_casual.glb')
 gltf.scene.updateMatrixWorld(true)
 const vertices:number[][]=[],faces:number[][]=[],colors:number[][]=[]
 gltf.scene.traverse(o=>{if(!(o instanceof THREE.Mesh))return
  if(o instanceof THREE.SkinnedMesh)o.skeleton.update()
  const geometry:THREE.BufferGeometry=o.geometry,position=geometry.getAttribute('position'),offset=vertices.length
  for(let i=0;i<position.count;i++){const v=new THREE.Vector3().fromBufferAttribute(position,i);if(o instanceof THREE.SkinnedMesh)o.applyBoneTransform(i,v);v.applyMatrix4(o.matrixWorld);vertices.push([v.x,-v.z,v.y])}
  const index=geometry.index,count=index?.count??position.count
  for(let i=0;i<count;i+=3){const group=geometry.groups.find(g=>i>=g.start&&i<g.start+g.count),material=(Array.isArray(o.material)?o.material[group?.materialIndex??0]:o.material) as THREE.MeshStandardMaterial;faces.push([0,1,2].map(k=>offset+(index?index.getX(i+k):i+k)));const color=material.color;colors.push([color.r,color.g,color.b,1])}
 })
 return{vertices,faces,colors}
}
