import { useState } from 'react'
import { Search, X } from 'lucide-react'
import { useStore } from '../store'
import { Icon } from './primitives'
import { matchesLens } from './action-rules'

export function MapTools({close}:{close:()=>void}){
  const[query,setQuery]=useState(''),city=useStore(s=>s.city),world=useStore(s=>s.world),lens=useStore(s=>s.mapLens),sim=useStore(s=>s.sim)
  const places=world?.cities.find(c=>c.id===city)?.landmarks.filter(l=>l.name.toLowerCase().includes(query.toLowerCase())&&matchesLens(l,lens,sim))??[]
  return <section className="map-tools plate" aria-label="Search the city"><div className="search-row"><Search size={20}/><input aria-label="Search places" placeholder="Search places…" value={query} onChange={e=>setQuery(e.target.value)}/><button className="icon-button" aria-label="Close search" onClick={close}><X size={20}/></button></div><div className="lenses" aria-label="Map lenses">{([['all','All','map-pin'],['eat','Eat','utensils'],['earn','Earn','wallet'],['fun','Have fun','sparkles'],['affordable','Affordable now','hand-coins']] as const).map(([id,label,icon])=><button key={id} aria-pressed={lens===id} className={`lens ${id}`} onClick={()=>useStore.getState().setMapLens(id)}><Icon name={icon} size={18}/>{label}</button>)}</div><div className="search-results">{places.map(place=><button key={place.id} onClick={()=>{useStore.getState().selectLocation(place.id);useStore.getState().setFocus(place.id);close()}}><span className="semantic-tile" style={{background:world?.categories[place.category]?.color}}><Icon name={place.icon}/></span><span>{place.name}<small>{place.area}</small></span></button>)}{!places.length&&<p>No places match. Try another name or lens.</p>}</div></section>
}
