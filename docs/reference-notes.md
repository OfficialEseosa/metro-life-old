# Reference study

## M1 — captured mechanics and API structure

REA `analyze_javascript_application(format=directory)` against the owner's captured `reference/chunks` timed out after 300 seconds. This is a tool failure, not an analysis result. Per the objective, used direct static reads instead. No original website interaction or submission took place.

Observed in `31rkf5nfrt4lz.js` and `2wn1at3jbyiyr.js`: activities are data records with duration, costs, need deltas, social tags and poses; prerequisite logic rejects unavailable actions before effects; mood derives from needs and modifiers; skill/need rewards and travel effects are applied centrally. These are static observations, not claims of runtime behavior. The large bundle contains many unrelated features; this is a bounded inspection.

Metro Life choices: keep four needs and seven skills, expand canonical labels into explicit server-side actions, make busy time short and visible, cap offline decay, and persist user/world state. The backend owns validation rather than trusting browser effects. Guest upgrades keep the same user and world. Do not reuse source dialogue, user names, ads, emoji or place content.

## M2 — camera, lighting and map

Initial REA graph failure is still the blocker to tracing; direct inspection of `3hix095xid-pq.js` used as the allowed fallback. Observed: `WorldMap` has demand rendering, a single shadow-casting directional light with bounded shadow camera, hemisphere fill, an FPS cap with an idle setting, instanced attributes and disabled static matrix updates. Its controls disable rotation and bound distance (minimum 8, maximum depends on map extent); home, billboard and plot selections share the map. This is static evidence; no runtime performance of the original was measured.

Metro Life choices: bounded pan/zoom with optional orbit; city-specific spatial tables; merged vertex-colour landmark geometry; repeated trees/homes/lamps instanced; one icon-atlas pin batch with one hover label. Keep large landmarks and simplify filler, as the objective requires. Use a sky gradient, muted city greens, soft static shadows, lit windows and lake ripple. Keep camera animation separate from React HUD updates and suspend ambient invalidation in hidden tabs.

M3–M7 studies will be added at each milestone start.
