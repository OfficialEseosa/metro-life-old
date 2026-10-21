import { motion, useWalking } from './walking'
import { serverNow, syncServerTime } from './server-time'
import { create } from 'zustand'
import { api, connectSocket } from './api/client'
import type {
  ActResult,
  Billboards,
  ChatMessage,
  CityId,
  Clock,
  Daily,
  Homes,
  MayorState,
  Player,
  Plots,
  ServerEvent,
  Sim,
  Stats,
  Rect,
  User,
  World,
  WorldInfo,
} from './api/types'

export type Panel =
  | null
  | 'creator'
  | 'city'
  | 'settings'
  | 'location' // selectedLoc (landmark id or "home")
  | 'sim' // needs, skills, goals, aspiration
  | 'jobs'
  | 'people'
  | 'chat'
  | 'mayor'
  | 'plots'
  | 'billboard' // selectedSlot
  | 'homes'


export type CityData = 'daily' | 'mayor' | 'plots' | 'billboards' | 'homes' | 'players' | 'chat'

type State = {
  sceneFailed: boolean
  acting: boolean
  ready: boolean
  loadError: string | null
  // static content
  world: World | null
  // session
  user: User | null
  worldInfo: WorldInfo | null
  sim: Sim | null
  clock: Clock | null
  stats: Stats | null
  socialNotice: string
  connected: boolean
  // the city map being looked at (may differ from sim.city)
  city: CityId
  sceneQuality: 'normal' | 'low'
  wallMode: 'up' | 'cutaway' | 'down'
  setWallMode: (mode: 'up' | 'cutaway' | 'down') => void
  setSceneQuality: (quality: 'normal' | 'low') => void
  sceneTheme: 'auto' | 'day' | 'night'
  mapLens: 'all' | 'eat' | 'earn' | 'fun' | 'affordable'
  searchOpen: boolean
  setSearchOpen: (open:boolean) => void
  needWarningDismissed: string
  dismissNeedWarning: (need:string) => void
  setMapLens: (lens: State['mapLens']) => void
  hudInsets: {top:number;right:number;bottom:number;left:number}
  setHudInsets: (insets: State['hudInsets']) => void
  cameraMoving: boolean
  setCameraMoving: (moving:boolean) => void
  rewardAnchor: {x:number;y:number}|null
  setRewardAnchor: (anchor: State['rewardAnchor']) => void
  setSceneTheme: (theme: 'auto' | 'day' | 'night') => void
  // per viewed city
  daily: Daily | null
  mayor: MayorState | null
  plots: Plots | null
  billboards: Billboards | null
  homes: Homes | null
  players: Player[]
  chat: ChatMessage[]
  // ui <-> scene
  panel: Panel
  selectedLoc: string | null
  selectedSlot: number | null
  plotSelection: Rect | null
  setPlotSelection: (rect:Rect) => void
  /** set by the UI to make the scene camera fly to a landmark id, "plots", "homes" or "home"; the scene clears it */
  focus: string | null
  /** last action result, for a toast; the UI clears it */
  lastResult: ActResult | null

  load: () => Promise<void>
  /** re-read session, world info, sim and clock (after login, world switch, etc.), then the city data */
  syncSession: () => Promise<void>
  changeSession: (change: () => Promise<unknown>) => Promise<void>
  setCity: (city: CityId) => Promise<void>
  refresh: (...what: CityData[]) => Promise<void>
  setSim: (sim: Sim | null) => void
  setUser: (user: User | null) => void
  setMayor: (m: MayorState) => void
  setLastResult: (r: ActResult | null) => void
  openPanel: (p: Panel) => void
  selectLocation: (id: string | null) => void
  selectSlot: (slot: number | null) => void
  travelTo: (location:string, afterPanel?:Panel) => Promise<void>
  setFocus: (key: string | null) => void
}

