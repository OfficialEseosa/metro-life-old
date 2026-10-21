import { ReasonButton } from './primitives'
import { enterBuilding,stationAction, nearbyPerson, meet } from './walking-actions'
import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import { api } from '../api/client'
import { motion, useWalking, interact, type InteractionIntent } from '../walking'
import { nearbyBench, nearbyDoor, interiorType, roomType } from '../navigation'
import { clearQueuedInteractions, useInteractions } from '../interactions'
import { policyHours, actionReason, workCareNote } from './action-rules'
import { serverNow } from '../server-time'
import './walking.css'

export function WalkingControls(){
 const sim=useStore(s=>s.sim),city=useStore(s=>s.city),panel=useStore(s=>s.panel),world=useStore(s=>s.world),acting=useStore(s=>s.acting),position=useWalking(s=>s.position),error=useWalking(s=>s.error),transition=useWalking(s=>s.transition),result=useStore(s=>s.lastResult),players=useStore(s=>s.players),clock=useStore(s=>s.clock),policy=useStore(s=>s.mayor?.mayor?.policy)
 const [help,setHelp]=useState(()=>{try{return !localStorage.getItem('metro-walk-help')}catch{return true}}),[stick,setStick]=useState<{x:number;y:number;dx:number;dy:number}|null>(null),origin=useRef({x:0,y:0})
 useEffect(()=>{if(!help)return;const dismiss=()=>{setHelp(false);try{localStorage.setItem('metro-walk-help','1')}catch{/* Storage is optional. */}},timer=setTimeout(dismiss,10000);let start:{x:number;z:number}|null=null;const off=useWalking.subscribe(s=>{if(!s.position)return;if(!start)start={...s.position};if(Math.hypot(s.position.x-start.x,s.position.z-start.z)>2)dismiss()});return()=>{clearTimeout(timer);off()}},[help])
 const room=position?.room,context=sim&&position?stationAction(sim,world,position):undefined,station=context?.station,door=sim&&position&&!room?nearbyDoor(sim,position):undefined
 const bench=position?nearbyBench(city,position):undefined,seated=sim?.activitySlot?.bench
 const person=sim&&position?nearbyPerson(sim,position,players):undefined,place=world?.cities.find(c=>c.id===city)?.landmarks.find(l=>l.id===position?.place),open=policyHours(place?.open??[0,24],place?.category??'',policy),hour=clock?((clock.hour*60+clock.minute+(serverNow()-clock.at)/clock.msPerMinute)%1440)/60:12,closed=open[0]<open[1]?hour<open[0]||hour>=open[1]:hour<open[0]&&hour>=open[1]
 const reason=context?.reason||(sim&&context?.action?actionReason(context.action,sim,closed,serverNow()):'')
 const canTalk=!!person&&station?.id!=='exit'&&(!!room||!door)&&(!station||Math.hypot(station.x-position!.x,station.z-position!.z)>.65)
 const label=seated?'Stand up':bench?'Sit on bench':canTalk?`Wave to ${person.username}`:room?(context?.label||'Walk to the furniture'):door?`${interiorType(world,city,door[0])?'Enter':'Explore'} ${door[1].name}`:'Walk to a door'
 const intent:InteractionIntent|null=sim&&position?(seated||bench?{kind:'bench',label,city:sim.city,room:position.room,loc:position.place,benchId:seated?undefined:bench?.id}:canTalk?{kind:'social',label,city:sim.city,room:position.room,loc:position.place,targetId:person!.id}:room&&station?{kind:station.id==='exit'?'door':context?.apply?'apply':'act',label,city:sim.city,room:position.room,loc:position.place,stationId:station.id,actionId:context?.action?.id,jobId:context?.jobId,enter:false}:door?{kind:interiorType(world,city,door[0])?'door':'location',label,city:sim.city,room:null,loc:door[0],enter:true}:null):null
 useEffect(()=>{motion.interactionIntent=intent;return()=>{motion.interactionIntent=null}})
 useEffect(()=>{
  const act=async(event:Event)=>{
   const s=useStore.getState(),p=motion.position
   if(s.panel||s.searchOpen||s.acting||s.sim?.busyUntil||s.sim?.pendingBeat||!s.sim||!p)return
   const active=document.activeElement;if(active?.matches('input,textarea,select,[contenteditable="true"]'))return
   const back=event.type==='metro-back',context=stationAction(s.sim,s.world,p)
   if(back&&!p.room)return
   const chosen:InteractionIntent|null=back&&p.room?{kind:'door',label:'Leave building',city:s.sim.city,room:p.room,loc:p.place,stationId:'exit',enter:false}:(event as CustomEvent<InteractionIntent>).detail??motion.interactionIntent
   if(!chosen)return
   if(chosen.city!==s.sim.city||chosen.room!==p.room)return
   if(useInteractions.getState().phase==='starting'||useInteractions.getState().phase==='performing')return
   clearQueuedInteractions()
   if(chosen.kind==='social'){await meet('wave',chosen.targetId);return}
   useStore.setState({acting:true})
   try{
    if(chosen.kind==='bench'){
     if(chosen.benchId&&nearbyBench(s.sim.city,p)?.id!==chosen.benchId)throw Error('Walk back to that bench first.')
     await motion.flush();const r=await api.posture(chosen.benchId??null);s.setSim(r.sim)
    }else if(chosen.kind==='act'||chosen.kind==='apply'){
     if(!context.station||context.station.id!==chosen.stationId)throw Error('Walk back to that station first.')
     if(context.reason)throw Error(context.reason)
     if(chosen.kind==='apply'){
      if(!chosen.jobId||chosen.jobId!==context.jobId)throw Error('Choose the available role again.')
      await motion.flush();const r=await api.applyJob(chosen.jobId);s.setSim(r.sim)
     }else{
      if(!chosen.actionId||context.action?.id!==chosen.actionId)throw Error('Choose the activity again.')
      const place=s.world?.cities.find(c=>c.id===s.sim!.city)?.landmarks.find(l=>l.id===p.place),hours=policyHours(place?.open??[0,24],place?.category??'',s.mayor?.mayor?.policy),c=s.clock,hour=c?((c.hour*60+c.minute+(serverNow()-c.at)/c.msPerMinute)%1440)/60:12,closed=hours[0]<hours[1]?hour<hours[0]||hour>=hours[1]:hour<hours[0]&&hour>=hours[1],blocked=actionReason(context.action,s.sim,closed,serverNow())
      if(blocked)throw Error(blocked)
      await motion.flush();const r=await api.act(s.sim.city,chosen.loc,chosen.actionId);s.setSim(r.sim);s.setLastResult(r.result)
     }
    }else if(chosen.kind==='door'){
     if(p.room){
      if(context.station?.id!=='exit')throw Error('Walk to the front door to leave.')
      await motion.flush();useWalking.setState({transition:true});const r=await api.door(chosen.loc,false);s.setSim(r.sim);setTimeout(()=>useWalking.setState({transition:false}),350)
     }else{if(nearbyDoor(s.sim,p)?.[0]!==chosen.loc)throw Error('Walk back to that door first.');await enterBuilding(chosen.loc)}
    }else if(chosen.kind==='location'){
     if(nearbyDoor(s.sim,p)?.[0]!==chosen.loc)throw Error('Walk back to that place first.')
     s.selectLocation(chosen.loc)
    }
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
  <div className="walk-status" role="status">{(error||!help||room)&&<span className="walk-caption">{error||(room?`${roomType(room)==='home'?'Home':roomType(room)==='cafe'?'Cafe':roomType(room)==='club'?'Music venue':world?.cities.find(c=>c.id===city)?.landmarks.find(l=>l.id===position?.place)?.name??'Workplace'}`:door?.[1].name??'City streets')}</span>}{help&&!room&&<div className="walk-help">WASD or arrows to walk · Shift to run<br/>E or Enter to interact · Escape to go back<button onClick={()=>{setHelp(false);try{localStorage.setItem('metro-walk-help','1')}catch{/* Storage may be blocked. */}}}>Got it</button></div>}</div>
  <div className={`walk-joystick ${stick?'active':''}`} aria-label="Walking joystick" role="region" onPointerDown={e=>{e.preventDefault();window.getSelection()?.removeAllRanges();e.currentTarget.setPointerCapture(e.pointerId);origin.current={x:e.clientX,y:e.clientY};setStick({x:e.clientX,y:e.clientY,dx:0,dy:0});motion.wake()}} onPointerMove={e=>{e.preventDefault();if(!e.currentTarget.hasPointerCapture(e.pointerId))return;const dx=e.clientX-origin.current.x,dy=e.clientY-origin.current.y,length=Math.max(36,Math.hypot(dx,dy));motion.x=dx/length;motion.z=dy/length;setStick({x:origin.current.x,y:origin.current.y,dx:dx/length*32,dy:dy/length*32});motion.wake()}} onPointerUp={clear} onPointerCancel={clear} onLostPointerCapture={clear}><span className="stick-base" style={stick?{position:'fixed',left:stick.x-44,top:stick.y-44}:undefined}><span style={{transform:`translate(${stick?.dx??0}px,${stick?.dy??0}px)`}}/></span></div>
  <ReasonButton className="walk-interact primary" reason={sim.busyUntil?'Stay here until your activity finishes':acting?'Sending…':reason&&!canTalk?reason:!door&&!station&&!person&&!bench&&!seated?(room?'Walk to furniture or the front door':'Walk closer to a door, bench or neighbour'):''} onClick={interact}>{sim.busyUntil?'Stay here until it finishes':label}<small>{context?.action?.requires?.job?(workCareNote(sim)||`${sim.shiftSchedule?.shiftSeconds??25}s shift · E / Enter`):'E / Enter'}</small></ReasonButton>
  {person&&station?.id!=='exit'&&!sim.busyUntil&&<div className="walk-social"><ReasonButton onClick={()=>meet('wave',person.id)} reason={acting?'Sending…':''}>Wave</ReasonButton><ReasonButton onClick={()=>meet('hangout',person.id)} reason={acting?'Sending…':''}>Hang out</ReasonButton><ReasonButton onClick={()=>meet('gift',person.id)} reason={acting?'Sending your gift…':(clock?.msPerMinute??1000)>=1000&&serverNow()-sim.createdAt<1440000?'Live here for one game day before gifting':sim.cash<25?'Save $25 for a gift':''} title={(clock?.msPerMinute??1000)>=1000&&serverNow()-sim.createdAt<1440000?'Live here for one game day before gifting':undefined}>Gift $25</ReasonButton></div>}
  {station&&station.id!=='exit'&&roomType(room)!=='home'&&!sim.busyUntil&&<button className="walk-more" onClick={()=>useStore.getState().selectLocation(position!.place)}>More activities</button>}
  <div className="walking-anchor" aria-live="polite">{result&&<span className="walking-payoff" key={`${result.text}:${result.busyUntil}`}>{result.activity?.id==='cook'?<><b>Dinner is ready</b><small>Spent ${result.activity.cost}</small>{result.activity.dailyCash>0&&<small>Daily goal +${result.activity.dailyCash}</small>}</>:(result.deltas.cash??0)!==0&&<b>{(result.deltas.cash??0)>0?'+':'-'}${Math.abs(result.deltas.cash??0)}</b>}{Object.entries(result.deltas.needs??{}).filter(([,n])=>n>0).map(([need,n])=><small key={need}>+{Math.round(n)} {need}</small>)}</span>}</div>
  {transition&&<div className="room-curtain"/>}
 </>
}
