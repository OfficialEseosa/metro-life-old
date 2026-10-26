# Design notes

Metro Life borrows mechanics, not content, from the life-sim genre. No source dialogue, names, advertisements, icons, emoji or place content are reused. The decisions below are what the game deliberately does.

## Simulation and actions

- Four needs and seven skills. Canonical activity labels expand into explicit server-side actions with duration, costs, need deltas, social tags and a pose.
- The server validates every action and applies rewards centrally; the browser never computes money or needs. Busy time is short and visible, offline decay is capped, and user/world state persists.
- One clear play entry, a compact setup (city, home, dream, look) and immediate direction to an entry-level job.
- Needs stay numeric with semantic meters and visible labels. Requirements and closed hours sit next to the actions they block; busy time has a progress indicator and blocks duplicates. Results describe their effects and can be dismissed.
- Careers use five levels with visible shift and skill requirements and promotion at shift completion. Seven distinct six-step aspirations record durable claims, so switching dreams cannot repeat rewards.
- City stories are short original three-beat chains triggered by completed activities. A skilled route pays more; a collaborative route needs no skill. Failed checks still continue with practice XP. The server protects pending ids, choices and once-only outcomes.

## City, camera and map

- Bounded pan and zoom with optional orbit; city-specific spatial tables; merged vertex-colour landmark geometry; repeated trees, homes and lamps instanced; one icon-atlas pin batch with one hover label.
- Large recognisable landmarks, simplified filler. Sky gradient, muted city greens, lit windows at night and lake ripple.
- Camera animation stays separate from React HUD updates; ambient rendering pauses in hidden tabs.
- A city reads as busy through repeated development, traffic, local crowds and roadside billboards rather than through raw building count.
- Free map viewing shows a "visiting this map" notice when the character is elsewhere. Flights are airport actions with a visible price and a short busy state; arrival changes the character's city while keeping home, job and world.
- New York water divides Manhattan and Brooklyn; Bay water separates the peninsula and the East Bay.

## Civic life, property and social

- Elections: authoritative once-per-game-day campaign support, one vote per term, first-on-ballot tie rule, Charisma 2 gate, no registration fee.
- Plots are rectangles with an area price and a seven-day lease, checked for overlap under the server lock. Billboards use exclusive scheduled bookings, at most four per slot, with an explicit start time.
- Daily rent, a disclosed one-day move fee, non-negative cash and arrears repaid from later funds. No eviction, external payment or uploads.
- The server owns social effects and cash, and validates shared world, city, location, cooldown and target availability.
- Server-owned residents each have one location, sparse chat and limited civic/property participation, so they cannot flood chat or monopolise plots.
- One cookie-bound world socket with city filtering, bounded histories, reconnect resync and instanced crowd models. Socket sends are serialised through bounded per-client buffers so a slow client never holds the simulation lock.

## Character creation

Visible appearance choices on a shared 3D preview: two bodies, skin tones, hair and hair colour, and casual or street starting outfits, plus pronouns and a $150 studio start. Every browser joins the same public city; there is no login or world picker.

## HUD principles

- The simulation stays authoritative outside React. Text and controls are DOM, not canvas.
- One small persistent cluster and at most one secondary cluster; keep the centre and lower-middle clear. Prompts are contextual and details are closed by default.
- Keyboard and focus management, 44 px touch targets on phones, safe-area padding, no disabled zoom, reduced-motion support, polite live announcements, transform/opacity animation only.
- Every workflow has real loading, empty and error states.
- Palette, typography, sheet states and allowed copy are in `hud-design.md`.
