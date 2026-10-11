// The API contract. Backend JSON must match these shapes (see SPEC.md).

export type CityId = 'atl' | 'nyc' | 'bay'
export type SkillId = 'fitness' | 'cooking' | 'music' | 'tech' | 'charisma' | 'creativity' | 'business'
export type NeedId = 'energy' | 'hunger' | 'fun' | 'social'
export type Mood = 'great' | 'good' | 'okay' | 'low' | 'rough'
export type ActionKind = 'work' | 'fun' | 'food' | 'learn' | 'social' | 'civic' | 'travel' | 'rest'
export type CareerTrack = 'tech' | 'music' | 'sports' | 'food' | 'finance' | 'arts' | 'civic' | 'health'

export type Look = {
  body: 'f' | 'm'
  skin: string
  hair: string
  hairColor: string
  top: string
  bottom: string
  style: string
  shoeColor: string
}

export type User = {
  id: string
  username: string
  guest: boolean
  look: Look
  createdAt: number
}

export type WorldMode = 'public' | 'private' | 'solo'
export type WorldInfo = {
  id: string
  name: string
  mode: WorldMode
  /** join code, only for private worlds the user belongs to */
  code: string | null
  ownerId: string | null
  /** humans who have a sim here / humans connected right now */
  players: number
  online: number
}

export type Clock = {
  /** game day number, starting at 1 */
  day: number
  hour: number
  minute: number
  weekday: string
  /** real milliseconds per game minute */
  msPerMinute: number
  /** server time (epoch ms) this clock value was computed at */
  at: number
}

// ---- static world content -------------------------------------------------

export type Category = { label: string; icon: string; color: string }
export type Policy = { id: string; label: string; banner: string; icon: string; effect?: string }

export type Requires = {
  skills?: Partial<Record<SkillId, number>>
  cash?: number
  level?: number
  /** must hold a job on this track (and at this landmark for shift actions) */
  job?: CareerTrack
}

export type Action = {
  id: string
  label: string
  kind: ActionKind
  icon: string
  /** game minutes */
  durationMin: number
  cost: number
  pay: number
  xp: number
  needs: Partial<Record<NeedId, number>>
  skills: Partial<Record<SkillId, number>>
  requires?: Requires
  /** destination city for travel actions */
  to?: CityId
}

export type Landmark = {
  id: string
  name: string
  area: string
  category: string
  icon: string
  blurb: string
  /** [openHour, closeHour); [0, 24] is always open; close < open wraps past midnight */
  open: [number, number]
  actions: Action[]
}

export type Neighborhood = { id: string; name: string; rent: number; blurb?: string }

export type City = {
  id: CityId
  name: string
  short: string
  state: string
  tagline: string
  plotsName: string
  plots: { cols: number; rows: number }
  billboardSlots: number
  neighborhoods: Neighborhood[]
  landmarks: Landmark[]
  /** actions available at the pseudo-landmark "home" */
  homeActions: Action[]
}

export type CareerLevel = {
  level: number
  title: string
  city: CityId
  loc: string
  payPerHour: number
  requires: Requires
  shiftsToPromote: number
}
export type Career = { track: CareerTrack; label: string; icon: string; levels: CareerLevel[] }

export type Milestone = { id: string; text: string; reward: { cash?: number; xp?: number } }
export type Aspiration = { id: string; label: string; icon: string; blurb: string; milestones: Milestone[] }
export type SkillInfo = { id: SkillId; label: string; icon: string }

export type World = {
  currency: string
  startingCash: number
  categories: Record<string, Category>
  policies: Policy[]
  skills: SkillInfo[]
  careers: Career[]
  aspirations: Aspiration[]
  cities: City[]
}

// ---- sim ------------------------------------------------------------------

export type Job = {
  id: string
  track: CareerTrack
  level: number
  title: string
  city: CityId
  loc: string
  payPerHour: number
  requires: Requires
}

export type Goal = {
  id: string
  text: string
  icon: string
  progress: number
  target: number
  done: boolean
  reward: { cash?: number; xp?: number }
}

