# Metro Life

A small shared-world life sim in the browser. Make a character, move into a studio in Atlanta, New York or the Bay Area, find a job, meet neighbours and other players, and build a life one game day (seven real minutes) at a time. There is no sign-up: a browser session keeps your life.

- `frontend/`: React 19, Vite, react-three-fiber and three.js. Static build, deployable to Vercel.
- `backend/`: Spring Boot 3 on Java 21. Owns the whole simulation, the save file (one JSON document) and the live WebSocket.
- `shared/`: world, navigation, interior, venue and naming data read by both.

## Run it locally

You need Java 21, Maven 3.9+ (or the included `backend/mvnw`) and Node 22.

```sh
# API on :8080, saving to backend/data/metro-life.json
cd backend
./mvnw spring-boot:run

# Frontend on :5173, proxying /api and /ws to :8080
cd frontend
npm ci
npm run dev
```

Open http://localhost:5173. Open it in a second browser profile to meet yourself in the city.

To run the frontend against an API on another port or host, set `METRO_API_PROXY=http://127.0.0.1:8082` for the dev proxy, or build with `VITE_API_URL=http://127.0.0.1:8082` to call that origin directly (the API must list the page's origin in `METRO_ORIGINS`).

## Build

```sh
npm --prefix frontend ci
npm --prefix frontend run build      # copies shared/*.json, type-checks, writes frontend/dist
npm --prefix frontend run lint
mvn -f backend/pom.xml -q package    # writes backend/target/backend-0.0.1-SNAPSHOT.jar
```

The JAR is API-only. To play from a single address without the dev server, point it at a built frontend:

```sh
cd backend
METRO_STATIC_LOCATIONS=file:../frontend/dist/ java -jar target/backend-0.0.1-SNAPSHOT.jar
```

## Configuration

| Variable | Where | Default | Meaning |
|---|---|---|---|
| `PORT` | API | `8080` | Listening port. |
| `METRO_DATA` | API | `data/metro-life.json` | Save file. Back it up while the server is stopped. |
| `METRO_ORIGINS` | API | `http://localhost:[*],http://127.0.0.1:[*]` | Browser origins allowed to call the API and open the socket. |
| `METRO_STATIC_LOCATIONS` | API | none | Optional Spring resource location of a built frontend. |
| `VITE_API_URL` | frontend build | empty (same origin) | API origin when the frontend is hosted elsewhere. |
| `METRO_API_PROXY` | frontend dev | `http://localhost:8080` | Target of the dev server's `/api` and `/ws` proxy. |

Run exactly one API instance: the save file has a single writer and sessions live in memory.

## Deploy

- Frontend: a Vercel project with Root Directory `frontend`. It is not connected yet; creating the project and linking the repository is a manual step described in [docs/deploy.md](docs/deploy.md). Set `VITE_API_URL` once an API is running.
- API: the `backend/Dockerfile` image on one instance with a persistent volume at `/data` (Render, Fly.io or Koyeb), with `METRO_ORIGINS` set to the Vercel URL.

Step by step in [docs/deploy.md](docs/deploy.md).

## End-to-end journeys

`e2e/` holds seven Playwright journeys that play the real game: first start, resuming after a reload, two players meeting online, a server outage with recovery, a work shift with pay, a two-way social visit (wave, hang out, gift), and a flight to another city, at 1366x768 and at 667x375 with touch. They start the API on :8090 and the Vite dev server on :5190 by themselves (or reuse running ones). On a machine without a GPU the run is slow, so allow plenty of time per viewport.

```sh
(cd backend && mvn -q package) && (cd frontend && npm ci)
cd e2e && npm ci && npm run e2e
```

See [e2e/README.md](e2e/README.md) for options.

## Playing

Tap **Play** to start in seconds, or make every detail of your character yourself. Walk with WASD or the arrow keys (Shift runs), use E or Enter to interact and Escape to back out. On phones, drag the joystick at the bottom left and tap the action button at the bottom right. Walk up to doors, furniture, counters and people to see what you can do.

## More

- [SPEC.md](SPEC.md): rules and API contract.
- [docs/](docs/): design notes, HUD direction, rendering, landmarks, first-day economy and asset credits.
- [CONTRIBUTING.md](CONTRIBUTING.md): how to work on the project.

Metro Life is released under the [MIT License](LICENSE). Assets keep their own licences; see [docs/credits.md](docs/credits.md). Map data (c) [OpenStreetMap contributors](https://www.openstreetmap.org/copyright).
