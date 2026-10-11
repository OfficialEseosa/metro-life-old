import { useEffect, useRef, useState } from 'react'
import { Volume2, VolumeX } from 'lucide-react'
import { useStore } from '../store'
import { money } from './helpers'
import { Icon } from './primitives'

import { sound, toggleSound, isMuted, resumeSound } from './sound'
export function SoundButton(){const[off,setOff]=useState(isMuted);return <button className="icon-button plate-button" aria-label={off?'Turn sound on':'Mute sound'} aria-pressed={!off} onClick={()=>{setOff(toggleSound());resumeSound('open')}}>{off?<VolumeX size={20}/>:<Volume2 size={20}/>}</button>}
export function CashCounter({cash}:{cash:number}){
  const ref=useRef<HTMLSpanElement>(null),shown=useRef(cash),[initial]=useState(cash)
  useEffect(()=>{const from=shown.current,target=cash,at=performance.now(),reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;let frame=0;const tick=(now:number)=>{const t=reduced?1:Math.min(1,(now-at)/650);shown.current=from+(target-from)*(1-(1-t)**3);if(ref.current)ref.current.textContent=money(shown.current);if(t<1)frame=requestAnimationFrame(tick)};frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame)},[cash])
  return <span ref={ref} className="cash-value">{money(initial)}</span>
}
export function RewardFlight(){
  const result=useStore(s=>s.lastResult),anchor=useStore(s=>s.rewardAnchor),ref=useRef<HTMLDivElement>(null)
  useEffect(()=>{const element=ref.current,counter=document.querySelector('[data-cash]');if(!result||!anchor||!element||!counter)return;const target=counter.getBoundingClientRect(),reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;const x=Math.max(24,Math.min(innerWidth-120,anchor.x)),y=Math.max(140,Math.min(innerHeight-100,anchor.y));element.style.transform=`translate(${x}px,${y}px)`;const animation=element.animate(reduced?[{opacity:1},{opacity:0}]:[{transform:`translate(${x}px,${y}px)`,opacity:0},{transform:`translate(${x}px,${y-32}px)`,opacity:1,offset:.16},{transform:`translate(${x}px,${y-38}px)`,opacity:1,offset:.5},{transform:`translate(${target.x+target.width/2}px,${target.y+target.height/2}px) scale(.45)`,opacity:0}],{duration:reduced?300:1350,easing:'cubic-bezier(.2,.7,.2,1)',fill:'forwards'});counter.animate(reduced?[{opacity:.8},{opacity:1}]:[{transform:'scale(1)'},{transform:'scale(1.1)'},{transform:'scale(1)'}],{duration:180,delay:reduced?0:1050});sound(result.leveledUp?'level':(result.deltas.cash??0)>0?'coin':'open');return()=>animation.cancel()},[result,anchor])
  if(!result||!anchor)return null
  const gain=result.deltas.cash??0,needs=Object.entries(result.deltas.needs??{}).filter(([,value])=>(value??0)>0)
  return <div ref={ref} className="reward-flight" aria-hidden="true">{gain!==0&&<strong>{gain>0?'+':''}{money(gain)}</strong>}{needs.map(([name])=><span key={name} className={`semantic-tile ${name}`}><Icon name={name==='energy'?'zap':name==='hunger'?'utensils':name==='fun'?'sparkles':'users'} size={18}/></span>)}</div>
}
