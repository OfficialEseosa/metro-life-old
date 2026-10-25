# Metro Life — game specification

A life-sim in the spirit of The Sims, set in the USA:
**Atlanta, New York and the Bay Area**. Everyone plays in one shared public world, with NPC residents
and other players who open this server address. You build a life: keep your needs up,
learn skills, get a job, earn money, pursue an aspiration, run for mayor, buy plots and billboards.

Design pillars: no emojis anywhere (SVG icons only), strong typography, better 3D models
than the original, and smooth rendering.

Stack: **Spring Boot 3 / Java 21 backend on :8080**, **React 19 + Vite + react-three-fiber frontend on :5173**
(in development Vite proxies `/api` and `/ws` to :8080; in production the frontend calls the API origin set by `VITE_API_URL`).

## Layout

```
  SPEC.md                        this file
  shared/world.json              canonical static content: categories, policies, 3 cities with landmarks,
                                 neighborhoods, plots grid size, billboard slot count
  shared/*.json                  navigation, interiors, venues, transit, furniture and naming data read by
                                 both the backend and the frontend
  reference/                     captured reference material — inspiration only (mechanics, API shapes)
  backend/                       Spring Boot API and WebSocket server
  frontend/
    public/models/kaykit/*.gltf  KayKit City Builder Bits (CC0)   public/models/world/**  Kenney kit pieces
    src/api/**, src/store.ts      API contract, client and store
    src/scene/**                 3D city (default export CityScene from src/scene/index.tsx)
    src/ui/**, src/index.css     HUD (default export Hud from src/ui/index.tsx)
```

Spatial layout (where each landmark, road, river, bridge, plots grid, billboard and neighborhood sits on each
city map) is owned by the **scene** in `src/scene/cities/*`. Everything non-spatial (names, blurbs, hours,
actions, rules, economy) is owned by the **backend** and served by `/api/world`. The join key is the ids in
`shared/world.json` (city ids `atl`, `nyc`, `bay`; landmark ids; neighborhood ids; billboard slots `1..N`;
plots grid `cols x rows` cells with origin top-left, x right, y down).

## Browser life and action feedback

The game has no account, registration, password or sign-in interface. Opening the game automatically
resumes the opaque browser session, or creates a guest session if one does not exist. The creator asks
only for a character name, city and appearance. Progress is held on the local server and recovered with
this browser’s site cookie; clearing site data loses that browser’s access to the life. Settings explains
this and offers the existing explicit new-life confirmation.

The only identity routes are `GET /api/auth/me`, `POST /api/auth/guest` and `POST /api/life/new`.
There are no credential or world-selection endpoints. A `User` is `{ id, username, guest, look, createdAt }`,
with `guest: true`. The schema-1 save migration marks retained users as guests, removes `passwordHash`
and `lastWorld`, moves retained sessions to `public`, and backs up the original save before migration.

Every disabled action button shows its specific reason inside the control, associated through
`aria-describedby`, so touch and keyboard users can read it without a tooltip. This includes a missing
or invalid creator name, first-day home/plot/billboard locks, insufficient cash, activity/story locks,
workplace opening hours, policy locks and the one-game-day gifting rule. Waiting for a request also has
a visible saving/sending explanation. Homes display resident counts and missing cash on separate lines.

## Core concepts

- **User**: an automatically created browser guest, resumed through the opaque `ml_session` cookie.
  There is no account or credential flow. A confirmed new life replaces that browser guest and its progress.
- **World**: `public`, the one shared world. All sims, mayors, plots, billboards and chat belong to it.
  `WorldInfo.mode` is `public`; `code` and `ownerId` are null. There is no world picker or join code.
- **Sim**: a user's character in one world: city, current landmark, home, cash, xp/level, needs, skills, job,
  aspiration, goals. One sim per (user, world).
- **NPC residents**: server-driven sims that vote, buy plots, visit landmarks, chat a little and can be interacted
  with. The shared world seeds 40 per city. Same data shape as players, flagged `npc: true`.
- **Clock**: per world. The shared world runs a seven-minute day (`Clock.msPerMinute` about 292, so one game
  hour is about 17.5 real seconds). Landmark opening hours use it. Days roll over at 00:00: rent is charged,
  daily goals reset.

