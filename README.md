# UNO Arena

An unofficial UNO-inspired card game for desktop and mobile browsers. React, TypeScript, Vite, Framer Motion, Express, Socket.IO, and optional MongoDB persistence.

## Run Locally

Requires Node.js 22 or 24 and npm.

```sh
npm ci
npm run dev
```

Open http://localhost:5173. The server listens on port 4000. The Vite app proxies API and socket traffic, so phones never need to connect to their own localhost.

## Play With Friends on Phones

1. Connect the computer and phones to the same Wi-Fi or hotspot.
2. Find the computer's LAN IPv4 address using `ipconfig`.
3. Open `http://COMPUTER-IP:5173` on every phone. Allow the dev server through the computer firewall for your private network if needed.
4. Choose **Host a table**, share the six-character room code, and have friends choose **Join your friends**.
5. Add bots for empty seats, then start. Up to ten total players.

The computer must remain running. A share link with `?room=CODE` prefills the invite. Use a LAN address when sharing nearby; localhost links only work on the computer itself. For internet play, deploy the production server behind HTTPS and share its public URL.

Room codes are the supported transport. Web Bluetooth is not a cross-browser phone-to-phone networking API; no Bluetooth connection is advertised or simulated.

## Install on Mobile

The production build includes a web app manifest, mobile icons, safe-area support, and a versioned offline service worker. Open the HTTPS site and use the browser's install action or Add to Home Screen. iPhone installation is through Safari's Share menu. Ordinary HTTP LAN addresses can play online but do not get service-worker installation or offline caching.

Solo games work offline after the production app shell has been installed. Multiplayer always needs the shared server. Returning to the same tab reconnects your saved multiplayer seat. Solo rounds can be resumed after a reload.

## Build and Deploy

### Vercel Frontend

The **repository root** is the recommended Vercel Root Directory. Select the **Vite** framework preset. The root `vercel.json` sets these commands:

| Setting | Value |
| --- | --- |
| Install Command | `npm ci --include=dev --workspaces --include-workspace-root` |
| Build Command | `npm run build:vercel` |
| Output Directory | `apps/client/dist` |
| Node.js Version | `22.x` or `24.x` |

Existing projects with Root Directory **`apps/server`** are also supported. Keep **Include source files outside of the Root Directory in the Build Step** enabled. The `apps/server/vercel.json` installs from the repository root, delegates `build:vercel` to the frontend, and publishes the copied static output from `vercel-dist`. It does not deploy the Socket.IO server as a function. See the [deployment guide](docs/DEPLOYMENT.md) for the settings for each root.

Redeploy the latest commit without the previous build cache. Without a backend, the site supports solo games, local settings/statistics, and offline installation. Multiplayer is explicitly unavailable until a server URL is configured.

For room-code multiplayer, use the included `render.yaml` to deploy the Node server, then set **`VITE_SERVER_URL`** in Vercel to its HTTPS origin and redeploy. The full [Vercel and multiplayer deployment guide](docs/DEPLOYMENT.md) covers this setup and the `tsup: command not found` error.

### Single-Server Hosting

```sh
npm run build
npm start
```

Express serves the built client and Socket.IO together on port 4000. Set `NODE_ENV=production` and configure HTTPS at your reverse proxy. Proxy WebSocket upgrades and all paths to the same backend. This repository is designed for one running server instance.

Server configuration in `apps/server/.env` (see `.env.example`):

- `PORT`: default 4000.
- `CLIENT_ORIGIN`: exact public origin for cross-origin clients; same-origin deployment is recommended.
- `MONGODB_URI`: enables persistent guest profiles, settings, statistics and history. Without it, backend saves are in memory.
- `TRUST_PROXY_HOPS`: exact number of trusted reverse proxies; default 0 for direct access, 1 in the Render template. Do not enable blindly on an untrusted network path.
- `VITE_SERVER_URL`: client build variable for a separate backend origin. Set in Vercel's environment settings or `apps/client/.env.local`, not the server's `.env`. Omit for same-origin hosting.

Never expose MongoDB directly to browsers. Guest profile saves are protected by a random device secret, not a public profile ID. Browser storage retains local data; clearing it removes that device identity. Statistics are personal records, not trusted leaderboard scores.

Live rooms and reconnect tokens are in memory and are lost on server restart. See the [review and deployment boundaries](docs/REVIEW.md) before multi-instance or competitive deployment.

## Project Layout

- `apps/client/src/components`: home, table, lobby, settings, help, statistics, cards, accessible dialogs.
- `apps/client/src/hooks`: stable multiplayer lifecycle, local match orchestration, device saves, synthesized audio.
- `apps/server/src`: validated socket protocol, authoritative rooms, turn scheduling, private guest APIs, MongoDB repository.
- `packages/shared/src`: game types, rules, AI, deck and statistics.
- `tests`: real browser journeys.
- `scripts`: mobile icon generation, offline build preparation and production smoke checks.
- `docs/REVIEW.md`: original findings, fixes, rule variants and deployment limits.

## Verification

```sh
npm test
npm run typecheck
npm run lint
npm run test:e2e
npm run build
node scripts/test-production.mjs
```

Browser checks use an installed Google Chrome via Playwright. Change the channel in `playwright.config.ts` to use a different installed browser. Screenshots and traces are written to ignored `artifacts/` and `test-results/` folders.

## Gameplay

Seven cards each. Match color, number or symbol. Draw one and optionally play only the drawn card. Call UNO before reaching one card; missed calls can be caught until the next play/draw. The winner earns the other hands' card points, including final draw penalties.

Easy bots choose random legal moves. Medium bots prefer playable color groups and useful action cards. Hard bots preserve wilds, choose strong follow-up colors, pressure short hands and target small hands for swaps. Bots use their own hand and public opponent card counts.

House rules include same-type +2/+4 stacking, identical colored-card jump-ins, seven/zero hand exchanges, and automatic force play. The app blocks illegal +4 plays instead of supporting bluff/challenge rounds, and opens with a number discard. Full details are available in Help.
