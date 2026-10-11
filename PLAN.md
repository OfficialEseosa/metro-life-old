# Metro Life living plan

## Progress
- [x] Read objective, CODEX_PROMPT.md, SPEC.md and canonical world content.
- [x] Preserve old game; replace checkout with Metro Life sources.
- [x] M1 Backend core: auth, world isolation, content expansion, sims/actions/decay, persistence and tests.
- [x] M2 Atlanta scene, architecture sheets, visual evidence and measured performance.
- [x] M3 HUD, onboarding and playable core loop.
- [ ] M4 New York and Bay Area, landmark evidence and airport travel.
- [ ] M5 Careers, aspirations, daily goals and story chains.
- [ ] M6 Elections, policy, plots atlas, billboards, homes and rent.
- [ ] M7 Live multiplayer, social and simulated residents.
- [ ] M8 Mobile/accessibility polish, full verification and final report.

## Decisions and setup
- 2026-10-10: Owner's objective supersedes old Dusk Dusk Goose instructions. Existing tracked state was clean at f86a168. Branch dusk-dusk-goose and tag dusk-dusk-goose-final preserve it.
- Research moved intact to C:/Users/rapha/dusk-dusk-goose-archive/research. Old tracked files removed using git rm. Automatic approval review rejected a combined command containing recursive deletion; generated/untracked old folders were instead moved intact to the archive. This is the recoverable alternative to deleting them.
- Copied source with robocopy /E /XD .git, including frontend/node_modules; source folder remains untouched. Remote changed locally to https://github.com/OfficialEseosa/metro-life.git. No network Git operations performed.
- Backend will use a versioned JSON store with atomic replacement and PBKDF2 passwords. Server owns rules; sessions persist across restart. Assets remain local.

## Commands and actual results
- git status --short: clean before setup; last commit f86a168.
- git branch dusk-dusk-goose; git tag dusk-dusk-goose-final: passed.
- Move-Item research to archive: passed.
- git rm -r --quiet -- .: passed.
- Move-Item remaining old untracked folders to archive: passed.
- robocopy source checkout /E /XD .git: exit 1 (successful copy).
- git remote set-url origin https://github.com/OfficialEseosa/metro-life.git: passed.

## M1 complete
- Read frontend API types/client/store/App and backend starter. Stale v1 Java sources will be replaced under app.metrolife.
- No audits folder existed at milestone start.
- REA initial static graph request timed out after 300 seconds. Direct captured-bundle inspection completed and recorded in docs/reference-notes.md.
- Rewrote backend under app.metrolife. Canonical content is packaged directly from shared/world.json; all labels expanded into structured actions. Home actions, eight career definitions, seven aspiration definitions, seven skills and neighborhood rents are present. Career/aspiration gameplay expands in M5.
- Implemented PBKDF2-HMAC-SHA256 (210,000 iterations), opaque 256-bit session cookies, guest signup upgrade, login/logout, public/solo/private worlds, membership validation and persistent selection. Private code is eight hex characters.
- Implemented setup, four capped needs, derived mood, skills/xp, validated activities (hours, location/city, busy state, cash, requirements), daily goals, stats/daily/version and atomic JSON persistence. Setup cannot be repeated to mint cash or teleport.
- `.\mvnw.cmd -q test` in backend: PASS, 6 core + 2 HTTP contract tests, zero failures/errors/skips. Reports copied to evidence/m1. First test run before tests were added only compiled; not counted as test coverage.
- `.\mvnw.cmd spring-boot:run`: PASS, Spring Boot 3.5.16 / Temurin Java 21 on http://localhost:8080.
- `scripts/m1-smoke.ps1`: PASS, curl.exe created guest and solo world, set up sim, performed sleep/cook/invite/shower/Krog food actions. Final cash $2,515, XP 100, cooking XP 44. evidence/m1/five-actions.json and before-restart.json saved.
- Stopped only the Java process started for this check (PID 49472), then restarted via Maven. `scripts/m1-smoke.ps1 -VerifyRestart`: PASS, same cookie restored user/world/cash/XP/skill; after-restart.json saved. Need values correctly decay with elapsed time.
- No SPEC.md or TypeScript API contract changes. No frontend visual checks or performance claims in M1; scene/HUD are not implemented yet. No push/deploy.
- Handoff: backend remains running at http://localhost:8080 (Java PID 19648; exec session 83888). Try GET /api/world or run the smoke script. Full browser game begins in M2/M3.

