import { motion } from '../walking'
import { serverNow } from '../server-time'
/* oxlint-disable react/immutability -- Scene animation writes renderer and DOM resources. */
import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store'
import { sitesFor, homeSite } from './cities'
import { Icon } from '../ui/primitives'

export function WorldActivity(){
 const city=useStore(s=>s.city),sim=useStore(s=>s.sim),result=useStore(s=>s.lastResult),marker=useRef<HTMLElement|null>(null),reaction=useRef<THREE.Mesh>(null),at=useRef(0),{camera,size,invalidate}=useThree()
 const site=sim?.city===city?(sim.loc==='home'?homeSite(city,sim.home):sim.loc?sitesFor(city)[sim.loc]:undefined):undefined
 const x=site?.x,z=site?.z,height=site?.height
 useEffect(()=>{if(!result||x===undefined||z===undefined||height===undefined)return;at.current=performance.now();invalidate();const p=motion.position?new THREE.Vector3(motion.position.x,3.2,motion.position.z):new THREE.Vector3(x,height+3,z);p.project(camera);useStore.getState().setRewardAnchor({x:(p.x+1)*size.width/2,y:(1-p.y)*size.height/2})},[result,x,z,height,camera,size.width,size.height,invalidate])
 useEffect(()=>{if(!sim?.busyUntil)return;const timer=setInterval(()=>{if(!document.hidden)invalidate()},1000/30);return()=>clearInterval(timer)},[sim?.busyUntil,invalidate])
 useFrame(()=>{if(!marker.current?.isConnected)marker.current=document.querySelector('.world-activity');const el=marker.current;if(el&&sim&&site){const until=sim.busyUntil??0,start=sim.busyStartedAt??until-3000,t=until?Math.max(0,Math.min(1,(serverNow()-start)/(until-start))):1;const ring=el.querySelector<SVGCircleElement>('.player-ring');if(ring)ring.style.strokeDasharray=`${t*100} 100`;const p=new THREE.Vector3(site.x,site.height+2,site.z).project(camera);el.style.transform=`translate(${(p.x+1)*size.width/2-22}px,${(1-p.y)*size.height/2-22}px)`;el.style.visibility=p.z<1?'visible':'hidden'}
 if(reaction.current){const t=(performance.now()-at.current)/1400;reaction.current.visible=!!result&&t<1;reaction.current.scale.setScalar(1+t*.5);(reaction.current.material as THREE.MeshBasicMaterial).opacity=Math.max(0,.5*(1-t));if(reaction.current.visible)invalidate()}})
 if(!sim||!site||sim.position)return null
 return <group position={[site.x,0,site.z]}><mesh ref={reaction} position={[0,.22,0]} rotation={[-Math.PI/2,0,0]} visible={false} raycast={()=>{}}><ringGeometry args={[site.size*.53,site.size*.57,24]}/><meshBasicMaterial color="#ffdf89" transparent opacity={0} depthWrite={false}/></mesh></group>
}
export function PlayerMarker(){const city=useStore(s=>s.city),sim=useStore(s=>s.sim);if(!sim||sim.city!==city||sim.position)return null;const low=Object.entries(sim.needs).sort((a,b)=>a[1]-b[1])[0];return <div className="world-activity" aria-hidden="true"><svg viewBox="0 0 44 44"><circle cx="22" cy="22" r="18" stroke="#c3d1bd"/><circle className="player-ring" cx="22" cy="22" r="18" fill="none" pathLength="100"/></svg><span className="marker-dot"/>{low&&low[1]<25&&<span className="thought-bubble"><Icon name={low[0]==='energy'?'zap':low[0]==='hunger'?'utensils':low[0]==='fun'?'sparkles':'users'}/></span>}</div>}
