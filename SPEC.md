# Metro Life (working title) — shared spec v2

A life-sim in the spirit of The Sims, inspired by the owner's site lagoslife.app but set in the USA:
**Atlanta, New York and the Bay Area**. Play **solo** (private world with NPC residents) or **online**
(shared public world, or a private world friends join with a code). You build a life: keep your needs up,
learn skills, get a job, earn money, pursue an aspiration, run for mayor, buy plots and billboards.

Design pillars (from the owner): no emojis anywhere (SVG icons only), strong typography, better 3D models
than the original, and smooth rendering.

Stack: **Spring Boot 3 / Java 21 backend on :8080**, **React 19 + Vite + react-three-fiber frontend on :5173**
(Vite proxies `/api` and `/ws` to :8080).

## Layout and ownership

```
lagos-life-remake/               (folder name is historical)
  SPEC.md                        this file (read-only for agents)
  shared/world.json              canonical static content: categories, policies, 3 cities with landmarks,
                                 neighborhoods, plots grid size, billboard slot count (read-only for agents)
  reference/                     captured from lagoslife.app — inspiration only now (mechanics, API shapes)
  backend/                       OWNER: backend agent
  frontend/
    public/models/kaykit/*.gltf  KayKit City Builder Bits (CC0)   public/models/world/**  Kenney kit pieces
    src/api/**, src/store.ts, src/App.tsx, src/main.tsx           shared contract, written by the lead — do not edit
    src/scene/**                 OWNER: scene agent  (default export CityScene from src/scene/index.tsx)
    src/ui/**, src/index.css, index.html                          OWNER: ui agent (default export Hud from src/ui/index.tsx)
```

Spatial layout (where each landmark, road, river, bridge, plots grid, billboard and neighborhood sits on each
city map) is owned by the **scene** in `src/scene/cities/*`. Everything non-spatial (names, blurbs, hours,
actions, rules, economy) is owned by the **backend** and served by `/api/world`. The join key is the ids in
`shared/world.json` (city ids `atl`, `nyc`, `bay`; landmark ids; neighborhood ids; billboard slots `1..N`;
plots grid `cols x rows` cells with origin top-left, x right, y down).

## Core concepts

- **User**: an account or a guest. Guests are created with one click (no password) so solo play starts instantly;
  signing up while a guest upgrades the same user and keeps progress.
- **World**: `public` (one shared world, always exists), `private` (join code, friends), `solo` (one human, NPCs).
  All game state — sims, mayors, plots, billboards, chat — is scoped to a world. The session remembers the
  current world; logged-out visitors read the public world.
- **Sim**: a user's character in one world: city, current landmark, home, cash, xp/level, needs, skills, job,
  aspiration, goals. One sim per (user, world).
- **NPC residents**: server-driven sims that vote, buy plots, visit landmarks, chat a little and can be interacted
  with. Solo worlds have ~40 per city; private ~20; public ~10. Same data shape as players, flagged `npc: true`.
- **Clock**: per world. 1 game hour = 60 real seconds (a day is 24 minutes). Landmark opening hours use it.
  Days roll over at 00:00: rent is charged, daily goals reset.

## Gameplay rules (backend is authoritative)

- **Needs** `energy, hunger, fun, social` in 0..100. They decay with game time (roughly: energy -3/h awake,
  hunger -4/h, fun -3/h, social -2/h; while offline decay is capped so nobody returns to a dead sim).
  `mood` is derived: `great | good | okay | low | rough`. Low mood reduces pay and skill gain; a need at 0 blocks
  work actions.
