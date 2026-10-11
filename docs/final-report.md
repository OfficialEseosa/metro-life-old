# Metro Life — final implementation report

Metro Life is a local browser life sim in Atlanta, New York and the Bay Area. A visitor can start as a guest, choose a home and dream, earn money through work, improve needs and skills, pursue careers and stories, travel, and meet friends in a private world joined by code. All work was committed locally. Nothing was pushed or deployed.

## What was built

- A Java 21/Spring Boot authoritative server, cookie sessions and account upgrades, isolated public/private/solo worlds, and an atomic JSON save. Accepted activities survive restart and settle their rewards once when complete.
- Three 3D cities, instanced kit buildings, roads, trees, vehicles and furniture, and bespoke landmark GLBs. Hero architecture references, modelling scripts, triangle counts and recognition exceptions are documented in `landmarks.md`. Successful OpenStreetMap extracts inform selected footprints; the maps remain compressed compositions.
- A small persistent HUD and category-coloured panels, a phone bottom sheet with peek/half/full sizes, completion progress and a fly-to-counter payoff, needs, skills, eight five-level careers, seven ordered six-step aspirations, daily goals and nine city stories.
- Authoritative flights, elections, six policies, announcements, rectangle plots on one image atlas, scheduled billboards, home moving and daily rent.
- Cookie/world-bound live sockets, city-filtered presence/chat, waves, hangouts and gifts, reconnect/resync, and 40/20/10 simulated residents per city in solo/private/public worlds. Residents visit places, chat sparsely, vote and book a limited number of small plots.
- Loading and retry states, connection feedback, keyboard focus handling, reduced motion, split scene loading, warm kit windows, and a compiled JAR that serves the page, API and sockets from one address. `../README.md` gives run commands.

## Verification

The authority suite has 37 passing tests: 12 core, 6 progression/story, 9 civic/economy, 5 community and 5 HTTP/socket tests. Frontend build and lint pass. M1–M7 checks, their initial failures and corrections remain recorded in `../PLAN.md`; M8 reports are in `../evidence/m8/`.

Final scene measurements use 40 solo residents per city, day/night, 1280×800 and 375×812, Intel Arc ANGLE D3D11, one GPU browser and no Blender. The sample starts after an 11-second warm-up; adaptive DPR is permitted. All views stayed below 150 draw calls and 300,000 triangles. Laptop warm samples were 59.01–59.80 FPS; phone samples 58.06–59.86 FPS, with worst P95 22.9 ms. These are measured approximately-60-FPS samples, not a physical-phone benchmark or a promise of a perfectly locked frame rate.

| City | Normal draw calls / triangles | Shadow-refresh peak calls / triangles |
|---|---:|---:|
| Atlanta | 51 / 177,660 | 80 / 249,509 |
| New York | 46 / 238,626 | 70 / 289,990 |
| Bay Area | 48 / 229,109 | 71 / 292,107 |

The final scene contact sheets and native views were inspected: ground is distinct at night, broad water ripples replace the moire pattern, kit windows glow individually, and rounded resident groups are clear in close park views. Geometry counts vary slightly as residents move in/out of view. No new full landmark-recognition round is claimed.

Final M8 flows pass at both native sizes:

- A fresh visitor earns their first completed shift in 8.355 seconds on laptop and 7.655 seconds at phone size; cash stays unchanged while the progress bar runs.
- Actual flights Atlanta → New York → Bay → Atlanta preserve job, home and world, recover an arrival after reload, and keep free map viewing separate from travel.
- Two independent cookie profiles exchange presence, movement, chat, waves, gifts and votes live. City/world filtering, NPC movement, reload deduplication and disconnect expiry pass.
- Fixed bottom primaries, phone sheet sizes, story choices, search focus/Escape, modal focus trapping, reduced motion and empty chat pass. Candidate layout and full-sheet social notice use labelled visual fixtures; authoritative live voting/social checks are separate.
- Delayed model loading, forced offline action/socket reconnect, controlled API 503 retry and model failure → error boundary → reload recovery pass. The audio context and notes run after a gesture.
- The final compiled JAR creates/joins private worlds by code, shows two online, keeps private homes separate, pays a shift and restores chat after reload. It serves page/assets/API/sockets without Vite or the development scene hook: 360 successful model responses, zero browser errors. Real sockets return 401 without a cookie, 403 for a foreign origin, and close 1008 after world switch/logout.

Commands: `node scripts/m8-scene.cjs`, `m8-travel.cjs`, `m8-layout.cjs`, `m8-polish.cjs`, `m8-live.cjs`, `m8-audit.cjs`, `m8-production.cjs` and `m8-socket.cjs` (each filename is under `scripts/`). Normal flows have zero collected page errors; scene/live/compiled checks also collect console errors. Controlled failures intentionally produce failed responses and loader diagnostics. Reports and screenshots are under `evidence/m8/`; native phone chat, candidate layout, story, recovery, city contacts and targeted night/crowd views were inspected.

Earlier milestone evidence remains under `evidence/m1` through `evidence/m7` and the audit-correction folders. The owner-called Atlanta landmarks have before/after art evidence and reference/model comparisons. `PLAN.md` records failures and superseding runs rather than counting them as passes.

## Known weaknesses, in the order a player is likely to notice

1. City geography is compressed. Some ordinary landmarks remain generic or unrecognisable, and several parks lose their real landscape proportions. Each exception has an explicit Yes/No/reason in `landmarks.md`; the independent auditor disagreed with our Metropolitan Museum aerial self-review. No independent recognition test or owner art acceptance is claimed.
2. The city fabric still has regular street spacing, empty lots and abrupt edges. The mostly unbooked community market is a large paved field; small posters and residents are difficult to read in a distant city overview. Close views are clearer. Kit windows have a warm night treatment; bespoke hero lighting is less detailed.
3. Residents have one simple rounded figure with colour variation. Their simulation covers limited visits, social needs and civic participation rather than the player's full career/story progression. Travel between destinations is an interpolated map movement, not street pathfinding.
4. Long-term economy, story pacing and multiplayer scale need human playtesting. Election terms take three game days; accelerated-clock unit checks and a copied-save mayor UI check cover rollover without claiming a live 63-minute wait. Offline rent catch-up uses the current housing policy rather than a history of past policy rates.
5. The scene bundle is still about 1.27 MB before gzip and produces a Vite large-chunk warning. The main HUD is split out at about 338 KB. Model loading has visible feedback, but low-bandwidth and low-memory devices were not benchmarked.
6. Saves require one server process and a writable local disk. There is no database, multi-instance coordination, moderation service or production hosting setup. Back up the JSON save with the server stopped.

## What was not checked

No physical phone, iOS/Safari, touch keyboard, human listening/haptic test, screen-reader audit, long-session memory soak, large concurrent-player load, production network or hosting/deployment test was performed. Browser phone checks use Chromium at 375×812; performance measurements are on this machine's Intel Arc integrated GPU with ANGLE D3D11. The audio graph was observed running, which is not a claim that a person heard it. Controlled offline/503/model-failure tests do not prove every network failure mode.

Captured reference was studied only as data. REA repeatedly failed with Transport closed/timeouts; permitted direct-file studies and decisions for M2–M7 are in `reference-notes.md`. No reference dialogue, names or advertisements were imported. Existing asset licences remain included; map data is credited to OpenStreetMap contributors.
