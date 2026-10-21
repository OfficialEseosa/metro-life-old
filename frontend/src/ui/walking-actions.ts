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
 const action=station?station.id==='counter'?place?.actions.find(a=>a.kind==='food'):stationActionFor(p.room,sim.city,world,station,sim.job?.track):undefined
 return {station,action,apply:atWork&&!sim.job,label:atWork?sim.job?(sim.job.loc===p.place?'Work a shift':'Your workplace is elsewhere'):'Apply for a role':action?.label??station?.name,reason:atWork&&sim.job&&sim.job.loc!==p.place?'Your workplace is elsewhere':station&&station.id!=='exit'&&!action&&!atWork?'There is no activity here right now. Try another station.':''}
}

export function nearbyPerson(sim:Sim,p:Position,players:import('../api/types').Player[]){return players.filter(n=>n.id!==sim.userId&&n.city===sim.city&&(n.npc||n.online)&&n.position&&(n.position.room??null)===(p.room??null)&&!p.room?.startsWith('home:')&&Math.hypot(n.position.x-p.x,n.position.z-p.z)<2.8).sort((a,b)=>Math.hypot(a.position!.x-p.x,a.position!.z-p.z)-Math.hypot(b.position!.x-p.x,b.position!.z-p.z))[0]}
export async function meet(kind:'wave'|'hangout'|'gift'='wave'){
 const s=useStore.getState(),p=motion.position;if(!s.sim||!p||s.acting||s.sim.busyUntil||s.sim.pendingBeat)return;
 const person=nearbyPerson(s.sim,p,s.players);if(!person)return;useStore.setState({acting:true});
 try{await motion.flush();const r=await api.social(person.id,kind,kind==='gift'?25:undefined);s.setSim(r.sim);useStore.setState({socialNotice:r.text});useWalking.setState({error:''})}catch(e){useWalking.setState({error:e instanceof Error?e.message:'Could not meet your neighbour.'})}finally{useStore.setState({acting:false})}
}
