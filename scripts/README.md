# Scripts

These are the authoring tools that produced the generated models and data under `frontend/public/models`, `frontend/src/scene/*.json` and `shared/`. The generated files are committed, and the game does not need to run any script to build or play. Treat the scripts as the record of how those files were made, not as a build step: some need inputs that are no longer in the repository, and a few no longer reproduce the committed output exactly.

Run everything from the repository root. Blender scripts need Blender (with its bundled Python and `bpy`) on your machine, run as `blender --background --python scripts/<name>.py`. Node scripts need `npm --prefix frontend ci` first.

## Needs inputs that are not in the repository

| Script | What is missing |
|---|---|
| `osm-layout.cjs` | OpenStreetMap XML extracts in `evidence/art-rebuild/` (`centennial-osm.xml`, `stadium-osm.xml`, `piedmont-osm.xml`). Nothing here downloads them. It skips absent files silently and then overwrites `frontend/src/scene/atl-osm.json` with empty data, so do not run it without the extracts. |
| `city-osm-layout.cjs` | Extracts in `evidence/art-rebuild/` (`nycDowntown-osm.xml`, `bayFerry-osm.xml`, `bayAlcatraz-osm.xml`). Same behaviour: absent files are skipped and `frontend/src/scene/city-osm.json` is overwritten. |
| `city-osm-extracts.cjs` | Downloads the New York and Bay Area extracts above from the public OpenStreetMap API into `evidence/art-rebuild/`. Create that folder first. It does not fetch the Atlanta extracts. |
| `retarget-activities.mjs` | Two animation libraries downloaded by hand into `.runtime/mesh2motion/` (`human-base-animations.glb` and `human-addon-animations.glb` from the mesh2motion-app repository, see `docs/credits.md`). `.runtime/` is git-ignored. |

## Run from the repository alone (plus Blender)

| Script | Notes |
|---|---|
| `build-landmarks.py` | Atlanta stadium, Centennial Park and Piedmont Park. Reads `frontend/src/scene/atl-osm.json`. Writes `frontend/public/models/landmarks/` and renders previews and a report into `evidence/art-rebuild/blender/` (created on demand, git-ignored). `--only id,id` limits the models. |
| `build-atlanta-heroes.py`, `build-new-york-heroes.py`, `build-bay-heroes.py`, `build-arena.py` | Hero landmarks. Each loads the one before it (`build-landmarks.py`, then Atlanta, New York, Bay), so keep the scripts together. Output and previews go to the same folders as above. The Bay script also reads `frontend/src/scene/city-osm.json`. |
| `build-fabric-lod.py` | Derives `painted-row-lod.glb` from `paintedLadies.glb`. Create `evidence/hud-m4-audit/` first, because it writes a small report there. |
| `build-metric-car.py` | Rebuilds `models/vehicles/sedan.glb` from `models/world/car/sedan.glb`. |
| `build-metric-road.py` | Rebuilds `models/streets/road_straight.glb`. |

## Generated data

| Script | Notes |
|---|---|
| `build-navigation.cjs`, `build-resident-routes.cjs` | Read the TypeScript scene layouts through a small in-process transpiler and write `shared/navigation.json` and `shared/resident-routes.json`. They need `npm --prefix frontend ci` and `npm --prefix frontend run sync-shared`. On the current tree they stop with a syntax error while transpiling `frontend/src/store.ts`, so they cannot regenerate the committed files until that loader is fixed. |
| `design-street-network.py` | Reads `shared/navigation.json` and `shared/resident-routes.json` and rewrites `shared/streets.json` and `shared/resident-routes.json`. Python 3 only. It runs, but its output is not identical to the committed files. |
| `../tools/BuildRoomLayouts.py` | Rewrites `shared/interiors.json` from `shared/world.json`. Python 3 only. It runs, but its output is not identical to the committed file. |

Check any regenerated file with `git diff` before keeping it, and run the end-to-end journeys in `e2e/` afterwards.
