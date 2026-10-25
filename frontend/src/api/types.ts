// The API contract. Backend JSON must match these shapes (see SPEC.md).

export type CityId = "atl" | "nyc" | "bay";
export type SkillId =
  | "fitness"
  | "cooking"
  | "music"
  | "tech"
  | "charisma"
  | "creativity"
  | "business";
/** Every need is 0..100 and always present on `Sim.needs`. */
export type NeedId = "energy" | "hunger" | "fun" | "social" | "hygiene";
export type Mood = "great" | "good" | "okay" | "low" | "rough";
export type ActionKind =
  "work" | "fun" | "food" | "learn" | "social" | "civic" | "travel" | "rest";
export type CareerTrack =
  | "tech"
  | "music"
  | "sports"
  | "food"
  | "finance"
  | "arts"
  | "civic"
  | "health";

export type LookOutfit = {
  top: string;
  bottom: string;
  style: string;
  shoeColor: string;
};
export type Look = {
  face?: string;
  outfits?: Record<"everyday" | "work" | "sleep", LookOutfit>;
  body: "f" | "m";
  skin: string;
  hair: string;
  hairColor: string;
  top: string;
  bottom: string;
  style: string;
  shoeColor: string;
};
/** Authored visual hip slot; movement authority remains at the furniture approach. */
export type ActivitySlot = {
  id: string;
  pose: string;
  x: number;
  z: number;
  y?: number;
  face: number;
  bench?: boolean;
  station?: string;
  action?: string;
};

export type User = {
  id: string;
  username: string;
  guest: boolean;
  look: Look;
  createdAt: number;
};

export type WorldMode = "public";
export type WorldInfo = {
  id: string;
  name: string;
  mode: WorldMode;
  /** Shared world has no join code; always null. */
  code: string | null;
  ownerId: string | null;
  /** humans who have a sim here / humans connected right now */
  players: number;
  online: number;
};

export type Clock = {
  /** game day number, starting at 1 */
  day: number;
  hour: number;
  minute: number;
  weekday: string;
  /** real milliseconds per game minute */
  msPerMinute: number;
  /** server time (epoch ms) this clock value was computed at */
  at: number;
};

// ---- static world content -------------------------------------------------

export type Category = { label: string; icon: string; color: string };
export type Policy = {
  id: string;
  label: string;
  banner: string;
  icon: string;
  effect?: string;
};

export type Requires = {
  skills?: Partial<Record<SkillId, number>>;
  cash?: number;
  level?: number;
  /** must hold a job on this track (and at this landmark for shift actions) */
  job?: CareerTrack;
};

export type Action = {
  pantry?: number;
  venueStation?: string;
  venuePose?: string;
  id: string;
  label: string;
  kind: ActionKind;
  icon: string;
  /** game minutes */
  durationMin: number;
  cost: number;
  pay: number;
  xp: number;
  needs: Partial<Record<NeedId, number>>;
  skills: Partial<Record<SkillId, number>>;
  requires?: Requires;
  /** destination city for travel actions */
  to?: CityId;
};

export type Landmark = {
  id: string;
  name: string;
  area: string;
  category: string;
  icon: string;
  blurb: string;
  /** [openHour, closeHour); [0, 24] is always open; close < open wraps past midnight */
  open: [number, number];
  actions: Action[];
};

export type Neighborhood = {
  id: string;
  name: string;
  rent: number;
  blurb?: string;
};

export type City = {
  startingLife?: {
    neighborhood: string;
    rent: number;
    payPerShift: number;
    startingCash: number;
  };
  id: CityId;
  name: string;
  short: string;
  state: string;
  tagline: string;
  plotsName: string;
  plots: { cols: number; rows: number };
  billboardSlots: number;
  neighborhoods: Neighborhood[];
  landmarks: Landmark[];
  /** actions available at the pseudo-landmark "home" */
  homeActions: Action[];
};

export type CareerLevel = {
  level: number;
  title: string;
  city: CityId;
  loc: string;
  payPerHour: number;
  requires: Requires;
  shiftsToPromote: number;
};
export type Career = {
  track: CareerTrack;
  label: string;
  icon: string;
  levels: CareerLevel[];
};

