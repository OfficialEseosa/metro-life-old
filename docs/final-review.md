# Final owner review

A–D are implemented and committed separately. PLAN.md records failures, repairs and checks; evidence/final-review contains native 1280x800 and 375x812 captures. Final regression and historical rechecks pass; screenshots were inspected. The evidence index is evidence/final-review/f/check-index.json.

| Items | Result and proof |
|---|---|
| 1 | All sound storage access is guarded, defaults on; final-a tests blocked storage. |
| 2 | Hash/verify outside GameService lock; per-IP/name limits and bounded concurrent hashing; AuthConcurrencyTests and packaged HTTP concurrency measurement. |
| 3–5 | Server-anchored clock, mutation revision drops old sim polls, synchronous shared action guard; final-a skew, delayed response and double-tap checks. |
| 6–7 | Opaque elevated controls, inset pin culling, separate loading/failure slots and failure replaces landing; final-b normal/failure/flight captures. |
| 8–10 | Disjoint varied names and visible levels, minimum crowd projection, atlas-backed upright booking posters; CommunityTests, final-b and M8 scene captures. |
| 11–14 | Story chapter kicker, thin handle focus, participant-named social events, unclipped ballot; final-b actual story/wave and labelled ballot fixture. |
| 15 | Per-day city/place visits independent of lifetime first discoveries; consecutive-day FinalRulesTests. |
| 16 | First six game hours of offline catch-up, policy history per eligible midnight; FinalRulesTests. Legacy unknown policy dates use an explicit baseline. |
| 17 | Gifts and public votes require one game day of sim age; fresh-gate tests and voter captures. Established live regression uses only an isolated sim-age fixture. |
| 18–20 | Only seated winner gets credit, campaign uses accepted day, apply requires idle/open workplace without teleport; FinalRulesTests and final-c UI flow. |
| 21 | Pure reads do not fsync; memory visit counter and actual online humans; byte-identical read/replay/checkpoint tests. Explicit writes remain durable; active simulation checkpoints every five seconds. |
| 22–26 | Keyed city mounts plus explicit procedural geometry cleanup; stable camera through inset changes; plane/clamped/cancelled drag; distance-aware fog; demand rendering, boolean lighting and dirty crowd uploads. final-d proves stable GPU counts; final two-second Atlanta samples have 0–1 frames and zero resident uploads. |
| 27 | Cash/queue/ownership/rent/debt and idle/story checks mirrored, with reasons; final-d fixtures and authoritative booking tests. |
| 28–30 | Merge chat ids, reject older player snapshots, clear world-specific UI state and count humans plus residents; final-d real socket/fetch races and 41-online solo capture. A held-real-presence check proves the loading interval never claims zero. |
| 31 | Error-specific jobs/homes state, wrapping titles, safe-area top CSS, visible-character and FORMAT validation; failed-load captures and CommunityTests. Physical safe-area hardware remains untested. |

Hosting-only items E are deferred exactly as requested: request caps, creation/join limits, user world/socket caps, session purge, bodyless POST origin/header validation, proxy Secure cookies and 600k PBKDF2. Nothing was pushed or deployed.

No new landmarks are modelled in this review. Recognition exceptions in landmarks.md remain known weaknesses.


## Evidence index

- [A authority/client report](../evidence/final-review/f/a/report.json) and [packaged auth measurement](../evidence/final-review/a/auth-live.json).
- [B captures and report](../evidence/final-review/f/b/report.json): items 6–14, actual named wave, with ballot layout clearly labelled as a client fixture.
- [C UI report](../evidence/final-review/c/report.json) and [50-test authority reports](../evidence/final-review/f/backend).
- [D report](../evidence/final-review/f/d/report.json): GPU stability, demand rendering, clamped picking, async races and failure/affordability states.
- [Historical report](../evidence/final-review/f/history/report.json) and [story/layout report](../evidence/final-review/f/layout/layout-report.json).
- [Session-transition race](../evidence/final-review/f/transition/report.json) and [presence-loading check](../evidence/final-review/f/presence-loading/report.json).
- [M8 scene](../evidence/final-review/f/scene/report.json), [live](../evidence/final-review/f/live/report.json), [compiled production](../evidence/final-review/f/production/report.json), [travel](../evidence/final-review/f/travel/report.json), [polish/recovery](../evidence/final-review/f/polish/report.json) and [socket boundaries](../evidence/final-review/f/socket/report.json).

Exact commands, failed attempts, repairs, screenshot inspection and local server addresses are in PLAN.md. Browser checks use this machine's installed Chromium and ANGLE D3D11. Fixtures never stand in for the separate authority/live checks. Physical phones, Safari, screen readers and large hosted load remain unverified.
