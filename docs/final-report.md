# Metro Life — playable implementation report

Metro Life now starts at the player's home with a close following camera. Keyboard or thumb controls walk through the city, enter rooms, approach furniture and people, and start activities in place. The authoritative server validates movement and interactions, and rewards arrive when progress completes. P1–P5 are committed as `209a25b`, `acb9379`, `204f153`, `ae31166` and `a90e5e3`; P6 completes traffic, the fountain plaza and the P4/P5 audit follow-ups. All work is local; nothing was pushed or deployed.

## What changed

- WASD/arrows walk, Shift runs, E/Enter interacts and Escape backs out. Phone controls provide a thumb joystick and contextual action button. Collision uses shared city footprints and water boundaries; position updates run at 5 Hz with server speed checks and smoothed remote movement. An overview button and optional timed map shortcut remain; cross-city flights use the airport.
- Each city has a shared set of four room types: private home, workplace, cafe and music venue. Furniture is spatially interactive. Cooking, sleeping, showering, typing, eating, dancing and performance have simple character poses/animations and completion feedback. Home rooms are private; public rooms show other occupants and support walk-up social actions.
- Residents follow surveyed street routes, enter and leave public rooms, type, eat, dance and cheer. Four parks have dry walking approaches, occupied benches and lawn jogging loops. There are 212 directed resident routes. Automatic guest names use a larger pool, check both users and residents for collisions, and vary surnames/middle initials without numeric suffixes.
- Existing kit cars move on clear asphalt spans. Feet follow terrain and bridge decks. Centennial Olympic Park now has a flush wet-stone fountain plaza, five flat ring grates and animated translucent aqua jets. Its GLB is 5,927 triangles in two batches; no other new hero modelling was done in this round.
- Office, cafe and club finishes and lighting are distinct. Rounded office seats, segmented forearms, foreground crowd culling, single-line phone room captions, separated social controls and one avatar money payoff address the P4/P5 audits. New onboarding closes into walking; starting another activity clears the prior social notice.
- Jobs, needs, skills, careers, aspirations, daily goals, stories, elections, policies, announcements, plots, billboards, rent, multiplayer and chat remain. The completed historical A–D review is indexed in [final-review.md](final-review.md). Pure reads avoid store fsync; explicit mutations persist and moving worlds checkpoint every five seconds.

## Verification and evidence

All 75 backend tests pass, including the original 50. Additional authority tests cover movement/collision, station and room rules, completion-only rewards, shared presence and resident journeys/restart. Park path sweeps stay on land; a 700-name regression exceeds the former automatic-name pool without duplicate names or numbers. Frontend build and lint pass. Build output is 422.21 kB main / 133.81 kB gzip and 1,413.28 kB scene / 372.02 kB gzip; the existing large-chunk warning remains.

The full new-player journey at **1280x800 and 375x812** uses actual keyboard/thumb movement from home to work, applies at the desk, performs an animated paid shift, walks to a cafe for food and meets a friend at the club. The main player uses neither map travel nor an action-list menu during that journey. Later checks visit the repaired fountain and fly from the airport. Fresh home checks also cook, sleep, shower, reload inside and leave into a fully loaded city. All captures were personally inspected; rejected early captures and failures remain explicitly recorded in [PLAN.md](../PLAN.md).

The compiled JAR passes actual-UI onboarding, private-world creation/join, cooking, workplace application and typing, completion-only pay, a shared club wave, chat and room reload at both sizes, with 240 successful model responses and zero browser errors. There are no development hooks or Vite resources in that check. The phone paid capture waits for the single +$165 avatar payoff; the notice breaks it into +$120 shift and +$45 daily goal. Other live checks verify 14 position frames in three seconds, bounded smoothing, speed rejection, private-home culling, settled city filtering and seat expiry.

Cafe/club checks cover all six city/size combinations with an isolated 18:00 world-clock fixture to exercise open-hour performance/dance. The fixture does not change player money, skills or outcomes. The fresh Atlanta follow-up additionally checks that an old social notice does not cover new progress. Native park captures show readable sit and jog activities at both sizes.