export type Milestone = {
  id: string;
  text: string;
  reward: { cash?: number; xp?: number };
};
export type Aspiration = {
  id: string;
  label: string;
  icon: string;
  blurb: string;
  milestones: Milestone[];
};
export type SkillInfo = { id: SkillId; label: string; icon: string };

export type World = {
  currency: string;
  startingCash: number;
  categories: Record<string, Category>;
  policies: Policy[];
  skills: SkillInfo[];
  careers: Career[];
  aspirations: Aspiration[];
  cities: City[];
};

// ---- sim ------------------------------------------------------------------

export type Job = {
  id: string;
  track: CareerTrack;
  level: number;
  title: string;
  city: CityId;
  loc: string;
  payPerHour: number;
  requires: Requires;
};

export type Goal = {
  id: string;
  text: string;
  icon: string;
  progress: number;
  target: number;
  done: boolean;
  reward: { cash?: number; xp?: number };
};

export type Friendship = {
  value: number;
  label: string;
  nextAt: number;
  nextLabel: string;
  lastAt: number;
  lastGain?: number;
};
export type FirstDayStep =
  "outside" | "job" | "shift" | "meal" | "neighbour" | "rent";
export type Sim = {
  /** Fresh meals bought at the market; each home cook uses one for extra hunger and fun. */
  pantry?: number;
  /** Private relationships for this life; omitted from public player presence. */
  relationships?: Record<string, Friendship>;
  personalSchedule?: Clock;
  scheduleMinutes?: number;
  shiftSchedule?: {
    open: number;
    close: number;
    lastDay: number;
    canWork: boolean;
    reason: string;
    gigsToday: number;
    gigLimit: number;
    shiftGameMinutes: number;
    gigGameMinutes: number;
    shiftSeconds: number;
    hoursLabel: string;
  };
  workGame?: {
    id: string;
    startsAt: number;
    endsAt: number;
    taps: number;
    best: number;
    bonus?: number;
  };
  openHouse?: boolean;
  homeLikes?: number;
  trip?: TransitTrip | null;
  pronouns?: "she" | "he" | "they";
  introDone?: boolean;
  arrivalDay?: number;
  firstDay?: Record<FirstDayStep, boolean> & {
    /**
     * True once outside, job, shift, meal and neighbour are done. Rent is tracked but never required
     * (the starter studio's first two game days are prepaid, so `rent` starts true for new lives).
     * Plots, billboards and moving home unlock when this is true.
     */
    complete: boolean;
    closingSeen?: boolean;
    /** Ready-to-show disabled reason listing what is left, e.g. "Unlocks after your first day. Still to do: work one shift and eat at a cafe." Empty when complete. */
    remaining?: string;
  };
  outfits?: Record<string, boolean>;
  position?: import("../navigation").Position;
  activitySlot?: ActivitySlot | null;
  /** Server epoch when this life began; civic/gift eligibility after one game day. */
  createdAt: number;
  userId: string;
  worldId: string;
  username: string;
  look: Look;
  city: CityId;
  /** landmark id, "home", or null when just arrived */
  loc: string | null;
  home: {
    kind?: string;
    city: CityId;
    neighborhood: string;
    rent: number;
    /** game day through which rent is already paid (first rent) */
    rentPaidThrough?: number;
  };
  cash: number;
  homeDesign?: import("../home-design").HomeDesign;
  homeLayout?: import("../navigation").RoomLayout;
  rentDebt?: number;
  traits?: string[];
  traitMoodlets?: { id: string; label: string; detail: string }[];
  wants?: Goal[];
  economy?: import("../ui/money-ledger").EconomySnapshot;
  moneyToday?: { income: number; spent: number };
  xp: number;
  level: number;
  /** xp needed for the next level */
  xpNext: number;
  lifeAction?: import("../life-actions").LifeAction | null;
  needs: Record<NeedId, number>;
  mood: Mood;
  skills: Record<SkillId, { level: number; xp: number; next: number }>;
  job: (Job & { shifts: number; shiftsToPromote: number }) | null;
  aspiration: {
    id: string;
    label: string;
    step: number;
    total: number;
    current: Milestone | null;
    milestones?: (Milestone & {
      status: "done" | "ready" | "current" | "locked";
      progress: number;
      target: number;
    })[];
  } | null;
  daily: Goal[];
  /** epoch ms until which the sim is busy with an action, or null */
  busyUntil: number | null;
  /** Server start time for stable progress across refresh/reconnect. */
  busyStartedAt?: number | null;
  busyKind?: string | null;
  busyLabel: string | null;
  /** a story beat waiting for a choice */
  stories?: {
    id: string;
    title: string;
    city: CityId;
    loc: string;
    completedBeats: number;
    total: number;
    status: "waiting" | "choice" | "complete";
    canContinue: boolean;
  }[];
  pendingBeat: StoryBeat | null;
  /**
   * The next story not yet started in the sim's current city: any ordinary activity at `loc`
   * opens its first beat. Null when every story here has begun.
   */
  storyLead?: {
    id: string;
    title: string;
    city: CityId;
    loc: string;
    /** display name of the landmark */
    name: string;
    /** ready-to-show line, e.g. "A story is waiting at Fox Theatre. Do any activity there to begin." */
    hint: string;
  } | null;
  /**
   * Server epoch ms from which this sim may send the next wave, hang out or gift (3 s cooldown).
   * Compare with `serverNow()`. Private sim only; never on public `Player` presence.
   */
  socialReadyAt: number;
  visited: string[];
  setupDone: boolean;
};