export type Sim = {
  userId: string
  worldId: string
  username: string
  look: Look
  city: CityId
  /** landmark id, "home", or null when just arrived */
  loc: string | null
  home: { city: CityId; neighborhood: string; rent: number }
  cash: number
  rentDebt?: number
  moneyToday?: { income: number; spent: number }
  xp: number
  level: number
  /** xp needed for the next level */
  xpNext: number
  needs: Record<NeedId, number>
  mood: Mood
  skills: Record<SkillId, { level: number; xp: number; next: number }>
  job: (Job & { shifts: number; shiftsToPromote: number }) | null
  aspiration: { id: string; label: string; step: number; total: number; current: Milestone | null; milestones?: (Milestone & { status: 'done' | 'ready' | 'current' | 'locked'; progress: number; target: number })[] } | null
  daily: Goal[]
  /** epoch ms until which the sim is busy with an action, or null */
  busyUntil: number | null
  /** Server start time for stable progress across refresh/reconnect. */
  busyStartedAt?: number | null
  busyLabel: string | null
  /** a story beat waiting for a choice */
  stories?: { id: string; title: string; city: CityId; loc: string; completedBeats: number; total: number; status: 'waiting' | 'choice' | 'complete'; canContinue: boolean }[]
  pendingBeat: StoryBeat | null
  visited: string[]
  setupDone: boolean
}

export type Deltas = {
  cash?: number
  xp?: number
  needs?: Partial<Record<NeedId, number>>
  skills?: Partial<Record<SkillId, number>>
}

export type ActResult = {
  text: string
  deltas: Deltas
  busyUntil: number | null
  leveledUp: boolean
  promoted: string | null
  goalsCompleted: string[]
  beat: StoryBeat | null
}

export type StoryChoice = { id: string; label: string; hint?: string }
export type StoryBeat = { id: string; title: string; chapter?: number; total?: number; icon: string; body: string; choices: StoryChoice[] }
export type StoryOutcome = { win: boolean; text: string; deltas: Deltas; next: StoryBeat | null }

// ---- people ---------------------------------------------------------------

export type Player = {
  id: string
  username: string
  look: Look
  city: CityId
  loc: string | null
  level: number
  npc: boolean
  online: boolean
  job: string | null
}

export type ChatMessage = { id: string; city: CityId; userId: string; username: string; npc: boolean; text: string; at: number }

// ---- civic ----------------------------------------------------------------

export type Candidate = { id: string; username: string; slogan: string; look: Look; votes: number; npc: boolean }
export type MayorState = {
  city: CityId
  mayor: {
    id: string
    username: string
    slogan: string
    votes: number
    look: Look
    policy: string | null
    announcement: string | null
    announcementAt: number | null
  } | null
  term: { id: number; endsDay: number; endsAt: number }
  candidates: Candidate[]
  myVote: string | null
  running: boolean
  campaignReady: boolean
  /** true when allowed, otherwise the reason */
  canRun: true | string
  canVote: true | string
  isMayor: boolean
}

// ---- plots, billboards, homes ---------------------------------------------

export type Rect = { x: number; y: number; w: number; h: number }
export type PlotAd = Rect & { id: string; title: string; link: string; image: string; owner: string; endsAt: number }
export type Plots = {
  city: CityId
  ads: PlotAd[]
  holds: Rect[]
  /** price per cell */
  price: number
  days: number
  cols: number
  rows: number
  /** one PNG of the whole grid: cols*atlasCell x rows*atlasCell px */
  atlas: string
  atlasCell: number
}

export type BillboardAd = { id: string; title: string; link: string; image: string; owner: string; endsAt: number; startsAt?: number }
export type BillboardSlot = { slot: number; ad: BillboardAd | null; queue: number; freeFrom: number }
export type Billboards = { city: CityId; days: number; price: number; slots: BillboardSlot[] }

export type Home = { id: string; userId: string; username: string; city: CityId; neighborhood: string; look: Look; npc: boolean }
export type Homes = { homes: Home[]; total: number }

export type Stats = { online: number; visits: number }
export type Daily = { date: string; weekday: string; weather: string; headline: string; tip: string }
export type Me = { now: number; user: User | null; world: WorldInfo | null; sim: Sim | null; clock: Clock }

// ---- socket ---------------------------------------------------------------

export type ServerEvent =
  | { type: 'hello'; worldId: string; clock: Clock }
  | { type: 'presence'; city: CityId; players: Player[] }
  | { type: 'chat'; message: ChatMessage }
  | { type: 'event'; kind: 'mayor' | 'plots' | 'billboards' | 'homes' | 'story'; city: CityId; text?: string }
  | { type: 'clock'; clock: Clock }
