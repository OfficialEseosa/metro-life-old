/* oxlint-disable react/immutability -- Owned shader clones and uniforms are imperative GPU resources. */
import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { motion } from '../walking'
import { useStore } from '../store'

/** Dither a blocking building/tree without another transparent pass or draw call. */
export function CameraOcclusion(){
 const {scene,invalidate}=useThree(),target=useMemo(()=>({value:new THREE.Vector4()}),[])
 const sync=useRef<()=>void>(()=>{})
 useEffect(()=>{
  const owned=new Map<THREE.Mesh,{original:THREE.Material|THREE.Material[];materials:THREE.Material[]}>()
  const scan=()=>{
   for(const[object,entry]of owned){let root:THREE.Object3D=object;while(root.parent)root=root.parent;if(root!==scene){entry.materials.forEach(m=>m.dispose());owned.delete(object)}}
   scene.traverse(object=>{
    if(!(object instanceof THREE.Mesh)||owned.has(object))return
    let parent:THREE.Object3D|null=object,scenery=false
    while(parent){if(parent.name.startsWith('kit:')&&/building|tree-|painted-row/.test(parent.name)||parent.userData.cameraOccluder)scenery=true;if(parent.name==='controlled-player'||parent.name.startsWith('room-'))return;parent=parent.parent}
    if(!scenery)return
    const geometry=object.geometry;geometry.computeBoundingSphere();geometry.computeBoundingBox()
    const box=geometry.boundingBox!
    const originals:THREE.Material[]=Array.isArray(object.material)?object.material:[object.material]
    const materials=originals.map(source=>{
     const material=source.clone(),compile=source.onBeforeCompile,key=source.customProgramCacheKey()
     material.onBeforeCompile=(shader,renderer)=>{
      compile.call(material,shader,renderer);shader.uniforms.metroFadeTarget=target;shader.uniforms.metroFadeMin={value:box.min.clone()};shader.uniforms.metroFadeMax={value:box.max.clone()}
      shader.vertexShader='uniform vec4 metroFadeTarget;varying vec3 vMetroLocalCamera;varying vec3 vMetroLocalTarget;\n'+shader.vertexShader
      shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
       mat4 metroModel=modelMatrix;
       #ifdef USE_INSTANCING
       metroModel=modelMatrix*instanceMatrix;
       #endif
       vec3 metroCameraDelta=cameraPosition-metroModel[3].xyz;
       vec3 metroTargetDelta=metroFadeTarget.xyz-metroModel[3].xyz;
       vec3 metroScaleSquared=vec3(dot(metroModel[0].xyz,metroModel[0].xyz),dot(metroModel[1].xyz,metroModel[1].xyz),dot(metroModel[2].xyz,metroModel[2].xyz));
       vMetroLocalCamera=vec3(dot(metroCameraDelta,metroModel[0].xyz),dot(metroCameraDelta,metroModel[1].xyz),dot(metroCameraDelta,metroModel[2].xyz))/metroScaleSquared;
       vMetroLocalTarget=vec3(dot(metroTargetDelta,metroModel[0].xyz),dot(metroTargetDelta,metroModel[1].xyz),dot(metroTargetDelta,metroModel[2].xyz))/metroScaleSquared;`)
      shader.fragmentShader='uniform vec4 metroFadeTarget;uniform vec3 metroFadeMin;uniform vec3 metroFadeMax;varying vec3 vMetroLocalCamera;varying vec3 vMetroLocalTarget;\n'+shader.fragmentShader
      shader.fragmentShader=shader.fragmentShader.replace('#include <dithering_fragment>',`#include <dithering_fragment>
       if(metroFadeTarget.w>.5){
        vec3 metroRay=vMetroLocalTarget-vMetroLocalCamera;
        vec3 metroSign=vec3(metroRay.x<0.?-1.:1.,metroRay.y<0.?-1.:1.,metroRay.z<0.?-1.:1.);
        vec3 metroInverse=metroSign/max(abs(metroRay),vec3(.00001));
        vec3 metroA=(metroFadeMin-vMetroLocalCamera)*metroInverse,metroB=(metroFadeMax-vMetroLocalCamera)*metroInverse;
        vec3 metroLow=min(metroA,metroB),metroHigh=max(metroA,metroB);
        float metroNear=max(metroLow.x,max(metroLow.y,metroLow.z));
        float metroFar=min(metroHigh.x,min(metroHigh.y,metroHigh.z));
        float metroEnd=1.-1.2/max(length(metroFadeTarget.xyz-cameraPosition),.001);
        float metroFade=step(max(metroNear,0.),metroFar)*step(metroNear,metroEnd);
        float metroPattern=fract(dot(floor(gl_FragCoord.xy),vec2(.754877666,.569840296)));
        if(metroPattern<metroFade*.82)discard;
       }`)
     }
     material.customProgramCacheKey=()=>key+'-metro-camera-fade-v3'
     material.needsUpdate=true;return material
    })
    owned.set(object,{original:object.material,materials});object.material=Array.isArray(object.material)?materials:materials[0]
   })
   scene.userData.cameraOcclusion={meshes:owned.size,method:'dither',remainingOpacity:.18};invalidate()
  }
  sync.current=()=>{for(const entry of owned.values()){const sources=Array.isArray(entry.original)?entry.original:[entry.original];entry.materials.forEach((material,i)=>{const source=sources[i] as THREE.MeshStandardMaterial,dest=material as THREE.MeshStandardMaterial;if(source.color&&dest.color)dest.color.copy(source.color);if(source.emissive&&dest.emissive){dest.emissive.copy(source.emissive);dest.emissiveIntensity=source.emissiveIntensity}dest.opacity=source.opacity})}}
  scan();const timer=setInterval(scan,1500)
  return()=>{clearInterval(timer);sync.current=()=>{};for(const[object,entry]of owned){if((Array.isArray(object.material)?object.material[0]:object.material)===entry.materials[0])object.material=entry.original;entry.materials.forEach(m=>m.dispose())}delete scene.userData.cameraOcclusion}
 },[scene,invalidate,target])
 useFrame(({camera})=>{sync.current();const state=useStore.getState(),p=motion.position,player=scene.getObjectByName('controlled-player'),near=!!p&&Math.hypot(camera.position.x-p.x,camera.position.z-p.z)<65;target.value.set(p?.x??0,(player?.position.y??0)+1,p?.z??0,p&&!p.room&&near&&state.sim?.city===state.city&&!scene.userData.cameraOcclusionDisabled?1:0);if(scene.userData.cameraOcclusion)scene.userData.cameraOcclusion.active=target.value.w>0})
 return null
}
