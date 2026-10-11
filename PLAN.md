# Metro Life living plan

## Progress
- [x] Read objective, CODEX_PROMPT.md, SPEC.md and canonical world content.
- [x] Preserve old game; replace checkout with Metro Life sources.
- [x] M1 Backend core: auth, world isolation, content expansion, sims/actions/decay, persistence and tests.
- [ ] M2 Atlanta scene, architecture sheets, visual evidence and measured performance.
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
