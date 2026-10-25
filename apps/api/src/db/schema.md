# Database schema

Everything the app stores lives in one Cloudflare D1 database, `autobourdain`
(SQLite). [`schema.ts`](schema.ts) is the source of truth. This page explains
it, and is updated in the same change as any edit to that file.

There are two kinds of table:

- **Auth tables** - `user`, `session`, `account`, `verification`. Owned by
  better-auth, which reads and writes them through its Drizzle adapter.
- **Application tables** - everything else, owned by this app's own routes.

## Diagram

```mermaid
erDiagram
    user ||--o{ session : "has"
    user ||--o{ account : "signs in with"
    user ||--o{ user_preferences : "sets"
    user ||--o{ user_ai_credentials : "sets up"

    user {
        text id PK
        text name
        text email UK
        integer email_verified "boolean"
        text image "nullable"
        text role "normal, pro, admin"
        integer created_at "unix seconds"
        integer updated_at "unix seconds"
    }

    session {
        text id PK
        text token UK
        text user_id FK
        integer expires_at "unix seconds"
        text ip_address "nullable"
        text user_agent "nullable"
        integer created_at "unix seconds"
        integer updated_at "unix seconds"
    }

    account {
        text id PK
        text user_id FK
        text account_id "id at the provider"
        text provider_id "credential, github"
        text access_token "nullable"
        text refresh_token "nullable"
        text id_token "nullable"
        integer access_token_expires_at "nullable"
        integer refresh_token_expires_at "nullable"
        text scope "nullable"
        text password "nullable, hashed"
        integer created_at "unix seconds"
        integer updated_at "unix seconds"
    }

    verification {
        text id PK
        text identifier "email or token subject"
        text value
        integer expires_at "unix seconds"
        integer created_at "unix seconds"
        integer updated_at "unix seconds"
    }

    user_preferences {
        text user_id PK, FK
        text key PK "theme, mode, recipePreferences"
        text value "JSON"
        integer created_at "unix seconds"
        integer updated_at "unix seconds"
    }

    user_ai_credentials {
        text user_id PK, FK
        text provider PK "anthropic, workers-ai"
        text model
        text encrypted_key "nullable, v1.iv.ciphertext"
        text key_hint "nullable, last 4 characters"
        text models "JSON"
        integer models_fetched_at "unix seconds"
        integer is_active "boolean, one per user"
        integer created_at "unix seconds"
        integer updated_at "unix seconds"
    }
```

The diagram uses SQL column names, which is what D1 holds. The tables below
also give the Drizzle property for each, which is the name code uses.

Every table hanging off `user` deletes with it (`ON DELETE CASCADE`).
`verification` stands alone on purpose: its rows are matched by `identifier`,
not by a foreign key.

Timestamps are `integer` Unix seconds, read as `Date` through Drizzle's
`timestamp` mode. Booleans are `integer` 0/1.

## Auth tables

Owned by better-auth, apart from `user.role`. Two rules hold for all four:

- **Never rename a property.** The Drizzle adapter looks fields up by the
  _property_ name, not the SQL column - rename one and better-auth stops
  finding it.
- **Regenerate rather than hand-edit** after a better-auth upgrade:
  `npx @better-auth/cli generate` prints the reference schema.

### `user`

One row per person.

| Column           | Property        | Type    | Null | Default     | Meaning                         |
| ---------------- | --------------- | ------- | ---- | ----------- | ------------------------------- |
| `id`             | `id`            | text    | no   |             | Primary key, set by better-auth |
| `name`           | `name`          | text    | no   |             | Display name                    |
| `email`          | `email`         | text    | no   |             | Unique                          |
| `email_verified` | `emailVerified` | integer | no   | `false`     | Boolean                         |
| `image`          | `image`         | text    | yes  |             | Avatar URL, from GitHub         |
| `created_at`     | `createdAt`     | integer | no   | `unixepoch` |                                 |
| `updated_at`     | `updatedAt`     | integer | no   | `unixepoch` |                                 |
| `role`           | `role`          | text    | no   | `normal`    | One of `ROLES` - see below      |

**`role` is ours, not better-auth's.** It is registered with better-auth as an
additional field with `input: false` ([`../auth.ts`](../auth.ts)), so it comes
back on the session user but no sign-up or update-user body can set it. Only
two things change it: `PATCH /api/admin/users/:id`
([`../admin.ts`](../admin.ts)), and the `ADMIN_EMAILS` secret, which makes a
listed address admin on sign-up or on its next sign-in. `ADMIN_EMAILS` only
ever grants admin - taking an address off the list demotes no one.

`ROLES` lives in
[`packages/shared/src/roles.ts`](../../../../packages/shared/src/roles.ts).
There is no CHECK constraint: a value that is not one of them reads as
`normal`.

