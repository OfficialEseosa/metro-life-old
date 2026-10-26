# Metro Life roadmap

## Status

- Playable: quick start or full creator, arrival, walking, jobs and shifts, needs, meals and groceries, furnishing, stories, aspirations, elections, plots and billboards, travel between three cities, shared presence, chat, emotes and city events.
- Verified on this build: the seven Playwright journeys (first start with the bed, resume after reload, two players, outage and reconnect after the API restarts, paid shift, two-way social visit, flight) pass at 1366x768 and at 667x375 with touch. The frontend builds and lints with no errors, and the backend packages as an API-only JAR. Played in the browser at both sizes: a meal at the Ponce market, a story beat at Tech Village (Co-work, the choice card, then play resumes), and a plot purchase (all six first-day goals, then a 2×2 plot booked for $140).
- Fixed in loop round 11:
  - At Hudson General (Presbyterian) the Met's collision box ran 6 m past the museum's back wall and stopped 3 m from the hospital door, so the camera looked down from above. The Met and Grand Central boxes now match their buildings. The hospital moved 1.5 m west, out of Northside Ballpark's camera view. Hudson General, Fifth Promenade and the Met now show from the front.
  - Northside Ballpark's stands reached past its own gate, so the player stood inside the wall and the sign was edge-on. The ballpark is now sized to its collision box, and the sign reads on laptop and phone.
  - The Transbay bus station stood on top of Bay Civic House's door, so its sign hung in front of City Hall and the station was seen side-on behind Mission Kitchen Row. The station now stands on open ground beside UCSF, with its walkway, plaza and resident routes moved. Both now show from the front.
- Fixed in loop round 10:
  - At Magnolia Square (Lenox) the south edge of the Piedmont Park model reached the shops' plaza, so a cluster of park trees stood between the camera and the sign and door. Park trees and props in any door's camera view are now left out of the park model, and the park's own gate path is clear too.
  - On phones, more than one passer-by's name plate could fill the screen next to a venue sign. Short screens now show one at most. Plates also keep clear of the first-day cue.
  - The Midtown Green walkway still led to the old gate position. It now leads to the moved gate.
  - The Five Points bus station stood 1.6 m in front of the Capitol's back wall, so the camera only saw it side-on along the canopy. The station now stands on open ground west of the Capitol, beside the downtown street, with its walkway and resident routes moved too. Its sign and the player show from the front on laptop and phone.
- Fixed in loop round 9:
  - At Peachtree Institute (Georgia Tech) the door stood 0.2 m from the aquarium's back wall, so the camera only saw the sign edge-on and phones lost the player. The campus now stands on open ground west of the aquarium, and the sign reads from the front.
  - At Midtown Green (Piedmont Park) the Peachtree Crown tower stood 3 m in front of the gate, so the camera looked down from above and phones could not read the sign. The gate is now 5 m east, clear of the tower, and the sign reads from the front.
  - At the Deepwater Aquarium a low park wall hid the player's legs, because the cut-out only checked the chest and the sign. It now checks the feet too.
- Fixed in loop round 8:
  - At Chase Center (Baylight Arena) the camera only had a side-on view. The Bay airport's collision box stood 10 m tall over the whole apron, though the terminal is low. It is now split into the terminal hall and a low apron strip, so the camera looks at the arena from the front.
  - At Oracle Park (Waterfront Ballpark) the ballpark's rear wall was drawn past its collision box and over the door. A parked plane and a filler building with no collision also filled the edge of the view. The ballpark now stays inside its box. The Bay airport has no east piers or planes facing the two arenas, and no filler building stands in any door's camera view.
  - At Dolores Park (Mission Meadow) and the Painted Ladies (Pastel Row), trees stood between the camera and the sign. No filler tree is placed in a door's camera view. The park's own west row of trees stands east of the path.
  - At Wall Street (Exchange Row) the bull stood on the door, so the player stood inside it. It now stands beside the sign post.
- Fixed in loop round 6:
  - Madison Square Garden (Midtown Garden Arena) was drawn 0.7 m past its own door, so the player stood inside the wall and the wall cut through the sign. The arena is smaller now and both show.
  - At the Georgia Aquarium door a pavilion in Olympic Rings Park stood between the camera and the player. The park now gets the same clean cut-out as buildings. The paths stay solid.
  - At Peachtree Institute (Georgia Tech) an edge of the aquarium wall stood in front of the sign. Any building the sight line crosses for more than 3 m now cuts away, and so does anything blocking the sign above a door.
  - Resident name plates keep clear of hiring boards as well as venue signs.
  - At Olympic Rings Park the street camera looked through the SkyView wheel, so spokes crossed the sign and the player. The wheel now has a collision box, so walkers go round it and the camera finds a clear view.
  - On the East River Bridge (Brooklyn Bridge) deck the suspension cables crossed the venue sign. The cables are too thin for the probe rays to hit, so bridges now always open a cut-out the width of the sign. The deck below the player stays solid.
  - At the Ferry Building (Bayside Ferry Hall) the camera only had a side-on view, so the sign was edge-on and unreadable. Salesforce Tower's collision box was 4 m wider to the west and 3.5 m deeper toward the ferry than the tower drawn there, and it blocked every front view. The box now matches the tower, so the camera looks at the ferry from the front.
  - On phones a big toast such as "Milestone reached" stood three lines tall over the player and the sign. On short screens toasts now drop the icon and the detail line, so the kicker and title read in full on one line each and the card stays below the player.
- Fixed in loop round 5:
  - Pier 39's door is surveyed out over the water, so the server found nowhere to stand and every trip there failed with "This entrance is busy". A booked trip then kept failing on the server and the player stayed on "Heading to Sealion Pier". People now arrive at a door that has no surveyed ground nearby and can walk the few metres back to shore. The door moved onto the pier deck in front of its sign. Crowded doors on land still say the entrance is busy.
  - Signs, boards and buildings that hide the player no longer fade in a dotted pattern, which showed as dotted lines at the Ferry Building and the Bay airport. Thin signs drop out whole while they are in the way, and anything bigger gets a clean cut-out around the player.
  - The ballpark overlapped the Cloudspire Tower (Salesforce) entrance. The player stood inside its stands and could not be seen, and the stands hid the end of the sign. The ballpark is narrower and sits 3 m east, so the player and the whole sign show.
  - Checked every Bay landmark (airport, Golden Gate, Ferry Building, Painted Ladies, Pier 39, Salesforce, City Hall) on laptop and phone.
- Fixed in loop round 4:
  - On phones the event chip covered the venue sign whenever the player stood at a door (Uptown Green, Concord Terminal, East River Bridge, Harbor International). The phone street camera now looks a little higher, so the sign sits below the chip and the player stays clear of the bottom bar.
- Fixed in loop round 3:
  - Once a tall building swung the street camera side-on, it stayed there. It now returns behind the player when that view is clear. Where a building blocks it, the camera first moves closer and higher from the front, and only swings to the side if that is blocked too. High Museum now gets a front view. The Ferry Building, Georgia Tech and a few New York and Bay doors still have no clear front view, so the camera there stays side-on.
  - Resident name plates keep clear of venue signs, so they no longer cover the name of the place.
  - Hiring boards stand on whichever side of the sign has open pavement. At Tech Village the board had been hidden behind the building next door.
  - Checked New York (Times Square, Crown Tower, Central Park, Brooklyn Bridge) and the Bay (airport kerb, Golden Gate, Ferry Building, Painted Ladies) on laptop.
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
- Lint reports React warnings (no errors) in 14 scene and UI files, most in `social-life.tsx` and `walking.tsx`. three.js warns that `THREE.Clock` is deprecated.
