import type { CharacterPose } from './character'
import type { VisibleLife } from '../life-actions'
import { lifePose } from '../life-actions'

export type BodyCondition={tired:boolean;hungry:boolean;dirty:boolean}
export function bodyCondition(person:VisibleLife):BodyCondition{return {tired:(person.needs?.energy??100)<20,hungry:(person.needs?.hunger??100)<20,dirty:(person.needs?.hygiene??100)<20}}
export function visiblePose(person:VisibleLife):CharacterPose{return lifePose(person) as CharacterPose}
export function crowdPose(pose:string){return ({walk:1,run:2,jog:2,sit:3,type:4,work:4,dance:5,fun:5,cheer:6,food:7,eat:7,sleep:8,lie:8,wave:9,talk:10,hangout:10,shower:11,cook:12,interact:12} as Record<string,number>)[pose.toLowerCase()]??0}
