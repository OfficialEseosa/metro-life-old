/* oxlint-disable react/immutability -- Static room staff matrices are owned instance buffers. */
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import type { RoomLayout } from '../navigation'
/** A single batch of on-duty staff at authored positions behind each service counter. */
export function RoomStaff({staff}:{staff:NonNullable<RoomLayout['staff']>}){
 const {scene}=useGLTF('/models/landmarks/resident-lod.glb'),ref=useRef<THREE.InstancedMesh>(null)
 const geometry=useMemo(()=>{let source:THREE.Mesh|undefined;scene.traverse(o=>{if(o instanceof THREE.Mesh)source=o});if(!source)throw Error('Staff model missing');scene.updateMatrixWorld(true);const g=source.geometry.clone();g.applyMatrix4(source.matrixWorld);g.computeBoundingBox();const bounds=g.boundingBox!,center=bounds.getCenter(new THREE.Vector3()),height=bounds.max.y-bounds.min.y;g.translate(-center.x,-bounds.min.y,-center.z);g.scale(1.78/height,1.78/height,1.78/height);return g},[scene])
 useLayoutEffect(()=>{if(!ref.current)return;const dummy=new THREE.Object3D();staff.forEach((person,i)=>{dummy.position.set(person.x,0,person.z);dummy.rotation.y=person.face;dummy.updateMatrix();ref.current!.setMatrixAt(i,dummy.matrix);ref.current!.setColorAt(i,new THREE.Color(person.id==='nurse'?'#bedce0':'#d2ba98'))});ref.current.instanceMatrix.needsUpdate=true;ref.current.computeBoundingSphere()},[staff])
 useEffect(()=>()=>geometry.dispose(),[geometry])
 return staff.length?<instancedMesh name="venue-staff-behind-counters" ref={ref} args={[geometry,undefined,staff.length]} castShadow userData={{roles:staff.map(s=>s.name)}}><meshStandardMaterial vertexColors roughness={.9}/></instancedMesh>:null
}
