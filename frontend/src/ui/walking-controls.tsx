import { enterBuilding,stationAction } from './walking-actions'
import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import { api } from '../api/client'
import { motion, useWalking, interact } from '../walking'
import { nearbyDoor, interiorType, roomType } from '../navigation'
import { actionReason } from './action-rules'
import { serverNow } from '../server-time'
import './walking.css'

export function WalkingControls(){
 const sim=useStore(s=>s.sim),city=useStore(s=>s.city),panel=useStore(s=>s.panel),world=useStore(s=>s.world),acting=useStore(s=>s.acting),position=useWalking(s=>s.position),error=useWalking(s=>s.error),transition=useWalking(s=>s.transition),result=useStore(s=>s.lastResult)
 const [help,setHelp]=useState(()=>{try{return !localStorage.getItem('metro-walk-help')}catch{return true}}),[stick,setStick]=useState<{x:number;y:number;dx:number;dy:number}|null>(null),origin=useRef({x:0,y:0})
 useEffect(()=>{if(!help)return;const dismiss=()=>{setHelp(false);try{localStorage.setItem('metro-walk-help','1')}catch{/* Storage is optional. */}},timer=setTimeout(dismiss,10000);let start:{x:number;z:number}|null=null;const off=useWalking.subscribe(s=>{if(!s.position)return;if(!start)start={...s.position};if(Math.hypot(s.position.x-start.x,s.position.z-start.z)>2)dismiss()});return()=>{clearTimeout(timer);off()}},[help])
 const room=position?.room,context=sim&&position?stationAction(sim,world,position):undefined,station=context?.station,door=sim&&position&&!room?nearbyDoor(sim,position):undefined
 const reason=context?.reason||(sim&&context?.action?actionReason(context.action,sim,false,serverNow()):'')
 const label=room?(reason||context?.label||'Walk to the furniture'):door?`${interiorType(world,city,door[0])?'Enter':'Explore'} ${door[1].name}`:'Walk to a door'
 useEffect(()=>{
  const act=async(event:Event)=>{
   const s=useStore.getState(),p=motion.position
   if(s.panel||s.acting||s.sim?.busyUntil||s.sim?.pendingBeat||!s.sim||!p)return
   const back=event.type==='metro-back',context=stationAction(s.sim,s.world,p),station=p.room?context.station:undefined,near=p.room?undefined:nearbyDoor(s.sim,p)
   useStore.setState({acting:true})
   try{
    if(p.room){
     if(back||station?.id==='exit'){
      if(station?.id!=='exit')throw Error('Walk to the front door to leave.')
      await motion.flush();useWalking.setState({transition:true});const r=await api.door(p.place,false);s.setSim(r.sim);setTimeout(()=>useWalking.setState({transition:false}),350)
     }else if(station){await motion.flush();if(context.reason)throw Error(context.reason);if(context.apply){const listing=await api.jobs(s.sim.city),job=listing.jobs.find(j=>j.loc===p.place&&j.level===1);if(!job)throw Error('No entry role here.');const r=await api.applyJob(job.id);s.setSim(r.sim)}else if(context.action){const r=await api.act(s.sim.city,p.place,context.action.id);s.setSim(r.sim);s.setLastResult(r.result)}}
    }else if(near&&interiorType(s.world,s.sim.city,near[0]))await enterBuilding(near[0])
    else if(near)s.selectLocation(near[0])
    useWalking.setState({error:''})
   }catch(e){useWalking.setState({error:e instanceof Error?e.message:'Could not interact with the city.',transition:false})}
   finally{useStore.setState({acting:false})}
  }
  window.addEventListener('metro-interact',act);window.addEventListener('metro-back',act)
  return()=>{window.removeEventListener('metro-interact',act);window.removeEventListener('metro-back',act)}
 },[])
 useEffect(()=>{motion.follow=!panel;if(!panel)motion.wake()},[panel])
 if(!sim||city!==sim.city||panel||sim.pendingBeat)return null
 const clear=()=>{motion.x=motion.z=0;setStick(null);motion.wake()}
 return <>
  <div className="walk-status" role="status">{(error||!help||room)&&<span className="walk-caption">{error||(room?`${roomType(room)==='home'?'Home':'Workplace'} · Walk up to furniture`:'Your neighbourhood')}</span>}{help&&!room&&<div className="walk-help">WASD or arrows to walk · Shift to run<br/>E or Enter to interact · Escape to go back<button onClick={()=>{setHelp(false);try{localStorage.setItem('metro-walk-help','1')}catch{/* Storage may be blocked. */}}}>Got it</button></div>}</div>
  <div className={`walk-joystick ${stick?'active':''}`} aria-label="Walking joystick" role="region" onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);origin.current={x:e.clientX,y:e.clientY};setStick({x:e.clientX,y:e.clientY,dx:0,dy:0});motion.wake()}} onPointerMove={e=>{if(!e.currentTarget.hasPointerCapture(e.pointerId))return;const dx=e.clientX-origin.current.x,dy=e.clientY-origin.current.y,length=Math.max(36,Math.hypot(dx,dy));motion.x=dx/length;motion.z=dy/length;setStick({x:origin.current.x,y:origin.current.y,dx:dx/length*32,dy:dy/length*32});motion.wake()}} onPointerUp={clear} onPointerCancel={clear} onLostPointerCapture={clear}><span className="stick-base" style={stick?{position:'fixed',left:stick.x-44,top:stick.y-44}:undefined}><span style={{transform:`translate(${stick?.dx??0}px,${stick?.dy??0}px)`}}/></span></div>
  <button className="walk-interact primary" disabled={(!door&&!station)||!!sim.busyUntil||acting||!!reason} onClick={interact}>{sim.busyUntil?'Stay here until it finishes':label}<small>E / Enter</small></button>
  <div className="walking-anchor" aria-live="polite">{result&&<span className="walking-payoff" key={`${result.text}:${result.busyUntil}`}>{result.activity?.id==='cook'?<><b>Dinner is ready</b><small>Spent ${result.activity.cost}</small>{result.activity.dailyCash>0&&<small>Daily goal +${result.activity.dailyCash}</small>}</>:(result.deltas.cash??0)!==0&&<b>{(result.deltas.cash??0)>0?'+':'-'}${Math.abs(result.deltas.cash??0)}</b>}{Object.entries(result.deltas.needs??{}).filter(([,n])=>n>0).map(([need,n])=><small key={need}>+{Math.round(n)} {need}</small>)}</span>}</div>
  {transition&&<div className="room-curtain"/>}
 </>
}
