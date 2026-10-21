# Round 2 item 4 — authoritative progress

Owner objective eaf89912-6173-4bda-aa92-0592f1599682 and research/metro/audit-R1.md read; AGENTS/PLAN and current progress, first-day, content, navigation and tests reviewed. Research/audits/world/reference were not changed. This subtask owns only GameService.java, Progression.java, FirstDay.java and the new Round2ProgressTests.java.

Root causes and changes:
- Only completed `/act` requests used to update visited/dailyVisited. Search travel, actual walking arrival and building entry never recorded visits. GameService now records real accepted public-landmark arrival after map travel settles, successful door entry, outdoor movement to a landmark, and a flight's destination settlement. Travel booking and UI/map reads do not count. Home/street do not count as exploration.
- Daily exploration remains distinct city:place keys and resets each game day. Lifetime visited keeps the existing public landmark-ID array contract; dream counting now excludes home/street and deduplicates legacy array entries. Current authored landmark IDs are globally distinct. Arrival+entry into the same place counts once, not twice.
- Daily rewards and ordered dream claims settle once on actual arrival and appear in moneyToday.income. A pending trip survives restart and pays its arrival rewards once. First-day completion no longer blocks an already-met dream milestone; the first Explore-three step advances during onboarding as its description promises. Stories still wait for the first-day checklist, preserving existing story pacing.
- Step outside is marked by accepted outdoor transitions/movement, including using Search to exit one's room. Rejected requests and mere previews do not mark it.
- Buy a cafe meal now recognizes any paid food activity, including food halls; free home cooking does not count as buying a meal. Meal/shift/cooking/activity effects retain completion-only timing.
- Reviewed all42 authored dream rules/texts: distinct visits and named landmarks now consume actual arrivals; skills/jobs/cash/stories retain existing state predicates; skill/civic activity counts and home-cook counts retain completion metrics; Run for mayor remains the existing successful run event (external campaign metric); election wins/plot ownership/billboard bookings retain authoritative external events. No broad economy/needs rebalance or later R2 item begun.

Checks:
- Command from backend: `.\mvnw.cmd -q '-Dtest=Round2ProgressTests,ProgressionTests,FirstDayTests,FinalRulesTests' test`.
- PASS32tests: new Round2ProgressTests9, ProgressionTests6, FirstDayTests9, FinalRulesTests8; zero failures/errors/skips. Raw log: evidence/round2/item4-progress-tests.log (quiet success). Maven released to interiors agent afterward; full suite is parent's integration check.
- New regressions reproduce real travel+door entry at3venues, no credit beforearrival, repeated samevenue idempotence, actual door-only visits, accepted outdoor movement, excluded home/previews/rejected operations, daily reset versus lifetime, restart/exact-once reward, named dream venue visits, and foodhallmeal/homecook completion timing.
- git diff --check PASS. A first test command did not execute because evidence/round2 did not exist; directory created and exact command rerun successfully.

Limits: no browser runs by this backend subtask; parent owns1280x800/390 captures and the full suite. Historic visits that the old code never stored cannot be reconstructed; subsequent accepted arrivals are tracked. No commits/server restarts/deployments or changes to owner-updated stadium asset. Backend remains browser guest sessions only.