### `session`

One row per signed-in device. The token is what the cookie, or the native
app's `Authorization` header, carries.

| Column       | Property    | Type    | Null | Default     | Meaning                       |
| ------------ | ----------- | ------- | ---- | ----------- | ----------------------------- |
| `id`         | `id`        | text    | no   |             | Primary key                   |
| `expires_at` | `expiresAt` | integer | no   |             |                               |
| `token`      | `token`     | text    | no   |             | Unique                        |
| `ip_address` | `ipAddress` | text    | yes  |             | From `cf-connecting-ip`       |
| `user_agent` | `userAgent` | text    | yes  |             |                               |
| `user_id`    | `userId`    | text    | no   |             | `user.id`, cascade on delete  |
| `created_at` | `createdAt` | integer | no   | `unixepoch` |                               |
| `updated_at` | `updatedAt` | integer | no   |             | Set by better-auth on refresh |

### `account`

One row per way a user signs in: `credential` for email and password,
`github` for GitHub.

| Column                     | Property                | Type    | Null | Default     | Meaning                       |
| -------------------------- | ----------------------- | ------- | ---- | ----------- | ----------------------------- |
| `id`                       | `id`                    | text    | no   |             | Primary key                   |
| `account_id`               | `accountId`             | text    | no   |             | The user's id at the provider |
| `provider_id`              | `providerId`            | text    | no   |             | `credential` or `github`      |
| `user_id`                  | `userId`                | text    | no   |             | `user.id`, cascade on delete  |
| `access_token`             | `accessToken`           | text    | yes  |             | OAuth only                    |
| `refresh_token`            | `refreshToken`          | text    | yes  |             | OAuth only                    |
| `id_token`                 | `idToken`               | text    | yes  |             | OAuth only                    |
| `access_token_expires_at`  | `accessTokenExpiresAt`  | integer | yes  |             | OAuth only                    |
| `refresh_token_expires_at` | `refreshTokenExpiresAt` | integer | yes  |             | OAuth only                    |
| `scope`                    | `scope`                 | text    | yes  |             | OAuth only                    |
| `password`                 | `password`              | text    | yes  |             | Hashed, `credential` only     |
| `created_at`               | `createdAt`             | integer | no   | `unixepoch` |                               |
| `updated_at`               | `updatedAt`             | integer | no   |             | Set by better-auth            |

### `verification`

Short-lived tokens: email verification and password reset.

| Column       | Property     | Type    | Null | Default     | Meaning                          |
| ------------ | ------------ | ------- | ---- | ----------- | -------------------------------- |
| `id`         | `id`         | text    | no   |             | Primary key                      |
| `identifier` | `identifier` | text    | no   |             | What the token is for, e.g. mail |
| `value`      | `value`      | text    | no   |             | The token                        |
| `expires_at` | `expiresAt`  | integer | no   |             |                                  |
| `created_at` | `createdAt`  | integer | no   | `unixepoch` |                                  |
| `updated_at` | `updatedAt`  | integer | no   | `unixepoch` |                                  |

## Application tables

### `user_preferences`

A user's preferences, one row per key. Read and written by
`GET` / `PATCH /api/preferences` ([`../preferences.ts`](../preferences.ts)).

| Column       | Property    | Type    | Null | Default     | Meaning                      |
| ------------ | ----------- | ------- | ---- | ----------- | ---------------------------- |
| `user_id`    | `userId`    | text    | no   |             | `user.id`, cascade on delete |
| `key`        | `key`       | text    | no   |             | The preference, e.g. `theme` |
| `value`      | `value`     | text    | no   |             | JSON-encoded value           |
| `created_at` | `createdAt` | integer | no   | `unixepoch` |                              |
| `updated_at` | `updatedAt` | integer | no   | `unixepoch` | Set on every upsert          |

Primary key: `(user_id, key)` - one value per key per user. `user_id` leads,
so the key doubles as the index for "all of this user's preferences".

**Key-value, on purpose.** A new preference is an entry in
`preferencesSchema` and `DEFAULT_PREFERENCES`
([`packages/shared/src/preferences.ts`](../../../../packages/shared/src/preferences.ts)),
with no migration. The cost is that SQLite knows nothing about the values -
they are opaque JSON, and cannot be filtered on in SQL.

**No row means the default.** A user only gets a row once they change a
setting, and `GET` folds whatever rows exist over the defaults. A default
changed later therefore reaches everyone who never picked.

**Zod is the only gate.** There is no CHECK constraint: `PATCH` validates
every key and value with `preferencesPatchSchema` before writing, and rejects
unknown keys and `null`. On read, a row whose key has been retired, or whose
value no longer fits - a removed theme, say - is skipped, and the default
stands in for it.

