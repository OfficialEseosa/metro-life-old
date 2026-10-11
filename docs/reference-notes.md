# Reference study

## M1 — captured mechanics and API structure

REA `analyze_javascript_application(format=directory)` against the owner's captured `reference/chunks` timed out after 300 seconds. This is a tool failure, not an analysis result. Per the objective, used direct static reads instead. No original website interaction or submission took place.

Observed in `31rkf5nfrt4lz.js` and `2wn1at3jbyiyr.js`: activities are data records with duration, costs, need deltas, social tags and poses; prerequisite logic rejects unavailable actions before effects; mood derives from needs and modifiers; skill/need rewards and travel effects are applied centrally. These are static observations, not claims of runtime behavior. The large bundle contains many unrelated features; this is a bounded inspection.

Metro Life choices: keep four needs and seven skills, expand canonical labels into explicit server-side actions, make busy time short and visible, cap offline decay, and persist user/world state. The backend owns validation rather than trusting browser effects. Guest upgrades keep the same user and world. Do not reuse source dialogue, user names, ads, emoji or place content.

## M2 — camera, lighting and map

Initial REA graph failure is still the blocker to tracing; direct inspection of `3hix095xid-pq.js` used as the allowed fallback. Observed: `WorldMap` has demand rendering, a single shadow-casting directional light with bounded shadow camera, hemisphere fill, an FPS cap with an idle setting, instanced attributes and disabled static matrix updates. Its controls disable rotation and bound distance (minimum 8, maximum depends on map extent); home, billboard and plot selections share the map. This is static evidence; no runtime performance of the original was measured.

Metro Life choices: bounded pan/zoom with optional orbit; city-specific spatial tables; merged vertex-colour landmark geometry; repeated trees/homes/lamps instanced; one icon-atlas pin batch with one hover label. Keep large landmarks and simplify filler, as the objective requires. Use a sky gradient, muted city greens, soft static shadows, lit windows and lake ripple. Keep camera animation separate from React HUD updates and suspend ambient invalidation in hidden tabs.

## M3 — panels, needs, actions and onboarding

Retried REA on an isolated copy of captured job/UI chunk 0nz0lvdmb76je.js to reduce the earlier graph scope. Tool returned `Transport closed` immediately; no graph or semantic trace was produced. Direct reads of 0nz0lvdmb76je.js, 2a6i2oyqx4umq.js, 2r7ird27h4onb.js, 1tnl62xgfe1fa.js, 3v9ahdlnp9txk.js and the game-state chunk used instead. Observed state-driven mutually exclusive panels, a separate job flow that closes the general panel, local activity queues/progress, mood/need-derived restrictions, tutorialStep in initial state, and result notices. This does not establish the original's complete onboarding sequence; minified dynamic bindings remain uncertain.

Metro Life choices: one clear play entry, a compact world picker, one-page city/home/dream/look setup, and immediate direction to an entry-level job. Keep needs numeric with semantic meters and visible labels. Requirements and closed hours stay next to actions; busy time has a progress indicator and blocks duplicates. Results describe effects and remain dismissible. Server state replaces browser-calculated rewards, and a focus-managed story dialog presents pending choices. No source wording or visual icons copied.

M4–M7 studies will be added at each milestone start.
