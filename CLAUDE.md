# autobourdain

Expo (React Native) app deployed to Cloudflare as a single Worker that serves
both the web build and the API, backed by D1.

## Git

- **`develop` is the working branch.** All development happens there unless
  specified otherwise.
- **`release` is what Cloudflare deploys.** It only ever moves by merging
  `develop` into it, on request - see Deploying. Never commit to it directly.
- **Do NOT make commits unless specifically asked.**
- Commit messages must be VERY brief.
- Extra detail goes in the commit description, as a bullet list of BRIEF points.

```
fix session refresh

- clear stale cookie on 401
- retry once
```

## Deploying

Cloudflare builds from the **`release`** branch. Pushing `develop` deploys
nothing.

- **Only deploy when specifically asked.** Never merge into `release` off your
  own initiative, and never as a follow-on to some other task.
- When asked, run every check first, in order, and stop at the first failure:
  1. Working tree is clean - nothing pending, nothing staged.
  2. `develop` is pushed - no commits ahead of `origin/develop`.
  3. `npm run typecheck` passes.
  4. `npm run lint` passes.
  5. `npm test` passes.
  6. `npm run build` passes.
  7. Migrations in `apps/api/migrations` are applied remotely
     (`npm run db:migrate:remote`). The code must never reach production ahead
     of its schema.
- On a failure, report it and stop. Do not fix it as part of the deploy - that
  is separate work, and it gets its own go-ahead.
- If everything checks out, ask outright - **"Are you sure you want to deploy?
  yes/no"** - and wait. Anything but yes means stop.
- On yes: merge `develop` into `release` and push. Then switch back to
  `develop`.

## Todo list

`README.md` carries the live backlog under `## Todo`, in three sections: Setup,
Next up, Later. Keep it true:

- **Delete** finished items. Do not leave them ticked off - git history is the
  record, and the list should only show what is still open.
- **Add** items that surface during the work.
- **Always say what you changed** in the list, in your reply. Never edit it
  silently.

## Cloudflare

Cloudflare is configured by hand in the dashboard. Give UI steps, not `wrangler`
commands, for creating the D1 database, secrets, the Git connection and custom
domains.

Two deliberate exceptions:

- **Migrations stay on the CLI**
  (`npx wrangler d1 migrations apply autobourdain --remote`). They are
  generated from `apps/api/src/db/schema.ts` and versioned with the code, so
  pasting SQL into the dashboard console would desync them.
- **Bindings and plain vars live in `wrangler.jsonc`**, never the dashboard.
  `wrangler deploy` overwrites dashboard-set variables and bindings on every
  deploy. Secrets are preserved, so secrets are the dashboard's job and
  everything else is the file's.

## Layout

| Path              | What                                                         |
| ----------------- | ------------------------------------------------------------ |
| `apps/mobile`     | Expo app (expo-router, NativeWind, TanStack Query)           |
| `apps/api`        | Worker: Hono routes, better-auth, Drizzle schema, migrations |
| `packages/shared` | Types shared by both sides                                   |
| `wrangler.jsonc`  | The single Worker: static assets + API + D1 binding          |
| `design`          | UI wireframes exported from Claude Design - guidance only    |

npm workspaces. Install from the repo root, never from inside a workspace.

### The design files

`design/` is **general guidance, not a specification.** The wireframes show the
intended direction - layout, hierarchy, tone, roughly what belongs on a screen.
They are not immutable goals and they are not kept in sync with the code.

- Treat a wireframe as the starting point for a screen, not as a pixel target.
- Deviate where the platform, the data we actually have, or a later decision
  calls for it. Say what you deviated from and why.
- Where a wireframe and the code disagree, the code wins. The wireframes are
  never re-exported to match it.

## Commands

```bash
npm run dev          # Expo dev server on :8081
npm run dev:api      # wrangler dev on :8787 (needed by the app)
npm run preview      # build the web export, then serve it from the Worker
npm run typecheck    # all workspaces
npm run lint         # eslint, all workspaces (--fix via npm run lint:fix)
npm test             # vitest (api) + jest (mobile), all workspaces
npm run format       # prettier --write (npm run format:check to verify only)
npm run db:generate  # drizzle-kit: schema change -> migration
npm run db:migrate   # apply migrations to local D1
```

## Conventions

- Routes live in `apps/mobile/src/app`; `@/*` maps to `apps/mobile/src/*`.
- Styling is NativeWind classNames, not StyleSheet. Keep Tailwind on v3 —
  NativeWind 4 does not support Tailwind 4.
- Colours come from the semantic tokens in `apps/mobile/src/theme/tokens.ts`,
  used as classNames (`bg-canvas`, `text-secondary`, `border-hairline`). No
  `neutral-*`, no hex in a screen, and no `dark:` for colour - the
  `ThemeProvider` swaps the whole palette. The few APIs that take a colour prop
  instead of a className (ActivityIndicator, navigation headers) read `palette`
  from `useTheme()`.
- Type is `font-display` (Newsreader) and `font-sans` (DM Sans), one Tailwind
  family per weight because native has no weight axis. Sizes come from
  `typeScale`, through the primitives in `apps/mobile/src/components/ui`.
- API tests live in `apps/api/test` and run inside the Workers runtime against a
  real local D1. Storage is isolated per test _file_, not per test, so anything
  writing a row uses a unique email - see `testUser()` in `test/helpers.ts`.
  Bindings come from `vitest.config.ts`, never `.dev.vars`.
- Schema changes: edit `apps/api/src/db/schema.ts`, then `npm run db:generate`.
  Never hand-edit files in `apps/api/migrations`.
- better-auth field names are looked up by the _property_ name in the Drizzle
  schema, not the SQL column name. Don't rename those properties.
- The auth instance is built per request (`createAuth(env, origin)`) because D1
  bindings only exist per request.
- After changing bindings or vars in `wrangler.jsonc`, run `npm run cf-typegen`.
- Tailwind is on `darkMode: 'class'` and `src/theme/theme-provider.tsx` pushes
  the resolved mode in via NativeWind's `colorScheme.set`. Do not switch back to `'media'`:
  react-native-css-interop's stylesheet observer calls `colorScheme.set()`
  unconditionally, and that setter throws on `'media'`, which Expo shows as an
  uncaught error overlay on every dev page load.
- `app/+html.tsx` does nothing here - Expo only uses it for `output: 'static'`,
  and this app is `output: 'single'`.
- Web-only for now, but keep code cross-platform: no `window`/`document` without
  a `Platform.OS === 'web'` guard.
- ESLint is pinned to **v9** on purpose. `eslint-plugin-import` and
  `eslint-plugin-react`, both pulled in by `eslint-config-expo`, still cap their
  peer range at 9 - installing ESLint 10 breaks the import resolver at runtime.
  Revisit when those plugins ship ESLint 10 support.
- Prettier owns formatting and `eslint-config-prettier` is loaded last, so
  ESLint never reports style. `printWidth` is 100 and `endOfLine` is `lf`, which
  `.gitattributes` (`* text=auto eol=lf`) guarantees - every checkout is LF
  whatever the developer's `core.autocrlf` happens to be.
