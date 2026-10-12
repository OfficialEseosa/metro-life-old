# Metro Life

Install **Java 21 (JDK)**, then run one command from this folder:

- Windows: double-click `run.cmd`, or run `.\run.cmd`.
- macOS / Linux: `sh run.sh`.

Open **http://localhost:8080/**. Everyone who opens this server joins the same city. Make your character, arrive at your small studio with $150, and play your first day. Your browser’s guest cookie keeps your life; there is no signup or login.

The first launch downloads pinned, checksum-verified Maven and Java dependencies, then builds once. Later launches reuse the build. The compiled frontend and every model are included; reviewers do **not** need Node or Maven installed. Java and network access for the first dependency download are the only prerequisites. Use `METRO_PORT` to choose another port. Local progress is in `backend/data/metro-life.json`; keep that folder and the browser’s site data. Settings offers a confirmed **Start a new life**.

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

## Maintainer frontend refresh

Run in this order from the repository root:

```powershell
npm --prefix frontend ci
npm --prefix frontend run build
java tools/PackFrontend.java
cd backend
.\mvnw.cmd package
java -jar target/backend-0.0.1-SNAPSHOT.jar
```

Open http://localhost:8080. Maven packages the compiled frontend and its local assets into the JAR. Build the frontend before packaging the backend; no Vite server is needed for this build.

`PORT` overrides 8080. `METRO_DATA` selects the save path (default `backend/data/metro-life.json` when started from backend). Back up that JSON file while the server is stopped. Sessions, worlds, residents, chat and progress survive restart; the process is the single writer. Run one instance only. `METRO_ORIGINS` is a comma-separated list of exact browser origins allowed to open sockets; the default permits localhost/127.0.0.1 on 5173/8080. For a different host/port, set it explicitly. No deployment has been performed.

## Playing

Start playing → Play solo → choose a city/home/dream → Start my life. You arrive at your front door. WASD or arrows walk, Shift runs, E or Enter interacts, and Escape backs out. On phones, drag the thumb joystick at bottom left and tap the contextual action at bottom right. Walk to the door to enter your home, and approach the stove, bed, shower or couch to use it.

Walk to an open workplace, enter, approach its desk and apply for an entry role. Work a shift there: the character types while progress runs, and cash arrives only on completion. Cafes have meals at counters/tables; music venues have a dance floor and stage. People in the same public room can wave, hang out or gift by walking up to one another. Private homes stay private.

The overview button zooms out; moving returns to the close following camera. Drag/pinch/scroll still explore the map. Search and Travel here provide an optional timed shortcut within a city; cross-city travel requires walking to the airport or visiting it through the shortcut and taking a flight. Panels remain available through the dock and More activities at public furniture. On phones the sheet handle supports peek, half and full height; focus it and press Up/Down for keyboard control. Story choices need an answer. The lighting button previews day/night, then follows the game clock; sound can be muted and reduced motion is respected.

Open the same server address in a second browser profile to meet another player. Your home is private to your character; streets, venues and city chat are shared. Gifts and voting unlock after one game day (24 real minutes), and incoming gifts are capped at $50 per day.

## Checks and limits

```powershell
npm --prefix frontend run build
java tools/PackFrontend.java
npm --prefix frontend run lint
cd backend
.\mvnw.cmd test
```

Browser evidence and exact results are in `evidence/` and `PLAN.md`. The scripts use this machine's installed Playwright/Chromium paths and ANGLE D3D11; adjust them on another machine. A physical phone, human listening test and production hosting are not verified. See `docs/final-report.md` for final results and known weaknesses, and `docs/landmarks.md` for recognisability exceptions.

Assets retain their included licences. Map data (c) [OpenStreetMap contributors](https://www.openstreetmap.org/copyright). Reference-source studies are in `docs/reference-notes.md`; captured reference content is not game content.