- **Skills** (level 0..10 with xp): `fitness, cooking, music, tech, charisma, creativity, business`.
- **Actions**: every landmark exposes structured actions. An action has `id, label, kind (work|fun|food|learn|social|civic|travel|rest),
  durationMin (game minutes), cost, pay, needs deltas, skill gains, requires {skill levels, job track, level, cash}`.
  `POST /api/act` validates (open hours, busy, requirements, cash), persists an accepted activity and sets
  `busyStartedAt` and `busyUntil` (real time: 2–6 s, proportional to duration). Cash, needs, XP, skills,
  shifts, goals, story triggers and travel settle once at completion, before the next sim response. The
  pending activity survives a server restart and is never exposed to the client. Its `ActResult` describes
  the promised outcome; the returned `sim` still has the pre-completion balance and needs. A completion
  read returns the authoritative payoff. This timing follows the owner's HUD direction of October 11.
  The labels in `shared/world.json`
  are the starting point; the backend expands each into a structured action and may add more.
  A pseudo-landmark `home` exists in every city (sleep, cook, shower, invite a friend).
- **Careers**: tracks `tech, music, sports, food, finance, arts, civic, health`, 5 levels each, each level tied
  to a workplace landmark in some city, with skill requirements and hourly pay. Apply at the workplace; a
  "Work a shift" action then appears there. Promotions come from shifts worked + skills.
- **Aspirations** (long arc, chosen at onboarding, changeable): e.g. Startup Founder, Headliner, Mayor,
  Restaurateur, Pro Athlete, Art Collector, Real-Estate Mogul. Each is 6–8 ordered milestones
  ("Reach Tech 3", "Pitch at Sand Hill Road", "Earn $25,000", ...) with rewards.
- **Daily goals**: three per day, small (visit X, work a shift, cook, hang out with someone).
- **Story beats**: some actions trigger a choice event (title, body, 2–3 choices; each choice has a skill check
  or a chance, with win/lose text and effects). Several beats chain into short storylines per city
  (open-mic night at the Apollo, demo day on Sand Hill Road, a campaign rally at the Capitol...).
- **Money**: starting cash from `shared/world.json`. Income: shifts, gigs, story wins, plots resale later.
  Sinks: food, fun, rent (per neighborhood, daily), flights between cities (airport action), plots, billboards.
  `moneyToday: { income, spent }` records settled action income (including goal rewards) and costs for the
  current game day, excluding starting cash. It resets with daily goals; future money routes must update it.
- **Travel**: flying is an action at the airport landmark of the current city; it costs cash and moves the sim.
  Viewing another city's map is free; acting there requires being there.
- **Mayor**: one per city per world, elected by term (3 game days). Vote, run (needs Charisma 2), campaign
  actions add votes. The mayor sets a weekly policy (from `shared/world.json`, small gameplay modifier) and
  can post an announcement.
- **Social**: at the same landmark you can wave, hang out (+social for both) or gift cash. City chat per world.
- **Plots** (ad grid, one field per city) and **billboards** (slots per city): bought with in-game cash.

## API (JSON; cookie session `ml_session`; errors `{ "error": "message" }` with 4xx; 401 = "Please log in")

