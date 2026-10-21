# Round 2 item 5 — server cancellation and exact furniture targets

Scope: GameService.java, ApiController.java, Navigation.java, and new focused ActionCancellationTests.java / RequestedSlotTests.java. No frontend, SPEC, PLAN, shared assets, browser or GPU work; parent owns integration and contract documentation. Owner's Round2 objective remains the authority; no later transport booking implemented.

Cancellation:
- Added POST /api/action/cancel with the existing opaque browser cookie and no required body. Returns the ordinary public `{sim,clock}` response; missing session returns401.
- The synchronized server method first runs normal decay/settlement. An action/trip whose deadline is due therefore finishes exactly once before cancellation responds. Its legitimate cash/XP/skill/goal/story/promotion/arrival effects remain.
- Unfinished `_pendingAction` / `_pendingTravel` are removed without applying the forecast state or delta. Activity costs were not charged yet, so cancellation neither charges nor refunds them. Busy timestamp/label/kind and activitySlot are cleared, releasing furniture. Story choices already earned are preserved.
- Current authoritative position is kept. Canceling a map shortcut that already exited a room leaves the player at that actual outside origin; a due shortcut first arrives at its destination. No cancellation teleport or client-supplied progress mutation.
- The result is saved durably; repeats and restart cannot replay discarded promises. Normal time-based need decay/rent continues independently.

Exact clicked furniture:
- Feasibility reported to parent before Navigation changes; parent explicitly accepted optional `/api/act` `slotId`.
- Stable authored slots already carry id/pose/station/x/z/face. Requested public slots must belong to the actual room and support the offered action's authored pose+station. The authoritative position must be walkable in that room and within1.45units of the chosen slot. The client routes to a valid approach within1.35units before submitting.
- Reservation chooses only that exact slot; occupied targets return409 rather than silently selecting another table. Invalid IDs / unsupported poses / invalid slotId types return400; remote room/distance/blocked approach return409. Current movement position stays at the validated approach; visual staging uses the returned existing activitySlot.
- Home requests preserve canonical furniture station checks plus the single compatible slot ID. Requests omitting slotId preserve the established keyboard/joystick station flow. No response shape or new ActivitySlot fields were needed.

Verification:
1. `.\mvnw.cmd -q '-Dtest=ActionCancellationTests' test` PASS8tests, zero failures/errors/skips. Log evidence/round2/item5-cancel-tests.log.
2. `.\mvnw.cmd -q '-Dtest=ActionCancellationTests,RequestedSlotTests,InteriorTests,LandmarkTemplateTests,Round2ProgressTests' test` PASS34tests, zero failures/errors/skips (8+7+5+5+9). Log evidence/round2/item5-cancel-slot-tests.log.
3. HTTP MockMvc regressions prove cookie-only cancellation response and exact selection of two separate public tables. Rule tests prove early/due cooking, paid food, work promotion/shift, map travel, story preservation, session isolation, persistence, occupancy release, remote/blocked/wrong-pose rejection and simultaneous different-table reservations.
4. git diff --check PASS. Maven and owned source released to parent for full integration tests. No source changes after these checks.

Limits: no browser/queue/radial-menu verification by this backend subtask. Client pathfinding and animation cancellation are parent's checks. No deployment/push/service purchase/account flow introduced.