## Next: M2
- Read new audits, inspect captured camera/lighting/map code, write landmark architecture sheets before modelling, build and visually verify Atlanta. Existing stale UI type errors must be removed before its frontend can build.
- Baseline `npx tsc -b`: FAILED with 36 stale v1 HUD errors (Lagos-only store fields and missing panels); known source-scaffold issue scheduled for replacement before scene verification.
- During M2 canonical ID inventory found sports career referenced `mbs` instead of `benz`; corrected immediately and expanded content test to validate every career workplace against the canonical map before proceeding.
- M2 audit check: still no audits folder. REA graph timeout prevents authenticated tracing; direct scene-bundle study recorded in docs/reference-notes.md.
- Architecture sheets written for every Atlanta location before modelling. Stale v1 UI removed and replaced with a scene-explorer HUD to unblock rendering; the life-sim HUD is M3.
- `npm run build`: PASS, 1.21MB initial JS / 338KB gzip; Vite warns about large chunk (splitting deferred to polish). `npx tsc -b` initially caught pin-shape narrowing; corrected. First browser caught missing Krog branch; fixed.
- First Playwright attempt failed because bundled Playwright expected Chromium revision 1234; selected already-installed Chromium 1243 explicitly, no browser installation.
- `node scripts/scene-check.cjs`: PASS after correction, zero page/console errors, Intel Arc D3D11, 32 calls / 161,574 triangles. Short warm-up measured 56 FPS; longer measured capture below is authoritative.
- `node scripts/capture-atlanta.cjs`: PASS, 84 scene screenshots + UI + four contact sheets under evidence/m2/round1. Dropdown and pin hit test passed. Warm measurements 59.99–60.06 FPS at both sizes/day/night, P95 17.2–18.1ms; geometry counts all within objective limits.
- Round 1 visual issues and rework recorded in docs/landmarks.md. M2 still unchecked until final review and backend-down proof.

## M2 complete
- Three capture/rework rounds completed (`node scripts/capture-atlanta.cjs round1`, `round2`, `round3`): each 84 scene images plus UI and four contact sheets. Inspected all contact sheets and final four skyline images. Per-landmark verdicts, rework and remaining recognition exceptions are in docs/landmarks.md. Several ordinary buildings still cannot be named immediately; no claim of a public recognition test.
- Final round: 31 calls without pins / 32 with, 158,694 triangles, 59.99–60.00 FPS, P95 18.0–18.3ms at 1280x800 and 375x812, day/night, Intel Arc integrated ANGLE D3D11. Dropdown and actual pin click passed; zero browser errors. Static merged landmarks, instanced fabric, one pin atlas, bounded camera, sky, soft static shadows, lit windows and rippling water implemented.
- `node scripts/scene-offline.cjs`: PASS with our Java process actually stopped. All 20 locations and map rendered; zero page errors. API 502 responses expected while offline. Backend restarted after check.
- Final `npm run build`: PASS (1,210KB JS / 338KB gzip, large-chunk warning remains). `npm run lint`: PASS, zero warnings. Development scene inspection hook absent from production bundle (rg returned no matches after correcting a Windows wildcard invocation).
- New audits/M1-findings.md read before starting further work. Fixed all four findings: API needs rounded to one decimal, outcome-specific text with actual effects, shower gives +18 energy/+12 fun before clamping, friendly generated names for new guests. Existing named guests retain their identities. `.\mvnw.cmd -q test`: PASS, 7 core + 2 HTTP tests, zero failures/errors/skips. `node scripts/audit-m1.cjs`: PASS over restarted real HTTP server; evidence/m1/audit-fixes.json saved.
- No API shape changes. No push/deploy. Servers left running: frontend http://127.0.0.1:5173 (session 93287), backend http://localhost:8080 (Java PID 40984, session 77430). Try destination dropdown, map pins and day/night button. Play flow begins in M3.

## Next: M3
- Re-read audits; inspect captured panel, need, action and onboarding structure, then build the full HUD and entry-level job loop. M2 scene explorer is replaced by playable UI.
- M3 start: only M1-findings.md exists; all four findings fixed and verified above. Scoped REA retry returned Transport closed. Used direct captured UI/job/state reads; limitations and choices in docs/reference-notes.md. Copied reference chunk is study input only and excluded from Git to avoid duplicate source.
- M3 browser loop passed at both sizes (7.25s laptop / 6.33s phone to first $120 shift + $45 daily reward); two private-world contexts joined successfully. Visual inspection caught phone modal overflow and inherited scroll position; fixed and reran with explicit bounds/scroll assertions. Build/lint passed. Ten backend tests passed. Entry flow timing is automation, not an independent human usability study.
- New audits/M2-findings.md arrived during M3. Read all findings and viewed black-wedge/phone evidence. Must fix before new city work: sky clipping, drift/interaction performance, first-shadow-pass budget, palette/fog, district/edge detail, weak architecture, preview label, mobile pin/UI crowding and missing action icons. The three full Atlanta architecture rounds are already used; this is focused audit correction, not a fourth full city capture round. Existing written recognition exceptions remain candid until targeted images support changes.

