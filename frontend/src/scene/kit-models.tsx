import { bakeBuildingContact } from './baked-contact'
import { CarLights } from './car-lights'
import { windowMask } from './window-mask'
import { NightPools } from './night-pools'
/* oxlint-disable react/immutability -- shared Three.js buffers and instance matrices are renderer resources. */
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import type { Placement } from './fabric'

export type DriveRoute={x:number;z:number;ex:number;ez:number;y:number;ey:number}
const noPick=()=>{}
/** Bake the glTF hierarchy once, keeping its atlas and normals, then instance each material batch. */
export function KitInstances({url,placements,shadow=true,night=false,drive}:{url:string;placements:Placement[];shadow?:boolean;night?:boolean;drive?:DriveRoute[]}){
 const {scene}=useGLTF(url)
 const {gl,invalidate}=useThree()
 useLayoutEffect(()=>{gl.shadowMap.needsUpdate=true;invalidate()},[scene,gl,invalidate])
 const batches=useMemo(()=>{
  scene.updateMatrixWorld(true)
  const bounds=new THREE.Box3().setFromObject(scene),center=bounds.getCenter(new THREE.Vector3())
  const normalize=new THREE.Matrix4().makeTranslation(-center.x,-bounds.min.y,-center.z)
  const groups=new Map<string,{parts:THREE.BufferGeometry[];material:THREE.MeshStandardMaterial}>()
  scene.traverse(o=>{if(!(o instanceof THREE.Mesh))return
   const source=(Array.isArray(o.material)?o.material[0]:o.material) as THREE.MeshStandardMaterial
   const g=o.geometry.clone();g.applyMatrix4(o.matrixWorld);g.applyMatrix4(normalize)
   for(const name of Object.keys(g.attributes))if(!['position','normal','uv','color'].includes(name))g.deleteAttribute(name)
   const group=groups.get(source.uuid)??{parts:[],material:source.clone()};group.parts.push(g);groups.set(source.uuid,group)
  })
  return [...groups.values()].map(({parts,material})=>{const geometry=mergeGeometries(parts);parts.forEach(p=>p.dispose());if(!geometry)throw Error(`Cannot merge kit ${url}`);material.roughness=.78;
   if(/building|painted-row/.test(url)){
    windowMask(geometry,material.map,url.includes('/kaykit/')?'kaykit':'other',material.name);bakeBuildingContact(geometry,.12);material.vertexColors=true
    const windowNight={value:0};material.userData.windowNight=windowNight
    material.onBeforeCompile=shader=>{shader.uniforms.windowNight=windowNight;shader.vertexShader='attribute float windowMask;attribute float windowId;varying float vLitWindow;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      float seed=windowId;
      #ifdef USE_INSTANCING
      seed+=floor(instanceMatrix[3].x)*13.+floor(instanceMatrix[3].z)*7.;
      #endif
      vLitWindow=windowMask*step(.22,fract(sin(seed*12.9898)*43758.5453));`);shader.fragmentShader='uniform float windowNight;varying float vLitWindow;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance+=windowNight*vLitWindow*vec3(3.1,1.6,.6);')};material.customProgramCacheKey=()=> 'metro-actual-window-faces-v5'
   }
   return{geometry,material}})
 },[scene,url])
 useEffect(()=>()=>{for(const batch of batches){batch.geometry.dispose();batch.material.dispose()}},[batches])
 return <group name={`kit:${url}`}>{night&&url.includes('streetlight')&&<NightPools placements={placements}/>}{batches.map((batch,i)=><KitBatch key={i} {...batch} placements={placements} shadow={shadow} night={night} drive={drive}/>)}</group>
}
function KitBatch({geometry,material,placements,shadow,night,drive}:{geometry:THREE.BufferGeometry;material:THREE.MeshStandardMaterial;placements:Placement[];shadow:boolean;night:boolean;drive?:DriveRoute[]}){
 const ref=useRef<THREE.InstancedMesh>(null)
 const {invalidate}=useThree(),dummy=useMemo(()=>new THREE.Object3D(),[])
 useEffect(()=>{if(!drive)return;const timer=setInterval(()=>{if(!document.hidden)invalidate()},1000/30);return()=>clearInterval(timer)},[drive,invalidate])
 useFrame(({clock})=>{if(!drive||!ref.current)return;drive.forEach((r,i)=>{const dx=r.ex-r.x,dz=r.ez-r.z,length=Math.hypot(dx,dz),t=((clock.elapsedTime*(2.4+i*.15)+i*7)%(2*length))/length,back=t>1,f=back?2-t:t,p=placements[i];dummy.position.set(r.x+dx*f,r.y+(r.ey-r.y)*f,r.z+dz*f);dummy.rotation.set(0,Math.atan2(dx,dz)+(back?Math.PI:0),0);dummy.scale.setScalar(p.scale??1);dummy.updateMatrix();ref.current!.setMatrixAt(i,dummy.matrix)});ref.current.instanceMatrix.needsUpdate=true;ref.current.computeBoundingSphere()})

 useLayoutEffect(()=>{const m=ref.current!,d=new THREE.Object3D();placements.forEach((p,i)=>{d.position.set(p.x,p.y,p.z);d.rotation.set(p.pitch??0,p.angle,0);d.scale.setScalar(p.scale??1);d.updateMatrix();m.setMatrixAt(i,d.matrix);m.setColorAt(i,new THREE.Color(p.color))});m.instanceMatrix.needsUpdate=true;if(m.instanceColor)m.instanceColor.needsUpdate=true;m.computeBoundingSphere();m.updateMatrix();m.matrixAutoUpdate=false},[placements])
 useLayoutEffect(()=>{material.emissive.set(night?'#243c50':'#000000');material.emissiveIntensity=night?.12:0;if(material.userData.windowNight)material.userData.windowNight.value=night?1:0},[material,night])
 return <>{night&&drive&&<CarLights source={ref} count={placements.length}/>}<instancedMesh name={drive?"driving-cars":undefined} ref={ref} args={[geometry,material,placements.length]} castShadow={shadow} receiveShadow raycast={noPick}/></>
}

/** Authoring units are scene units. Exported hierarchy contains <=4 merged material meshes. */
export function BlenderLandmark({id,x,z,angle=0}:{id:string;x:number;z:number;angle?:number}){
 const {scene}=useGLTF(`/models/landmarks/${id}.glb`)
 const {gl,invalidate}=useThree(),fountainTime=useMemo(()=>({value:0}),[])
 useFrame(({clock})=>{fountainTime.value=clock.elapsedTime})
 useEffect(()=>{if(id!=='centennial')return;const timer=setInterval(()=>{if(!document.hidden)invalidate()},1000/30);return()=>clearInterval(timer)},[id,invalidate])
 useLayoutEffect(()=>{gl.shadowMap.needsUpdate=true;invalidate()},[scene,gl,invalidate])
 const model=useMemo(()=>{const root=scene.clone(true);root.name=id;root.traverse(o=>{if(o instanceof THREE.Mesh){const water=/lake|jets/.test(o.name);if(id==='centennial'&&/jets/.test(o.name)){const material=(o.material as THREE.MeshStandardMaterial).clone();material.transparent=true;material.opacity=.78;material.depthWrite=false;material.roughness=.18;material.onBeforeCompile=shader=>{shader.uniforms.fountainTime=fountainTime;shader.vertexShader='uniform float fountainTime;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nfloat pulse=.82+.18*sin(fountainTime*2.4+position.x*1.7+position.z*2.1);transformed.y=.15+(position.y-.15)*pulse;transformed.x+=max(0.,position.y-.15)*.035*sin(fountainTime*4.+position.z);')};material.customProgramCacheKey=()=> 'metro-fountain-pulse-v1';o.material=material;}o.castShadow=!water;o.receiveShadow=!water;o.raycast=noPick;o.updateMatrix();o.matrixAutoUpdate=false}});root.position.set(x,0,z);root.rotation.y=angle;root.updateMatrix();root.matrixAutoUpdate=false;return root},[scene,id,x,z,angle,fountainTime])
 useEffect(()=>()=>{if(id==='centennial')model.traverse(o=>{if(o instanceof THREE.Mesh&&/jets/.test(o.name))(o.material as THREE.Material).dispose()})},[id,model])
 return <primitive object={model}/>
}
