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
  4. `npm run build` passes.
  5. Migrations in `apps/api/migrations` are applied remotely
     (`npm run db:migrate:remote`). The code must never reach production ahead
     of its schema.
- On a failure, report it and stop. Do not fix it as part of the deploy - that
  is separate work, and it gets its own go-ahead.
- If everything checks out, ask outright - **"Are you sure you want to deploy?
  yes/no"** - and wait. Anything but yes means stop.
- On yes: merge `develop` into `release` and push. Then switch back to
  `develop`.

## Working style

Do not make assumptions. When a decision could reasonably go more than one way -
scope, library, data shape, naming, where a thing lives - ask before building.
A short question costs less than the wrong implementation.

**A question is a question.** When I ask one, answer it - do not touch files.
Reading code to answer properly is fine; editing is not. If the answer suggests
a change, say what you would change and stop there. Implement only when I
actually ask for it.

**A plan is a plan.** When I ask you to plan, plan - and stop. Answering your
questions is not a green light: the answers feed the plan, they do not start
the work. End with a short summary of what you would do and ask outright
whether to begin. Only an explicit yes starts the implementation.

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
