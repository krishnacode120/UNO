# Vercel and Multiplayer Deployment

## Fix the Failed Build

The latest log runs `npm run build:vercel` in `apps/server`. That script previously existed only in the repository root and the frontend. This is the fatal error; the Node engine, audit, and install-script messages are separate warnings. The server workspace now includes a compatibility build entry point, and both Node 22 and 24 are supported.

### Existing Project With Root Directory `apps/server`

Keep your current root. In **Settings > Build and Deployment**, enable **Include source files outside of the Root Directory in the Build Step**. This is necessary because the client and shared engine are sibling workspaces. The config at `apps/server/vercel.json` supplies:

| Setting | Value |
| --- | --- |
| Framework Preset | `Vite` |
| Install Command | `node ../../scripts/vercel-workspace.mjs install` |
| Build Command | `npm run build:vercel` |
| Output Directory | `vercel-dist` |
| Node.js Version | `22.x` or `24.x` |

The installer runs `npm ci --include=dev --workspaces --include-workspace-root` from the repository root. The build runs the root frontend pipeline and copies its complete output, including the offline service worker and icons, to `apps/server/vercel-dist`. No build tools are downloaded dynamically, and no backend source is published in that static directory.

Deploy the newest `main` commit without the previous build cache. Do not redeploy the old `5b5924c` commit: it does not contain this compatibility entry point.

### New Project With the Repository Root

Leave **Root Directory** blank and select **Vite**. The top-level `vercel.json` supplies `npm ci --include=dev --workspaces --include-workspace-root`, `npm run build:vercel`, and `apps/client/dist` as the install command, build command, and output directory. Both deployment roots build the same frontend. Do not mix the output directories between them.

The earlier `tsup` dependency ownership fix remains in place for the persistent Node backend. Do not work around deployment errors with a global install, `npx tsup`, or an unreviewed `npm audit fix --force`. Dependency audit findings need separate review; this workspace fix does not claim to resolve them.

Without `VITE_SERVER_URL`, the Vercel build is intentionally solo-only. Local settings, statistics, AI matches, and offline play still work. It does not pretend a static deployment can create shared rooms or save profiles to a server.

## Add Room-Code Multiplayer

The simplest supported setup for this repository is a Vercel frontend plus one persistent Node backend. No backend account or service is created automatically by adding the configuration files.

1. Deploy the frontend first and copy its stable production origin, such as `https://your-game.vercel.app`.
2. Open [Render's new Blueprint page](https://dashboard.render.com/select-repo?type=blueprint), connect `krishnacode120/UNO`, and select `main`. It reads the repository's `render.yaml`.
3. When prompted for `CLIENT_ORIGIN`, enter the exact Vercel origin from step 1, without a trailing slash. The template requests one free Node service, installs build dependencies, builds the shared package and server, starts with `npm start`, and checks `/api/health`.
4. Copy the backend's assigned HTTPS origin after it starts. Open `https://YOUR-BACKEND/api/health` and confirm it returns `{"ok":true,"service":"uno-server"}`. The backend-only build does not serve a homepage.
5. In Vercel **Settings > Environment Variables**, add `VITE_SERVER_URL=https://YOUR-BACKEND` for **Production**. Do not append `/api` or `/socket.io`. This is a public URL, not a secret.
6. Redeploy Vercel so the URL is embedded in the frontend bundle. Open two browsers or phones, create a table, join its code, and start a game. Reload the guest tab to check reconnection.

Both hosts must use HTTPS. The backend permits the exact `CLIENT_ORIGIN`, not every `*.vercel.app` domain. Leave preview builds solo-only unless you intentionally configure a separate backend for their origin. Never place a MongoDB connection string or other secret in a `VITE_` variable.

Render's free service may sleep when idle and restart. A cold start delays connection; a restart loses in-memory rooms. For reliable public matches, select an always-on service after reviewing the provider's pricing. Keep one server instance: this implementation does not have shared room storage or a distributed timer scheduler. An upgrade is not applied by this repository automatically.

Optionally set `MONGODB_URI` on the backend to retain profiles, statistics, settings, and match history across server restarts. This does not persist live rooms. Without MongoDB, browser-local saves remain available but backend saves are in memory.

### Other Node Hosts

Use the repository root with these settings on any persistent Node host:

```text
Build: npm ci --include=dev && npm run build:server
Start: npm start
Health: /api/health
NODE_ENV=production
CLIENT_ORIGIN=https://YOUR-VERCEL-SITE
```

Honor the host's `PORT` environment variable. Configure `TRUST_PROXY_HOPS` to match the actual trusted proxy path (the Render template sets 1). Support both Socket.IO polling and WebSocket upgrades. Do not scale to multiple instances with the current in-memory room manager.

## Why Not Put the Existing Server in a Vercel Function?

Vercel now has WebSocket support, including Socket.IO with WebSocket-only transport. However, new connections and reconnects can land on different function instances, and connections close at the function duration limit. This game's rooms, reconnect tokens, turn timers, and bot scheduler are process-local. Wrapping the existing server in a function would allow broken room joins and lost matches.

A Vercel-only multiplayer implementation would also need externally stored authoritative room state, atomic move/version updates, cross-instance broadcasts, and coordinated bot/timer ownership. The current deployment fix preserves the tested persistent-server architecture instead of claiming those changes are implemented.

References: [Vercel project configuration](https://vercel.com/docs/project-configuration/vercel-json), [Vercel WebSocket state and reconnection](https://vercel.com/docs/functions/websockets), [Render Blueprints](https://render.com/docs/blueprint-spec), [Render free service limitations](https://render.com/docs/free).

## Local Verification

```sh
npm ci --include=dev
npm run typecheck
npm run lint
npm test
npm run build:vercel
npm run build:server
node scripts/test-vercel.mjs
```

To reproduce the server-root deployment, run the following from `apps/server` (the install step replaces the repository's installed dependencies):

```sh
node ../../scripts/vercel-workspace.mjs install
npm run build:vercel
node --test ../../scripts/vercel-workspace.test.mjs
```

CI builds through this entry point on both Node 22 and Node 24, verifies that the published output matches the frontend byte-for-byte, and then checks the ordinary all-in-one build.

The deployment smoke test builds and serves a static frontend on a separate origin from the real Node backend. It checks solo-only hosting, offline reload, cross-origin profile saves, room-code joins, synchronized moves, and private-hand reconnects. It uses installed Google Chrome through Playwright and cleans up its own servers. It does not create a live Vercel or Render deployment.