Current keys:

| Key                 | Value                              | Default      |
| ------------------- | ---------------------------------- | ------------ |
| `theme`             | `cocoa-plum` \| `warm-ink`         | `cocoa-plum` |
| `mode`              | `light` \| `dark` \| `system`      | `system`     |
| `recipePreferences` | Likes & dislikes, up to 2000 chars | `''`         |

`recipePreferences` is free text in the user's words, added to every
`/api/suggest` prompt after the app's own instructions.

### `user_ai_credentials`

The AI providers a user has set up, one row per provider, and which one is
active. Read and written by `/api/ai` and `/api/ai-key`, and used by
`/api/suggest` ([`../ai/credentials.ts`](../ai/credentials.ts)).

| Column              | Property          | Type    | Null | Default     | Meaning                                 |
| ------------------- | ----------------- | ------- | ---- | ----------- | --------------------------------------- |
| `user_id`           | `userId`          | text    | no   |             | `user.id`, cascade on delete            |
| `provider`          | `provider`        | text    | no   |             | One of `AI_PROVIDERS`, e.g. `anthropic` |
| `model`             | `model`           | text    | no   |             | The chosen model's id                   |
| `encrypted_key`     | `encryptedKey`    | text    | yes  |             | The key, encrypted - see below          |
| `key_hint`          | `keyHint`         | text    | yes  |             | The key's last 4 characters             |
| `models`            | `models`          | text    | no   |             | JSON `[{ id, label }]`, cached          |
| `models_fetched_at` | `modelsFetchedAt` | integer | no   |             | When `models` was fetched               |
| `is_active`         | `isActive`        | integer | no   | `false`     | Boolean - suggestions come from this    |
| `created_at`        | `createdAt`       | integer | no   | `unixepoch` |                                         |
| `updated_at`        | `updatedAt`       | integer | no   | `unixepoch` | Set on every change                     |

Primary key: `(user_id, provider)` - one row per provider per user. A partial
unique index, `user_ai_credentials_one_active` on `user_id` where `is_active`
is 1, lets the database refuse a second active row. Switching provider turns
the others off and the new one on in one batch, in that order.

**Two kinds of provider.** A keyed provider (`KEYED_AI_PROVIDERS` - Anthropic)
runs on the user's own account, and its row carries the key and its hint. One
without a key - Workers AI - runs on the app's Cloudflare account through the
Worker's `AI` binding, and both columns are null. Its row is created the first
time the user switches to it. A keyed row with no key reads as not set up.

**Active is a choice, not a consequence.** Storing a key makes its provider
active. Switching away keeps the key, so switching back needs no re-entry.
Deleting the active key leaves nothing active, even when another provider is
set up - the user picks again.

**Who may use what is checked at the API, not here.** Workers AI is for pro
and admin (`canUseAiProvider` in the shared package). A user demoted while on
it keeps the row, active, and their asks are refused until they switch.

**The key never leaves the Worker.** It is encrypted with AES-256-GCM under
the `AI_KEY_ENCRYPTION_KEY` secret, with the user's id bound in, so a
ciphertext copied to another row does not decrypt
([`../ai/crypto.ts`](../ai/crypto.ts)). Reads return the provider, model and
`key_hint` only. Losing the secret makes every stored key unreadable.

**The model list is a cache.** It is what the provider's adapter listed,
filtered to models that can return structured output, and each adapter says
how long it is served for (`modelsTtlMs`). Anthropic's is fetched with the
key and kept 24 hours; a provider that cannot be reached gets the stale list
served instead. Workers AI's is `WORKERS_AI_MODELS` in
[`../ai/workers-ai.ts`](../ai/workers-ai.ts), picked by hand, and is never
served from the column, so a model added there shows up straight away. When
the chosen model drops off a fresh list, the first listed model replaces it.

**Zod is the only gate**, as for preferences. A row whose provider has since
been removed is skipped, and a `models` value that does not parse counts as
never fetched.

## Changing the schema

Edit [`schema.ts`](schema.ts), update this page to match - the diagram
included - then:

```bash
npm run db:generate -w @autobourdain/api -- --name <what_changed>
npm run db:migrate         # apply locally
npm run db:migrate:remote  # apply to Cloudflare
```

Name every migration; without `--name`, drizzle-kit picks a random one. The
workspace form is deliberate - through the root `npm run db:generate`, npm
takes `--name` for itself and drizzle-kit never sees it.

Never hand-edit generated migrations - they are versioned with the code, and
`npm test` builds its database from the same files production does.

Remote migrations run before a deploy, never after: the code must not reach
production ahead of its schema.
