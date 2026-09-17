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
design            frames          wireframes + the 2e hi-fi pass, from Claude Design
```

Deployed at <https://autobourdain.blaczko.com>.

## Todo

Kept current as work lands - finished items are deleted rather than ticked off,
since git history is the record.

### Next up

Ordered. Each block is expected to land before the next one starts, and the
blocks after the Today page are deliberately coarse - they get broken down when
they come up.

**1. Settings scaffolding and Appearance**

- [ ] Settings shell - content and flow from `d5b`, treatment from `2e`:
      category rail (Preferences / Setup / App)
- [ ] `userPreferences` in `apps/api/src/db/schema.ts` + migration - theme and
      mode stored on the user
- [ ] `GET` / `PATCH /api/preferences`, with a TanStack Query hook that updates
      optimistically
- [ ] Appearance section: mode (Light / Dark / Match system) and a theme picker
      with a swatch per theme
- [ ] Apply the stored preference before first paint, so there is no flash of
      the wrong palette on load

**2. Today page - first pass**

A random suggestion with refinements, and nothing else: no previous
recommendations, no saved recipes, no kitchen stock.
Leave out, rather than fake, everything that needs data we do not have:
"everything at home", recently cooked, repeat counting, stock deduction

- [ ] Pick the model provider - Workers AI binding vs an Anthropic API key as a
      Cloudflare secret. Weigh cost, latency and how well each holds a response
      schema
- [ ] `POST /api/suggest`: ask text, meal type, time limit and portions in; a
      recipe out (title, time, portions, ingredients, method), validated against
      a schema in the Worker before it reaches the client
- [ ] Today screen - content and flow from `D1d`, treatment from `2e`, which
      drew this exact screen: ask field, meal-type chips, time and portion
      controls, Suggest
- [ ] Suggestion card plus the "what it takes" detail beside it
- [ ] Refinements, details to be decided
- [ ] Pending and failure states for a call that takes seconds and can fail

**3. Followup steps**

- [ ] Settings - recipe preferences
- [ ] Kitchen item tracking
- [ ] Recipes
- [ ] Week planning

### Later

- [ ] The dark palettes' `muted`, `control` and `rule` are derived, not
      designed - no dark screen was ever drawn. Confirm them against a dark
      hi-fi pass, or accept them
- [ ] No danger colour exists in the palettes - errors currently borrow the
      accent. Decide one before the first destructive action ships
- [ ] Recipe photos - every wireframe has a dish image and we have no store for
      one yet
- [ ] Receipt scanning into the kitchen list
- [ ] Drag a saved recipe onto a day on the week board
- [ ] Narrow-screen nav shape is undecided - sidebar vs bottom tabs. Decide
      before the app matters on a phone
- [ ] The shell's contents diverge from `2e` on purpose: the account and a
      sign-out where `2e` puts the household, no "kitchen covers" box in the
      rail, shorter labels, and Shopping list folded into Kitchen rather than
      being a sixth destination. The treatment follows `2e`; only what is in it
      differs. Revisit once there is data behind any of it
- [ ] `Shell` in `app/(shell)/_layout.tsx` opts out of React Compiler with
      `'use no memo'` - without it the memoised subtree swallows every
      navigation. Drop the directive when expo-router's headless tabs survive
      the compiler
- [ ] On Windows the dev server corrupts `.expo/types/router.d.ts` for any file
      created outside `src/app` while it runs - expo-router's watch handler
      tests a backslash path against `'../'`. Restart it before trusting
      `npm run typecheck`
- [ ] EAS build configuration for iOS/Android
- [ ] Set `EXPO_PUBLIC_API_URL` to the deployed origin for native builds - they
      have no `window.location` to fall back to

## Design

`design/` holds the UI frames, exported from the **Meal Planning App
Wireframes** project on <https://claude.ai/design>. Open
`design/Meal Planner Wireframes.dc.html` straight from disk to view them - it
loads its `support.js` runtime by relative path and needs no server.

Nothing imports it, nothing builds it, and it is excluded from ESLint and
Prettier. Edits belong on claude.ai/design, then a re-export.

There are two kinds of frame in there and they answer different questions:

- **`2e` is the hi-fi pass, and it is what the app looks like.** It is the only
  frame drawn at real fidelity, and every visual decision comes from it - fills,
  rules, spacing, type sizes and weights, and how the current thing is marked.
  Its palettes are spelled out in `2e-1`, `2e-2`, `2e-1b` and `2e-2b`, which is
  where `src/theme/palettes.ts` comes from. The vocabulary is editorial and
  quiet: chrome is unfilled canvas separated by hairlines, panels are kept for
  content, and state is marked with an accent rule rather than a filled pill.
- **`D1d`, `D2c`, `D3a`, `D4a-*` and `d5b` are wireframes, and they carry
  content and flow only.** They say what belongs on a screen and roughly in what
  order. Their boxes, fills, blocked-in nav and proportions are placeholder
  drawing rather than design - build a screen to look like one of them and it
  will look nothing like this app.

So a screen takes its content from the wireframe and its treatment from `2e`.
Where a wireframe covers something `2e` never drew, extend `2e`'s vocabulary
instead of falling back on the wireframe's look.

**Both are general guidance, not immutable goals**, and neither is kept in sync
with the code. Deviate where the platform, the data we actually have, or a later
decision calls for it. Where a frame and the code disagree, the code is what
ships.

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
`http://localhost:8787/api/auth/callback/github`. That is the **OAuth**
callback, and the Worker's port is right: GitHub returns to the API. The hop
after it — the API sending you back to the app — is a separate address, and has
to be absolute, or it lands on the Worker instead of the Expo dev server. The
app passes `APP_URL` for it (`apps/mobile/src/lib/config.ts`); in production the
two origins are the same and the distinction disappears. Testing it on a phone needs a
second callback on this machine's LAN address
(`http://192.168.x.x:8787/api/auth/callback/github`): the device reaches the
Worker there, so that is the origin better-auth hands GitHub.

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

