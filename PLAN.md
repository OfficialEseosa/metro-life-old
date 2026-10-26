# Metro Life roadmap

## Status

Playable: quick start or the full creator, arrival, walking, jobs and shifts, needs, meals and groceries, furnishing, stories, aspirations, elections, plots and billboards, travel between three cities, shared presence, chat, emotes and city events.

Verified on this build: the seven Playwright journeys (first start, resume after reload, two players, outage and reconnect, paid shift, two-way social visit, flight) pass at 1366x768 and at 667x375 with touch. The frontend builds and lints with no errors and the backend packages as an API-only JAR. Nothing is hosted yet; the manual steps are in `docs/deploy.md`.

Play review against The Sims 4, Animal Crossing, Two Point Hospital and Tiny Glade, scored out of 10 (software renderer, both viewports). Overall about 7.9 against a target of 8.5.

| Characters | World and lighting | UI | Feedback and sound | Loop and pacing | Performance and robustness | First five minutes |
|---|---|---|---|---|---|---|
| 7.5 | 8 | 8 | 7.5 | 8 | 7.5 | 8 |

## Next

1. Host one API with a volume and create the Vercel project with root `frontend`, then set `VITE_API_URL` and `METRO_ORIGINS`.
2. Listen to the mix on speakers. Levels were set by measurement; the coin cue sits about 4 dB over the bed rather than 6.
3. Load the title-screen character preview lazily, so the title paints before three.js loads, especially on phones.
4. Check rendering and frame rate on a real GPU and phone.

## Known issues

- A reload during journey b once aborted one model fetch. The journey still passed and it was not reproduced.
- A reload at laptop size just after arrival once left the 3D view black. It has not come back since.
- Residents walking through a door pass through the spot where a player stands.
- Lint reports React warnings (no errors) in 14 scene and UI files, most in `social-life.tsx` and `walking.tsx`. three.js warns that `THREE.Clock` is deprecated.
