# Metro Life roadmap

## Status

- Playable: quick start or full creator, arrival, walking, jobs and shifts, needs, meals, furnishing, stories, aspirations, elections, plots and billboards, travel between three cities, shared presence, chat, emotes and city events.
- Verified on this build: the seven Playwright journeys (first start, resume, two players, outage, shift, social, flight) pass at 1366x768 and at 667x375 with touch. The frontend type-checks, builds and lints with no errors. The backend packages as an API-only JAR and the API image is ready.
- Fixed in the last pass: far characters cast no shadows; the render scale steps down toward 0.5 when low quality stays under 20 fps; Apply waits until the scene has placed the player; toasts sit beside the vitals plate; the money sheet closes on Escape, a tap outside or a panel; other players read as Player; a newcomer stands beside the person already at a door; plate names no longer vanish into the wall behind a door; phones skip the started card the queue pill already shows.
- A play review against The Sims 4, Animal Crossing, Two Point Hospital and Tiny Glade (software renderer, both viewports) scored about 7.5 of 10 overall: characters 7.5, world and lighting 7.5, UI 8 on a laptop and 7.5 on a phone, feedback 7, loop and pacing 7.5, robustness 7, first five minutes 7.5. What remains is design work rather than defects, listed under Next, so the review loop stopped here.
- Nothing is hosted: the Vercel project `metro-life` is not created and the API has no host. The checklist is in `docs/deploy.md` under "What is still manual".

## Next

1. Create the Vercel project with root `frontend`, host one API with a volume, then set `VITE_API_URL` and `METRO_ORIGINS`.
2. Camera: in halls wider than about 20 m (market, arena, airport, stadium) follow the player instead of framing the whole room. At 1366x768 the player is a few pixels tall in the market.
3. The airport reads as plain blocks from the kerb. Give the landside piers glazing and signage.
4. Listen to the mix on a machine with speakers; a headless review cannot judge sound. On a slow machine interior furniture can arrive some seconds after the room.
5. Purge guest users and expired sessions, and limit new guest lives.

## Known issues

- A reload at laptop size just after arrival can leave the 3D view black while the HUD works.
- Residents walking through a door pass through the spot where a player stands.
- The main JavaScript chunk is about 2.2 MB because shared data is bundled into it.
- `SPEC.md` need-decay rates are older than the code.
