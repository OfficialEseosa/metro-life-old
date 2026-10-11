# Metro Life living plan

## Progress
- [x] Read objective, CODEX_PROMPT.md, SPEC.md and canonical world content.
- [x] Preserve old game; replace checkout with Metro Life sources.
- [x] M1 Backend core: auth, world isolation, content expansion, sims/actions/decay, persistence and tests.
- [x] M2 Atlanta scene, architecture sheets, visual evidence and measured performance.
- [ ] M3 HUD, onboarding and playable core loop.
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
