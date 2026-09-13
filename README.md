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

Deployed at <https://autobourdain.blaczko.com>.

## Todo

Kept current as work lands - finished items are deleted rather than ticked off,
since git history is the record.

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
- [ ] Replace the native Turnstile stub in
      `apps/mobile/src/components/turnstile.tsx` with an Expo DOM component.
      Until then native email sign-in fails closed
- [ ] Set `EXPO_PUBLIC_API_URL` to the deployed origin for native builds - they
      have no `window.location` to fall back to

## Prerequisites

- Node 22+ (see `.nvmrc`)
- A Cloudflare account

## First-time setup

```bash
npm install
```

### 1. The D1 database

Already created - `autobourdain`, with its Database ID sitting in
`wrangler.jsonc`. The ID is not a secret and belongs in version control, so
there is nothing to do here. Building the account again from scratch means
**Storage & Databases → D1 → Create database** in the dashboard, named
`autobourdain`, then pasting the new ID over `database_id`.

Migrations are the one Cloudflare-side thing that stays on the CLI, since they
are generated from the schema and versioned with the code. That needs a one-off
`npx wrangler login`.

### 2. Local secrets

```bash
cp .dev.vars.example .dev.vars
```

Put a random value in `BETTER_AUTH_SECRET` (`openssl rand -base64 32`).
`.dev.vars` is gitignored.

Turnstile needs nothing set up locally. `.dev.vars.example` and
`apps/mobile/.env.development` carry Cloudflare's always-passes test keys, so
the widget renders and solves itself with no hostname to register. To exercise
the failure path, swap the site key for `2x00000000000000000000AB`, which always
blocks.

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

Deployments run from the repo, not from your machine, and only off the
**`release`** branch - pushing `develop` deploys nothing. `release` moves by
merging `develop` into it when a deploy is wanted.

1. **Workers & Pages → Create → Workers → Connect to Git**, pick
   `laczbali/autobourdain`.
2. Build settings:
   - Production branch: `release`
   - Root directory: `/`
   - Build command: `npm run build`
   - Deploy command: `npx wrangler deploy`

   To apply migrations on every deploy, use instead:
   `npx wrangler d1 migrations apply autobourdain --remote && npx wrangler deploy`
3. After the first deploy, in **Settings → Variables and Secrets**, add
   **Secrets** (not variables):
   - `BETTER_AUTH_SECRET` — a fresh random value, not the dev one
   - `TURNSTILE_SECRET_KEY` — from the Turnstile widget. Required: email
     sign-in and sign-up fail closed without it
   - `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`, if using GitHub sign-in
4. Set `BETTER_AUTH_URL` in `wrangler.jsonc` to `https://autobourdain.blaczko.com`
   — the deployed origin — and push.

   ⚠️ Not in the dashboard. `wrangler deploy` replaces plain-text variables with
   whatever `wrangler.jsonc` says, so a value set in the UI disappears on the
   next deploy. Secrets are preserved, which is why they go the other way.
5. Point the GitHub OAuth app's callback at
   `<BETTER_AUTH_URL>/api/auth/callback/github`.
6. In **Turnstile → Add widget**, create a **Managed** widget for
   `autobourdain.blaczko.com`. Its Secret Key is the `TURNSTILE_SECRET_KEY`
   above; its Site Key goes into `apps/mobile/.env.production` and is committed
   — it is public, and has to be in the bundle at build time.

The D1 binding comes from `wrangler.jsonc`, so no database wiring is needed in
the dashboard.

## Bot protection

Turnstile guards `/sign-up/email`, `/sign-in/email` and
`/request-password-reset`, via better-auth's `captcha` plugin. The browser sends
the token in an `x-captcha-response` header and the Worker verifies it with
Cloudflare before the request reaches the auth handler.

The plugin is registered unconditionally, so a missing `TURNSTILE_SECRET_KEY`
breaks those three endpoints loudly rather than quietly leaving them ungated.

GitHub sign-in is not gated — the credential exchange happens on github.com,
behind GitHub's own abuse checks.

## Going to mobile later

The Turnstile widget is the one web-only piece; everything else already builds
for native. When you want native builds:

- Replace the stub in `apps/mobile/src/components/turnstile.tsx`. Turnstile has
  no React Native binding, so this wants an Expo DOM component (`'use dom'`),
  which runs the web widget in a WebView. Until then it returns no token and
  native email sign-in fails closed against the gated API.
- Set `EXPO_PUBLIC_API_URL` to `https://autobourdain.blaczko.com` — native has
  no `window.location` to fall back to.
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
