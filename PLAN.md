# Metro Life roadmap

## Status

- Playable: quick start or full creator, arrival, walking, jobs and shifts, needs, meals, furnishing, stories, aspirations, elections, plots and billboards, travel between three cities, shared presence, chat, emotes and city events.
- Far characters do not cast shadows. The creator and the scene share one palette. A 404, a 5xx, or a non-JSON reply during load shows the unreachable card and retries.
- When low quality stays under 20 fps, the render scale steps down toward 0.5. The HUD stays sharp.
- Apply stays disabled until the scene has placed the player.
- Journeys a through g (first start, resume, two players, outage, shift, social, flight) pass at 1366x768 and at 667x375 with touch.
- Frontend builds and lints. The backend packages as an API-only JAR. The API image is ready. The Vercel project `metro-life` is not created, and the API is not hosted.

## Next

1. Create the Vercel project with root `frontend`, host one API with a volume, then set `VITE_API_URL` and `METRO_ORIGINS`.
2. Keep the phone event chip and toasts off the vitals. Point the first-job quest somewhere visible. Tie wave, hang out, and gift to the person in front of the player.
3. Listen to the mix on a machine with speakers. Interior loads still feel slow.
4. Purge guest users and expired sessions, and limit new guest lives.

## Known issues

- A reload at laptop size just after arrival can leave the 3D view black while the HUD works.
- The main JavaScript chunk is about 2.2 MB because shared data is bundled into it.
- `SPEC.md` need-decay rates are older than the code.
