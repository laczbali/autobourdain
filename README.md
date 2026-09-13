# autobourdain

An Expo (React Native) app and its API, deployed to Cloudflare as **one Worker**:
the Worker serves the Expo web export as static assets and handles `/api/*`
itself, with D1 for storage. Web is the current target; the same codebase builds
for iOS/Android later.

```
apps/mobile       Expo app        expo-router, NativeWind, TanStack Query
apps/api          Worker API      Hono, better-auth, Drizzle -> D1
packages/shared   shared types
wrangler.jsonc    the Worker      static assets + API + D1 binding
```

## Todo

Kept current as work lands - finished items are deleted rather than ticked off,
since git history is the record.

### Setup

- [ ] Commit and push - the repo has no commits yet
- [ ] Connect the repo in the dashboard (build `npm run build`, deploy
      `npx wrangler deploy`)
- [ ] Add `BETTER_AUTH_SECRET` as a **Secret** in the dashboard - a fresh value,
      not the dev one. Sign-in fails without it
- [ ] Put the deployed origin into `wrangler.jsonc` as `BETTER_AUTH_URL`, then
      push. It must live in the file, not the dashboard - see Deploying below
- [ ] Optional: register a GitHub OAuth app and add `GITHUB_CLIENT_ID` /
      `GITHUB_CLIENT_SECRET` as Secrets

### Next up

- [ ] Decide what the app actually does - data model and first screens. Nothing
      domain-specific exists yet; the app is scaffolding plus auth
- [ ] Replace the placeholder icon, splash and favicon in
      `apps/mobile/assets/images` - they are still Expo's defaults
- [ ] Pick lint/format tooling. Nothing is configured; `npm run lint` will
      scaffold an ESLint config on first run if you want that route
- [ ] Add tests. There is no test setup at all yet

### Later

- [ ] EAS build configuration for iOS/Android
- [ ] Set `EXPO_PUBLIC_API_URL` to the deployed origin for native builds - they
      have no `window.location` to fall back to
- [ ] Custom domain

## Prerequisites

- Node 22+ (see `.nvmrc`)
- A Cloudflare account

## First-time setup

```bash
npm install
```

### 1. Create the D1 database

In the Cloudflare dashboard: **Storage & Databases → D1 → Create database**,
named `autobourdain-db`. Copy its Database ID into `wrangler.jsonc`, replacing
`REPLACE_ME` - it is not a secret and belongs in version control.

Migrations are the one Cloudflare-side thing that stays on the CLI, since they
are generated from the schema and versioned with the code. That needs a one-off
`npx wrangler login`.

### 2. Local secrets

```bash
cp .dev.vars.example .dev.vars
```

Put a random value in `BETTER_AUTH_SECRET` (`openssl rand -base64 32`).
`.dev.vars` is gitignored.

GitHub sign-in is optional locally — leave the GitHub values empty and the
provider is simply not registered. To enable it, create an OAuth app at
<https://github.com/settings/developers> with callback URL
`http://localhost:8787/api/auth/callback/github`.

### 3. Create the tables

```bash
npm run db:migrate
```

## Development

Two servers, in two terminals:

```bash
npm run dev:api   # Worker + local D1 on http://localhost:8787
npm run dev       # Expo dev server on http://localhost:8081
```

Open <http://localhost:8081>. The app reads `EXPO_PUBLIC_API_URL` from
`apps/mobile/.env.development` to find the API; CORS and `trustedOrigins` are
already configured for that pair of ports.

To check what production will actually serve (single origin, real static
assets, no hot reload):

```bash
npm run preview   # builds the web export, then serves it from the Worker
```

## Debugging (VS Code)

Select **Dev: full stack** and press F5. It starts both dev servers, attaches
the debugger to the Worker, and opens Chrome on the app. Breakpoints work on
both sides at once, and hot reload stays live: saving in `apps/mobile` fast
refreshes the browser, saving in `apps/api` reloads the Worker and the debugger
reattaches.

The servers run as background tasks and deliberately outlive the debug session,
so stopping and restarting debugging does not pay Metro's ~20s startup again.
Shut them down with the **dev: stop servers** task (Command Palette → Run Task).

Other configs: **Web: Chrome against Worker preview** builds the web export and
serves it from the Worker, which is what production actually looks like — one
origin, no fast refresh.

## Database changes

Edit `apps/api/src/db/schema.ts`, then:

```bash
npm run db:generate        # writes apps/api/migrations/NNNN_*.sql
npm run db:migrate         # apply locally
npm run db:migrate:remote  # apply to Cloudflare
```

Never hand-edit generated migrations. The four auth tables are owned by
better-auth — regenerate them with `npx @better-auth/cli generate` if you
upgrade it.

## Deploying (Cloudflare dashboard, connected to Git)

Deployments run from the repo, not from your machine.

1. **Workers & Pages → Create → Workers → Connect to Git**, pick
   `laczbali/autobourdain`.
2. Build settings:
   - Root directory: `/`
   - Build command: `npm run build`
   - Deploy command: `npx wrangler deploy`

   To apply migrations on every deploy, use instead:
   `npx wrangler d1 migrations apply autobourdain-db --remote && npx wrangler deploy`
3. After the first deploy, in **Settings → Variables and Secrets**, add
   **Secrets** (not variables):
   - `BETTER_AUTH_SECRET` — a fresh random value, not the dev one
   - `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`, if using GitHub sign-in
4. Set `BETTER_AUTH_URL` in `wrangler.jsonc` — the deployed origin, e.g.
   `https://autobourdain.<subdomain>.workers.dev` — and push.

   ⚠️ Not in the dashboard. `wrangler deploy` replaces plain-text variables with
   whatever `wrangler.jsonc` says, so a value set in the UI disappears on the
   next deploy. Secrets are preserved, which is why they go the other way.
5. Point the GitHub OAuth app's callback at
   `<BETTER_AUTH_URL>/api/auth/callback/github`.

The D1 binding comes from `wrangler.jsonc`, so no database wiring is needed in
the dashboard.

## Going to mobile later

Nothing here is web-only. When you want native builds:

- Set `EXPO_PUBLIC_API_URL` to the deployed origin — native has no
  `window.location` to fall back to.
- Sessions already use SecureStore on native via better-auth's Expo client.
- The app scheme is `autobourdain` and is already in `trustedOrigins` for
  OAuth redirects.
- Add EAS (`npx eas build:configure`) when you need store builds.

## API

| Route             | Purpose                                  |
| ----------------- | ---------------------------------------- |
| `GET /api/health` | Liveness check                           |
| `/api/auth/*`     | better-auth: sign-up, sign-in, OAuth     |
| `GET /api/me`     | Current user, or `null`                  |

Anything not under `/api/` is served from the web build, with unknown paths
falling back to `index.html` so client-side routes work on reload.
