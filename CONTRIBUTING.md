# Contributing

- Read `SPEC.md` first. It is the gameplay and API contract; `frontend/src/api/types.ts` must agree with it.
- The backend is authoritative. The browser moves its own character and shows results, but money, needs, timers, purchases and every other outcome are decided on the server.
- `shared/*.json` is the single source for world, navigation, interior, venue and naming data. Both the backend and the frontend read it; the files are generated, but the scripts in `scripts/` and `tools/` are authoring history rather than a build step: some need inputs that are not in the repository and some no longer reproduce the committed output. Read `scripts/README.md` before relying on one, and check the diff after running it.
- Players only ever see fictional venue and business names. Canonical ids stay stable.
- No emoji anywhere in the game; icons are SVG. Copy never says prototype, placeholder, temporary or graybox.
- New assets must carry a licence that allows redistribution in a game. Record the source URL and licence in `docs/credits.md` and keep the licence text next to the files.
- Before pushing: `npm --prefix frontend run build`, `npm --prefix frontend run lint` and `mvn -f backend/pom.xml -q package` must pass, and the change must be checked by playing it in a browser at phone (667 x 375) and laptop size.
- Keep commits focused, with short imperative messages.
- Never commit screenshots, browser reports, save files or build output; `.gitignore` covers the usual folders.
