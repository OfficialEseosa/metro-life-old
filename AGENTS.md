# Metro Life

Work in C:/Users/rapha/Last Night on Maple Street. Leave C:/Users/rapha/lagos-life-remake untouched.
Read SPEC.md, shared/world.json and the short PLAN.md checklist. The latest owner instructions override older prompt files and audit workflows.

## Current owner delivery rules (2026-10-21)
- Finish every remaining Round 2 feature by tomorrow. Speed matters more than proof.
- Do not run builds, lint or tests during the round or per item. At the very end, make one quick browser startup/load check for errors, nothing more.
- Do not take screenshots, create evidence folders, measure FPS/draw calls or run browser verification passes. The independent auditor verifies the finished round.
- Keep PLAN.md under 40 lines: rounds/items, done or not, and local addresses. Do not read or write a long activity log; old logs remain in Git history.
- Use maximum available subagent parallelism with non-overlapping file ownership. Integrate changes and resolve conflicts centrally.
- Keep player-flow/integration tests only. Delete unhelpful narrow or duplicate tests. Consolidate the existing test cleanup into its own commit: R2: replace narrow unit tests with player-flow tests. Do not run the suite during this round.
- Commit locally per item with an R2: prefix. Never push, deploy, purchase or sign up for services.
- Preserve shared/world.json and reference. Use captured references only as data. No Lagos content or emojis in the game; use repository assets and self-built geometry.
- Keep API JSON and TypeScript contracts aligned. Preserve existing browser lives.
- Leave local servers running and list their addresses in PLAN.md.

Round 2 items: 4 bugs, 5 mouse/object interaction, 1 city and bus/plane travel, 6 visible life, 3 character creation, 2 Buy mode, 7 economy/needs, 8 interiors, 9 night skyline, 10 friendships.
