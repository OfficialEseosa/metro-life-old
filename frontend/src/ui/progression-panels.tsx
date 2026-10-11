import type { Sim } from '../api/types'
import { api } from '../api/client'
import { useStore } from '../store'
import { Check, ErrorMessage, Icon, SectionTitle } from './primitives'
import { money, useTask } from './helpers'

export function PromotionProgress({sim}:{sim:Sim}){
 const world=useStore(s=>s.world),job=sim.job!,next=world?.careers.find(c=>c.track===job.track)?.levels[job.level]
 return <div className="dream-card promotion-progress"><span className="eyebrow">CAREER LEVEL {job.level} OF 5</span>{next?<><h3>Next: {next.title}</h3><p>{money(next.payPerHour)} per shift · {world?.cities.find(c=>c.id===job.city)?.name}</p><div className="requirement"><Icon name={job.shifts>=job.shiftsToPromote?'check':'briefcase'}/><span>{Math.min(job.shifts,job.shiftsToPromote)} / {job.shiftsToPromote} shifts in this role</span></div>{Object.entries(next.requires.skills??{}).map(([skill,level])=><div className="requirement" key={skill}><Icon name={sim.skills[skill as keyof Sim['skills']].level>=level?'check':'book-open'}/><span>{skill}: {sim.skills[skill as keyof Sim['skills']].level} / {level}</span></div>)}<progress aria-label="Shifts toward promotion" max={job.shiftsToPromote} value={Math.min(job.shifts,job.shiftsToPromote)}/><small>Meet both requirements. Your next completed shift earns the promotion.</small></>:<><h3>You reached the top.</h3><p>Keep building your skills, or explore a new career.</p></>}</div>
}

export function AspirationProgress({sim}:{sim:Sim}){
 const world=useStore(s=>s.world),{working,error,run}=useTask(),a=sim.aspiration,definition=world?.aspirations.find(d=>d.id===a?.id)
 if(!a)return null
 return <><SectionTitle icon={definition?.icon??'rocket'}>{a.label}</SectionTitle><div className="dream-card"><span className="eyebrow">{a.step===a.total?'DREAM COMPLETE':`STEP ${a.step+1} OF ${a.total}`}</span><p>{a.current?.text??'You made your dream happen.'}</p>{a.current&&<small>{money(a.current.reward.cash??0)} + {a.current.reward.xp} XP when complete</small>}<progress max={a.total} value={a.step} aria-label="Aspiration progress"/><ol className="milestone-list">{definition?.milestones.map((m,i)=><li key={m.id} className={i<a.step?'complete':i===a.step?'current':''}>{i<a.step&&<Check size={16}/>}<span>{m.text}</span></li>)}</ol><label className="field">Choose a dream<select aria-label="Choose a dream" value={a.id} disabled={working||!!sim.busyUntil||!!sim.pendingBeat} onChange={e=>{const id=e.target.value;run(async()=>{const r=await api.setAspiration(id);useStore.getState().setSim(r.sim)})}}>{world?.aspirations.map(d=><option key={d.id} value={d.id}>{d.label}</option>)}</select></label><small>Completed steps stay earned when you change dreams. New steps are checked after activities.</small></div><ErrorMessage text={error}/></>
}
