# Metro Life roadmap

## Status

- Playable: quick start or full creator, arrival home, walking, jobs and shifts, needs, cafe meals, home furnishing, stories, aspirations, elections, plots and billboards, travel between three cities, shared presence, chat, emotes and city events.
- Build: frontend type-checks, builds and lints with no errors; the backend packages as an API-only JAR; a Docker image for the API builds.
- Deployment: frontend set up for the Vercel project `metro-life` (Root Directory `frontend`, `frontend/vercel.json`); the project still has to be created in the Vercel dashboard. API ready for one container with a volume (`backend/Dockerfile`, `METRO_ORIGINS`); not hosted yet.
- Sessions work across origins: first-party cookie when same-site, `SameSite=None; Secure; Partitioned` cross-site over HTTPS, and a header session for browsers that block third-party cookies.
- Connection problems show a screen with a button: server unreachable (auto retry), blocked cookies, ended session, slow first load, and a reconnect banner in play.
- Regression gate: Playwright journeys in `e2e/` (first start, resume, two players online, server outage).

## Next

1. Merge the gameplay branch (one settlement path, social cooldowns, complete action flows).
2. Create the Vercel project and host the API (Render, Fly.io or Koyeb); then set `VITE_API_URL` and `METRO_ORIGINS`.
3. Add the work-shift, social (wave, hang out, gift) and flight journeys to `e2e/`.
4. Characters: cull people outside the shadow camera so they stop costing a full shadow pass.
5. Share one palette between the creator (`ui/looks.ts`) and the characters.

## Known issues

- Reloading at laptop size shortly after arriving could leave the 3D view black while the HUD works (scene loading); recheck after the world changes.
- The main JavaScript chunk is about 2.2 MB because large shared data is bundled into it.
- Guest users and expired sessions are never purged and `/api/auth/guest` has no rate limit.
- `SPEC.md` need-decay rates are older than the code.
