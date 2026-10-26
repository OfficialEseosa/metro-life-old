# Metro Life roadmap

## Status

- Playable: quick start or full creator, arrival, walking, jobs and shifts, needs, meals and groceries, furnishing, stories, aspirations, elections, plots and billboards, travel between three cities, shared presence, chat, emotes and city events.
- Verified on this build: the seven Playwright journeys (first start with the bed, resume after reload, two players, outage and reconnect after the API restarts, paid shift, two-way social visit, flight) pass at 1366x768 and at 667x375 with touch. The frontend builds and lints with no errors, and the backend packages as an API-only JAR. Played in the browser at both sizes: a meal at the Ponce market, a story beat at Tech Village (Co-work, the choice card, then play resumes), and a plot purchase (all six first-day goals, then a 2×2 plot booked for $140).
- Fixed in loop round 2:
  - Where the street camera arrives beside a door (High Museum, Tech Village, Capitol, Grady), the venue sign and the hiring board stood edge-on between it and the player. They now fade like buildings when they hide the player. Seen from the front they stay solid.
  - Hiring boards stand outside the venue sign posts, not inside the entrance.
  - The live event chip drops the word "moments" so the venue name fits. The progress bar still shows the count.
- Fixed in loop round 1:
  - Residents give up a seat to a player when they hold every matching one. Before, a Co-work at Tech Village could fail with "The furniture is in use" and the story never started.
  - Story cards are compact on short screens, so every choice fits at 667x375. A story choice shows its outcome as a toast.
  - Name plates cut on whole words. Wave bubbles and plates keep clear of the vitals, the first-day cue, the event chip and the walking controls. Event titles wrap to two lines. On phones, toasts move to the free side when a panel is open and their detail stays on one line.
  - Airports: the terminal frontage has glazing, a canopy, a kerb and Departures, Arrivals and Taxi signs, and storefront boards stand on posts. Far landmarks cast no shadows. Atlanta trees keep out of landmark arrival plazas. Phone draw calls at the Atlanta airport peak at 118, and the Ponce street holds at 41.
  - First load: vendor code is split into parallel chunks, and 64 world models and four textures are compressed with meshopt and WebP (20.8 to 12.4 MB). On the software renderer the laptop city is ready in a median 20.7 s, down from 30.5 s. Phone timing did not change.
  - Characters: rigged faces have larger eyes, lid lines and fuller brows. Cloth has a darker hem and cuffs, and shoes contrast with trousers. The crowd figure has eyes, brows, a collar, a hem, a fringe and long-hair pieces and is still one draw call. Turning on the spot is a 0.4 s planted step instead of a slide.
- Fixed in the pass before:
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
- Play review against The Sims 4, Animal Crossing, Two Point Hospital and Tiny Glade (software renderer, both viewports), scored out of 10. The overall score was about 5.5 at the start, 7.6 after the first pass, and is now about 7.9:

  | Axis | Score |
  |---|---|
  | Characters | 7.5 |
  | World and lighting | 8 |
  | UI | 8 |
  | Feedback and sound | 7.5 |
  | Loop and pacing | 8 |
  | Performance and robustness | 7.5 |
  | First five minutes | 8 |

  This misses the 8.5 target. What remains is listed under Next and Known issues. It needs either listening on real speakers, a GPU, or asset and design work beyond this pass.
- Nothing is hosted: the Vercel project `metro-life` is not created and the API has no host. The checklist is in `docs/deploy.md` under "What is still manual".

## Next

1. Create the Vercel project with root `frontend`, host one API with a volume, then set `VITE_API_URL` and `METRO_ORIGINS`.
2. Listen to the mix on speakers. The levels were set by measurement, because the review machine has no audio device. The coin cue sits about 4 dB over the bed rather than 6.
3. First load: the character preview on the title screen imports the scene code, so three.js loads before the title shows. Loading the preview lazily would let the title paint first, especially on phones.
4. Check rendering and frame rate on a real GPU and phone. The review machine renders in software.

## Known issues

- A reload during journey b once aborted one model fetch. The journey still passed, and it was not reproduced.
- A reload at laptop size just after arrival once left the 3D view black. It has not come back since.
- Residents walking through a door pass through the spot where a player stands.
- Lint reports React warnings (no errors) in `buy-mode.tsx` and `residents.tsx`. three.js warns that `THREE.Clock` is deprecated.