## Gameplay rules (backend is authoritative)

- **Needs** `energy, hunger, fun, social, hygiene` in 0..100, always present on `Sim.needs`. They decay per game
  hour: energy 0.45, hunger 0.55, fun 0.42, social 0.36, hygiene 0.4 (with personality modifiers; the table is
  `Content.NEED_RATES` and is published as `economy.ratesPerGameHour`). At the seven-minute day a full need lasts
  well over half an hour of real play. Offline decay is capped at six game hours so nobody returns to a dead sim.
  Hygiene is a full need: the home shower restores it (+65, more with a better shower or tub), shifts and gigs
  cost a little (-6 to -8) and exercise costs more (-10); below 20 the sim shows the "dirty" condition.
  `mood` is derived from all five needs: `great | good | okay | low | rough`. Low mood reduces pay and skill
  gain; a need at 0 blocks work actions.
- **Skills** (level 0..10 with xp): `fitness, cooking, music, tech, charisma, creativity, business`.
- **Actions**: every landmark exposes structured actions. An action has `id, label, kind (work|fun|food|learn|social|civic|travel|rest),
  durationMin (game minutes), cost, pay, needs deltas, skill gains, requires {skill levels, job track, level, cash}`.
  `POST /api/act` validates (open hours, busy, requirements, cash), persists an accepted activity and sets
  `busyStartedAt` and `busyUntil` (real time: 2–6 s, proportional to duration). Cash, needs, XP, skills,
  shifts, goals, story triggers and travel settle once at completion, before the next sim response. The
  pending activity survives a server restart and is never exposed to the client. Its `ActResult` describes
  the promised outcome; the returned `sim` still has the pre-completion balance and needs. A completion
  read returns the authoritative payoff.
  The labels in `shared/world.json`
  are the starting point; the backend expands each into a structured action and may add more.
  A pseudo-landmark `home` exists in every city (sleep, cook, shower, invite a friend).
- **Careers**: tracks `tech, music, sports, food, finance, arts, civic, health`, 5 levels each, each level tied
  to a workplace landmark in some city, with skill requirements and hourly pay. Apply at the workplace; a
  "Work a shift" action then appears there. Promotions come from shifts worked + skills.
  A healthy shift gives 75 XP in its career skill; the first promotion requires four shifts and skill level 2.
  Both requirements and an estimate of missing practice are shown before promotion.
- **Aspirations** (long arc, chosen at onboarding, changeable): e.g. Startup Founder, Headliner, Mayor,
  Restaurateur, Pro Athlete, Art Collector, Real-Estate Mogul. Each is 6–8 ordered milestones
  ("Reach Tech 3", "Pitch at Sand Hill Road", "Earn $25,000", ...) with rewards.
  Public sim milestones include `status` (`done|ready|current|locked`), `progress`, `target` and rewards.
  An early completed milestone is remembered while that dream is active, then paid once in order.
- **Daily goals**: three per day, small (visit X, work a shift, cook, hang out with someone).
- **Story beats**: some actions trigger a choice event (title, body, 2–3 choices; each choice has a skill check
  or a chance, with win/lose text and effects). Several beats chain into short storylines per city
  (open-mic night at the Apollo, demo day on Sand Hill Road, a campaign rally at the Capitol...).
  One choice closes the dialog. The next chapter requires a completed activity elsewhere and then a
  non-job activity back at the story landmark. The public sim `stories` journal records completed chapters,
  `choice|waiting|complete` status and `canContinue`; departure and reward guards persist privately.
- **Money**: starting cash from `shared/world.json`. Income: shifts, gigs, story wins, plots resale later.
  Sinks: food, fun, rent (per neighborhood, daily), flights between cities (airport action), plots, billboards.
  `moneyToday: { income, spent }` records settled action income (including goal rewards) and costs for the
  current game day, excluding starting cash. It resets with daily goals; future money routes must update it.
- **Travel**: flying is an action at the airport landmark of the current city; it costs cash and moves the sim.
  Viewing another city's map is free; acting there requires being there.
