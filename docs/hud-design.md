# Metro Life HUD visual direction

Owner direction: audits/UI-UX-guide.md. The city is the screen. Playing mode is an experience, not a dashboard. The memorable motif is a friendly illustrated portrait in a substantial mood ring attached to a small cream cash-and-clock plate.

Palette: plate #FFF7EA; inset #EFE3CF; edge #CBB79A; ink #243E3A; secondary ink #53685F; green primary #216546 / edge #124631. Semantic tiles: money amber #C18121 / tint #FFF0CC / edge #855112; energy blue #477CB7 / #E0EDFC / #31577E; hunger coral #C46649 / #FFE5D8 / #873E2A; fun violet #8767B1 / #EFE3FA / #5C427C; social teal #378879 / #DDF3EC / #235C52. All have text/icon redundancy.

Typography: existing self-hosted Bricolage Grotesque 750 for headings/cash/rewards; Geist 500 body and 650 controls. Body and labels 16px, supporting copy at least 15px, cash 30px, panel titles 24–28px. Tabular numbers. Sentence case.

Material: opaque cream plates, 2px warm edges, 20px outer / 12px inner radii. Green primary buttons have a 4px bottom lip. Filled 38px semantic icon tiles; lucide 20px / stroke 2.5. One tinted shadow direction; no blur.

Persistent desktop: top-left portrait/cash/clock cluster ~286×84; top-right compact city/control capsule and up to three needs/mood chips below. Four small lower-left menu tiles (Home, Career, World, Search) collapse when a panel opens. Centre and lower-middle remain open; no full-width header/footer or pinned information cards. One transient next-step cue for first job.

Phone: portrait/cash cluster upper-left, city/control button upper-right. Needs warnings only when relevant. Search/lenses open on demand. Bottom dock is a compact four-item cream tray only when no sheet is open. Location opens at peek (~190px to fit 48px primary plus heading/handle); half 50dvh; full 90dvh. Handle tap cycles heights, drag snaps, keyboard alternatives. No backdrop for location. Close returns dock. Primary is in a fixed summary slot above scroll content at every height. Other panels default half/full as appropriate. Safe-area padding.

Location structure: handle; category tile, name and open hours with close; primary action/progress; secondary actions and short context below. One active action slot. Primary work action takes priority once hired. Keep map usable above sheets; camera target offset tracks measured panel rectangle.

Action response: press 80ms; progress bar/marker ring until server completion. Server persists pending activity; balance/needs settle once at deadline. At completion a outlined +cash label floats from building, flies to cash plate; counter rolls 650ms and punches 150ms. Synthesized short local sounds (tap/open/close/coin/error) after first gesture; mute. Reduced motion uses cuts and simple fades. No per-frame React store updates.

Entry: existing city stays full screen behind compact wordmark/city capsule and small left welcome invitation. No giant marketing panel. Start playing → solo/private/join → setup with an illustrated portrait and clear Start my life action. Existing information/function is preserved.

Required mockup states before code: desktop playing/location, phone peek, half/running, needs; entry/onboarding component families. Generated concept is evidence only, not a runtime texture. Existing 3D world, illustrated SVG portrait and local icon set remain intentional code-native assets under repository asset rules. All UI text/controls remain HTML.

Allowed visible UI vocabulary: Metro Life, city names, Day/time, cash, Home, Career, World, Search places, Eat, Earn, Have fun, Affordable now, Your life, needs/skills/goals, canonical place/action/job names, Open/Closed hours, Work a shift, More to do, Start playing, Play solo, Play online, Start my life, Keep your progress, Preview, settings/mute/accessibility labels. Dynamic API values are real. Do not invent fake metrics, quest claims or decorative eyebrow labels.

Review: compare concept and actual at 1280×800/375×812 for composition, cream/semantic colours, type, icon mass, primary position, sheet heights, map exposure. At most three batched rounds. User direction supersedes generic skill approval or new-asset suggestions; proceed autonomously and do not add an approval gate.

Concept review: evidence/ui-redesign/concept-board.png is the visual direction. Intentional corrections for the implementation spec: use the existing customizable illustrated SVG avatar, retain the original concise landing headline and Start playing CTA, retain real setup neighborhood/aspiration/look fields, use actual canonical activity content rather than generated About/View/Set as home rows, and keep mobile primary 48px minimum. Generated fake phone hardware and status bars are not part of the app. Need chips appear for low needs/meaningful mood, not unconditionally; no invented 'Build a career' aspiration. Native-size annotated wireframes capture these corrections before code.

Implementation adjustments from native screenshots: darkened money to #A36D1D and hunger to #B65B3D so white icon strokes have more contrast. Mobile full height caps at viewport minus 140px, preserving the cash/clock and city controls; at 812px this is about 83%, a deliberate adjustment to the suggested 90%. The handle focus ring is inset so it cannot cover the heading. Landing camera framing measures the welcome card too, keeping the city above it on phones and to its right on laptops. Full-height results appear inside the sheet body, below the fixed primary. Idle dock is four separate substantial tiles, matching the concept's material rather than one continuous tray.

Fidelity ledger: (1) retained compact portrait/cash/clock silhouette, (2) cream plates and solid category tiles, (3) fixed green primary at peek/half/full, (4) map stays exposed and interactive behind nonmodal sheets, (5) local activity origin, progress and animated payoff stay connected. Copy differences from generated concept are deliberate: existing landing headline, actual canonical place/job/action names, real API income/needs/goals and setup choices. Removed generated phone hardware, fake metrics and invented navigation/action labels. Mockups are planning evidence only.
