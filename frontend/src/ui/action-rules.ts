import { serverNow } from '../server-time'
import type { Action, Landmark, Sim } from '../api/types'
import { money } from './helpers'
type WorkSchedule={open:number;close:number;lastDay:number;canWork:boolean;reason:string;gigsToday?:number;gigLimit?:number;hoursLabel?:string}
export function actionReason(a:Action,sim:Sim,closed:boolean,now:number){
 if(sim.busyUntil&&sim.busyUntil>now)return 'Finish your current activity first'
 if(sim.pendingBeat)return 'Choose your story first'
 if(closed)return 'Closed right now'
 if(sim.cash<Math.max(a.cost,a.requires?.cash??0))return `Needs ${money(Math.max(a.cost,a.requires?.cash??0))}`
 if(a.requires?.job&&sim.job?.track!==a.requires.job)return 'Apply for this job first'
 const schedule=(sim as Sim&{shiftSchedule?:WorkSchedule;workGigsToday?:number}).shiftSchedule
 if(a.requires?.job&&schedule&&!schedule.canWork)return schedule.reason||'Your next paid shift is tomorrow'
 if(!a.requires?.job&&a.kind==='work'&&a.pay>0&&(schedule?.gigsToday??(sim as Sim&{workGigsToday?:number}).workGigsToday??0)>=(schedule?.gigLimit??3))return 'Three paid gigs are done for today. Try again tomorrow.'
 if(a.requires?.level&&sim.level<a.requires.level)return `Level ${a.requires.level} required`
 for(const[skill,value]of Object.entries(a.requires?.skills??{}))if(sim.skills[skill as keyof Sim['skills']].level<value)return `${skill} level ${value} required`
 return ''
}
export function matchesLens(place:Landmark,lens:string,sim:Sim|null){return lens==='all'||place.actions.some(a=>lens==='eat'?(a.needs.hunger??0)>0:lens==='earn'?a.pay>0&&(!a.requires?.job||a.requires.job===sim?.job?.track):lens==='fun'?(a.needs.fun??0)>0:!!sim&&!actionReason(a,{...sim,busyUntil:null},false,serverNow()))}

export function policyHours(open:[number,number],category:string,policy:string|null|undefined):[number,number]{if(open[0]===0&&open[1]===24)return open;return policy==='parks'&&category==='park'||policy==='arts'&&category==='culture'?[open[0],24]:policy==='nightlife'&&category==='nightlife'?[open[0],4]:open}
export function policyAction(a:Action,category:string,policy:string|null|undefined,hour:number):Action{return {...a,cost:policy==='transit'&&category==='transport'&&!a.to||policy==='arts'&&category==='culture'&&hour>=18&&!a.requires?.job?0:a.cost,pay:policy==='smallbiz'&&a.kind==='work'?Math.floor(a.pay*1.05):a.pay}}

export function workCareNote(sim:Sim){return sim.mood==='rough'||sim.mood==='low'?'Low needs: pay is 30% lower. You can still work.':''}