- **Mayor**: one per city per world, elected by term (3 game days). Vote, run (needs Charisma 2), campaign
  actions add votes. The mayor sets a weekly policy (from `shared/world.json`, small gameplay modifier) and
  can post an announcement.
  A term closes at midnight on days 4, 7, 10, etc. One vote per resident per term; ties go to the first
  candidate registered, and a ballot with zero votes elects nobody. Running is free. A registered candidate's
  canonical Campaign activity adds one support vote at completion, at most once per game day. Policies may
  be chosen once per term and end with the term: transit makes non-flight airport rides free; parks extend
  to midnight; smallbiz adds 5% work pay; arts extends culture hours to midnight and removes after-18:00
  non-job costs; housing cuts daily rent by 20%; nightlife extends hours to 04:00. Announcements are plain
  text, 3–140 characters, without links, at most once per game hour.
- **Social**: both residents must be at the same public location (private homes are separate) in the same city/world and free of activities or
  story choices. Human targets must be online. Wave gives both +3 Social; hang out gives both +15, capped
  at 100. Gifts transfer an integer $1–$500 with matching income/spending ledger entries. A sender waits
  three seconds between social actions; the private sim exposes `socialReadyAt` (server epoch ms) so the client can
  disable the buttons until then. The receiving human gets a `socialReceived` socket frame. Other private cooldown
  and notification fields never enter the public sim.
- **Presence and chat**: browser-session sockets are bound to the shared public world. Online seats expire after 12 seconds without a live socket; multiple tabs count once.
  Viewed-city presence includes offline human residents and NPCs; the HUD shows the online human count and a separate resident count.
  City chat retains the last 50 messages per world/city across restart. Sending requires physically being
  in that city, 1–240 plain-text characters, and a 1.5-second send cooldown. Reconnect refetches resources
  and deduplicates chat IDs. Socket writes run outside the simulation lock with bounded per-client queues:
  `positions` frames are coalesced (only the newest unsent one is delivered), and a client whose queue
  fills is never dropped silently; its backlog is discarded, it receives `resync`, and the next tick resends a full
  snapshot (presence, positions, clock, sim, resources, recent chat).
- **City residents**: the shared world lazily seeds 40 residents per city. Synthetic residents have one authoritative location and persistent cash/home/needs.
  Active worlds simulate movement every 45–96 seconds after staggered initial departures. Residents use
  a limited activity routine, rather than the full human career/story loop. Up to three residents per city
  vote once per term when a human candidate exists; up to two lease one-cell plots. They do not run for
  office or buy billboards. At most one synthetic chat message per city every two real minutes. Worlds
  stop simulating five minutes after their last read/live connection; no offline simulation catch-up.
- **Plots**: rectangles of 1–12 cells in each dimension, $35 per cell for seven game days, with atomic
  bounds/overlap validation. One generated atlas PNG per city/world; no per-cell meshes or image requests.
  Booking is immediate under the server lock, so `holds` is empty. Titles use 3–48 plain-text characters;
  links are optional HTTP(S). No external artwork uploads or real payments.
- **Billboards**: $300 for three game days, exclusive sequential bookings, maximum four outstanding per
  slot. A resident cannot book the same slot twice while a booking is active/queued. Response `ad.startsAt`
  discloses a future booking; reads expose current ad, queued count and the next available timestamp.
- **Homes and rent**: moving requires being in the destination city and costs one day's rent, shown before
  acceptance. Daily rent first falls due at the next midnight. A new life's starter studio is prepaid for its
  first two game days (`home.rentPaidThrough`), so an idle new player loses nothing for about fourteen minutes. Unpaid amounts persist as public `rentDebt`;
  available funds repay them automatically without making cash negative. Accepted activity costs are reserved
  while rent settles. Purchases, move fees and actual rent payments update `moneyToday.spent`; aspiration
  rewards update income. All civic and property mutations require a sim and no pending activity/story.

## API (JSON; cookie session `ml_session`; errors `{ "error": "message" }` with 4xx)

