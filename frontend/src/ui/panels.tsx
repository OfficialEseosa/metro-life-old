import { enterBuilding } from './walking-actions'
import { doorsFor,interiorType } from '../navigation'
import { serverNow } from '../server-time'
import { PromotionProgress, AspirationProgress, StoryJournal } from './progression-panels'
import { useEffect, useState } from 'react'
import { api } from '../api/client'
import type { Action, Job, Sim, StoryBeat } from '../api/types'
import { useStore } from '../store'
import { Avatar, ErrorMessage, Icon, SectionTitle, Check, ChevronRight } from './primitives'
import { money, useTask, useNow } from './helpers'
import { actionReason, policyHours, policyAction } from './action-rules'
const state=()=>useStore.getState()

export function Busy(){
 const until=useStore(s=>s.sim?.busyUntil),label=useStore(s=>s.sim?.busyLabel),started=useStore(s=>s.sim?.busyStartedAt)
 return until?<BusyProgress key={until} until={until} start={started??until-3000} label={label??'Your activity'}/>:null
}
function BusyProgress({until,start,label}:{until:number;start:number;label:string}){const[now,setNow]=useState(serverNow);useEffect(()=>{const timer=setInterval(()=>setNow(serverNow()),100);return()=>clearInterval(timer)},[]);return <div className="busy-card" role="status"><span className="semantic-tile energy"><Icon name="zap"/></span><span><strong>{label}</strong><small>{until>now?`${Math.max(1,Math.ceil((until-now)/1000))}s to go`:'Finishing…'}</small></span><progress aria-label="Activity progress" max={Math.max(1,until-start)} value={Math.max(0,now-start)}/></div>}
function useLocation(){
 const selected=useStore(s=>s.selectedLoc),world=useStore(s=>s.world),cityId=useStore(s=>s.city),sim=useStore(s=>s.sim),clock=useStore(s=>s.clock),policy=useStore(s=>s.mayor?.mayor?.policy),now=useNow()
 const city=world?.cities.find(c=>c.id===cityId),home=selected==='home',place=city?.landmarks.find(l=>l.id===selected),open=policyHours(place?.open??[0,24],place?.category??'',policy)
 const hour=clock?((clock.hour*60+clock.minute+Math.floor((now-clock.at)/clock.msPerMinute))%1440)/60:12
 const closed=open[0]<open[1]?hour<open[0]||hour>=open[1]:hour<open[0]&&hour>=open[1]
 const actions=(home?city?.homeActions:place?.actions)?.filter(a=>a.id!=='visit-workplace'&&(!a.id.startsWith('shift-')||sim?.job?.track===a.requires?.job)).map(a=>policyAction({...a,pay:a.requires?.job?sim?.job?.payPerHour??a.pay:a.pay},place?.category??'',policy,hour)).sort((a,b)=>Number(!!b.requires?.job)-Number(!!a.requires?.job))??[]
 const primary=actions.find(a=>a.requires?.job)??actions.find(a=>!sim||!actionReason(a,sim,closed,now))??actions[0]
 return{selected,world,cityId,sim,now,city,home,place,closed,actions,primary}
}
async function perform(city:Sim['city'],loc:string,a:Action){const r=await api.act(city,loc,a.id);state().setSim(r.sim);state().setLastResult(r.result)}
export function LocationPrimary(){
 const{selected,cityId,sim,closed,now,primary,world}=useLocation(),{working,error,run}=useTask(true)
 if(!sim)return <button className="primary full" onClick={()=>state().openPanel('play')}>Start a life here<ChevronRight size={20}/></button>
 if(sim.busyUntil)return <Busy/>
 if(sim.city!==cityId)return <button className="primary primary-action" aria-label={selected==='home'?'Find a flight home':'Go to your airport'} onClick={()=>{state().selectLocation(`${sim.city}Airport`);state().setFocus(`${sim.city}Airport`)}}><Icon name="plane"/><span>{selected==='home'?'Find a flight home':'Go to your airport'}<small>Fly here to take part.</small></span></button>
 if(!selected)return null
 const p=sim.position,door=doorsFor(sim)[selected as keyof ReturnType<typeof doorsFor>],near=door&&p&&!p.room&&Math.hypot(door.x-p.x,door.z-p.z)<3,type=interiorType(world,cityId,selected)
 if(p?.room)return <button className="primary full" onClick={()=>state().openPanel(null)}>{p.place===selected?'Return to your room':'Leave the room to travel'}</button>
 if(!near)return <><button className="primary full" disabled={working||!!sim.pendingBeat} onClick={()=>run(async()=>{const r=await api.travel(cityId,selected);state().setSim(r.sim);state().openPanel(null)})}>Travel here<small>Map shortcut · 2 seconds</small></button><ErrorMessage text={error}/></>
 if(type)return <><button className="primary full" disabled={working||closed&&selected!=='home'} onClick={()=>run(()=>enterBuilding(selected))}>{closed&&selected!=='home'?'Closed right now':`Enter ${selected==='home'?'home':door.name}`}</button><ErrorMessage text={error}/></>
 if(!primary)return null
 const blocked=actionReason(primary,sim,closed,now),pay=primary.pay
 return <><button className="primary primary-action" disabled={working||!!blocked} onClick={()=>run(()=>perform(cityId,selected,primary))}><Icon name={primary.icon}/><span>{primary.label}<small>{blocked||`${pay>0?`Earn ${money(pay)}`:primary.cost?money(primary.cost):'Free'} · ${primary.durationMin} min`}</small></span><ChevronRight size={20}/></button><ErrorMessage text={error}/></>
}
export function LocationPanel(){
 const{selected,world,cityId,sim,now,city,home,place,closed,actions,primary}=useLocation(),{working,error,run}=useTask(true)
 if(!city||!selected||(!home&&!place))return <p className="intro">Choose a pin on the map to explore.</p>
 if(home)return <p className="intro">Step inside, then walk to the stove to cook, the bed to sleep, the shower to freshen up or the couch for company. Use E or your interact button.</p>
 if(interiorType(world,cityId,selected))return <p className="intro">Enter through the door, then walk to the desk to apply or work a shift. Use E or your interact button.</p>
 if(sim&&sim.city===cityId&&sim.loc!==selected)return <p className="intro">Walk to the door, or use Travel here as a map shortcut.</p>
 const jobs=world?.careers.filter(c=>c.levels[0].city===cityId&&c.levels[0].loc===selected)??[]
 return <><p className="intro">{home?'Rest, recharge, and make room for what comes next.':place!.blurb}</p>{sim&&sim.city===cityId&&<><div className="actions-list">{actions.filter(a=>a.id!==primary?.id&&a.label!==sim.busyLabel).map(a=>{const blocked=actionReason(a,sim,closed,now),pay=a.pay;return <button key={a.id} className={`activity ${a.kind}`} disabled={working||!!blocked} onClick={()=>run(()=>perform(cityId,selected,a))}><span className={`semantic-tile ${a.kind}`}><Icon name={a.icon}/></span><span className="activity-main"><strong>{a.label}</strong><small>{blocked||`${a.durationMin} min · ${pay>0?`Earn ${money(pay)}`:a.cost>0?money(a.cost):'Free'}`}</small><span className="effect-line">{Object.entries(a.needs).filter(([,v])=>v>0).map(([k,v])=>`${k} +${v}`).join(' · ')||Object.keys(a.skills).map(k=>`${k} XP`).join(' · ')}</span></span><ChevronRight size={20}/></button>})}</div>{jobs.length>0&&!sim.job&&<button className="secondary full" onClick={()=>state().openPanel('jobs')}><Icon name="briefcase"/> Find a role here</button>}<ErrorMessage text={error}/></>}</>
}
export function JobPrimary(){const sim=useStore(s=>s.sim);if(!sim?.job)return null;if(sim.busyUntil)return <Busy/>;return <button className="primary primary-action" onClick={()=>{state().selectLocation(sim.job!.loc);state().setFocus(sim.job!.loc)}}><Icon name="briefcase"/><span>Go to work<small>{sim.job.title} · {money(sim.job.payPerHour)} per shift</small></span><ChevronRight size={18}/></button>}
export function JobsPanel(){
 const clock=useStore(s=>s.clock),policy=useStore(s=>s.mayor?.mayor?.policy),now=useNow(),city=useStore(s=>s.city),sim=useStore(s=>s.sim),world=useStore(s=>s.world),[listing,setListing]=useState<{city:string;jobs:Job[];error:string}>({city:'',jobs:[],error:''}),{working,error,run}=useTask(),jobs=listing.city===city?listing.jobs:[],loading=listing.city!==city,loadError=listing.city===city?listing.error:''
 useEffect(()=>{let live=true;api.jobs(city).then(r=>{if(live)setListing({city,jobs:r.jobs.filter(j=>j.level===1),error:''})}).catch(e=>{if(live)setListing({city,jobs:[],error:e.message})});return()=>{live=false}},[city])
 if(!sim)return <button className="primary full" onClick={()=>state().openPanel('play')}>Start your life first</button>
 async function apply(job:Job){state().selectLocation(job.loc);state().setFocus(job.loc)}

 return <>{sim.job?<><PromotionProgress sim={sim}/><button className="text-button" disabled={working} onClick={()=>run(async()=>{const r=await api.quitJob();state().setSim(r.sim)})}>Leave this role</button></>:<><p className="intro">Pick an entry role, visit its workplace, then apply while it is open.</p>{sim.busyUntil&&<Busy/>}{loading&&<p role="status">Finding opportunities…</p>}{jobs.map(job=>{const place=world?.cities.find(c=>c.id===job.city)?.landmarks.find(l=>l.id===job.loc),open=policyHours(place?.open??[0,24],place?.category??'',policy),hour=clock?((clock.hour*60+clock.minute+Math.max(0,now-clock.at)/clock.msPerMinute)%1440)/60:12,closed=open[0]<open[1]?hour<open[0]||hour>=open[1]:hour<open[0]&&hour>=open[1];return <div key={job.id} className="job-card"><div><span className="eyebrow">{job.track}</span><h3>{job.title}</h3><p>{world?.cities.find(c=>c.id===job.city)?.landmarks.find(l=>l.id===job.loc)?.name}</p></div><div className="job-offer"><strong>{money(job.payPerHour)}<small>per shift</small></strong><button className="secondary" disabled={working||sim.city!==job.city||!!sim.busyUntil||!!sim.pendingBeat||closed} title={closed?'Workplace closed':undefined} onClick={()=>run(()=>apply(job))}>{sim.loc===job.loc?'Find the desk':'Find workplace'}<ChevronRight size={16}/></button></div>{closed&&<small>Closed · Opens at {open[0]}:00</small>}</div>})}{!loading&&!loadError&&jobs.length===0&&<p className="notice">No jobs listed in this city yet.</p>}</>}<ErrorMessage text={error||loadError}/></>
}
export function SimPanel(){
 const sim=useStore(s=>s.sim)!,world=useStore(s=>s.world)!,user=useStore(s=>s.user)
 return <><div className="sim-profile"><Avatar look={sim.look} size={64}/><div><h3>{sim.username}</h3><p>Level {sim.level} · Feeling {sim.mood}</p><small>{sim.xp} / {sim.xpNext} XP</small></div><strong>{money(sim.cash)}</strong></div><SectionTitle icon="heart-pulse">A little care goes a long way</SectionTitle><div className="needs-grid">{Object.entries(sim.needs).map(([id,n])=><div key={id} className={`need ${id} ${n<25?'need-low':''}`}><div><span className={`semantic-tile ${id}`}><Icon name={id==='energy'?'zap':id==='hunger'?'utensils':id==='fun'?'sparkles':'users'}/></span><span>{id}</span><strong>{Math.round(n)}<small> / 100</small></strong></div><meter aria-label={id} min={0} max={100} low={25} high={75} optimum={100} value={n}/></div>)}</div><button className="secondary full" onClick={()=>{state().selectLocation('home');state().setFocus('home')}}><Icon name="house" size={17}/> Recharge at home</button><SectionTitle icon="trophy">Today's small wins</SectionTitle><div className="goals-list">{sim.daily.map(g=><div className={g.done?'goal done':'goal'} key={g.id}><span className="goal-check">{g.done?<Check size={16}/>:<Icon name={g.icon} size={16}/>}</span><div><strong>{g.text}</strong><small>{g.done?'Done':`${g.progress} / ${g.target}`} · {money(g.reward.cash??0)} reward</small></div></div>)}</div><AspirationProgress sim={sim}/><StoryJournal sim={sim}/><SectionTitle icon="book-open">Practice makes progress</SectionTitle><div className="skills-list">{world.skills.map(info=>{const skill=sim.skills[info.id];return <div key={info.id}><Icon name={info.icon} size={18}/><span>{info.label}<progress max={skill.next} value={skill.xp} aria-label={`${info.label} progress`}/></span><strong>{skill.level}<small> / 10</small></strong></div>})}</div>{user?.guest&&<button className="secondary full" onClick={()=>state().openPanel('signup')}>Save this life with an account</button>}<button className="text-button" onClick={()=>state().openPanel('worlds')}>Switch worlds</button></>
}
export function StoryPanel({beat}:{beat:StoryBeat}){const{working,error,run}=useTask(),[outcome,setOutcome]=useState('');return <><span className="story-icon"><Icon name={beat.icon} size={32}/></span><p className="story-body" aria-live="polite">{beat.body}</p>{outcome&&<p className="story-outcome" role="status">{outcome}</p>}<div className="story-choices">{beat.choices.map(c=><button className="mode-card" key={c.id} disabled={working} onClick={()=>run(async()=>{const r=await api.choose(beat.id,c.id);setOutcome(r.outcome.text);state().setSim(r.sim);state().setLastResult({text:r.outcome.text,deltas:r.outcome.deltas,busyUntil:null,leveledUp:false,promoted:null,goalsCompleted:[],beat:r.outcome.next})})}><span><strong>{c.label}</strong>{c.hint&&<small>{c.hint}</small>}</span><ChevronRight size={18}/></button>)}</div><ErrorMessage text={error}/></>}