export type Deltas = {
  cash?: number;
  xp?: number;
  needs?: Partial<Record<NeedId, number>>;
  skills?: Partial<Record<SkillId, number>>;
};

export type ActResult = {
  activity?: {
    id: string;
    label: string;
    cost: number;
    pay: number;
    dailyCash: number;
    bonusCash: number;
  };
  text: string;
  deltas: Deltas;
  busyUntil: number | null;
  leveledUp: boolean;
  promoted: string | null;
  goalsCompleted: string[];
  beat: StoryBeat | null;
};

export type StoryChoice = { id: string; label: string; hint?: string };
export type StoryBeat = {
  id: string;
  title: string;
  chapter?: number;
  total?: number;
  icon: string;
  body: string;
  choices: StoryChoice[];
};
export type StoryOutcome = {
  win: boolean;
  text: string;
  deltas: Deltas;
  next: StoryBeat | null;
};

// ---- people ---------------------------------------------------------------

export type Player = {
  lifeAction?: import("../life-actions").LifeAction | null;
  needs?: { energy?: number; hunger?: number; hygiene?: number };
  busyLabel?: string | null;
  travelStatus?: string | null;
  tripId?: string | null;
  socialBusy?: boolean;
  activity?: string;
  position?: import("../navigation").Position;
  activitySlot?: ActivitySlot | null;
  id: string;
  username: string;
  look: Look;
  city: CityId;
  loc: string | null;
  level: number;
  npc: boolean;
  online: boolean;
  job: string | null;
};

export type ChatMessage = {
  id: string;
  city: CityId;
  userId: string;
  username: string;
  npc: boolean;
  text: string;
  at: number;
};

export type TransitMode = "plane" | "bus";
export type TransitHub = { loc: string; name: string; x: number; z: number };
export type TransitRoute = {
  to: CityId;
  mode: TransitMode;
  fare: number;
  durationSeconds: number;
  gameMinutes: number;
  boardingSeconds: number;
  fromHub: string;
  toHub: string;
  reason: string;
};
export type TransitTrip = {
  id: string;
  mode: TransitMode;
  from: CityId;
  to: CityId;
  fromName: string;
  toName: string;
  fromHub: string;
  toHub: string;
  fare: number;
  bookedAt: number;
  departAt: number;
  arriveAt: number;
  durationSeconds: number;
  gameMinutes: number;
  status: "boarding" | "riding";
  progress: number;
  seat: number;
  nap: boolean;
  napAvailable: boolean;
  passengers: {
    id: string;
    username: string;
    look: Look;
    seat: number;
    nap: boolean;
    online: boolean;
  }[];
  messages: ChatMessage[];
  events: { id: string; text: string; at: number }[];
  warning: string;
};
export type TransitState = {
  city: CityId;
  hubs: { plane: TransitHub; bus: TransitHub };
  routes: TransitRoute[];
  trip: TransitTrip | null;
  clock: Clock;
};

// ---- civic ----------------------------------------------------------------

