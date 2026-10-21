# R2 item 4: High Museum exterior occlusion

Read the Round 2 goal and independent R1 audit. Changes are limited to `camera-occlusion.tsx`, a focused offline regression/inventory script and this evidence. No skyline heights, supplied GLBs/manifests, scene composition, shared data or gameplay rules were changed by this subagent.

High Museum is a single merged 4,198-triangle campus mesh. Its bounding box spans the actual buildings, empty courtyards and entrance frontage: world minimum `[-19,-0.051,-53]`, maximum `[3,6,-35]`. A ray from an angled arrival camera to the player can intersect this box without hitting any actual building surface. The previous shader faded the entire mesh to an 18% dither silhouette on the box test alone, creating the reported ghost.

Non-instanced landmarks now require an actual triangle hit between the camera and the player (ending 1.2 metres short of the player) before their existing fade shader is allowed to run. The broad box test rejects unrelated landmarks first; Three's production mesh raycast confirms remaining candidates. Internal geometry checking bypasses the deliberately disabled interaction raycast without changing click behavior. A live uniform carries the confirmation, so this adds no draw calls, render targets or material variants per mesh. The shader keeps a shared v4 program key and its original per-mesh bounds uniforms. Normals, geometry groups, emission and source material synchronization are unchanged.

Intersection results are reused while camera and target remain stationary. Newly mounted/removed models invalidate that cache. Only static exterior non-instanced landmarks need triangle confirmation; repeated trees/building kits retain their current instanced local-box shader path. This keeps hundreds of foliage instances batched and preserves the Round 1 fix for the foreground Capitol tree. This is a focused correction for merged landmark geometry with empty spaces, not a claim of triangle-perfect per-instance foliage fading.

`node scripts/r2-item4-evidence.mjs` passes ten real High Museum entrance/courtyard cases where the old box test says fade but no triangle blocks the player. A real foreground museum wall still confirms as a blocker; a museum behind the player does not; the actual eight-metre foreground tree geometry remains a blocker. Saved `item4-occlusion-geometry.json`. Texture loading is disabled only in this offline geometry fixture; the game and supplied files are unchanged. The initial fixture attempted the tree's relative palette image in Node and logged an image-load warning; the final fixture avoids unused texture loading and reruns cleanly.

The same script measures and hashes the owner's final nine supplied Blender files, checks both manifest mirrors byte-for-byte, validates every manifest triangle count and named glow, and writes new `item4-models.json` without overwriting Round 1 evidence. Current set: **18,292 source triangles, 17 merged beauty draws**. The updated stadium SHA-256 is recorded in that file; the root must include its owner-supplied blue-glass binary in the first R2 commit. No asset was modified here.

Frontend lint passes with zero warnings. No GPU browser or scene build was launched by this subagent; the root owns serialized browser verification and final frame-rate/draw/triangle measurements.

Root browser scenarios at both 1280x800 and 390px:

1. Search for High Museum by day, travel there and let arrival finish. Keep the museum visibly opaque while the player stands at its door. Open its location view to exercise the angled camera, then return to following the player; orbit/zoom if available. Compare against a fade-disabled frame from the same position.
2. Use an angled approach similar to camera `[10.332,16,-17.771]`, target/player `[-8,1,-35.75]` (or the symmetric west-side view). Old bounds confirm occlusion; actual museum triangles do not. `cameraOcclusion.landmarkPrecision` should report `triangle-confirmed` and zero confirmed landmark surfaces if no other building intervenes.
3. Travel to the Capitol from indoors. The large foreground tree must still fade enough to reveal the player; the Capitol behind the player should remain visible. Also check Ponce arrival for background-building ghosting.
4. Move the camera so an actual building wall lies between it and the player. That wall must still fade. Indoors and full-city overview should not activate close-player occlusion.

Actual browser screenshots, performance results and material/shader console checks remain with the root before acceptance. No local commit performed by this subagent.
