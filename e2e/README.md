# End-to-end journeys

Playwright journeys that drive the real game in Chromium against a real API.

```sh
(cd backend && mvn -q package)        # the API jar the journeys start
(cd frontend && npm ci)
cd e2e
npm ci
npm run e2e                           # both viewports
npm run e2e:laptop                    # 1366x768 only
npm run e2e:phone                     # 667x375, touch
npx playwright test b-resume          # one journey
```

- The API runs on `127.0.0.1:8090` with a fresh save in `e2e/output/metro-e2e.json`. If something already answers on 8090 it is reused, and journey d simulates the outage in the browser instead of stopping the server.
- The Vite dev server runs on `127.0.0.1:5190` with `VITE_API_URL=http://127.0.0.1:8090` (reused if already running; set `E2E_EXTERNAL_FRONT=1` to never start it).
- Use the Playwright browsers already installed on the machine; the package pins `@playwright/test` to the same version.
- Screenshots go to `e2e/output/shots` (`E2E_SHOTS` to change), the HTML report to `e2e/output/report`. Both are ignored by git.
- `E2E_QUALITY=normal` keeps full scene quality; the default `low` makes software-rendered runs much faster.
- Timeouts are generous (15 minutes per journey) because software WebGL renders a few frames per second.

| Journey | What it checks |
|---|---|
| a | Make a character, arrive, leave and enter home, use the bed |
| b | Reload resumes the same life |
| c | Two browsers see each other online in the same city |
| d | Server stopped: reconnecting banner, unreachable card, recovery to the same life |
| e, f, g | Work a shift, wave/hang out/gift both ways, fly to another city (skipped until added) |
