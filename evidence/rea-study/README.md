# REA repair and read-only reference study

Owner scope: tooling and reference notes only. No game source changed; no push or deployment.

The permanent installation is `C:/Users/rapha/tools/rea`, pinned to `rea-agents@6.3.0`. Its package-lock remains there. `config-change.json` records the REA-only Codex configuration diff and verifies every byte outside that section stayed identical. The pre-change full configuration backup is outside the repository; it is not copied here because other settings are private.

`windows-cleanup-patch.json` records one local REA runtime repair: allow ten seconds instead of one for an owned browser to terminate and remove its profile. The original file is backed up alongside the patched file as `.js.owner-before`. Reinstalling REA will replace this local repair; reapply that exact guarded replacement if the Windows cleanup failure recurs. No ownership checks, error reporting, or page permissions were relaxed.

## Reproduce the bounded checks

Run from the repository root in PowerShell:

```powershell
npm.cmd install --prefix C:/Users/rapha/tools/rea --save-exact rea-agents@6.3.0 --no-fund --no-audit
& 'C:/Program Files/nodejs/node.exe' 'C:/Users/rapha/tools/rea/node_modules/rea-agents/scripts/rea.mjs' doctor --client codex --json
& 'C:/Program Files/nodejs/node.exe' evidence/rea-study/rea-client.mjs 'C:/Users/rapha/tools/rea/node_modules/rea-agents/scripts/rea.mjs' evidence/rea-study/isolated-tiny-plan.json C:/Users/rapha/tools/rea/recheck-tiny
```

The third command uses the already-created isolated tiny input. `input-manifest.json` records its source and hash. This version does **not** support `format: file`; each wrapper directory contains exactly one copied input. Never point the analyzer at all of `reference/chunks`.

The client performs real stdio MCP initialize, tools/list, and tools/call requests, saving exact JSON and stderr. It allows 120 seconds for startup and 900 seconds per analysis. Large records remain in the same server session: use `inspect_analysis_view` with the returned retained reference, then `export_evidence_bundle` before closing. The initial large-call harness closed too soon; `chunks-recovery-plan.json` recovered these records once and exported them. Complete exports are retained outside git at `C:/Users/rapha/tools/rea/owner-study-evidence.json` and `owner-study-features.json`; their hashes and sizes are in `check-index.json`. Import a bundle instead of reanalyzing it.

`extract-features.mjs` uses Babel only to locate exact functions, without executing the original. It writes small analysis inputs outside the repository. `feature-manifest.json` preserves original source digests and UTF-16 ranges. External bindings remain unknown. `features-retry`, `exact`, and `home` contain successful narrower REA calls; zero-match/ambiguous traces are retained as limitations, not passed feature assertions.

## Live page

The requested direct Edge debugging-port launch was blocked by automatic approval review. `live-target-list.json` records the consequent unreachable-endpoint error. The approved REA-owned browser launcher was used instead, visibly, with its own private profile. Its only action was an eight-second passive wait at the public page. No cookie choice, signup, login, form submission, map interaction, or gameplay occurred.

`live-managed-launch.json.gz` retains the initial successful capture with a cleanup error. After the ten-second cleanup repair, `live-permanent/live.json.gz` retains a successful complete capture with `terminated-owned-process`. Both screenshots were inspected; `original-live-verified.png` is the fresh successful capture. This proves public-page observation, not authenticated gameplay. The missing lazy venue module returned HTTP403 to an unauthenticated GET (`venue-fetch.json`); no access bypass was attempted.

Large successful responses are gzip-compressed losslessly to keep review evidence manageable. Exact small failures, requests, lifecycle records and server stderr remain plain text. Duplicate protocol streams/catalogs are omitted; the complete tool catalog is retained outside git at `C:/Users/rapha/tools/rea/owner-study-tools.json`.

The current chat's connected MCP process was launched with the old cached configuration; its tiny call succeeded. Fresh manual servers prove the permanent entry works. A newly connected Codex MCP session will adopt the updated command/timeouts. No unrelated MCP process or user browser was stopped.

Final doctor reports config_drift because its registration checker requires startup timeout exactly30s. The owner-requested repair intentionally uses120s after actual startup failures; fresh MCP calls succeed. This warning is recorded and the timeout is retained.
