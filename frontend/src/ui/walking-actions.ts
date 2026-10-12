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
 const station=nearbyStation(p),city=world?.cities.find(c=>c.id===sim.city),place=city?.landmarks.find(l=>l.id===p.place)
 const action=p.room?.startsWith('home:')?city?.homeActions.find(a=>a.id===station?.action):station?.id==='desk'?place?.actions.find(a=>a.requires?.job===sim.job?.track&&!!a.requires?.job):undefined
 return {station,action,apply:station?.id==='desk'&&!sim.job,label:station?.id==='desk'?sim.job?(sim.job.loc===p.place?'Work a shift':'Your workplace is elsewhere'):'Apply for a role':station?.name,reason:station?.id==='desk'&&sim.job&&sim.job.loc!==p.place?'Your workplace is elsewhere':''}
}
