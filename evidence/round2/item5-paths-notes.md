# R2 item 5: click-to-walk route module

Owned files: frontend/src/scene/navigation-route.ts, scripts/r2-path-check.mjs, evidence/round2/item5-paths.json and these notes. Root additionally authorized the Bay Bridge connectivity correction in shared/navigation.json and its existing ignored backend target resource. No changes to navigation.ts, activity-route.ts, walking/store/UI, backend Java, world.json, research, SPEC or PLAN. No GPU browser, Maven or commits.

## Module contract

`navigationRoute(city, room, start, end): {x,z}[]` omits the start, preserves the exact valid goal, and returns [] for invalid/nonfinite endpoints, an unknown room, disconnected geometry or an exhausted budget. There is no snapping or teleport fallback. Root owns UI feedback and nearest-valid door approach selection.

- Binary-heap weighted A* (weight 1.5; responsive feasible routes rather than mathematical shortest paths), 0.25m indoor / 0.6m outdoor lattice.
- Maximum 9,000 indoor / 50,000 outdoor expansions. Time guard 40ms indoors / 220ms per outdoor leg, checked every 128 expansions. Smoothing has an additional 15ms allowance. Bridge-assisted routes have a shared 480ms overall deadline; ordinary measured calls are substantially faster.
- A small cached topology graph rejects disconnected islands and guides cross-region routes through required bridge centers. Each leg still uses the same checked A*. The graph ignores obstacles only for connectivity hints; it never authorizes movement by itself.
- Static geometry uses shared inBox/inPolygon math with an 8m spatial bucket index, preserving canStand room bounds, collision padding, land/water and bridge rules. Every final segment is rechecked through actual canStand.
- Every search and smoothing edge is sampled at <=0.125m. Analytic rotated-box intersection prevents corner cuts, with a conservative 1mm extra margin to avoid floating-point tangencies being classified inside by server samples. Analytic shoreline/land/bridge crossings divide each edge into constant-validity intervals and test their midpoints, catching small concave shoreline gaps between samples.
- Exponential lookahead plus binary refinement reduces waypoints without quadratic long-street smoothing.

## Final actual checks

- `node scripts/r2-path-check.mjs`: PASS. 488 route cases, 475 required routes found, zero required failures. All 274,594 independently checked segment samples at <=0.075m pass actual canStand. Exact goals are verified. Eighteen invalid input cases pass (nonfinite starts/goals, blocked starts, outside-world goals, wall clicks and unknown rooms).
- Cases cover home-to-every-landmark, nearby and farthest landmark pairs, resident-survey connections, all 36 room/city variants from exits to stations and between stations, plus SF/Oakland and Manhattan/Brooklyn bridge crossings. Thirteen route cases intentionally return [] because of invalid authored endpoints or separate islands.
- Final runtime: median 0.731ms, p95 28.770ms, max 76.991ms; aggregate 2,336.112ms across all 488 cases. These are CPU route calculations in Node on this host, not rendering/frame-rate measurements. JSON records navigation SHA256, exact budgets, per-case runtimes and the final bridge contract.
- Focused oxlint on the two new source files: PASS, no warnings. TypeScript compiler API semantic diagnostics for navigation-route.ts: 0. `git diff --check` for assigned files passes.
- Initial checker rejected a Krog tangent that .125m samples alone missed; analytic intersections plus 1mm margin fixed it. Early 70/80ms caps rejected long connected routes; increased the click-only budget with root authorization and added bridge topology guidance. Earlier 17 cross-Bay failures were real map disconnection and are resolved by the correction below; no unsafe movement fallback was introduced.

## Authorized Bay Bridge correction

The original bridge walk box was {x:33,z:-8,w:49,d:6,a:0}. Its west edge stopped at x=8.5 while SF land stopped near x=5.27, leaving water between them. Extending the box straight west was insufficient because the Ferry Building footprint then blocked the entire landing.

The final walk box is {x:30,z:-5.25,w:55,d:6,a:0.10}. This lengthens/slants the span so its west landing reaches the real walkable strip between the Ferry Building and Salesforce footprints while retaining its Oakland connection. All cross-Bay routes now pass independent segment checks. The existing ignored backend/target/classes/static-data/navigation.json was copied to match shared/navigation.json. Root owns matching renderer/generator changes: suspension length55, rotateY(pi/2+0.10), translate(30,0,-5.25), generator bridge contract identical. No canonical world content changed.

## Existing endpoint limits reported to root

- Atlanta Georgia Tech authored door center (-24,-21) is inside a static blocker.
- Bay Pier 39 authored door center (-10,-27.56) is outside walkable land.
- The module correctly returns [] for these centers. Root plans nearest-valid approaches within the authoritative door radius; this module deliberately does not silently move an invalid click.

Root owns integrated browser behavior, screenshots, movement/queue integration, final build and visual bridge alignment. No browser pass, full-suite backend result or GPU rendering claim is made here.