A missing or expired required session returns 401 with `Your life could not be found. Reload to start again.`
The client creates or resumes the browser guest automatically. The cookie is HttpOnly, SameSite=Lax,
scoped to `/`, valid for 30 days, and Secure when the request uses HTTPS.

Reads accept `?city=atl|nyc|bay` where noted (default: the sim's city, else `atl`).

| Method | Path | Body → Response |
|---|---|---|
| GET | `/api/world` | static content: `shared/world.json` plus structured `actions` per landmark, `careers`, `aspirations`, `skills`, `neighborhood rent` |
| GET | `/api/stats` | `{ online, visits }` (increments visits) |
| GET | `/api/version` | `{ build }` |
| GET | `/api/daily?city` | `{ date, weekday, weather, headline, tip }` (per city, per game day) |
| GET | `/api/auth/me` | `{ now, user: User|null, world: WorldInfo|null, sim: Sim|null, clock: Clock }` |
| POST | `/api/auth/guest` | `{ username? }` → `{ user }` (name applies to a new guest; an existing valid session is returned unchanged) |
| POST | `/api/life/new` | `{ confirm: true }` → `{ user }` (replaces the browser life and issues a new session cookie) |
| POST | `/api/sim/setup` | `{ username, pronouns, city, neighborhood, aspiration, look? }` → `{ sim }` (creates the sim once in the shared world; existing sim returns 409, later home/aspiration changes use their dedicated endpoints) |
| GET | `/api/sim` | `{ sim, clock }` (applies decay up to now) |
| POST | `/api/act` | `{ city, loc, action, slotId? }` → `{ sim, result: ActResult }` |
| POST | `/api/action/cancel` | no body → `{ sim, clock }` |
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
| GET | `/api/plots/{id}/image` | PNG generated poster art |
| GET | `/api/plots/atlas.png?city&world&v` | one PNG of the whole grid, `atlasCell` px per cell, `cols*atlasCell` x `rows*atlasCell` |
| GET | `/api/billboards?city` | `{ days, price, slots: [{ slot, ad: BillboardAd|null, queue: number, freeFrom }] }` |
| POST | `/api/billboards` | `{ city, slot, title, link }` → `{ ad, sim }` |
| GET | `/api/billboards/{id}/image` | PNG generated poster art (16:9) |

Image fields (`Plots.atlas`, `PlotAd.image`, `BillboardAd.image`) are server-relative paths; the client loads them
through `apiUrl()` so they work when the API is on another origin. Billboard ads carry `startsAt` (later than now when
the booking is queued); `BillboardSlot.freeFrom` is the next free start. `GET /api/sim` and every `{ sim }` response carry the private `socialReadyAt`.
| GET | `/api/homes?city` | `{ homes: Home[], total }` |

**WebSocket** `GET /ws` (same cookie). Plain JSON text frames.
Server → client:
- `{ type: "hello", worldId, clock }` on connect.
- `{ type: "presence", city, players: Player[] }`: the viewed city's full list, on change (checked every second)
  and in full after every connect, `view` change or resync.
- `{ type: "positions", city, at, players: PlayerPatch[] }`: live fields (`id, position, activity, loc, activitySlot,
  socialBusy, tripId, travelStatus, lifeAction, needs, busyLabel`) at up to 5 per second; coalesced per client.
- `{ type: "chat", message }`.
- `{ type: "event", kind: "mayor"|"plots"|"billboards"|"homes", city }`: refetch that resource.
- `{ type: "event", kind: "sim", city }`: your own sim changed; re-read `/api/sim`. (Older clients called it `story`.)
- `{ type: "socialReceived", kind: "wave"|"hangout"|"gift", fromId, fromName, text, amount?, at }`: only to the
  target's sockets.
- `{ type: "clock", clock }`: every game hour and at least every 5 seconds (heartbeat; a client that hears nothing
  for 15 seconds treats the socket as dead and reconnects).
- `{ type: "resync" }`: frames were skipped; refetch players and chat over HTTP.

Client → server: `{ type: "view", city }` (which city map the client is looking at — presence/chat are filtered by it),
`{ type: "ping" }` (accepted, ignored).

The exact TypeScript shapes are in `frontend/src/api/types.ts` — that file is the contract; backend JSON must match it.

## No-emoji rule

No emoji in UI, scene, seeded data, generated images, NPC chat or story text. Icons are lucide names
(kebab-case) carried in data (`icon` fields) and rendered as SVG.

## Rule clarifications
- Explore daily goals count distinct city/place pairs completed on that game day, independently of lifetime exploration.
- Offline need decay and rent catch-up cover the first six game hours since the last update (six real minutes at the canonical clock rate). Only midnights in that capped interval charge rent. Recorded housing-policy changes and term boundaries determine the rate at each midnight. Policy dates before this migration cannot be reconstructed; legacy saves begin with their known current policy as the baseline.
- A life must be at least one game day old (24 real minutes) to send cash gifts or cast a ballot. Waves, chat and activities remain immediate. New sims expose authoritative createdAt; legacy sims fall back to browser-guest creation time.
- Job applications require the sim's actual location to be the open workplace, with no activity or story pending. The job listing's Visit workplace action takes two seconds, gives no XP or cash itself, and cannot trigger a story; Apply then hires in place. It uses normal authoritative activity/travel validation.
- A campaign consumes its accepted game day even if it settles after midnight. Election wins are credited only when that term's winner is actually seated.
- Read endpoints apply due simulation state in memory without fsync. Explicit mutations persist immediately; active worlds checkpoint every five seconds and at orderly shutdown. Accepted activity outcomes are durable before a response and replay once after a crash. Visit statistics are process-memory counters; online stats count current authenticated human users. Story chapter/total counts are separate from titles (optional on legacy saved beats).

## Walking contract
`Sim.position` and visible `Player.position` carry `{x,z,face,place,room}` in scene units. `POST /api/move` accepts `{city,x,z,face}` only in the actual city, while idle and outside a story. Swept segments must remain on land/bridges and outside footprint boxes and lakes. A server-time credit budget caps movement at7.5 units/second (client walk4.2,run7.2); burst credit is capped at3units. Rejected movement leaves coordinates unchanged. Updates at most5/second are checkpointed by the existing world saver; no per-step fsync. The room field is null in P1. `shared/navigation.json` is generated by `node scripts/build-navigation.cjs` from the rendered kit placements and scene anchors; canonical world.json remains unchanged.
Keyboard WASD/arrows, Shift, E/Enter and Escape; pointer joystick on narrow screens. Wheel/pinch/overview temporarily releases follow; walking restores it. Server coordinates initialise at the home door, including migrated saves; legacy map actions retain their existing behaviour until P2 adds authoritative room/station checks.

## Home interior contract
`POST /api/door {loc:"home",enter:true}` requires the actual home city, proximity to the home door, and an idle sim without a story. It changes `position.room` to `home:<userId>` and starts at the room exit. `{enter:false}` requires proximity to the room exit and restores the recorded outside position. `shared/interiors.json` supplies the same room bounds, furniture blockers and interaction stations to Java and TypeScript. Home `/api/act` requests now require that private room and the matching furniture station within1.45units; they retain the existing completion-only rewards, costs and busy rules. The client serializes its final movement before interacting. Home panels explain walking to furniture; their action lists are removed. General landmark map actions retain their prior rules until the P3 movement/travel integration.

- Workplace entry requires an open door within3units; application and shifts require the shared desk station. Every other activity requires a real doorway arrival. POST `/api/travel` accepts same-city locations only and settles after2seconds; city changes remain airport activities. Result `activity` separates actual cost/pay/daily rewards/milestone rewards from the net cash delta.

## Landmark rooms
Every landmark is assigned in shared/interiors.json to a theatre, food hall, stadium, arena, museum, office, cafe, club, hospital, airport or pavilion. Java and TypeScript use the same assignments, action-kind rules, collision boxes, approach stations, surveyed aisle paths and use slots. Public ActivitySlot may include station (the authored approach id); poses remain strings and use y as seated hip height or standing platform elevation. Food activities reserve Eat slots at dining tables; career shifts use the venue service counter except office typing desks. Room staff occupy authored positions behind counters. Same-city map travel validates its target before exiting a room, then arrives outside the destination after two seconds. Older generic workplace room ids migrate to the assigned room doorway.
## Authority and arrival contract
Actual public landmark arrivals (door entry, walking into a doorway area, or completed map/flight travel) update distinct daily visits and lifetime exploration immediately. Home, street, previews and rejected operations do not count. Dream progress/rewards do not wait for first-day completion; each claim still pays once. A completed paid food-hall meal counts as a first-day meal.

Player presence and position patches include optional `socialBusy:boolean`, true for an active activity or pending story. Human trips/actions settle before presence snapshots. Nearby social controls require an online player or NPC within three metres, the same exact public room (or both outdoors), and no pending activity/story. Private home locations are not shared social places. The endpoint checks the same effective use-slot position. New arrivals and reconnects use a valid free spot near the authored door, including current actors, staff and reservations.

The client serializes map travel, waits for its authoritative settlement, then snaps motion/visual position before restoring follow or opening the requested panel. Movement request revisions discard pre-travel replies. City election travels to that city's civic destination and opens the working ballot after arrival. Find a home opens its list without travel. `POST /api/travel` returns `{sim,clock}`. HUD gestures prevent text selection while text inputs remain editable.


### Mouse interaction contract
- Ground clicks follow collision-checked walking paths. Usable furniture, doors, park benches and rendered residents open an action menu at the pointer. Accepted object actions walk to their valid approach before requesting the action; manual keyboard or joystick movement interrupts the current walking leg.
- The local queue holds one current action and up to three waiting actions, with individual cancellation. It is cleared when the browser life changes; pending responses from the previous life cannot restore it. Server activity cancellation is serialized, settles already-due rewards once, and otherwise discards pending effects/travel without paying unearned rewards. It clears the use slot. Waiting actions are local intentions, revalidated against server state when they start.
- Optional `slotId` targets an exact compatible furniture use slot. Public slots must match the action station and pose, be free, and have a valid approach within 1.45m. There is no fallback to another table or chair if the selected piece is occupied. Home activities retain their authored canonical approaches. Omission preserves existing keyboard and panel behavior.
- Mouse wheel zooms and right drag orbits. The chosen camera offset persists while walking until the room/city changes. Phone room framing includes the whole studio; keyboard, touch joystick and touch camera rotation remain available.

## Travel and creator contract

Setup includes optional `traits` (three of twelve) and Look `face` plus `outfits.everyday/work/sleep`. Older lives receive compatible defaults. Traits affect practice/recovery/drain and aspiration daily wants are exposed as `wants`.
After creation a city card shows that city’s starting neighborhood, rent and entry pay. Visiting preserves the lease; moving charges a reviewed deposit. `/api/transit` lists both fares and durations. Booking at the matching hub uses `/api/transit/book` with `to`, `mode` and bus `confirmTimeAdvance`; a departure cohort shares seats and private chat. Plane rides take 10 real seconds / 2 game hours, buses 50 seconds / 8 game hours. The shared clock advances once per cohort and applies midnight costs. `/api/transit/nap` restores bus energy at arrival. `Sim.trip` supplies cabin state; public presence supplies travel status.

Homes use GET/POST `/api/home/design`, saved per life. The response includes `catalog`, `design`, `layout`, `sim`, and `clock`. Placement uses quarter-metre coordinates and four rotations; the server checks overlaps, doors and reachable use points. Sim `homeDesign` and `homeLayout` install the same geometry in client navigation. Home actions reserve the selected item and apply its comfort/recovery bonuses.
Sim `economy` includes a durable reasoned journal and next-rent/food/shift forecast. Purchases over $50 require `confirm: true` after the UI review. Hourly need drains are listed under Needs above. Public presence exposes needs, busyLabel and temporary lifeAction gestures. Sim `relationships` is a private per-person value/label map; nearby chat, waves and hanging out build reciprocal bonds. Public venue bounds, floor polygons, slots and signature architecture share `shared/interiors.json`.


## Shared life and venue contract
Newly started browser lives opt their shared world into a seven-minute day (`Clock.msPerMinute`); the anchored clock preserves the current day. Explicit legacy clock settings remain valid. Work is one four-game-hour paid shift per day inside career hours; three paid gigs per day are available. Work timing awards a server-timed bonus, while sleep lasts 6 to 20 real seconds according to missing energy and restores energy on completion.
`POST /api/quick-start` accepts city, optional curated look and invite code. `/api/invite` returns a persistent code; `/api/invite/join` joins that resident at their current room or outside a private home. `/api/emote` publishes a timed nearby pose. `/api/social-life` supplies the city event and open homes; `/api/event/join` contributes to its shared goal. Open-house control, visit and one-per-visitor likes use `/api/open-house`, `/api/open-house/visit` and `/api/open-house/like`. Open homes permit nearby social actions and expose their furnished layout to visitors; editing remains owner-only.
`GET/POST /api/venue-moment` exposes authoritative room show times, station reasons, timed mini-games, room scores and shared visual cues. Shared interior templates include zones, camera focus, staff, use slots and architectural identity. Public labels use fictional names while canonical world IDs remain stable. Walking and traffic use the authored shared street network. Buy mode previews furniture and paint directly in the room, retaining server placement and purchase review rules.

## Pacing, first day and flows (2026-10-25)

- **Money for a new life.** Starting cash is $150. Starter studios cost $15 (Atlanta), $22 (New York) and $25
  (Bay Area) per game day and are prepaid for the first two game days; other neighbourhoods cost $40 to $110.
  Plane fares are $120 (Atlanta and New York), $160 (Atlanta and Bay Area) and $170 (New York and Bay Area);
  a bus costs a quarter. Starting cash covers a first flight, and about two entry shifts ($70 each in Atlanta)
  pay for the next one.
- **Opening hours.** Food venues never close, music and nightlife 12:00 to 05:00, workplaces and
  transport all day, and other places at least 07:00 to 23:00. Someone already inside when a place closes may
  still finish activities there (`Civic.openFor`). A closed place answers "<Name> is closed right now. It opens
  at HH:00."
- **First day.** `firstDay.complete` needs outside, job, shift, meal and neighbour (about ten minutes of play).
  The rent step starts done because the first two days are prepaid. `firstDay.remaining` is the ready-made
  disabled reason for plots, billboards and moving home, which unlock with `complete`.
- **Stories.** Any ordinary activity at a story landmark (not a shift or the workplace visit) opens that story's
  first beat when the activity finishes; there is no first-day gate. `Sim.storyLead` names the next story in the
  current city so the HUD can point at it.
- **Venues and civic life.** Music and nightlife venues always offer "Dance the night away" ($10, fun +28,
  social +12) on the dance floor. Every election term opens with two residents on the ballot, so there is always
  someone to vote for; running for mayor needs Charisma 1.
- **City events.** A 90-second shared event runs every nine minutes per city. `/api/social-life` returns
  `event: null` unless it starts within 90 seconds, is live, or finished and this player joined it; a finished
  event's `result` speaks only to people who joined.
- **Social reach.** A wave reaches 8 m; hang out and gift reach 3.3 m (3.8 m for walking residents). A greeted
  resident stops for nine seconds so a hang out can follow. The client targets the
  nearest person the player faces, real players before residents (`SocialTarget` in the store), and waits out the
  3-second cooldown instead of failing.
- **Movement.** `POST /api/move` may carry `via: [{x,z}]` (up to 16 corners walked since the last confirmed
  position). The server checks every straight piece of that polyline for collisions and the whole length against
  the speed budget (7.5 m/s, saved up to 12 m), so walking never pauses at a corner to wait for the server.
- **Settlement.** The client learns that an activity finished from the socket `event: sim` (the server settles
  due activities for connected players every second) or from any fresher sim; one fallback `GET /api/sim` runs
  1.5 s after the deadline only if neither arrived. The accepted result is shown once.
- **Guests and caching.** New guest lives are limited to 12 per address and 240 in total per ten minutes (429
  with a friendly message). Expired sessions are removed, unused guests after a day, and lives nobody can sign
  into after thirty quiet days. JSON responses over 1 KB are gzip-compressed; `/api/world` and `/api/version`
  may be cached for five minutes, revisioned plot atlases for a day, and every other API response is `no-store`.
