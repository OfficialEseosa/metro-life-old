# Metro Life — final implementation report

Metro Life is a local browser life sim in Atlanta, New York and the Bay Area. A visitor can start as a guest, choose a home and dream, earn money through work, improve needs and skills, pursue careers and stories, travel, and meet friends in a private world joined by code. All work was committed locally. Nothing was pushed or deployed.

## What was built

- A Java 21/Spring Boot authoritative server, cookie sessions and account upgrades, isolated public/private/solo worlds, and an atomic JSON save. Accepted activities survive restart and settle their rewards once when complete.
- Three 3D cities, instanced kit buildings, roads, trees, vehicles and furniture, and bespoke landmark GLBs. Hero architecture references, modelling scripts, triangle counts and recognition exceptions are documented in `landmarks.md`. Successful OpenStreetMap extracts inform selected footprints; the maps remain compressed compositions.
- A small persistent HUD and category-coloured panels, a phone bottom sheet with peek/half/full sizes, completion progress and a fly-to-counter payoff, needs, skills, eight five-level careers, seven ordered six-step aspirations, daily goals and nine city stories.
- Authoritative flights, elections, six policies, announcements, rectangle plots on one image atlas, scheduled billboards, home moving and daily rent.
- Cookie/world-bound live sockets, city-filtered presence/chat, waves, hangouts and gifts, reconnect/resync, and 40/20/10 simulated residents per city in solo/private/public worlds. Residents visit places, chat sparsely, vote and book a limited number of small plots.
- Loading and retry states, connection feedback, keyboard focus handling, reduced motion, split scene loading, warm kit windows, and a compiled JAR that serves the page, API and sockets from one address. `../README.md` gives run commands.

## Final owner review

All 31 items in groups A–D are implemented; the per-item proof index is [final-review.md](final-review.md). The separate local commits are A `48158d1`, B `d6d6b7a`, C `f9779f9` and D `f86ba50`. Final historical captures, placement repairs and regression evidence are included in the final review commit. No new landmark modelling was undertaken.

The authority suite now has 50 passing tests: 3 auth-concurrency, 12 core, 6 progression/story, 9 civic/economy, 7 community, 8 final-rules, 2 HTTP contract and 3 live-socket tests. Build and lint pass. The final build is approximately 341 kB main / 108 kB gzip and 1,275 kB scene / 347 kB gzip; the existing large-scene-chunk warning remains.

Checks and failures are recorded in [PLAN.md](../PLAN.md). Fresh evidence is under [evidence/final-review](../evidence/final-review), including both native viewport sizes, 1280x800 and 375x812. The isolated live test advances only sim creation time by one game day to exercise established gifting/voting without a 24-minute wait; it does not edit skills, money, votes or activity outcomes. Fresh-player age gates have independent authority tests.

Important behavioural corrections include guarded storage, server-anchored client time, old-poll rejection, a shared action guard, password work outside the game lock, daily exploration reset, capped policy-aware rent, abuse gates, workplace-only job applications, and reads without disk fsync. Explicit mutations save immediately; active simulation checkpoints every five seconds. Session transitions cancel previous-world resources before changing the cookie.

The scene runs on demand. In two-second settled Atlanta checks, the final repeat rendered one new frame on laptop and zero on phone, with zero resident-matrix uploads at either size. Repeated New York/Bay switches stabilized GPU geometry counts after asset-cache population. Water in New York and the Bay animates at 30 Hz when visible; camera flights and other active effects request frames while moving.

Scene performance is measured on this machine's Intel Arc with ANGLE D3D11, one GPU browser, 40 solo residents per city, day/night and both viewport sizes. Samples use three real close/overview flight pairs per theme, allowing adaptive scene DPR down to 0.85 while keeping the HUD at native CSS resolution. The completed run measured 60.00–60.39 active-flight FPS with worst P95 18.4 ms; every view met the unchanged >58 FPS, <150 calls and <300,000 triangles checks. The final successful samples all used DPR 1; the 0.85 fallback was available but did not activate in that run. Earlier 57 FPS failures and their repairs remain in PLAN.md. These are browser samples, not a physical-phone benchmark or a perfectly locked frame-rate claim.

