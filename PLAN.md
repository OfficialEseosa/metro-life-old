# Metro Life roadmap

## Status

- Playable: quick start or full creator, arrival, walking, jobs and shifts, needs, meals and groceries, furnishing, stories, aspirations, elections, plots and billboards, travel between three cities, shared presence, chat, emotes and city events.
- Verified on this build: the seven Playwright journeys (first start with the bed, resume after reload, two players, outage and reconnect after the API restarts, paid shift, two-way social visit, flight) pass at 1366x768 and at 667x375 with touch. The frontend builds and lints with no errors, and the backend packages as an API-only JAR. A meal at the Ponce market was played in the browser. Booking a plot was checked only up to its first-day gate: the API refuses with the goals still to do. A story beat was not played end to end in this pass.
- Fixed in the last pass:
  - Rooms stand on a street or lawn, the room camera frames the player, and the wheel or a pinch zooms within limits. Market draw calls fell from 185 to 72.
  - Characters: warmer skin and varied cloth and hair, hair outlines that break up, idles per personality, heads that turn toward neighbours, and a rounded crowd figure in place of the far impostors. Name plates are 256 px with 16 px text.
  - HUD:
    - Career lists the job hiring where you stand first, and the first-job cue opens it.
    - Tapping the clock explains the seven-minute day.
    - On phones, the event chip, cue, toasts and shift card each keep their own space.
    - Key hints are 16 px, and Gift says why it is disabled.
  - Gameplay:
    - Every Ponce stall sells something. Groceries fill a pantry for home cooking. The aquarium and airport actions work.
    - A door tap during an action queues the walk, and Escape does the same.
    - The social target stays on the person you face.
    - Guest lives are limited per address and in total, deleted guests leave nothing behind, and saves are compact.
  - Feedback:
    - The mix runs through a compressor and limiter: about -21 dBFS mean, peaks under -1, cues 4 to 12 dB over the bed.
    - Toast labels and details are 16 px and wrap to two lines.
    - Money labels start below the vitals, and toasts rise above task cards.
    - Wave, hang out and gift answer over the target on both players' screens.
    - City events give a sound and a ring.
  - A refused guest sign-up explains why. On short screens object menus open as a wide list. The e2e setup warms the dev server before journey a.
- Play review against The Sims 4, Animal Crossing, Two Point Hospital and Tiny Glade (software renderer, both viewports), scored out of 10. Before this pass the overall score was about 5.5; it is now about 7.6:

  | Axis | Score |
  |---|---|
  | Characters | 7 |
  | World and lighting | 7.5 |
  | UI | 8 |
  | Feedback and sound | 7.5 |
  | Loop and pacing | 7.5 |
  | Performance and robustness | 7.5 |
  | First five minutes | 8 |

  This misses the 8.5 target. What remains is listed under Next and Known issues. It needs either listening on real speakers, a GPU, or asset and design work beyond this pass.
- Nothing is hosted: the Vercel project `metro-life` is not created and the API has no host. The checklist is in `docs/deploy.md` under "What is still manual".

## Next

1. Create the Vercel project with root `frontend`, host one API with a volume, then set `VITE_API_URL` and `METRO_ORIGINS`.
2. Listen to the mix on speakers. The levels were set by measurement, because the review machine has no audio device. The coin cue sits about 4 dB over the bed rather than 6.
3. The airport reads as plain blocks from the kerb. Give the landside piers glazing and signage.
4. Characters up close: the rounded crowd figure is plain within a few metres, and turning in place was not checked on screen.
5. First load takes about 7.5 s here. Split shared data out of the 2.2 MB main chunk and shrink the character files.

## Known issues

- On phones, street draw calls reached 146 in one run, over the 140 budget.
- For about 1.5 s a money label can cover part of a toast. On phones the bubble over your own head can touch the event chip.
- A reload at laptop size just after arrival once left the 3D view black. It has not come back in this pass.
- Residents walking through a door pass through the spot where a player stands.
- Lint reports React warnings (no errors) in `buy-mode.tsx` and `residents.tsx`. three.js warns that `THREE.Clock` is deprecated.
