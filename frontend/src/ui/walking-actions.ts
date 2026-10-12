import { api } from '../api/client'
import { useStore } from '../store'
import { motion, useWalking } from '../walking'
export async function enterHome(){
 useWalking.setState({transition:true})
 try{await motion.flush();await new Promise(r=>setTimeout(r,120));const r=await api.door('home',true);useStore.getState().setSim(r.sim);useStore.getState().openPanel(null)}
 finally{setTimeout(()=>useWalking.setState({transition:false}),350)}
}
