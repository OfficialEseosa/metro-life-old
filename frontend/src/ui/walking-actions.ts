import { api } from '../api/client'
import { useStore } from '../store'
import { motion, useWalking } from '../walking'
import { nearbyStation } from '../navigation'
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
 const action=p.room?.startsWith('home:')?city?.homeActions.find(a=>a.id===station?.action):station?.id==='desk'?place?.actions.find(a=>a.requires?.job===sim.job?.track&&!!a.requires?.job):station?.action==='eat'?place?.actions.find(a=>a.kind==='food'):station?.action==='dance'?place?.actions.find(a=>a.kind==='fun'&&!a.requires?.job):station?.action==='perform'?place?.actions.find(a=>a.kind==='work'&&!a.requires?.job):undefined
 return {station,action,apply:station?.id==='desk'&&!sim.job,label:station?.id==='desk'?sim.job?(sim.job.loc===p.place?'Work a shift':'Your workplace is elsewhere'):'Apply for a role':station?.name,reason:station?.id==='desk'&&sim.job&&sim.job.loc!==p.place?'Your workplace is elsewhere':''}
}

export function nearbyPerson(sim:Sim,p:Position,players:import('../api/types').Player[]){return players.filter(n=>n.id!==sim.userId&&n.city===sim.city&&(n.npc||n.online)&&n.position&&(n.position.room??null)===(p.room??null)&&!p.room?.startsWith('home:')&&Math.hypot(n.position.x-p.x,n.position.z-p.z)<2.8).sort((a,b)=>Math.hypot(a.position!.x-p.x,a.position!.z-p.z)-Math.hypot(b.position!.x-p.x,b.position!.z-p.z))[0]}
export async function meet(kind:'wave'|'hangout'|'gift'='wave'){
 const s=useStore.getState(),p=motion.position;if(!s.sim||!p||s.acting||s.sim.busyUntil||s.sim.pendingBeat)return;
 const person=nearbyPerson(s.sim,p,s.players);if(!person)return;useStore.setState({acting:true});
 try{await motion.flush();const r=await api.social(person.id,kind,kind==='gift'?25:undefined);s.setSim(r.sim);useStore.setState({socialNotice:r.text});useWalking.setState({error:''})}catch(e){useWalking.setState({error:e instanceof Error?e.message:'Could not meet your neighbour.'})}finally{useStore.setState({acting:false})}
}
