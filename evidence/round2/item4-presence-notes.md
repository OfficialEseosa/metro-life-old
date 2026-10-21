# R2 item 4: arrival spacing and reliable presence

Scope: backend Navigation.java, Community.java, LiveWire.java, ResidentMotion.java and new PresenceArrivalTests.java only. Read the Round 2 objective and independent R1 audit. Did not edit research, canonical world, frontend, SPEC, PLAN, other agents' backend files, or start another R2 item.

## Changes

- One arrival allocator now checks static collision, room bounds, visible human/NPC bodies, active use-slot positions, approaching NPC reservations and authored staff positions. New human spawns, public room entry/exit, settled map destinations, reconnects and NPC spawns/door transitions receive a free point with at least 0.85m spacing. Exterior searches stay within 2.7m of the destination door so entering remains possible. New arrivals reserve their point for 12 seconds even before a socket is established. Private rooms remain isolated by their exact room id.
- Arrivals with no free point return an explicit busy-entrance conflict. Normal walking retains the existing continuous movement rules; this is arrival spacing, not full crowd avoidance.
- Human/NPC use-slot reservations remain shared and authoritative. Outdoor bench selection now also checks actual human/NPC bodies and reservations, rather than only another human's bench id. Expired offline returns release stale bench posture and choose a free point if another person occupies their old position.
- Social distance is measured using the same visible effective position as rendering (an active use slot, otherwise walking coordinates), with exact normalized room id and the existing 3m range. Home/other-city/other-room targets remain unavailable. Accepted NPC interactions hold that NPC's movement for five seconds.
- Full Player presence and position patches add `socialBusy: boolean`, meaning a future activity timer or pending story. It is viewer independent. Root added the matching optional TypeScript field and frontend filtering/reasons. No pending story payload is exposed.
- Presence serialization settles due trips/actions for active humans before either full presence or fast position frames. This prevents a snapshot from claiming the new location while carrying an old door position or stale busy state.
- Closing the last socket releases online presence immediately. Closing one of several tabs keeps that player online. Closed sockets are not renewed by the scheduled heartbeat.

## Checks and evidence

Targeted command:
`backend/mvnw.cmd -q -f backend/pom.xml -Dtest=PresenceArrivalTests,NavigationTests,CommunityTests,InteriorTests,VenueTests,ResidentMotionTests,LiveWireTests test`

- Initial run: 44 tests, one failure, zero errors. Existing resident continuity test caught reallocation at every new walking route; that caused a jump larger than the motion budget. Corrected by preserving an already walking exterior position and allocating only actual spawns/room transitions.
- Repeat: PASS, 44 tests, zero failures/errors/skips: PresenceArrivalTests 8, NavigationTests 4, CommunityTests 7, InteriorTests 5, VenueTests 12, ResidentMotionTests 5, LiveWireTests 3.
- New regressions cover eight new players/public entries, simultaneous map arrivals and exits, occupied offline reconnect, NPC body/use-point exclusion, exact room and busy-state social gating, seated NPC distance/hold, last-socket versus multiple-tab TTL, and WebSocket snapshots settling due travel before publishing.
- Logs: `evidence/round2/item4-presence-tests.log` (initial failure retained) and `item4-presence-tests-repeat.log` (pass).
- `git diff --check`: PASS; only existing PLAN.md line-ending advisory from another agent's changes.
- No full-suite run was made by this agent. Maven access was coordinated and released to root after the targeted pass. Root owns integrated full-suite/build/browser verification, screenshots at 1280x800 and 390px, and performance measurements. No browser pass or visual claim is made here.
- No commits, server start/stop, pushes, deployments, purchases or signups by this agent.