Reads accept `?city=atl|nyc|bay` where noted (default: the sim's city, else `atl`).

| Method | Path | Body → Response |
|---|---|---|
| GET | `/api/world` | static content: `shared/world.json` plus structured `actions` per landmark, `careers`, `aspirations`, `skills`, `neighborhood rent` |
| GET | `/api/stats` | `{ online, visits }` (increments visits) |
| GET | `/api/version` | `{ build }` |
| GET | `/api/daily?city` | `{ date, weekday, weather, headline, tip }` (per city, per game day) |
| GET | `/api/auth/me` | `{ now, user: User|null, world: WorldInfo|null, sim: Sim|null, clock: Clock }` |
| POST | `/api/auth/guest` | `{ username? }` → `{ user }` |
| POST | `/api/auth/signup` | `{ username, password, look? }` → `{ user }` (upgrades a guest in place) |
| POST | `/api/auth/login` | `{ username, password }` → `{ user }` |
| POST | `/api/auth/logout` | → `{ ok: true }` |
| GET | `/api/worlds` | `{ worlds: WorldInfo[], current: string|null }` (public + mine) |
| POST | `/api/worlds` | `{ name, mode: "solo"|"private" }` → `{ world }` (and selects it) |
| POST | `/api/worlds/join` | `{ code }` → `{ world }` |
| POST | `/api/worlds/select` | `{ worldId }` → `{ world, sim: Sim|null }` |
| POST | `/api/sim/setup` | `{ city, neighborhood, aspiration, look? }` → `{ sim }` (creates the sim once in the current world; existing sim returns 409, later home/aspiration changes use their dedicated endpoints) |
| GET | `/api/sim` | `{ sim, clock }` (applies decay up to now) |
| POST | `/api/act` | `{ city, loc, action }` → `{ sim, result: ActResult }` |
| POST | `/api/story/choose` | `{ beatId, choice }` → `{ sim, outcome: StoryOutcome }` |
| POST | `/api/home/move` | `{ city, neighborhood }` → `{ sim }` |
| GET | `/api/jobs?city` | `{ jobs: Job[] }` |
| POST | `/api/jobs/apply` | `{ jobId }` → `{ sim, hired: boolean, reason? }` |
| POST | `/api/jobs/quit` | → `{ sim }` |
| POST | `/api/aspiration` | `{ aspiration }` → `{ sim }` |
| GET | `/api/players?city` | `{ players: Player[] }` (humans + NPCs in the current world and city) |
| POST | `/api/social` | `{ targetId, kind: "wave"|"hangout"|"gift", amount? }` → `{ sim, text }` |
| GET | `/api/chat?city` | `{ messages: ChatMessage[] }` (last 50) |
| POST | `/api/chat` | `{ city, text }` → `{ message }` (also broadcast on the socket) |
| GET | `/api/mayor?city` | `MayorState` |
| POST | `/api/mayor/vote` | `{ city, candidateId }` → `MayorState` |
| POST | `/api/mayor/run` | `{ city, slogan }` → `MayorState` |
| POST | `/api/mayor/policy` | mayor only `{ city, policy }` → `MayorState` |
| POST | `/api/mayor/announce` | mayor only `{ city, text }` → `MayorState` |
| GET | `/api/plots?city` | `{ ads: PlotAd[], holds: Rect[], price, days, cols, rows, atlas, atlasCell }` |
| POST | `/api/plots` | `{ city, x, y, w, h, title, link }` → `{ ad, sim }` (409 overlap, 402 no cash) |
| GET | `/api/plots/{id}/image` | PNG placeholder art |
| GET | `/api/plots/atlas.png?city&world&v` | one PNG of the whole grid, `atlasCell` px per cell, `cols*atlasCell` x `rows*atlasCell` |
| GET | `/api/billboards?city` | `{ days, price, slots: [{ slot, ad: BillboardAd|null, queue: number, freeFrom }] }` |
| POST | `/api/billboards` | `{ city, slot, title, link }` → `{ ad, sim }` |
| GET | `/api/billboards/{id}/image` | PNG placeholder art (16:9) |
| GET | `/api/homes?city` | `{ homes: Home[], total }` |

**WebSocket** `GET /ws` (same cookie). Plain JSON text frames.
Server → client: `{ type: "hello", worldId, clock }`, `{ type: "presence", players: Player[] , city }` (on change, throttled),
`{ type: "chat", message }`, `{ type: "event", kind: "mayor"|"plots"|"billboards"|"homes"|"story", city, text? }`
(clients refetch that resource), `{ type: "clock", clock }` (every game hour).
Client → server: `{ type: "view", city }` (which city map the client is looking at — presence/chat are filtered by it),
`{ type: "ping" }`.

The exact TypeScript shapes are in `frontend/src/api/types.ts` — that file is the contract; backend JSON must match it.

## No-emoji rule

No emoji in UI, scene, seeded data, generated images, NPC chat or story text. Icons are lucide names
(kebab-case) carried in data (`icon` fields) and rendered as SVG.
