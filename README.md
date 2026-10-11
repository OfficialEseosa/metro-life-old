# Metro Life

A browser life sim set in Atlanta, New York and the Bay Area. Play solo, enter the public world, or create a private world and share its code. Start as a guest; save the guest account with a username and password to keep access on another device.

Requires Node 22 and Java 21. No accounts, keys or external services are needed to run locally. All assets are included.

## Development

From this directory, run these in separate PowerShell terminals:

```powershell
cd backend
.\mvnw.cmd spring-boot:run
```

```powershell
cd frontend
npm ci
npm run dev -- --host 127.0.0.1
```

Open http://127.0.0.1:5173. The frontend proxies API and WebSocket traffic to :8080.

## Compiled build

Run in this order from the repository root:

```powershell
npm --prefix frontend ci
npm --prefix frontend run build
cd backend
.\mvnw.cmd package
java -jar target/backend-0.0.1-SNAPSHOT.jar
```

Open http://localhost:8080. Maven packages the compiled frontend and its local assets into the JAR. Build the frontend before packaging the backend; no Vite server is needed for this build.

`PORT` overrides 8080. `METRO_DATA` selects the save path (default `backend/data/metro-life.json` when started from backend). Back up that JSON file while the server is stopped. Sessions, worlds, residents, chat and progress survive restart; the process is the single writer. Run one instance only. `METRO_ORIGINS` is a comma-separated list of exact browser origins allowed to open sockets; the default permits localhost/127.0.0.1 on 5173/8080. For a different host/port, set it explicitly. No deployment has been performed.

## Playing

Start playing → Play solo → choose a city/home/dream → Start my life. Choose an entry job, visit its open workplace, apply there and work a shift. Cash arrives when its progress bar finishes. Search places to eat, learn, relax or meet residents. Viewing another city is free; taking part there requires an airport flight. Home remains in its original city until you move.

Drag the map, pinch/scroll to zoom, or use Search. All actions have keyboard-accessible controls. On phones, drag/tap the sheet handle or focus it and press Up/Down for peek, half or full height. Escape closes ordinary panels; story choices need an answer. The lighting button previews the opposite lighting, then returns to the game clock. Sound can be muted. Reduced-motion preferences shorten camera/reward motion.

World contains neighbours, city chat, elections, plots, billboards and homes. To meet a friend, create a private world and enter its eight-character code from a separate browser profile. Meet at the same place before waving, hanging out or sending a gift. Gifts and public votes unlock after one game day (24 real minutes); chat and waves are available immediately. City chat and purchases are scoped to that world.

## Checks and limits

```powershell
npm --prefix frontend run build
npm --prefix frontend run lint
cd backend
.\mvnw.cmd test
```

Browser evidence and exact results are in `evidence/` and `PLAN.md`. The scripts use this machine's installed Playwright/Chromium paths and ANGLE D3D11; adjust them on another machine. A physical phone, human listening test and production hosting are not verified. See `docs/final-report.md` for final results and known weaknesses, and `docs/landmarks.md` for recognisability exceptions.

Assets retain their included licences. Map data (c) [OpenStreetMap contributors](https://www.openstreetmap.org/copyright). Reference-source studies are in `docs/reference-notes.md`; captured reference content is not game content.
