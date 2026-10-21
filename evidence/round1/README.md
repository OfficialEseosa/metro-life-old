# Round 1 evidence

Start with `city/1280-skyline-night.png`, `foodhall-final/1280-foodhall-eat.png`, `home-final/390-home-cook.png`, and the paired `city/*-camera-blocked-before.png` / `*-camera-fade-after.png` images. `PLAN.md` is the chronological check/decision record.

| Item | Accepted evidence |
|---|---|
| 1: travel, furniture, gates, browser save | `travel-accepted/` reports and arrivals at both sizes; `rooms/report-1280-rooms.json`; `home-final/` phone actions/wall modes/night; `item1-ui/` actual creator, gates and refresh persistence |
| 2: distinct landmark interiors | `rooms/` all12templates at1280; all11publictemplates at390 before the external reload; `foodhall-final/` replaces the three older1280foodhall images after raising the canopy; `home-final/` completes phonehome |
| 3: nine supplied models | `city/` both sizes; `item3-model-metrics.json` has final hashes, parsed counts and glow validation; `item3-placement-check.json` has435placement checks; `item3-notes.md` explains the projection adaptation |
| 4: night/ads/cutaway/road/fade | `city/` day/night, four supplied heroes, fictional billboard, road and paired fade; room night and three wall modes in the room suites |

Measurements use Chromium on Intel Arc via ANGLE D3D11, Cozy at native DPR1. The390px results are a phone viewport on that desktop GPU, not measurements on phone hardware. City movement is measured after warming the overview/landmark shader views, with four alternating camera flights. Street/road samples use actual keyboard movement. Repeated FPS values on static landmark screenshots refer to the preceding movement sample; they are not a separate idle-frame benchmark. Draw calls/triangles are actual renderer.info values at each captured view; source model counts exclude the rest of the city and shadow/effect passes.

Final source models:18,292triangles /17beautydraws; all8manifest-named glow meshes verified. Aquarium explicitly has `glowMesh:null`, so no glow is invented. Relative tower positions/heights use the research projection uniformly reduced0.1 to fit the existing playable diorama. Existing destinations/roads retain their prior manually positioned map. The eleven venue archetypes are reused across65landmarks with city variants; they are not65bespoke rooms.

Retained failures and superseded evidence:

- `travel/`, `travel-repeat/`, `travel-final/`, `travel-asset-retry-failed/`, `travel-diagnostic/`: earlier deadlines, locator issue, HMR and unresolved late Suspense commits. The diagnostic proves every model response200 within~0.9s. Exterior assets now stay mounted and hidden indoors; both final real-button travel reports pass.
- `rooms/report-390-rooms.json`: partial FAIL after19valid views because an external model-manifest update reloaded the page and removed the test store hook. Its blank failure image is not an accepted game view. Owner confirmed the assets finished, and final manifest/model hashes were refreshed. Targeted phonehome completed all missing checks.
- `rooms/1280-foodhall-*.png`: superseded by `foodhall-final/` because the first canopy hid staff heads. Phonefoodhall images already use the raised canopy.
- `city-pre-fade-fix/`: original sphere test wrongly skipped small native tree geometry before instance scale. `city-first-sample/` includes corrected fade but first overview flight57.99FPS, below58target. Final warmed repeat is retained separately in `city/`; no effect, resolution or gate reduction.
- `probe-*.png`: intermediate diagnostics, not the final performance evidence.

All final suites assert no browser console/page errors. Frontend final build/lint and backend95tests are recorded in PLAN; raw `.log` outputs follow the repository's existing ignored-log policy. No full New York/Bay browser sweep or physical phone test was performed in this Atlanta-focused Round1.

Final accepted city movement:1280 street59.59FPS / full-view flights60.26FPS / road59.63FPS;390 street/road60.37FPS / full-view flights60.81FPS. Peak90drawcalls and182,716triangles. Final indoor check with hidden exterior mounted:60.03/60.01FPS,38drawcalls11,801triangles. Earlier full-room suite min58.353FPS, peak58calls37,679triangles. Release build/lint pass; clean package95tests, zero failures/errors/skips. Usual8080/5173 restored; isolated QA8081/5174 stopped.

The compiled8080UI suite also passes both sizes (`compiled-ui/report.json`): no credential controls, visible disabled reasons, same browser life after refresh. `checks/release-validation.json` verifies95tests plus13packaged-source checks, including every supplied model hash and four shared JSON resources. The final compiled smoke screenshots were inspected natively.