## M3 complete
- Implemented play/world picker, one-page city/home/aspiration/look onboarding, guest/account forms, top bar and clock, destination selection, location actions with requirements/costs/effects, busy progress, needs/mood/skills/daily/aspiration panel, result notices and focus-managed story dialog. Story engine and integrated story-choice verification remain M5. Eight entry jobs can be accepted, worked and quit; actual salary is validated on the server. Setup remains one-time; deliberately clarified SPEC.md, no JSON shape change.
- `node scripts/m3-browser.cjs`: latest PASS at 1280x800 and 375x812: landing to first paid job shift in 4.787s / 3.476s; cash $2,500 to $2,665 ($120 salary plus $45 daily reward), four needs meters, home shower feedback, no page overflow. Two separate cookie contexts joined the same private world as distinct users; bad code rejected. Zero unexpected browser errors. Evidence/m3/report.json and screenshots saved and inspected. Automated timings do not establish independent human usability.
- `.\\mvnw.cmd -q test` in backend: PASS, 8 core + 2 HTTP contract tests, no failures/errors/skips. Coverage includes unauthorized/forged job requests, entry-role restrictions, busy/quit validation and actual salary for both generated and canonical health shifts. `npm run lint`: PASS, zero warnings. `npm run build`: PASS, 1,257KB JS / 353KB gzip; large-chunk warning remains for M8.
- M2 audit fixes: (1) camera-following sky, far clipping and background draw order fix the black wedge; (2) stable first load has computed styles at every tested size; (3) lower-poly instanced trees keep shadow-refresh budget below cap; (4–5) bounded pan/zoom with no rotation/damping, fly-to cancellation on input, DPR cap/adaptation; (6) Ponce central sign tower, Fox/Tech lettering, fan-shaped baseball seating/field, continuous BeltLine, white High panels/skylights and three different skyline crowns; (7) district height/palette distributions; (8) cooler day fill, blue night, window/street-light glow; (9) rolling outer terrain and elliptical tree cover; (10) explicit Preview label with return to game-clock lighting; (11) fit-all overview, lighter fog, pin decluttering/cutoff filtering, smaller phone prompt and no footer behind dock; (12) explicit action icons. Exact recognition exceptions, including High/Piedmont/Truist, remain candid in docs/landmarks.md. Filler still uses a small set of shapes, not a detailed street-by-street city.
- `node scripts/audit-m2.cjs`: final stable PASS at 1638x863, 1280x800 and 375x812 CSS viewports, DPR requested 1.75 (renderer cap 1.25/adaptive). Evidence/m3/m2-audit/report.json: normal 34 calls / 118,125 triangles day; 35 / 128,877 night; captured shadow peak 61 / 217,272. Interaction 59.998–60.005 FPS, P95 17.5–18ms; day/night warm windows 57.77–60.10 FPS, P95 17–17.5ms. Zero drift pixels after two seconds, actual hover and click PASS, no console/page errors. All model budgets pass (largest Ponce 4,800 / Fox 4,060). Peak capture saw the shadow pass in the first viewport; later captures sometimes missed that one frame, so do not claim every first frame was sampled.
- One intermediate audit run failed because a frontend edit triggered Vite HMR while Playwright was active (React dependency-length warning); reran without source edits and it passed. A report-read command used the wrong HTTP test filename; actual HttpContractTests report was then read successfully. No runtime failure inferred from either tooling mistake.
- Inspected final phone day/night, Fox/High targeted images and phone shift/needs panels; earlier full Atlanta three-round evidence remains. No original-site login, push or deploy. Running: http://127.0.0.1:5173 (frontend session 93287), http://localhost:8080 (Java PID 47500, backend session 71186). Try Start playing → Solo → Start my life → Find your first job → Apply → Work a shift, or create/join a private world.

## Next: M4
- Read new audits, study captured travel mechanics, write NYC/Bay architecture sheets before modelling, then implement both maps, free map viewing and authoritative airport travel. M5–M8 remain outstanding.
