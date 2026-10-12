import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import { motion, useWalking, interact } from '../walking'
import { nearbyDoor } from '../navigation'
import './walking.css'
export function WalkingControls(){
 const sim=useStore(s=>s.sim),city=useStore(s=>s.city),panel=useStore(s=>s.panel),position=useWalking(s=>s.position),error=useWalking(s=>s.error),[help,setHelp]=useState(()=>{try{return !localStorage.getItem('metro-walk-help')}catch{return true}}),[stick,setStick]=useState<{x:number;y:number;dx:number;dy:number}|null>(null),origin=useRef({x:0,y:0})
 const door=sim&&position?nearbyDoor(sim,position):undefined,label=door?`Explore ${door[1].name}`:'Walk to a door'
 useEffect(()=>{const act=()=>{const s=useStore.getState(),p=motion.position;if(s.panel||s.sim?.busyUntil||s.sim?.pendingBeat||!s.sim||!p)return;const near=nearbyDoor(s.sim,p);if(near)s.selectLocation(near[0])};window.addEventListener('metro-interact',act);return()=>window.removeEventListener('metro-interact',act)},[])
 useEffect(()=>{motion.follow=!panel;if(!panel)motion.wake()},[panel])
 if(!sim||city!==sim.city||panel||sim.pendingBeat)return null
 const clear=()=>{motion.x=motion.z=0;setStick(null);motion.wake()}
 return <><div className="walk-status" role="status">{error||'Your neighbourhood'}{help&&<div className="walk-help">WASD or arrows to walk · Shift to run<br/>E or Enter to interact · Escape to go back<button onClick={()=>{setHelp(false);try{localStorage.setItem('metro-walk-help','1')}catch{/* Storage may be blocked. */}}}>Got it</button></div>}</div><div className={`walk-joystick ${stick?'active':''}`} aria-label="Walking joystick" role="region" onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);origin.current={x:e.clientX,y:e.clientY};setStick({x:e.clientX,y:e.clientY,dx:0,dy:0});motion.wake()}} onPointerMove={e=>{if(!e.currentTarget.hasPointerCapture(e.pointerId))return;const dx=e.clientX-origin.current.x,dy=e.clientY-origin.current.y,length=Math.max(36,Math.hypot(dx,dy));motion.x=dx/length;motion.z=dy/length;setStick({x:origin.current.x,y:origin.current.y,dx:dx/length*32,dy:dy/length*32});motion.wake()}} onPointerUp={clear} onPointerCancel={clear} onLostPointerCapture={clear}><span className="stick-base" style={stick?{position:'fixed',left:stick.x-44,top:stick.y-44}:undefined}><span style={{transform:`translate(${stick?.dx??0}px,${stick?.dy??0}px)`}}/></span></div><button className="walk-interact primary" disabled={!door||!!sim.busyUntil} onClick={interact}>{sim.busyUntil?'Activity in progress':label}<small>E / Enter</small></button><div className="walking-anchor" aria-hidden="true"/></>
}
