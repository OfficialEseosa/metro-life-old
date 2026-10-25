# Deploying Metro Life

Metro Life is two pieces:

- **Frontend**: a static Vite build (`frontend/`), suited to Vercel or any static host.
- **API**: the Spring Boot server (`backend/`), which owns the whole simulation, the save file and the live WebSocket. It runs as one long-lived container.

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

Rules that matter on every host:

- **Exactly one instance.** The save file has a single writer and sessions and sockets live in memory. Disable autoscaling and zero-downtime overlap if the host offers them.
- **A persistent volume at `/data`.** Without it every redeploy starts a new city.
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

1. Import the repository and set **Root Directory** to `frontend`. `frontend/vercel.json` sets the install command, the build command and the `dist` output.
2. Keep **Include files outside the root directory in the Build Step** enabled (the default). The build copies `../shared/*.json` into `src/shared-data` before compiling.
3. Add the environment variable `VITE_API_URL` with the API origin, without a trailing slash, for example `https://metro-life-api.fly.dev`. It is read at build time, so redeploy after changing it.
4. Put the Vercel production URL (and a preview pattern if you want previews to work) into the API's `METRO_ORIGINS`.

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
