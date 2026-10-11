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
  useEffect(()=>{if(!until)return;let cancelled=false;const timer=setTimeout(()=>{api.sim().then(r=>{if(!cancelled&&useStore.getState().sim?.worldId===worldId)useStore.getState().setSim(r.sim)}).catch(()=>{})},Math.max(0,until-Date.now()+80));return()=>{cancelled=true;clearTimeout(timer)}},[until,worldId])
}