| City | Normal calls / triangles | Shadow-refresh peak calls / triangles |
|---|---:|---:|
| Atlanta | 52 / 173,248 | 81 / 246,700 |
| New York | 47 / 237,698 | 71 / 289,062 |
| Bay Area | 49 / 222,489 | 72 / 285,487 |

Completed compiled flow checks create/join private worlds, exchange chat/presence between two profiles, keep private homes separate, settle shift pay and restore chat on reload. There are no Vite requests or development scene hooks; 360 model responses succeeded with zero browser errors. Socket checks reject no-cookie connections with 401 and foreign Origins with 403, and close existing sockets with 1008 on world switch/logout.

The screenshot review includes opaque flight controls, separate loading/failure notices, resident names/levels and overview sizing, upright booking posters, chapter kickers, thin keyboard handle focus, named waves and a readable laptop ballot. Historical captures cover arrival framing, home placement/marker, distinct action icons, shower progress and benefit, unobstructed modal close buttons, long plot titles, story spacing and aspiration states. Layout fixtures are labelled; real authoritative activities and live interactions are tested separately. Earlier milestone evidence remains under evidence/m1 through evidence/m8, with superseding runs and failures retained in PLAN.md.

## Known weaknesses, in the order a player is likely to notice

1. City geography is compressed. Some ordinary landmarks remain generic or unrecognisable, and several parks lose their real landscape proportions. Each exception has an explicit Yes/No/reason in `landmarks.md`; the independent auditor disagreed with our Metropolitan Museum aerial self-review. No independent recognition test or owner art acceptance is claimed.
2. The city fabric still has regular street spacing, empty lots and abrupt edges. The mostly unbooked community market is a large paved field; bookings now have distance-sized posters and residents have a minimum projected size, but distant city overviews still give limited detail. Close views are clearer. Kit windows have a warm night treatment; bespoke hero lighting is less detailed.
3. Residents have one simple rounded figure with colour variation. Their simulation covers limited visits, social needs and civic participation rather than the player's full career/story progression. Travel between destinations is an interpolated map movement, not street pathfinding.
4. Long-term economy, story pacing and multiplayer scale need human playtesting. Election terms take three game days; accelerated-clock unit checks and a copied-save mayor UI check cover rollover without claiming a live 63-minute wait. Rent catch-up is capped to the first six game hours and uses policy history at each eligible midnight. Policy dates from saves predating that history cannot be reconstructed; the legacy current policy is the explicit baseline.
5. The scene bundle is still about 1.27 MB before gzip and produces a Vite large-chunk warning. The main HUD is split out at about 341 KB. Model loading has visible feedback, but low-bandwidth and low-memory devices were not benchmarked.
6. Saves require one server process and a writable local disk. There is no database, multi-instance coordination, moderation service or production hosting setup. The hosting-only request/session/rate/cookie/password hardening backlog in PLAN.md is deliberately deferred; do not expose this local review build as a hosted service before that work. Back up the JSON save with the server stopped.

## What was not checked

No physical phone, iOS/Safari, touch keyboard, human listening/haptic test, screen-reader audit, long-session memory soak, large concurrent-player load, production network or hosting/deployment test was performed. Browser phone checks use Chromium at 375×812; performance measurements are on this machine's Intel Arc integrated GPU with ANGLE D3D11. The audio graph was observed running, which is not a claim that a person heard it. Controlled offline/503/model-failure tests do not prove every network failure mode.

Captured reference was studied only as data. REA repeatedly failed with Transport closed/timeouts; permitted direct-file studies and decisions for M2–M7 are in `reference-notes.md`. No reference dialogue, names or advertisements were imported. Existing asset licences remain included; map data is credited to OpenStreetMap contributors.
