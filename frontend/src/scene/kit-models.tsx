/* oxlint-disable react/immutability -- shared Three.js buffers and instance matrices are renderer resources. */
import { useLayoutEffect, useMemo, useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import type { Placement } from './fabric'

const noPick=()=>{}
/** Bake the glTF hierarchy once, keeping its atlas and normals, then instance each material batch. */
export function KitInstances({url,placements,shadow=true,night=false}:{url:string;placements:Placement[];shadow?:boolean;night?:boolean}){
 const {scene}=useGLTF(url)
 const {gl,invalidate}=useThree()
 useLayoutEffect(()=>{gl.shadowMap.needsUpdate=true;invalidate()},[scene,gl,invalidate])
 const batches=useMemo(()=>{
  scene.updateMatrixWorld(true)
  const bounds=new THREE.Box3().setFromObject(scene),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3())
  const normalize=new THREE.Matrix4().makeScale(1/(size.x||1),1/(size.y||1),1/(size.z||1)).multiply(new THREE.Matrix4().makeTranslation(-center.x,-bounds.min.y,-center.z))
  const groups=new Map<string,{parts:THREE.BufferGeometry[];material:THREE.MeshStandardMaterial}>()
  scene.traverse(o=>{if(!(o instanceof THREE.Mesh))return
   const source=(Array.isArray(o.material)?o.material[0]:o.material) as THREE.MeshStandardMaterial
   const g=o.geometry.clone();g.applyMatrix4(o.matrixWorld);g.applyMatrix4(normalize)
   for(const name of Object.keys(g.attributes))if(!['position','normal','uv','color'].includes(name))g.deleteAttribute(name)
   const group=groups.get(source.uuid)??{parts:[],material:source.clone()};group.parts.push(g);groups.set(source.uuid,group)
  })
  return [...groups.values()].map(({parts,material})=>{const geometry=mergeGeometries(parts);parts.forEach(p=>p.dispose());if(!geometry)throw Error(`Cannot merge kit ${url}`);material.roughness=.78;return{geometry,material}})
 },[scene,url])
 return <group name={`kit:${url}`}>{batches.map((batch,i)=><KitBatch key={i} {...batch} placements={placements} shadow={shadow} night={night}/>)}</group>
}
function KitBatch({geometry,material,placements,shadow,night}:{geometry:THREE.BufferGeometry;material:THREE.MeshStandardMaterial;placements:Placement[];shadow:boolean;night:boolean}){
 const ref=useRef<THREE.InstancedMesh>(null)
 useLayoutEffect(()=>{const m=ref.current!,d=new THREE.Object3D();placements.forEach((p,i)=>{d.position.set(p.x,p.y,p.z);d.rotation.set(0,p.angle,0);d.scale.set(p.sx,p.sy,p.sz);d.updateMatrix();m.setMatrixAt(i,d.matrix);m.setColorAt(i,new THREE.Color(p.color))});m.instanceMatrix.needsUpdate=true;if(m.instanceColor)m.instanceColor.needsUpdate=true;m.computeBoundingSphere();m.updateMatrix();m.matrixAutoUpdate=false},[placements])
 useLayoutEffect(()=>{material.emissive.set(night?'#243c50':'#000000');material.emissiveIntensity=night?.12:0},[material,night])
 return <instancedMesh ref={ref} args={[geometry,material,placements.length]} castShadow={shadow} receiveShadow raycast={noPick}/>
}

/** Authoring units are scene units. Exported hierarchy contains <=4 merged material meshes. */
export function BlenderLandmark({id,x,z,angle=0}:{id:string;x:number;z:number;angle?:number}){
 const {scene}=useGLTF(`/models/landmarks/${id}.glb`)
 const {gl,invalidate}=useThree()
 useLayoutEffect(()=>{gl.shadowMap.needsUpdate=true;invalidate()},[scene,gl,invalidate])
 const model=useMemo(()=>{const root=scene.clone(true);root.name=id;root.traverse(o=>{if(o instanceof THREE.Mesh){const water=/lake|jets/.test(o.name);o.castShadow=!water;o.receiveShadow=!water;o.raycast=noPick;o.updateMatrix();o.matrixAutoUpdate=false}});root.position.set(x,0,z);root.rotation.y=angle;root.updateMatrix();root.matrixAutoUpdate=false;return root},[scene,id,x,z,angle])
 return <primitive object={model}/>
}
