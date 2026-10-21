import { api } from '../api/client'
import { useStore } from '../store'
import { motion, useWalking } from '../walking'
import { nearbyStation, stationActionFor } from '../navigation'
import type { Position } from '../navigation'
import type { Sim,World } from '../api/types'
export const enterHome=()=>enterBuilding('home')
export async function enterBuilding(loc:string){
 useWalking.setState({transition:true})
 try{await motion.flush();await new Promise(r=>setTimeout(r,120));const r=await api.door(loc,true);useStore.getState().setSim(r.sim);useStore.getState().openPanel(null)}
 finally{setTimeout(()=>useWalking.setState({transition:false}),350)}
}

export function stationAction(sim:Sim,world:World|null,p:Position){
 const station=nearbyStation(p,sim.city),city=world?.cities.find(c=>c.id===sim.city),place=city?.landmarks.find(l=>l.id===p.place)
 const workplace=place?.actions.some(a=>!!a.requires?.job),atWork=station?.id==='desk'&&workplace
 const role=atWork&&!sim.job?world?.careers.filter(c=>place?.actions.some(a=>a.requires?.job===c.track)).map(c=>({ ...c.levels[0],id:`${sim.city==='atl'?'':sim.city+'-'}${c.track}-1` }))[0]:undefined
 const owned=sim.job?.loc===p.place&&sim.job.city===sim.city
 const action=atWork?(owned?place?.actions.find(a=>a.requires?.job===sim.job?.track):undefined):station?station.id==='counter'?place?.actions.find(a=>a.kind==='food'):stationActionFor(p.room,sim.city,world,station,sim.job?.track):undefined
 return {station,action,apply:!!role,jobId:role?.id,label:atWork?sim.job?(owned?(action?.label??'Work a shift'):'Your workplace is elsewhere'):role?`Apply: ${role.title}`:'No entry role here':action?.label??station?.name,reason:atWork&&sim.job&&!owned?'Your workplace is elsewhere':station&&station.id!=='exit'&&!action&&!role?'There is no activity here right now. Try another station.':''}
}

export function nearbyPerson(sim:Sim,p:Position,players:import('../api/types').Player[]){return players.filter(n=>p.place!=='home'&&n.loc!=='home'&&n.id!==sim.userId&&n.city===sim.city&&(n.npc||n.online)&&n.position&&(n.position.room??null)===(p.room??null)&&!p.room?.startsWith('home:')&&Math.hypot(n.position.x-p.x,n.position.z-p.z)<2.8).sort((a,b)=>Math.hypot(a.position!.x-p.x,a.position!.z-p.z)-Math.hypot(b.position!.x-p.x,b.position!.z-p.z))[0]}
export async function meet(kind:'wave'|'hangout'|'gift'='wave',targetId?:string){
 const s=useStore.getState(),p=motion.position;if(!s.sim||!p||s.acting||s.sim.busyUntil||s.sim.pendingBeat)return;
 const person=targetId?s.players.find(n=>n.id===targetId&&n.city===s.sim!.city&&(n.position?.room??null)===(p.room??null)&&n.position&&Math.hypot(n.position.x-p.x,n.position.z-p.z)<2.8):nearbyPerson(s.sim,p,s.players);if(!person)return;useStore.setState({acting:true});
 try{await motion.flush();const r=await api.social(person.id,kind,kind==='gift'?25:undefined);s.setSim(r.sim);useStore.setState({socialNotice:r.text});useWalking.setState({error:''})}catch(e){useWalking.setState({error:e instanceof Error?e.message:'Could not meet your neighbour.'})}finally{useStore.setState({acting:false})}
}
