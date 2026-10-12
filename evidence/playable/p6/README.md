# P6 evidence — city feel and playable completion

All screenshots are native 1280x800 or 375x812 unless labelled as contact sheets or Blender references. Captures are personally inspected; rejected captures remain explicitly named `rejected-*` and are not accepted proof. Failures and repeats are recorded in [PLAN.md](../../../PLAN.md).

| Check | Report and captures | Scope |
|---|---|---|
| Backend authority | [75-test manifest](backend-tests.json) | Original 50 retained; movement speed/collision, private rooms, station rules, completion-only rewards, resident paths/restart, park paths and 700 unique automatic names |
| Full new-player journey | [Report](journey/report.json), [contact](journey/contact.jpg) | Both sizes: real WASD/thumb home→work→apply→animated paid shift→cafe meal→club wave; no main-player map-travel POSTs or list menus; later fountain and airport flight |
| Home | [Report](home/report.json), [contact](home/contact.jpg) | Both sizes: enter, cook, sleep, shower, reload inside and leave; exit capture waits for terrain, kit batches and cleared loader |
| Cafe/club and P4 follow-ups | [All six city/size flows](p4-followups/report.json), [fresh Atlanta repeat](p4-followups/report-atl.json), [contact](p4-followups/contact.jpg) | Distinct floors/walls/lights, typing/eating/dance/performance, segmented arms, foreground culling and social spacing; fresh Atlanta repeat additionally proves clearing the prior social notice |
| Shared movement | [Report](park-live-followups/report.json), [contact](park-live-followups/contact.jpg) | Both sizes: 14 frames/3s, smoothed remote movement, refused excessive speed, private-home culling, social, office occupants, reload/chat, settled city filtering and expiry |
| Park activities | [Report](park-activities/report.json), [contact](park-activities/contact.jpg) | Both sizes: physically approach visible seated resident and jogging loop; surveyed paths avoid lakes and benches |
| City scene | [All-city report](scene/report.json), [contact](scene/contact.jpg) | Day/night, both sizes, 40 solo residents, real focus/overview flights, shadow-refresh peaks, moving car matrices, plot UV/atlas and billboard reads |
| Actual local-city budget | [NYC](scene-owned/report-nyc.json), [Bay](scene-owned/report-bay.json), [contact](scene-owned/contact.jpg) | Both sizes/day/night with that city's local player and door geometry, which the map-view sweep alone does not include |
| Compiled build | [Report](production/report.json), [contact](production/contact.jpg) | Both sizes through actual UI: create/join private world, walking start, cook, desk application/typing, completion-only pay, shared club wave, city chat and room reload; no development hooks or Vite resources |

Centennial: [same-angle before/after comparison](centennial-comparison.jpg), [before aerial](fountain-before-aerial.png), [before street](fountain-before-street.png). Exported fountain model: 5,927 triangles in two batches, with flush dark grates, a wet stone plaza and animated translucent aqua jets. Accepted in-game close captures are in `journey/`. Blender authoring measurements and generic-landmark exceptions remain in [landmarks.md](../../../docs/landmarks.md).

The journey's paid image catches the counter animation beginning; the compiled `production/375-paid.png` explicitly waits for the single avatar payoff and shows +$165 once, with +$120 shift and +$45 daily-goal breakdown in the completion notice. No acceptance-time money is applied.

The venue fixture uses an isolated server with its world clock at 18:00 to exercise open-hour dance/performance. It does not change player cash, skills or outcomes. The full journey and compiled flow use unmodified new profiles and the normal local server. Resident park captures wait for live simulation; crowd animation checks read actual instance matrices/pose buffers. No reference names, imagery, ads or text are game content.

Performance evidence is measured on Intel Arc / ANGLE D3D11 in Chromium, one GPU test browser at a time. Phone size is browser emulation, not a physical-phone benchmark. Visible traffic/crowds/water/fountain request bounded animation frames; hidden-page timers pause. Decorative cars reverse on clear road spans and do not implement driving physics.

Final combined [performance summary](performance-summary.json):59.81–60.15activeFPS, maxP95 21.3ms,86drawcalls/287562triangles peak across final all-city and local-player checks, DPR1. The earlier56.22FPSsample and actual-play NYC304746triangle failure are retained in PLAN.md; the unchanged-source FPS repeat and repaired filler budget repeat are distinguished.
