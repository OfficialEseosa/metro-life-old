/* oxlint-disable react/immutability -- Event marker floats above its venue. */
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard } from '@react-three/drei'
import * as THREE from 'three'
import { useStore } from '../store'
import { useSocialLife } from '../ui/social-life'
import { sitesFor } from './cities'
import { WorldText } from './world-text'

export function EventPin(){
 const city=useStore(s=>s.city),event=useSocialLife(s=>s.event),ref=useRef<THREE.Group>(null),site=event?sitesFor(city)[event.loc]:null
 useFrame(({clock})=>{if(ref.current&&site)ref.current.position.y=site.height+4+Math.sin(clock.elapsedTime*2)*.22})
 if(!event||event.city!==city||!site)return null
 const find=()=>{useStore.getState().selectLocation(event.loc);useStore.getState().setFocus(event.loc)}
 return <group name="world-event-pin"><group ref={ref} position={[site.x,site.height+4,site.z]}><Billboard><mesh onPointerDown={e=>{e.stopPropagation();e.nativeEvent.stopImmediatePropagation()}} onClick={e=>{e.stopPropagation();find()}}><boxGeometry args={[7.8,1.2,.13]}/><meshStandardMaterial color={event.active?'#2fa36b':'#bb8254'} emissive={event.active?'#23724c':'#795934'} emissiveIntensity={.35}/></mesh><WorldText position={[0,0,.08]} fontSize={.44} maxWidth={7.3} distance={210}>{event.active?'Party is on!':event.name}</WorldText></Billboard></group>{event.active&&<mesh position={[site.x,.08,site.z]} rotation={[-Math.PI/2,0,0]} raycast={()=>{}}><ringGeometry args={[site.size*.46,site.size*.48,48]}/><meshBasicMaterial color="#8bd497" transparent opacity={.65} depthWrite={false}/></mesh>}</group>
}
