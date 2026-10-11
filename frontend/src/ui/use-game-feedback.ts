import { useEffect } from 'react'
import { api } from '../api/client'
import { useStore } from '../store'
import { resumeSound } from './sound'
export function useGameFeedback(){
  const until=useStore(s=>s.sim?.busyUntil),worldId=useStore(s=>s.sim?.worldId)
  useEffect(()=>{
    const tap=(e:PointerEvent)=>{if(!(e.target instanceof Element)||!e.target.closest('button'))return;resumeSound('tap');navigator.vibrate?.(8)}
    document.addEventListener('pointerdown',tap,{passive:true});return()=>document.removeEventListener('pointerdown',tap)
  },[])
  useEffect(()=>{
    if(!until)return
    let cancelled=false,timer:ReturnType<typeof setTimeout>
    const settle=async()=>{try{
      const r=await api.sim(),state=useStore.getState()
      if(cancelled||state.sim?.worldId!==worldId)return
      if(r.sim.busyUntil&&r.sim.busyUntil>Date.now()){timer=setTimeout(()=>void settle(),150);return}
      const travelled=r.sim.city!==state.sim?.city
      useStore.setState({sim:r.sim,clock:r.clock})
      if(travelled){await state.setCity(r.sim.city);state.selectLocation(r.sim.loc);state.setFocus(r.sim.loc)}
    }catch{if(!cancelled&&useStore.getState().sim?.worldId===worldId)timer=setTimeout(()=>void settle(),1000)}}
    timer=setTimeout(()=>void settle(),Math.max(0,until-Date.now()+80))
    return()=>{cancelled=true;clearTimeout(timer)}
  },[until,worldId])
}
