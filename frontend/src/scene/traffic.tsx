/* oxlint-disable react/immutability -- Vehicle transforms belong to the Three instance batch. */
import { Suspense,useEffect,useMemo,useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import { useFrame,useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import type { CityId } from '../api/types'
import { streets } from '../street-network'

export function Traffic({city,night}:{city:CityId;night:boolean}){return <Suspense fallback={null}><StreetCars key={city} city={city} night={night}/></Suspense>}
function StreetCars({city,night}:{city:CityId;night:boolean}){
 const graph=streets[city],{scene}=useGLTF('/models/vehicles/sedan.glb'),{invalidate}=useThree(),meshes=useRef<(THREE.InstancedMesh|null)[]>([]),dummy=useMemo(()=>new THREE.Object3D(),[])
 const batches=useMemo(()=>{scene.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(scene),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3()),matrix=new THREE.Matrix4().makeTranslation(-center.x,-bounds.min.y,-center.z),groups=new Map<string,{parts:THREE.BufferGeometry[];material:THREE.MeshStandardMaterial}>();scene.traverse(o=>{if(!(o instanceof THREE.Mesh))return;const material=(Array.isArray(o.material)?o.material[0]:o.material) as THREE.MeshStandardMaterial,group=groups.get(material.uuid)??{parts:[],material:material.clone()},g=o.geometry.clone();g.applyMatrix4(o.matrixWorld);g.applyMatrix4(matrix);g.scale(2.7/Math.max(size.x,size.z),2.7/Math.max(size.x,size.z),2.7/Math.max(size.x,size.z));group.parts.push(g);groups.set(material.uuid,group)});return [...groups.values()].map(({parts,material})=>{const geometry=mergeGeometries(parts)!;parts.forEach(g=>g.dispose());return{geometry,material}})},[scene])
 const cars=useMemo(()=>{const candidates=graph.links.flatMap((links,i)=>links.length?[i]:[]);return Array.from({length:Math.min(8,candidates.length)},(_,i)=>{const from=candidates[Math.floor(i*candidates.length/8)],to=graph.links[from][0];return{from,to,previous:-1,t:i/11,yaw:0,turn:i}})},[graph])
 useEffect(()=>{const timer=setInterval(()=>{if(!document.hidden)invalidate()},1000/30);return()=>clearInterval(timer)},[invalidate])
 useEffect(()=>()=>batches.forEach(b=>{b.geometry.dispose();b.material.dispose()}),[batches])
 useEffect(()=>{for(const batch of batches){batch.material.emissive.set(night?'#152126':'#000000');batch.material.emissiveIntensity=night?.18:0}},[batches,night])
 useFrame((_,dt)=>{for(let i=0;i<cars.length;i++){const car=cars[i];let a=graph.nodes[car.from],b=graph.nodes[car.to],length=Math.hypot(b[0]-a[0],b[2]-a[2]);car.t+=Math.min(dt,.05)*2.8/Math.max(.1,length);if(car.t>=1){car.previous=car.from;car.from=car.to;const options=graph.links[car.from].filter(n=>n!==car.previous),choices=options.length?options:graph.links[car.from];car.to=choices[(++car.turn+i)%choices.length];car.t-=1;a=graph.nodes[car.from];b=graph.nodes[car.to];length=Math.hypot(b[0]-a[0],b[2]-a[2])}const dx=b[0]-a[0],dz=b[2]-a[2],target=Math.atan2(dx,dz),delta=Math.atan2(Math.sin(target-car.yaw),Math.cos(target-car.yaw));car.yaw+=delta*(1-Math.exp(-dt*12));dummy.position.set(a[0]+dx*car.t+Math.cos(target)*.55,a[1]+(b[1]-a[1])*car.t+.09,a[2]+dz*car.t-Math.sin(target)*.55);dummy.rotation.set(0,car.yaw,0);dummy.scale.setScalar(1);dummy.updateMatrix();for(const mesh of meshes.current)mesh?.setMatrixAt(i,dummy.matrix)}for(const mesh of meshes.current)if(mesh){mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere()}})
 return <group name="street-traffic">{batches.map((batch,i)=><instancedMesh key={i} name="driving-cars" ref={m=>{meshes.current[i]=m}} args={[batch.geometry,batch.material,cars.length]} castShadow receiveShadow raycast={()=>{}}/>)}</group>
}
