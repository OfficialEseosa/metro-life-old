# V1: metres and rigged player

The ruler uses the actual production models at their production uniform scales: player 1.78m, door opening 2.1m, sedan 4.4 x 1.8 x 1.45m, lamp 5.5m, two-storey house 6.64m. The five native animations are checked for changing bone quaternions, with 0.2-second cross-fades. Native rendering is DPR 1.

`report.json` covers Atlanta, New York and the Bay Area at 1280x800 and 375x812. Each city has a ruler and an ordinary arrival capture. Rejected captures and reports are retained under `rejected-*`; they are not acceptance evidence.

The sedan is a Blender-authored CC0 Kenney derivative with preserved wheel/end sections and extended centre spans; the street section has two 3.2m lanes, 2m sidewalks and 0.15m curbs. Source models remain unchanged. Measurements and SHA256 hashes are in shared/model-metrics.json, licenses in docs/credits.md.

V1 establishes scale and the player rig. Staged sitting/sleeping/work animations and complete cutaway rooms are V4; the same-family resident upgrade is V5; a connected merged street graph and five-car traffic set are V6; building facade/entrance/landmark trim unification is V7. Current rooms still use the generic Interact clip for activities, and residents still use the older crowd mesh at corrected metre height.

Visual acceptance and final budget results are recorded in PLAN.md after the serial checks complete.

Final serial scene checks passed12day/night views, zero errors: minimum58.326FPS, maximum94calls/240017triangles at DPR1. All30scene images and4compiled images were personally inspected. `compiled/report.json` proves native controls against the packaged server with no development hooks. `height-sampling.json` compares the cached terrain sampler against1200original raycasts; the earlier failed CPU profiles in walk-diagnostic/walk-profile explain the repaired6-8FPS walking issue and are not acceptance reports. Backend75tests/build/lint passed.