const safe = <T,>(p: Promise<T>) => p.catch(() => null)
let socket: ReturnType<typeof connectSocket> | null = null
let loading: Promise<void> | null = null
let resultTimer:ReturnType<typeof setTimeout>|null=null
let panelTrigger:HTMLElement|null=null
export const getPanelTrigger=()=>panelTrigger
function rememberTrigger(){const active=document.activeElement;if(active instanceof HTMLElement&&active.matches('button')&&!active.closest('.sheet'))panelTrigger=active}
const realtimeEnabled = true
let socketEpoch=0,presenceRevision=0,resourceRevision=0,sessionChanging=false
let indoorTravelPending=false
export const mergeChat=(current:ChatMessage[],incoming:ChatMessage[])=>[...new Map([...current,...incoming].map(m=>[m.id,m])).values()].sort((a,b)=>a.at-b.at||a.id.localeCompare(b.id)).slice(-50)

export const useStore = create<State>((set, get) => {
  const onEvent = (e: ServerEvent) => {
    const { city } = get()
    switch (e.type) {
      case 'hello':
      case 'clock':
        syncServerTime(e.clock.at)
        set({ clock: e.clock })
        break
      case 'presence':
        if (e.city === city){presenceRevision++;set({ players: e.players })}
        break
      case 'positions':
        if(e.city===city){presenceRevision++;const positions=new Map(e.players.map(p=>[p.id,p]));set(s=>({players:s.players.map(p=>positions.has(p.id)?{...p,...positions.get(p.id)}:p)}))}
        break
      case 'chat':
        if (e.message.city === city)set(s=>({chat:mergeChat(s.chat,[e.message])}))
        break
      case 'event':
        if(e.kind==='story'){const wid=get().worldInfo?.id;void api.sim().then(r=>{if(get().worldInfo?.id===wid){const travelled=r.sim.city!==get().sim?.city;get().setSim(r.sim);set({clock:r.clock});if(travelled){void get().setCity(r.sim.city);get().selectLocation(r.sim.loc);get().setFocus(r.sim.loc)}}}).catch(()=>{});if(e.text)set({socialNotice:e.text})}else if(e.city===city)void get().refresh(e.kind)
        break
    }
  }

  const reconnect = () => {
    socket?.close()
    const epoch=++socketEpoch
    if(!get().user){socket=null;set({connected:false});return}
    socket = connectSocket(e=>{if(epoch===socketEpoch)onEvent(e)}, (connected) => {
      if(epoch!==socketEpoch)return
      set({ connected })
      if (connected){socket?.send({ type: 'view', city: get().city });void get().refresh('players','chat','mayor','plots','billboards','homes')}
    })
  }

  return {
    sceneFailed: false,
    acting: false,
    ready: false,
    loadError: null,
    world: null,
    user: null,
    worldInfo: null,
    sim: null,
    clock: null,
    stats: null,
    connected: false,
    socialNotice: '',
    city: 'atl',
    sceneQuality: (()=>{try{return localStorage.getItem('metro-quality')==='low'?'low':'normal'}catch{return 'normal'}})(),
    wallMode: 'cutaway',
    setWallMode: (wallMode) => set({wallMode}),
    setSceneQuality: (sceneQuality) => {try{localStorage.setItem('metro-quality',sceneQuality)}catch{/* Session preference still works with blocked storage. */}set({sceneQuality})},
    sceneTheme: 'auto',
    mapLens: 'all',setMapLens:mapLens=>set({mapLens}),
    searchOpen:false,setSearchOpen:searchOpen=>set(searchOpen?{searchOpen,panel:null}:{searchOpen}),
    needWarningDismissed:'',dismissNeedWarning:needWarningDismissed=>set({needWarningDismissed}),
    hudInsets:{top:0,right:0,bottom:0,left:0},setHudInsets:hudInsets=>set({hudInsets}),
    cameraMoving:false,setCameraMoving:cameraMoving=>set({cameraMoving}),
    rewardAnchor:null,setRewardAnchor:rewardAnchor=>set({rewardAnchor}),
    setSceneTheme: (sceneTheme) => set({ sceneTheme }),
    daily: null,
    mayor: null,
    plots: null,
    billboards: null,
    homes: null,
    players: [],
    chat: [],
    panel: null,
    selectedLoc: null,
    selectedSlot: null,
    plotSelection:null,setPlotSelection:plotSelection=>set({plotSelection}),
    focus: null,
    lastResult: null,

    load: () => {
      if (loading) return loading
      loading=(async()=>{try{const [world,stats]=await Promise.all([api.world(),api.stats()]);set({world,stats,loadError:null});await api.guest();await get().syncSession()}catch(error){set({loadError:error instanceof Error?error.message:'Could not reach the city. Try again.'})}finally{set({ready:true});loading=null}})()
      return loading
    },

    changeSession: async (change) => {
      const panel=get().panel
      sessionChanging=true;resourceRevision++;socketEpoch++;socket?.close();socket=null
      set({plots:null,billboards:null,players:[],chat:[],connected:false})
      // Let layout-effect image cleanup abort old-world requests before changing the cookie.
      await new Promise<void>(resolve=>setTimeout(resolve,0))
      try{await change();await api.guest();await get().syncSession()}catch(error){await get().syncSession();set({panel});throw error}
    },

    syncSession: async () => {
      const me = await safe(api.me())
      const city = me?.sim?.city ?? get().city
      if(resultTimer)clearTimeout(resultTimer);resultTimer=null;presenceRevision++
      set({ user: me?.user ?? null, worldInfo: me?.world ?? null, sim: me?.sim ?? null, clock: me?.clock ?? null, city,players:[],chat:[],socialNotice:'', mayor:null,plots:null,billboards:null,homes:null,plotSelection:null,lastResult:null,selectedLoc:null,selectedSlot:null,searchOpen:false,rewardAnchor:null,focus:null,panel:null,acting:false })
      sessionChanging=false;resourceRevision++
      // Civic and live resources become available in M6/M7; do not poll absent routes.
      if (realtimeEnabled) reconnect()
      await get().refresh('daily','mayor','plots','billboards')
    },

    setCity: async (city) => {
      if (city === get().city) return
      set({ city, daily: null, mayor: null, plots: null, billboards: null, homes: null, players: [], chat: [], selectedLoc: null, selectedSlot: null,plotSelection:null, panel:null,focus:'overview' })
      socket?.send({ type: 'view', city })
      await get().refresh('daily','mayor','plots','billboards')
    },

    refresh: async (...what) => {
      if(sessionChanging)return
      const city = get().city,worldId=get().worldInfo?.id,presenceAtStart=presenceRevision,revision=resourceRevision
      const jobs: Promise<void>[] = []
      const put = <K extends keyof State>(key: K, p: Promise<State[K] | null>) =>
        jobs.push(
          p.then((v) => {
            // drop the result if the user switched city meanwhile
            if(sessionChanging||revision!==resourceRevision||get().city!==city||get().worldInfo?.id!==worldId||v===null)return
            if(key==='chat'){set(s=>({chat:mergeChat(s.chat,v as ChatMessage[])}));return}
            if(key==='players'&&presenceRevision!==presenceAtStart)return
            set({[key]:v} as Pick<State,K>)
          }),
        )
      for (const w of what) {
        if (w === 'daily') put('daily', safe(api.daily(city)))
        if (w === 'mayor') put('mayor', safe(api.mayor(city)))
        if (w === 'plots') put('plots', safe(api.plots(city)))
        if (w === 'billboards') put('billboards', safe(api.billboards(city)))
        if (w === 'homes') put('homes', safe(api.homes(city)))
        if (w === 'players') put('players', safe(api.players(city).then((r) => r.players)))
        if (w === 'chat') put('chat', safe(api.chat(city).then((r) => r.messages)))
      }
      await Promise.all(jobs)
    },

    setSim: (sim) => {if(indoorTravelPending)return;if(sim&&sim.worldId!==get().worldInfo?.id)return;const travelled=sim&&get().sim&&sim.city!==get().sim?.city;if(sim?.position&&motion.position&&(sim.position.room!==motion.position.room||Math.hypot(sim.position.x-motion.position.x,sim.position.z-motion.position.z)>4)){motion.teleport++;motion.position={...sim.position};useWalking.setState({position:{...sim.position}});motion.follow=true;motion.wake()}set({sim});if(travelled&&sim){void get().setCity(sim.city);get().selectLocation(sim.loc);get().setFocus(sim.loc)}},
    setUser: (user) => set({ user }),
    setMayor: (mayor) => set({ mayor }),
    setLastResult: (lastResult) => {
      if(resultTimer)clearTimeout(resultTimer);resultTimer=null
      const wait=(lastResult?.busyUntil??0)-serverNow(),worldId=get().sim?.worldId,sourceCity=get().sim?.city
      if(lastResult&&wait>0){
        set({lastResult:null,rewardAnchor:null})
        const complete=async()=>{if(get().sim?.worldId!==worldId)return;try{
          const r=await api.sim();if(get().sim?.worldId!==worldId)return
          if(r.sim.busyUntil&&r.sim.busyUntil>serverNow()){resultTimer=setTimeout(()=>void complete(),150);return}
          get().setSim(r.sim);set({clock:r.clock,lastResult,rewardAnchor:null})
          if(r.sim.city!==sourceCity){await get().setCity(r.sim.city);get().selectLocation(r.sim.loc);get().setFocus(r.sim.loc)}
          resultTimer=null
        }catch{if(get().sim?.worldId===worldId)resultTimer=setTimeout(()=>void complete(),1000)}}
        resultTimer=setTimeout(()=>void complete(),wait+40)
      }else set({lastResult,rewardAnchor:null})
    },
    openPanel: (panel) => {if(panel)rememberTrigger();set(panel?{panel,searchOpen:false}:{panel})},
    selectLocation: (id) => {
      if(id)rememberTrigger()
      const targetCity=id==='home'?get().sim?.home.city:get().world?.cities.find(c=>c.landmarks.some(l=>l.id===id))?.id
      if(targetCity&&targetCity!==get().city)void get().setCity(targetCity)
      set({ selectedLoc: id, panel: id ? 'location' : null,searchOpen:false })
    },
    selectSlot: (slot) => set({ selectedSlot: slot, panel: slot === null ? null : 'billboard' }),
    travelTo: async (destination,afterPanel=null) => {
      const state=get(),sim=state.sim
      if(!sim||state.city!==sim.city||indoorTravelPending)return
      if(sim.busyUntil||sim.pendingBeat){useWalking.setState({error:sim.busyUntil?'Finish this activity before travelling.':'Make your story choice before travelling.'});return}
      indoorTravelPending=true;set({focus:null,acting:true});motion.x=motion.z=0
      const world=sim.worldId
      try{
        await motion.flush();motion.revision++
        const current=get().sim!
        const alreadyThere=!current.position?.room&&current.position?.place===destination
        let result=alreadyThere?await api.sim():await api.travel(sim.city,destination)
        if(get().sim?.worldId!==world)return
        set({sim:result.sim,clock:result.clock,searchOpen:false,cameraMoving:false})
        const deadline=Date.now()+15000
        while(result.sim.busyUntil){
          if(Date.now()>deadline)throw Error('Your trip is taking longer than expected. Please try again.')
          await new Promise(resolve=>setTimeout(resolve,150));result=await api.sim()
          if(get().sim?.worldId!==world)return
        }
        motion.revision++;motion.teleport++;motion.position={...result.sim.position!};motion.follow=true
        useWalking.setState({position:{...result.sim.position!},error:''})
        set({sim:result.sim,clock:result.clock,panel:afterPanel,selectedLoc:destination,focus:null,cameraMoving:false})
        motion.wake();if(afterPanel==='mayor')await get().refresh('mayor')
      }catch(error){useWalking.setState({error:error instanceof Error?error.message:'Could not travel. Try again.'});throw error}
      finally{indoorTravelPending=false;set({acting:false})}
    },
    setFocus: (focus) => {
      const state=get(),sim=state.sim
      const destination=focus==='homes'?'home':focus
      const landmark=destination==='home'||state.world?.cities.find(c=>c.id===sim?.city)?.landmarks.some(l=>l.id===destination)
      if(destination&&landmark&&sim&&state.city===sim.city){void get().travelTo(destination).catch(()=>{});return}
      if(sim?.position?.room&&state.city===sim.city){set({focus:null});motion.follow=true;motion.wake();return}
      set({focus})
    },
  }
})
