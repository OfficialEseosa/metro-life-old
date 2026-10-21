# Item 5 evidence

Start with 1280-bed-pie.png, 390-four-action-queue.png and 390-zoom-and-orbit.png. Compiled8080 proof is compiled-1280-bed-pie.png.

Public-room proof: ../item5-public/1280-specific-table-eating.png, 390-counter-pie.png, 390-counter-order-at-table.png and 390-person-pie.png. Final report-1280.json and report-390.json pass. The retained counter-camera-first report failed because its test targeted a person below the current camera frame; the final fixture uses actual wheel zoom before selection.

City reports: ../item5-city/report-{1280,390}-city.json. Peak 90 calls, 181708 triangles, active 59.48–60.18FPS. Bay Bridge: ../item5-bridge/report-{1280,390}.json; actual click crossing 59.92/60.00FPS and validated authority segments. All390 measurements use a desktop-rendered phone viewport on IntelArcD3D11, Cozy/nativeDPR1, not physical phone hardware.

CPU reports one level up: item5-actions-check.json (19runtime cases), item5-paths.json (475required routes/274594samples), item5-picking-check.json (30input/geometry cases). Backend127tests pass in ../checks/item5-tests.json; build/lint/package logs follow existing ignored-log policy. Failed attempts and decisions are in PLAN.md; failure.png captures are diagnostics and are not acceptance evidence.
