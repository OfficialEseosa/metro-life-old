import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { useStore } from '../store'
import { Icon } from './primitives'
import { sound } from './sound'
export function NeedWarning({inline=false}:{inline?:boolean}){
 const social=useStore(s=>!!s.socialNotice),needs=useStore(s=>s.sim?.needs),panel=useStore(s=>s.panel),result=useStore(s=>s.lastResult),insets=useStore(s=>s.hudInsets),[shown,setShown]=useState(''),dismissed=useStore(s=>s.needWarningDismissed),setDismissed=useStore(s=>s.dismissNeedWarning)
 const critical=Object.entries(needs??{}).sort((a,b)=>a[1]-b[1]).find(([,value])=>value<15)?.[0]??'',full=innerWidth<=700&&insets.bottom>innerHeight*.65
 useEffect(()=>{const timer=setTimeout(()=>{setShown(critical);if(!critical)setDismissed('');if(critical&&!inline)sound('low')},critical?5000:0);return()=>clearTimeout(timer)},[critical,inline,setDismissed])
 if(!critical||shown!==critical||dismissed===critical||result||social||['play','setup','signup','login','worlds'].includes(panel??'')||(inline?!full:full))return null
 const title=critical[0].toUpperCase()+critical.slice(1),home=critical==='energy'||critical==='social'
 return <div className={`result-toast plate need-warning ${inline?'inline-result':''}`} style={innerWidth<=700&&!inline?{bottom:insets.bottom+12}:undefined} role="status"><span className={`semantic-tile ${critical}`}><Icon name={critical==='energy'?'zap':critical==='hunger'?'utensils':critical==='fun'?'sparkles':'users'}/></span><div><strong>{title} is very low</strong><p>{home?'Recharge at home.':'Search the city for a little care.'} Low needs reduce your pay.</p><button className="text-button" onClick={()=>{setDismissed(critical);if(home){useStore.getState().selectLocation('home');useStore.getState().setFocus('home')}else{useStore.getState().setMapLens(critical==='hunger'?'eat':'fun');useStore.getState().setSearchOpen(true)}}}>{home?'Go home':'Find a place'}</button></div><button className="icon-button" aria-label="Dismiss need warning" onClick={()=>setDismissed(critical)}><X size={20}/></button></div>
}
