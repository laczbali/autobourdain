# autobourdain

Expo (React Native) app deployed to Cloudflare as a single Worker that serves
both the web build and the API, backed by D1.

## Git

- **`develop` is the working branch.** All development happens there unless
  specified otherwise.
- **Do NOT make commits unless specifically asked.**
- Commit messages must be VERY brief.
- Extra detail goes in the commit description, as a bullet list of BRIEF points.

```
fix session refresh

- clear stale cookie on 401
- retry once
```

## Working style

Do not make assumptions. When a decision could reasonably go more than one way -
scope, library, data shape, naming, where a thing lives - ask before building.
A short question costs less than the wrong implementation.

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
  (`npx wrangler d1 migrations apply autobourdain-db --remote`). They are
  generated from `apps/api/src/db/schema.ts` and versioned with the code, so
  pasting SQL into the dashboard console would desync them.
- **Bindings and plain vars live in `wrangler.jsonc`**, never the dashboard.
  `wrangler deploy` overwrites dashboard-set variables and bindings on every
  deploy. Secrets are preserved, so secrets are the dashboard's job and
  everything else is the file's.

## Layout

| Path               | What                                                        |
| ------------------ | ----------------------------------------------------------- |
| `apps/mobile`      | Expo app (expo-router, NativeWind, TanStack Query)           |
| `apps/api`         | Worker: Hono routes, better-auth, Drizzle schema, migrations |
| `packages/shared`  | Types shared by both sides                                   |
| `wrangler.jsonc`   | The single Worker: static assets + API + D1 binding          |

npm workspaces. Install from the repo root, never from inside a workspace.

## Commands

```bash
npm run dev          # Expo dev server on :8081
npm run dev:api      # wrangler dev on :8787 (needed by the app)
npm run preview      # build the web export, then serve it from the Worker
npm run typecheck    # all workspaces
npm run db:generate  # drizzle-kit: schema change -> migration
npm run db:migrate   # apply migrations to local D1
```

## Conventions

- Routes live in `apps/mobile/src/app`; `@/*` maps to `apps/mobile/src/*`.
- Styling is NativeWind classNames, not StyleSheet. Keep Tailwind on v3 —
  NativeWind 4 does not support Tailwind 4.
- Schema changes: edit `apps/api/src/db/schema.ts`, then `npm run db:generate`.
  Never hand-edit files in `apps/api/migrations`.
- better-auth field names are looked up by the *property* name in the Drizzle
  schema, not the SQL column name. Don't rename those properties.
- The auth instance is built per request (`createAuth(env, origin)`) because D1
  bindings only exist per request.
- After changing bindings or vars in `wrangler.jsonc`, run `npm run cf-typegen`.
- Tailwind is on `darkMode: 'class'` and `_layout.tsx` pushes the OS scheme in
  via NativeWind's `colorScheme.set`. Do not switch back to `'media'`:
  react-native-css-interop's stylesheet observer calls `colorScheme.set()`
  unconditionally, and that setter throws on `'media'`, which Expo shows as an
  uncaught error overlay on every dev page load.
- `app/+html.tsx` does nothing here - Expo only uses it for `output: 'static'`,
  and this app is `output: 'single'`.
- Web-only for now, but keep code cross-platform: no `window`/`document` without
  a `Platform.OS === 'web'` guard.
