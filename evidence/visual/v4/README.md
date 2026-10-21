# V4 staged activities and rooms

Atlanta is the V4 visual check city under the owner's lighter-check direction. All captures use native 1280 x 800 or 375 x 812, DPR 1, Cozy. The complete three-city day/night sweep is reserved for V8.

## Sources and implementation
- Original character GLBs stay unchanged. Nine activity clips per body are derived from CC0 Quaternius Universal Animation Libraries 1 and 2; source URLs, archive inventories and SHA256 hashes are in the two universal_animation_library*.json files. Shipped licence copies are under frontend/public/models/chars.
- The 62-bone target rig is retargeted with recovered inverse-bind rest transforms in Three. Blender and Three inventories are retained. wardrobe-rest.json checks all ten outfits; maximum bind difference is 0.0000155.
- Shared room data supplies city layouts, collision, approach points and reserved hip/facing slots. Visual staging leaves movement authority at the validated approach. Indoor activities last six seconds; effects settle only at completion. Public dance slots are spaced so several people can dance together.
- Four full-height walls, camera cutaway and 0.25 m Walls Down; tiling wood/tile/wallpaper, skirting, real lamps, shelves, rugs, plants and city clutter. The studio remains small and sparsely furnished by design. Sleep is under a blanket, showers use frosted glass, eating/typing use chairs, and park benches can be sat on and left.

## Evidence and actual checks
- poses: 36 accepted pose-gallery captures (both bodies, nine poses, both sizes); poses-round1 retains rejected typing/cheering before the corrections.
- rooms: first laptop four-room run, including measured cold failures and warmed retries in report-1280-normal.json. Actual sleep and floating food captures are under rejected-sleep/rejected-food.
- home-final: bed-height correction and actual Settings wall buttons at laptop size.
- phone-final: all four rooms and actual Settings wall buttons at phone size; old floating food is under rejected-food.
- food-final: hand-attached eating prop at both sizes, inspected natively.
- stage-final: laptop stage performance; phone performance also appears in phone-final.
- contacts: inspected contact sheets supplement native inspection of Sleep, Sit, shower, cooking, Eat, Type and Cheer.
- checks: raw successful and failed build/lint/backend runs and retarget logs; failures are retained rather than replaced.

Final reservation/park checks and server/commit status will be appended after completion.

## Limits
The old crowd representation is replaced in V5, and city building/entrance work stays in V7. Only Atlanta is visually checked in V4; backend layout authority is checked for all three cities. Some measured post-processing GPU timings remain above the approximate 3–4 ms target (up to 6.35 ms in these checks); the unchanged active-motion FPS gate is assessed separately, with every failed sample retained. No physical phone or native macOS/Linux execution is claimed.
