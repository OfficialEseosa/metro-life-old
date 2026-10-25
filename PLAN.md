# Metro Life roadmap

## Status

- Playable: quick start or full creator, arrival home, walking, jobs and shifts, needs, cafe meals, home furnishing, stories, aspirations, elections, plots and billboards, travel between three cities, shared presence, chat, emotes and city events.
- Build: frontend type-checks, builds and lints with no errors; the backend packages as an API-only JAR; a Docker image for the API builds.
- Deployment: frontend ready for Vercel (`frontend/vercel.json`, `VITE_API_URL`), API ready for one container with a volume (`backend/Dockerfile`, `METRO_ORIGINS`). Nothing is deployed yet.
- Sessions work across origins: first-party cookie when same-site, `SameSite=None; Secure; Partitioned` cross-site over HTTPS, and a header session for browsers that block third-party cookies.
- Connection problems show a screen with a button: server unreachable (auto retry), blocked cookies, ended session, slow first load, and a reconnect banner in play.

## Next

1. Characters: closer to stylised-realistic, cheaper per frame (cached bones, no per-frame lookups, steadier near/far switching, one shared portrait renderer).
2. World and rendering: render continuously while playing instead of interval timers, shadows that follow the player outdoors, no full scene rebuild on city change, adaptive quality that recovers.
3. HUD: one stylesheet and design system, controls mounted once, narrow store selectors so 5 Hz updates do not re-render the HUD.
4. Gameplay flows: one settlement path instead of three pollers, smooth click-to-walk around corners, visible social cooldowns, every action with a complete start, progress, result and exit.
5. Feedback: a visible and audible response for every event (start, finish, cancel, error, purchase, promotion, rent, arrival, travel); replace the filler speech bubble text.
6. A few Playwright journeys as the regression gate (first start, a work shift, two players meeting, travel).

## Known issues

- Reloading at laptop size shortly after arriving can leave the 3D view black while the HUD works; reproduced on the code before the deployment work, so it is a scene loading issue.
- The main JavaScript chunk is about 2.2 MB because large shared data is bundled into it.
- Guest users and expired sessions are never purged and `/api/auth/guest` has no rate limit.
- `SPEC.md` need-decay rates are older than the code.