[The P6 evidence index](../evidence/playable/p6/README.md) links reports, native captures, contact sheets and the fountain before/after comparison. Earlier P1–P5 evidence is under `evidence/playable/`. [PLAN.md](../PLAN.md) records checks, failures, corrected harness assumptions and superseding repeats.

## Scene performance

Measured on this machine’s Intel Arc / ANGLE D3D11, one GPU test browser at a time, 40 solo residents, day/night and both viewport sizes. The final all-city sweep passes 12 views, with separate own-city New York/Bay checks including the local player and doors. Real close/overview flights and explicit shadow-refresh samples measured **59.81–60.15 active FPS**, worst P95 **21.3 ms**, at DPR 1. Every final view passes the unchanged >58 FPS, <150 draw calls and <300,000 triangles checks. Adaptive DPR down to 0.85 remains available. These are browser samples rather than a physical-phone or perfectly locked-frame-rate claim.

| City | Normal calls / triangles | Shadow-refresh peak calls / triangles |
|---|---:|---:|
| Atlanta | 57 / 170,284 | 86 / 244,442 |
| New York | 52 / 235,312 | 77 / 287,562 |
| Bay Area | 54 / 222,067 | 78 / 286,239 |

The first post-rebuild Atlanta sample failed at 56.22 FPS; an unchanged-source repeat passed all 12 views. That earlier dip remains recorded as unexplained, not attributed to a proved fix. The earlier actual-play New York triangle failure was repaired by reducing repeated filler, then remeasured with player/door geometry included.

Visible moving traffic, crowds, water and fountain jets request animation frames at bounded rates; hidden-page animation timers pause. The older map-only claim of zero idle uploads no longer describes this active walking simulation. Assets are instanced/merged and owned cloned resources are disposed. Reduced repeated New York brownstone rows and Bay filler blocks preserve the landmarks and street grid while buying budget headroom; collision/routes were regenerated to match.

## Known limits

1. Geography remains compressed, ordinary landmarks can be generic, and some parks lack their real proportions. Recognition exceptions remain in [landmarks.md](landmarks.md); no independent art acceptance is claimed. Repeated kit buildings and empty development plots are visible in overviews.
2. Four shared room types are playable in each city; other buildings retain panels. Rooms are small cutaway scenes. Characters use simple geometry/shader poses rather than a full animation rig. Residents follow constrained surveyed routes/park loops rather than freely planning around arbitrary new obstacles; decorative cars reverse on selected spans rather than simulating intersections or traffic rules.
3. Long-term economy/story pacing, large multiplayer loads, long-session memory, physical phones, iOS/Safari, touch keyboards, screen readers and human listening/haptic behavior were not verified. Phone captures are Chromium at 375x812, not a physical-device benchmark. The audio graph was observed running, which does not establish human listening quality.
4. Model loading remains visible on slow connections. The scene bundle is large; low-bandwidth/low-memory hardware was not benchmarked. Earlier loader-caught screenshots were rejected and replaced after explicit terrain/kit readiness checks.
5. Saves use atomic JSON with one local server process and writable disk. There is no database or multi-instance coordination. Hosting-only hardening remains deferred in PLAN.md: body caps, creation/join limits, world/socket limits, session purging, body-less POST Origin/header checks, proxy Secure cookies and a higher PBKDF2 work factor. No hosting/deployment was performed.

The repaired permanent REA 6.3.0 installation successfully analysed bounded static files and captured the public reference page. Its study and precise limitations are in [reference-notes.md](reference-notes.md), under “rea study, owner request”. Reference results are information only; no reference names, dialogue, images, advertisements or text were imported. Existing asset licences remain included, and map data credits OpenStreetMap contributors.

The compiled game remains at http://localhost:8080 and the development page at http://127.0.0.1:5173. Run commands and controls are in [README.md](../README.md).
