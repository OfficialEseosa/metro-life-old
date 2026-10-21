import type {
  ActResult,
  BillboardAd,
  Billboards,
  ChatMessage,
  CityId,
  Clock,
  Daily,
  Homes,
  Job,
  Look,
  MayorState,
  Me,
  Player,
  PlotAd,
  Plots,
  ServerEvent,
  Sim,
  Stats,
  StoryOutcome,
  User,
  World,
  TransitState,
  TransitTrip,
  TransitMode,
} from './types'
import { syncServerTime } from '../server-time'
import { useStore } from '../store'
import { confirmPurchase } from '../ui/purchase-confirmation'

let mutationRevision=0,mutations=0,lastSimSnapshotAt=0

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const mutation=method!=='GET',revision=mutationRevision,started=performance.now()
  if(mutation){mutationRevision++;mutations++}
  try {
  let res: Response
  try{res = await fetch(path, {
    signal:AbortSignal.timeout(15000),
    method,
    credentials: 'include',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })}catch{throw new ApiError(0,'Could not reach the city. Check your connection and try again.')}
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new ApiError(res.status, data?.error ?? `Request failed (${res.status})`)
  if(path==='/api/sim'&&(mutations>0||revision!==mutationRevision))throw new ApiError(0,'A newer action is already in progress.')
  if(path==='/api/sim'&&data?.clock?.at<lastSimSnapshotAt)throw new ApiError(0,'A newer city update has already arrived.')
  if(data?.sim&&data?.clock?.at)lastSimSnapshotAt=Math.max(lastSimSnapshotAt,data.clock.at)
  if(data?.now||data?.clock?.at)syncServerTime(data.now??data.clock.at,performance.now()-started)
  return data as T
  } finally {if(mutation){mutations--;mutationRevision++}}
}

async function approvePurchase(amount:number,reason:string){if(!await confirmPurchase(amount,reason,useStore.getState().sim))throw new ApiError(0,'Purchase cancelled')}

const q = (city?: CityId) => (city ? `?city=${city}` : '')

