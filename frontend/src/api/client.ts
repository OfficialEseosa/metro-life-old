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
  WorldInfo,
} from './types'
import { syncServerTime } from '../server-time'

let mutationRevision=0,mutations=0

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
  if(data?.now||data?.clock?.at)syncServerTime(data.now??data.clock.at,performance.now()-started)
  return data as T
  } finally {if(mutation){mutations--;mutationRevision++}}
}

const q = (city?: CityId) => (city ? `?city=${city}` : '')

export const api = {
  world: () => req<World>('GET', '/api/world'),
  stats: () => req<Stats>('GET', '/api/stats'),
  version: () => req<{ build: string }>('GET', '/api/version'),
  daily: (city?: CityId) => req<Daily>('GET', `/api/daily${q(city)}`),

  me: () => req<Me>('GET', '/api/auth/me'),
  guest: (username?: string) => req<{ user: User }>('POST', '/api/auth/guest', { username }),
  signup: (username: string, password: string, look?: Partial<Look>) =>
    req<{ user: User }>('POST', '/api/auth/signup', { username, password, look }),
  login: (username: string, password: string) => req<{ user: User }>('POST', '/api/auth/login', { username, password }),
  logout: () => req<{ ok: true }>('POST', '/api/auth/logout'),

  worlds: () => req<{ worlds: WorldInfo[]; current: string | null }>('GET', '/api/worlds'),
  createWorld: (name: string, mode: 'solo' | 'private') => req<{ world: WorldInfo }>('POST', '/api/worlds', { name, mode }),
  joinWorld: (code: string) => req<{ world: WorldInfo }>('POST', '/api/worlds/join', { code }),
  selectWorld: (worldId: string) => req<{ world: WorldInfo; sim: Sim | null }>('POST', '/api/worlds/select', { worldId }),

  sim: () => req<{ sim: Sim; clock: Clock }>('GET', '/api/sim'),
  setupSim: (setup: { city: CityId; neighborhood: string; aspiration: string; look?: Partial<Look> }) =>
    req<{ sim: Sim }>('POST', '/api/sim/setup', setup),
  act: (city: CityId, loc: string, action: string) =>
    req<{ sim: Sim; result: ActResult }>('POST', '/api/act', { city, loc, action }),
  choose: (beatId: string, choice: string) =>
    req<{ sim: Sim; outcome: StoryOutcome }>('POST', '/api/story/choose', { beatId, choice }),
  moveHome: (city: CityId, neighborhood: string) => req<{ sim: Sim }>('POST', '/api/home/move', { city, neighborhood }),
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
  buyPlot: (plot: { city: CityId; x: number; y: number; w: number; h: number; title: string; link: string }) =>
    req<{ ad: PlotAd; sim: Sim }>('POST', '/api/plots', plot),
  billboards: (city?: CityId) => req<Billboards>('GET', `/api/billboards${q(city)}`),
  bookBillboard: (city: CityId, slot: number, title: string, link: string) =>
    req<{ ad: BillboardAd; sim: Sim }>('POST', '/api/billboards', { city, slot, title, link }),
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