Open <http://localhost:8081>. Nothing points the app at the API: in
development it puts the Worker on port 8787 of whichever host served the bundle
(`apps/mobile/src/lib/config.ts`), which is localhost in a browser and this
machine's LAN address on a phone. Set `EXPO_PUBLIC_API_URL` to override that -
to work against the deployed API, say. CORS and `trustedOrigins` are already
configured for the dev pair of ports.

To check what production will actually serve (single origin, real static
assets, no hot reload):

```bash
npm run preview   # builds the web export, then serves it from the Worker
```

## Linting and formatting

ESLint for rules, Prettier for formatting, with `eslint-config-prettier` last in
the chain so the two never disagree about style.

```bash
npm run lint          # eslint across all three workspaces
npm run lint:fix      # ...and fix what it can
npm run format        # prettier --write
npm run format:check  # verify only, changes nothing
```

`npm run lint` is one of the deploy checks, so keep it green. The setup is
type-aware on `.ts`/`.tsx`: `no-floating-promises`, `no-misused-promises` and
`await-thenable` use the TypeScript program, which is how an unawaited promise
in a Worker handler gets caught. Expo's React Native rules apply to
`apps/mobile` only.

Prettier sorts NativeWind classNames via `prettier-plugin-tailwindcss`, reading
`apps/mobile/tailwind.config.js`.

Line endings are LF everywhere. `.gitattributes` (`* text=auto eol=lf`) checks
out LF on every platform regardless of the developer's `core.autocrlf`, and
Prettier is on `endOfLine: lf` to match, so a stray CRLF is a formatting error
rather than something the tooling quietly accepts.

## Testing

```bash
npm test                       # both workspaces
npm test -w @autobourdain/api  # just the Worker
npm run test:watch -w @autobourdain/api
```

`npm test` is one of the deploy checks.

The API tests run **inside the Workers runtime**, through
`@cloudflare/vitest-pool-workers`: the real `wrangler.jsonc`, the real Hono app,
and a real local D1 with `apps/api/migrations` applied before every test file.
They live in `apps/api/test`, and they cover health, routing, CORS, the trusted
origin list, email sign-up and sign-in, the Turnstile gate and the conditional
GitHub provider.

Three things to know before adding more:

- **Storage is isolated per test file, not per test.** Everything in one file
  shares a database, so anything that writes a row takes a unique email from
  `testUser()` in `test/helpers.ts`.
- **Turnstile is verified over the real network**, against Cloudflare's
  always-passes test secret, with the always-fails one (`2x00...AA`) swapped in
  for the rejection path. So the auth tests need internet. Swapping them to
  `cloudflare:test`'s `fetchMock` is a small change if that ever grates.
- **Bindings come from `vitest.config.ts`, not `.dev.vars`.** A test run must
  not depend on local secrets, or change when someone edits theirs.

Tests that need a different configuration than the Worker booted with - a
failing captcha secret, GitHub credentials - call the Hono app directly with an
overridden env rather than going through the Worker. See `envWith()`.

`apps/mobile` runs on jest-expo, with React Native Testing Library installed
and one test written: `src/lib/config.test.ts`, over how the API URL is
resolved. The preset is the native one, so tests render the React Native tree
rather than DOM; note that RNTL 14's `render` is async and has to be awaited.
Anything importing `config.ts` needs it loaded per case, since it resolves the
URL once at import.

## Debugging (VS Code)