export const api = {
  world: () => req<World>('GET', '/api/world'),
  stats: () => req<Stats>('GET', '/api/stats'),
  version: () => req<{ build: string }>('GET', '/api/version'),
  daily: (city?: CityId) => req<Daily>('GET', `/api/daily${q(city)}`),

  me: () => req<Me>('GET', '/api/auth/me'),
  guest: (username?: string) => req<{ user: User }>('POST', '/api/auth/guest', { username }),
  newLife: () => req<{user:User}>('POST','/api/life/new',{confirm:true}),
  finishIntro: () => req<{sim:Sim}>('POST','/api/intro/complete'),
  finishFirstDay: () => req<{sim:Sim}>('POST','/api/first-day/complete'),
  payFirstRent: () => req<{sim:Sim}>('POST','/api/home/rent'),
  outfit: async(style:string) => {const sim=useStore.getState().sim,owned=['casual','street'].includes(style)||style==='work'&&!!sim?.job||!!sim?.outfits?.[style];await approvePurchase(owned?0:style==='party'?90:120,`New ${style} outfit`);return req<{sim:Sim}>('POST','/api/sim/outfit',{style,confirm:true})},

  travel: (city:CityId,loc:string) => req<{sim:Sim;clock:Clock}>('POST','/api/travel',{city,loc}),
  transit: (city?:CityId) => req<TransitState>('GET',`/api/transit${q(city)}`),
  bookTransit: async(to:CityId,mode:TransitMode,confirmTimeAdvance=false) => {const state=useStore.getState(),routes=await req<TransitState>('GET',`/api/transit${q(state.sim?.city)}`),route=routes.routes.find(r=>r.to===to&&r.mode===mode);if(!route)throw new ApiError(0,'This departure is no longer available');const city=state.world?.cities.find(c=>c.id===to)?.name??to;await approvePurchase(route.fare,`${mode==='bus'?'Bus':'Plane'} ticket to ${city}. Visiting keeps your home.`);return req<{sim:Sim;clock:Clock}>('POST','/api/transit/book',{to,mode,confirmTimeAdvance,confirm:true})},
  napTransit: () => req<{sim:Sim;clock:Clock}>('POST','/api/transit/nap'),
  chatTransit: (text:string) => req<{message:ChatMessage;trip:TransitTrip;clock:Clock}>('POST','/api/transit/chat',{text}),
  door: (loc:string,enter:boolean) => req<{sim:Sim}>('POST','/api/door',{loc,enter}),
  posture: (bench:string|null) => req<{sim:Sim}>('POST','/api/posture',{bench}),
  move: (city:CityId,p:import('../navigation').Position) => req<{position:import('../navigation').Position}>('POST','/api/move',{city,...p}),
  sim: () => req<{ sim: Sim; clock: Clock }>('GET', '/api/sim'),
  setupSim: (setup: { traits?:string[];username:string;pronouns: 'she'|'he'|'they';city: CityId; neighborhood: string; aspiration: string; look?: Partial<Look> }) =>
    req<{ sim: Sim }>('POST', '/api/sim/setup', setup),
  act: async(city: CityId, loc: string, action: string, slotId?: string) => {const c=useStore.getState().world?.cities.find(c=>c.id===city),a=(loc==='home'?c?.homeActions:c?.landmarks.find(l=>l.id===loc)?.actions)?.find(a=>a.id===action);await approvePurchase(a?.cost??0,a?.label??'City activity');return req<{ sim: Sim; result: ActResult }>('POST', '/api/act', { city, loc, action, confirm:true, ...(slotId?{slotId}:{}) })},
  cancelAction: () => req<{sim:Sim;clock:Clock}>('POST','/api/action/cancel'),
  choose: (beatId: string, choice: string) =>
    req<{ sim: Sim; outcome: StoryOutcome }>('POST', '/api/story/choose', { beatId, choice }),
  moveHome: async(city: CityId, neighborhood: string) => {const c=useStore.getState().world?.cities.find(c=>c.id===city),home=c?.neighborhoods.find(n=>n.id===neighborhood);if(!home)throw new ApiError(0,'Choose a listed neighbourhood');await approvePurchase(home.rent,`Move your home to ${home.name}, ${c?.name??city}. One daily rent deposit; future daily rent is $${home.rent}.`);return req<{ sim: Sim }>('POST', '/api/home/move', { city, neighborhood,confirm:true })},
  setAspiration: (aspiration: string) => req<{ sim: Sim }>('POST', '/api/aspiration', { aspiration }),

  jobs: (city?: CityId) => req<{ jobs: Job[] }>('GET', `/api/jobs${q(city)}`),
  applyJob: (jobId: string) => req<{ sim: Sim; hired: boolean; reason?: string }>('POST', '/api/jobs/apply', { jobId }),
  quitJob: () => req<{ sim: Sim }>('POST', '/api/jobs/quit'),

  players: (city?: CityId) => req<{ players: Player[] }>('GET', `/api/players${q(city)}`),
  social: (targetId: string, kind: 'wave' | 'hangout' | 'gift', amount?: number) =>
    req<{ sim: Sim; text: string }>('POST', '/api/social', { targetId, kind, amount }),
  chat: (city?: CityId) => req<{ messages: ChatMessage[] }>('GET', `/api/chat${q(city)}`),
  say: (city: CityId, text: string) => req<{ message: ChatMessage }>('POST', '/api/chat', { city, text }),

  mayor: (city?: CityId) => req<MayorState>('GET', `/api/mayor${q(city)}`),
  mayorVote: (city: CityId, candidateId: string) => req<MayorState>('POST', '/api/mayor/vote', { city, candidateId }),
  mayorRun: (city: CityId, slogan: string) => req<MayorState>('POST', '/api/mayor/run', { city, slogan }),
  mayorPolicy: (city: CityId, policy: string) => req<MayorState>('POST', '/api/mayor/policy', { city, policy }),
  mayorAnnounce: (city: CityId, text: string) => req<MayorState>('POST', '/api/mayor/announce', { city, text }),

  plots: (city?: CityId) => req<Plots>('GET', `/api/plots${q(city)}`),
  buyPlot: async(plot: { city: CityId; x: number; y: number; w: number; h: number; title: string; link: string }) => {await approvePurchase(plot.w*plot.h*35,`Community plot booking: ${plot.w} by ${plot.h} cells for 7 days`);return req<{ ad: PlotAd; sim: Sim }>('POST', '/api/plots', {...plot,confirm:true})},
  billboards: (city?: CityId) => req<Billboards>('GET', `/api/billboards${q(city)}`),
  bookBillboard: async(city: CityId, slot: number, title: string, link: string) => {await approvePurchase(300,'Billboard booking for 3 days');return req<{ ad: BillboardAd; sim: Sim }>('POST', '/api/billboards', { city, slot, title, link,confirm:true })},
  homes: (city?: CityId) => req<Homes>('GET', `/api/homes${q(city)}`),
}

/** Reconnecting JSON socket. Returns a handle to send and close. */
export function connectSocket(onEvent: (e: ServerEvent) => void, onStatus?: (open: boolean) => void) {
  let ws: WebSocket | null = null
  let closed = false
  let retry = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  const queue: string[] = []

  const open = () => {
    if (closed) return
    const proto = location.protocol === 'https:' ? 'wss' : 'ws'
    ws = new WebSocket(`${proto}://${location.host}/ws`)
    ws.onopen = () => {
      retry = 0
      onStatus?.(true)
      while (queue.length) ws?.send(queue.shift()!)
    }
    ws.onmessage = (m) => {
      try {
        onEvent(JSON.parse(m.data as string) as ServerEvent)
      } catch {
        // ignore malformed frames
      }
    }
    ws.onclose = () => {
      if (closed) return
      onStatus?.(false)
      retry = Math.min(retry + 1, 6)
      timer = setTimeout(open, 500 * 2 ** retry)
    }
    ws.onerror = () => ws?.close()
  }
  open()

  return {
    send(msg: { type: 'view'; city: CityId } | { type: 'ping' }) {
      const text = JSON.stringify(msg)
      if (ws?.readyState === WebSocket.OPEN) ws.send(text)
      else if (msg.type !== 'ping') queue.splice(0, queue.length, text)
    },
    close() {
      closed = true
      clearTimeout(timer)
      ws?.close()
    },
  }
}

export { req as apiRequest }
