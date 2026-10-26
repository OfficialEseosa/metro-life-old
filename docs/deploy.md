# Deploying Metro Life

Metro Life is two pieces:

- **Frontend**: a static Vite build (`frontend/`), suited to Vercel or any static host.
- **API**: the Spring Boot server (`backend/`), which owns the whole simulation, the save file and the live WebSocket. It runs as one long-lived container.

## What is still manual

The repository does not deploy itself. These steps need a dashboard login and are not scripted:

1. Create a Vercel project with the settings under [Frontend on Vercel](#frontend-on-vercel).
2. Run one API container with a volume at `/data` on one of the [free API hosts](#free-api-hosts), and set its `METRO_ORIGINS` to the Vercel URL.
3. Set `VITE_API_URL` on the Vercel project to the API origin and redeploy.

## API container

Build from the repository root (the build packages `shared/*.json`):

```sh
docker build -f backend/Dockerfile -t metro-life-api .
docker run -p 8080:8080 -v metro-data:/data \
  -e METRO_ORIGINS=https://your-game.vercel.app \
  metro-life-api
```

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `8080` | Port to listen on. Most hosts set it for you. |
| `METRO_DATA` | `/data/metro-life.json` in the image | The save file. Put it on a persistent volume. |
| `METRO_ORIGINS` | `http://localhost:[*],http://127.0.0.1:[*]` | Comma-separated browser origins allowed to call the API and open the socket. Exact origins or patterns, for example `https://metro-life.vercel.app,https://metro-life-*-team.vercel.app`. |
| `METRO_STATIC_LOCATIONS` | none | Optional Spring resource location of a built frontend (for example `file:../frontend/dist/`), so the API also serves the game from one address. Leave unset when the frontend is on Vercel. |

Rules that matter on every host:

- **Exactly one instance.** The save file has a single writer and sessions and sockets live in memory. Disable autoscaling and zero-downtime overlap if the host offers them.
- **A persistent volume at `/data`.** Without it every redeploy starts a new city.
- **Volume ownership.** A mounted volume usually arrives owned by root. The image starts as root only to `chown` the `/data` directory (the folder of `METRO_DATA`) to its unprivileged `metro` user, then drops to that user before starting Java (`backend/docker-entrypoint.sh`). Nothing to configure on Fly, Render or Koyeb; if you override the entrypoint, make the data directory writable yourself.
- **HTTPS in front.** Hosts terminate TLS and forward `X-Forwarded-*`; the server trusts those headers, so cookies are marked `Secure` and cross-site cookies work.
- Health check path: `GET /api/version`.
- The server stops gracefully (up to 10 s) and saves on shutdown.

### Render

New Web Service, runtime Docker, Dockerfile path `backend/Dockerfile`, Docker build context `.` (repository root). Add a persistent disk mounted at `/data` (disks need a paid instance; on the free tier the city resets on every restart). Set `METRO_ORIGINS`. Keep instances at 1. Free services sleep when idle; the first request after a sleep takes a while, and the game shows its reconnecting screen until the server answers.

### Fly.io

```sh
fly launch --dockerfile backend/Dockerfile --no-deploy
fly volumes create metro_data --size 1
```

In `fly.toml` mount the volume (`[mounts] source = "metro_data"`, `destination = "/data"`), set `internal_port = 8080`, and keep one machine (`fly scale count 1`). Set the allow-list with `fly secrets set METRO_ORIGINS=https://your-game.vercel.app`, then `fly deploy`.

### Koyeb

Create a service from the Git repository with the Dockerfile builder, Dockerfile `backend/Dockerfile`, work directory the repository root, port 8080, one instance, and the `METRO_ORIGINS` variable. Attach a volume at `/data` where your plan allows it; otherwise the save file is lost on redeploy.

## Frontend on Vercel

Project settings (your Vercel team, any project name):

| Setting | Value |
|---|---|
| Git repository | `<github-owner>/<repository>`, production branch `main` (every push deploys) |
| Root Directory | `frontend` |
| Framework preset | Vite |
| Install / build / output | `npm ci` / `npm run build` / `dist` (also set in `frontend/vercel.json`) |
| Include files outside the root directory in the Build Step | **on** (the default) |
| Node.js | 22.x |
| `VITE_API_URL` | the API origin without a trailing slash, for example `https://metro-life-api.fly.dev`; leave unset until an API exists |

Steps:

1. Vercel dashboard, Add New, Project, import `<github-owner>/<repository>` (install the Vercel GitHub app for the repository if asked), then set the values above.
2. Keep **Include files outside the root directory** on: `npm run build` first copies `../shared/*.json` into `src/shared-data` and stops with a clear message if `../shared` is missing.
3. Once an API is running, add `VITE_API_URL` (Production and Preview) and redeploy: the value is read at build time.
4. Put the Vercel production URL, and a preview pattern if you want previews to reach the API (for example `https://<project>-*-<team>.vercel.app`), into the API's `METRO_ORIGINS`.

Without `VITE_API_URL` the page calls `/api` on its own origin, which Vercel answers with 404, so players see the "server unreachable" card instead of a blank page.

`frontend/vercel.json` also:

- rewrites page paths to `index.html`, but never `api/`, `ws`, `assets/`, `audio/`, `models/` or any path with a file extension, so a missing model or sound is a real 404;
- caches `assets/` (content-hashed JS, CSS and fonts) for a year as immutable, `audio/` and `models/` for a day with a 30-day stale-while-revalidate window (they are not hashed), and serves `index.html` with `no-cache`.

## Free API hosts

Any of these runs the `backend/Dockerfile` image. Whatever the host: one instance, a persistent volume at `/data`, `METRO_ORIGINS` set to the Vercel URL, health check `GET /api/version`.

| Host | Free tier notes |
|---|---|
| Render | Free web services sleep after idle time and have no disk, so the city resets on each restart; a paid instance adds a disk at `/data`. |
| Fly.io | Small machines and a 1 GB volume fit the free allowance on most accounts; set `min_machines_running = 1` to avoid cold starts. |
| Koyeb | One free instance; volumes depend on the plan, otherwise the save file is lost on redeploy. |

## Sessions across origins

There is no login. The API keeps each life with an HttpOnly `ml_session` cookie:

- same site (for example `play.example.com` and `api.example.com`, or local development): `SameSite=Lax`;
- different sites over HTTPS (for example `*.vercel.app` and `*.fly.dev`): `SameSite=None; Secure; Partitioned`.

Browsers that block third-party cookies (Safari, Firefox strict mode, Chrome with third-party cookies off) never send that cookie to a different site. For those, when the API is on another origin the frontend also receives the session token on sign-in, stores it in `localStorage` and sends it as the `X-Metro-Session` header and the socket's `session` parameter. The most robust setup is still to serve the API from a subdomain of the frontend's domain, so the cookie is first-party.

## Running everything from one address

For local play without Vercel you can let the API serve a built frontend:

```sh
npm --prefix frontend ci && npm --prefix frontend run build
cd backend && METRO_STATIC_LOCATIONS=file:../frontend/dist/ java -jar target/backend-0.0.1-SNAPSHOT.jar
```