Select **Dev: full stack** and press F5. It starts both dev servers, attaches
the debugger to the Worker, and opens Chrome on the app. Breakpoints work on
both sides at once, and hot reload stays live: saving in `apps/mobile` fast
refreshes the browser, saving in `apps/api` reloads the Worker and the debugger
reattaches.

The servers run as background tasks and deliberately outlive the debug session,
so stopping and restarting debugging does not pay Metro's ~20s startup again.
Shut them down with the **dev: stop servers** task (Command Palette → Run Task).

**Native: Expo Go on a phone** is the same idea for a device: Metro plus a
Worker bound to `0.0.0.0`, since a phone's `localhost` is the phone. Scan the QR
code in the **dev: expo** terminal. There is no address to configure — the app
derives the API from the dev server it loaded the bundle from — but Windows
Defender asks to allow both servers on Private networks the first time. It runs
its own Worker task, so run **dev: stop servers** when switching between this
and **Dev: full stack** — they both want `:8787`. Breakpoints land in
`apps/api`; app-side breakpoints need the Expo Tools extension.

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
   above; its Site Key goes into `apps/mobile/.env.production` for the web
   bundle and `wrangler.jsonc` for the native WebView page, and is committed in
   both — it is public, and has to be in the bundle at build time.

The D1 binding comes from `wrangler.jsonc`, so no database wiring is needed in
the dashboard.

## Bot protection

Turnstile guards `/sign-up/email`, `/sign-in/email` and
`/request-password-reset`, via better-auth's `captcha` plugin. The browser sends
the token in an `x-captcha-response` header and the Worker verifies it with
Cloudflare before the request reaches the auth handler.

The plugin is registered unconditionally, so a missing `TURNSTILE_SECRET_KEY`
breaks those three endpoints loudly rather than quietly leaving them ungated.

Native has no DOM to render the widget into, so the app loads `/api/turnstile`
— the widget as a standalone page, served by the Worker — in a WebView, and
reads the token back over the WebView bridge. Serving it from the Worker is the
point: Cloudflare checks the widget against the hostnames registered for it, and
the page shares an origin with the web app, so one widget covers both. Its site
key is `TURNSTILE_SITE_KEY` in `wrangler.jsonc`, and `.dev.vars` swaps in the
test key locally — the real widget accepts neither `localhost` nor a LAN IP.

GitHub sign-in is not gated — the credential exchange happens on github.com,
behind GitHub's own abuse checks.

## On a phone

The app runs on a device through Expo Go today — Turnstile, email sign-in and
GitHub sign-in all work against the local Worker. Same two servers as the web,
except the Worker has to listen beyond loopback for the phone to reach it:

```bash
npm run dev:api -- --ip 0.0.0.0        # every interface, not just localhost
npm run start -w @autobourdain/mobile  # Metro, with the QR code
```

Scan the QR code with Expo Go on Android, or the Camera app on iOS. In VS Code
the **Native: Expo Go on a phone** launch config does both and attaches the
Worker debugger. The phone has to be on the same network, and Windows Defender
asks to allow the servers on Private networks the first time.

Nothing needs configuring for the address: the app puts the API on port 8787 of
the host it loaded the bundle from, which is this machine's LAN address on a
phone and localhost in a browser (`apps/mobile/src/lib/config.ts`).

Sessions live in SecureStore rather than a cookie, via better-auth's Expo
client, and the API takes the token from a header — that part is the same in
Expo Go as in a real build.

The one thing Expo Go does differently is deep links: it returns to
`exp://<host>:8081` rather than the `autobourdain` scheme, which it cannot use.
better-auth's Expo plugin trusts `exp://` in development only, so that is a
dev-time arrangement; a real build uses the scheme, which is already in
`trustedOrigins`. The second GitHub callback URL is a separate matter - it is
the Worker origin the phone talks to, and therefore the `redirect_uri` GitHub
is asked to come back to.

For store builds:

- Add EAS (`npx eas build:configure`).
- Set `EXPO_PUBLIC_API_URL` to `https://autobourdain.blaczko.com`. A release
  build has neither a dev server nor a `window.location` to derive from.
- Turnstile needs nothing extra. The widget page is served by the Worker, so a
  build pointed at production loads it from the production origin — the one the
  widget is registered for.

## API

| Route                | Purpose                                       |
| -------------------- | --------------------------------------------- |
| `GET /api/health`    | Liveness check                                |
| `/api/auth/*`        | better-auth: sign-up, sign-in, OAuth          |
| `GET /api/me`        | Current user, or `null`                       |
| `GET /api/turnstile` | Turnstile widget page, for the native WebView |

Anything not under `/api/` is served from the web build, with unknown paths
falling back to `index.html` so client-side routes work on reload.