export type Candidate = {
  id: string;
  username: string;
  slogan: string;
  look: Look;
  votes: number;
  npc: boolean;
};
export type MayorState = {
  city: CityId;
  mayor: {
    id: string;
    username: string;
    slogan: string;
    votes: number;
    look: Look;
    policy: string | null;
    announcement: string | null;
    announcementAt: number | null;
  } | null;
  term: { id: number; endsDay: number; endsAt: number };
  candidates: Candidate[];
  myVote: string | null;
  running: boolean;
  campaignReady: boolean;
  /** true when allowed, otherwise the reason */
  canRun: true | string;
  canVote: true | string;
  isMayor: boolean;
};

// ---- plots, billboards, homes ---------------------------------------------

export type Rect = { x: number; y: number; w: number; h: number };
export type PlotAd = Rect & {
  id: string;
  title: string;
  link: string;
  /** Server-relative path (`/api/plots/{id}/image`). Always load through `apiUrl()`. */
  image: string;
  owner: string;
  endsAt: number;
};
export type Plots = {
  city: CityId;
  ads: PlotAd[];
  holds: Rect[];
  /** price per cell */
  price: number;
  days: number;
  cols: number;
  rows: number;
  /**
   * One PNG of the whole grid: cols*atlasCell x rows*atlasCell px. Server-relative path
   * (`/api/plots/atlas.png?...`). Always load through `apiUrl()`.
   */
  atlas: string;
  atlasCell: number;
};

export type BillboardAd = {
  id: string;
  title: string;
  link: string;
  /** Server-relative path (`/api/billboards/{id}/image`). Always load through `apiUrl()`. */
  image: string;
  owner: string;
  endsAt: number;
  /** Server epoch ms when this booking goes live (later than now when it is queued). */
  startsAt?: number;
};
export type BillboardSlot = {
  slot: number;
  ad: BillboardAd | null;
  queue: number;
  bookedByMe: boolean;
  freeFrom: number;
};
export type Billboards = {
  city: CityId;
  days: number;
  price: number;
  slots: BillboardSlot[];
};

export type Home = {
  id: string;
  userId: string;
  username: string;
  city: CityId;
  neighborhood: string;
  look: Look;
  npc: boolean;
};
export type Homes = { homes: Home[]; total: number };

export type Stats = { online: number; visits: number };
export type Daily = {
  date: string;
  weekday: string;
  weather: string;
  headline: string;
  tip: string;
};
export type Me = {
  now: number;
  user: User | null;
  world: WorldInfo | null;
  sim: Sim | null;
  clock: Clock;
};

// ---- socket ---------------------------------------------------------------

/** Live fields patched onto a known `Player` by a `positions` frame (5 Hz). */
export type PlayerPatch = Pick<
  Player,
  | "id"
  | "position"
  | "activity"
  | "loc"
  | "activitySlot"
  | "socialBusy"
  | "tripId"
  | "travelStatus"
  | "lifeAction"
  | "needs"
  | "busyLabel"
>;

export type SocialKind = "wave" | "hangout" | "gift";

/** Sent only to the target's own sockets when another resident waves, hangs out or gifts. */
export type SocialReceived = {
  type: "socialReceived";
  kind: SocialKind;
  fromId: string;
  fromName: string;
  /** ready-made sentence, e.g. "Ada waved to Bo." */
  text: string;
  /** gift amount in dollars (gift only) */
  amount?: number;
  /** server epoch ms */
  at: number;
};

/**
 * Kinds of `event` frame. `sim` means "your own sim changed: re-read /api/sim".
 * `story` is the old name of `sim`, still accepted by the client for one release.
 */
export type ServerEventKind =
  "mayor" | "plots" | "billboards" | "homes" | "sim" | "story";

export type ServerEvent =
  | { type: "hello"; worldId: string; clock: Clock }
  /** Full player list of the viewed city: on change, after (re)connect and after a resync. */
  | { type: "presence"; city: CityId; players: Player[] }
  /** Latest live fields of the viewed city; coalesced per client (only the newest is delivered). */
  | { type: "positions"; city: CityId; at: number; players: PlayerPatch[] }
  | { type: "chat"; message: ChatMessage }
  | {
      type: "event";
      kind: ServerEventKind;
      city: CityId;
      /** legacy social sentence; replaced by `socialReceived` */
      text?: string;
    }
  /** On every game-hour change and at least every 5 s as a heartbeat. */
  | { type: "clock"; clock: Clock }
  | SocialReceived
  /** The server skipped frames for this client; re-read players and chat over HTTP. */
  | { type: "resync" };
