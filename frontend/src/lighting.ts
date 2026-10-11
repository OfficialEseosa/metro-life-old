import { useEffect, useState } from 'react'
import { useStore } from './store'

/** Use the same advancing clock for the scene and its preview control. */
export function useNightLighting() {
  const theme=useStore(s=>s.sceneTheme),clock=useStore(s=>s.clock)
  const [now,setNow]=useState(Date.now)
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer)},[])
  const elapsed=clock?Math.max(0,now-clock.at)/clock.msPerMinute:0
  const hour=clock?Math.floor((clock.hour*60+clock.minute+elapsed)%1440/60):11
  return theme==='night'||theme==='auto'&&(hour<6||hour>=19)
}
