import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { RiggedCharacter,type CharacterPose } from './character'
import type { Look } from '../api/types'
import * as THREE from 'three'
export function PoseStudio({pose,body}:{pose:CharacterPose;body:string}){
 const {camera,scene}=useThree(),seated=['Sit','Type','Eat'].includes(pose),lying=['Lie','Sleep'].includes(pose),look:Look={body:body==='m'?'m':'f',skin:'#b47752',hair:'short',hairColor:'#493326',top:'#326957',bottom:'#32475c',shoeColor:'#563d2c',style:'casual'}
 useEffect(()=>{camera.position.set(3.2,2.5,4.2);camera.lookAt(0,.85,0);camera.updateProjectionMatrix()},[camera])
 useEffect(()=>{Object.assign(window,{__metroPose:()=>{const actor=scene.getObjectByName('rigged-character'),bones:Record<string,number[]>={};actor?.traverse(o=>{if(o instanceof THREE.Bone&&['Body','Head','WristL','WristR','FootL','FootR'].includes(o.name))bones[o.name]=o.getWorldPosition(new THREE.Vector3()).toArray()});return{pose,bones}}});return()=>{Object.assign(window,{__metroPose:undefined})}},[scene,pose])
 return <><color attach="background" args={['#e4d6c0']}/><ambientLight intensity={1.5}/><directionalLight position={[-3,6,4]} intensity={3}/><RiggedCharacter look={look} readPose={()=>pose} readHipHeight={()=>seated?.61:lying?.65:undefined}/><mesh position={[0,-.08,0]}><boxGeometry args={[5,.12,5]}/><meshStandardMaterial color="#d8c6ac"/></mesh>{seated&&<mesh position={[0,.4,-.12]}><boxGeometry args={[.65,.1,.65]}/><meshStandardMaterial color="#bd7d63"/></mesh>}{lying&&<mesh position={[0,.43,0]}><boxGeometry args={[1.5,.3,2]}/><meshStandardMaterial color="#f2e0c5"/></mesh>}</>
}
