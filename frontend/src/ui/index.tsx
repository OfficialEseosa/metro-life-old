import { Compass, MapPin, Moon, Sun, ArrowUpRight, RotateCcw } from 'lucide-react'
import { useStore } from '../store'
import canonical from '../../../shared/world.json'
import './hud.css'

export default function Hud() {
  const selected=useStore(s=>s.selectedLoc),theme=useStore(s=>s.sceneTheme)
  const location=canonical.cities[0].landmarks.find(l=>l.id===selected)
  return <div className="metro-hud">
    <header className="map-header"><a className="wordmark" href="/" aria-label="Metro Life home"><span className="brand-symbol"><Compass size={23}/></span>metro<span>life</span><i/></a><div className="city-name"><span className="eyebrow">YOUR NEXT CHAPTER</span><strong>Atlanta, Georgia</strong></div><button className="theme-button" onClick={()=>useStore.getState().setSceneTheme(theme==='night'?'day':'night')} aria-label={theme==='night'?'Show daytime':'Show nighttime'}>{theme==='night'?<Sun size={19}/>:<Moon size={19}/>}</button></header>
    <aside className="explore-card"><span className="eyebrow">THE CITY IN A FOREST</span><h1>A little room<br/>to dream bigger.</h1><p>Find your corner of Atlanta. Twenty places, a thousand possibilities.</p><label htmlFor="destination"><MapPin size={17}/> Explore a place</label><select id="destination" value={selected??''} onChange={e=>{useStore.getState().selectLocation(e.target.value||null);useStore.getState().setFocus(e.target.value||'overview')}}><option value="">Choose your destination</option>{canonical.cities[0].landmarks.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select><button className="overview-button" onClick={()=>{useStore.getState().setFocus('overview');useStore.getState().selectLocation(null)}}><RotateCcw size={16}/> See the whole city</button></aside>
    {location&&<section className="place-card"><span className="eyebrow">{location.area}</span><h2>{location.name}</h2><p>{location.blurb}</p><span className="place-caption"><MapPin size={15}/> Your next stop <ArrowUpRight size={17}/></span></section>}
    <footer className="map-footer"><span><span className="status-dot"/> A city of possibilities</span><span>Drag to explore <b>·</b> Scroll to get closer</span><span>ATL <b>33.75° N / 84.39° W</b></span></footer>
  </div>
}
