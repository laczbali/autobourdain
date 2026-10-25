import { sql } from 'drizzle-orm';
import { integer, primaryKey, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

/**
 * better-auth core tables. The property names on each table must match
 * better-auth's field names exactly - the drizzle adapter looks fields up by
 * property, not by SQL column name. Regenerate the reference with:
 *   npx @better-auth/cli generate
 *
 * Application tables go below the auth block.
 */

export const user = sqliteTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
  image: text('image'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  // Ours, not better-auth's: registered with it as an additional field in
  // src/auth.ts. One of ROLES from the shared package, checked at the API.
  role: text('role').notNull().default('normal'),
});

export const session = sqliteTable('session', {
  id: text('id').primaryKey(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  token: text('token').notNull().unique(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
});

export const account = sqliteTable('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: integer('access_token_expires_at', { mode: 'timestamp' }),
  refreshTokenExpiresAt: integer('refresh_token_expires_at', { mode: 'timestamp' }),
  scope: text('scope'),
  password: text('password'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const verification = sqliteTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

// --- application tables -------------------------------------------------
// Add your own tables here, then `npm run db:generate` to emit a migration.
// Keep `schema.md` beside this file in step with every change.

/**
 * A user's preferences, one row per key. A key with no row means the default
 * from `DEFAULT_PREFERENCES` in the shared package.
 *
 * Keys and values are checked by `preferencesSchema` at the API, not here: the
 * value is opaque JSON to SQLite, which is what lets a new preference ship
 * without a migration.
 */
export const userPreferences = sqliteTable(
  'user_preferences',
  {
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    value: text('value', { mode: 'json' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`)
      .$onUpdate(() => new Date()),
  },
  (t) => [primaryKey({ columns: [t.userId, t.key] })],
);

/**
 * The AI providers a user has set up, one row per provider. At most one row
 * per user is active, and that is the one suggestions come from.
 *
 * A provider that takes the user's own key stores it encrypted - see
 * `src/ai/crypto.ts` - and it never leaves the Worker. One that runs on the
 * app's account, Workers AI, has no key. `models` caches what the provider
 * offers, so the settings page does not ask every time it opens. Provider,
 * model and the cached list are checked with zod on read, like preferences.
 */
export const userAiCredentials = sqliteTable(
  'user_ai_credentials',
  {
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(),
    model: text('model').notNull(),
    // Both null for a provider without a key, and both set for one with.
    encryptedKey: text('encrypted_key'),
    keyHint: text('key_hint'),
    models: text('models', { mode: 'json' }).notNull(),
    modelsFetchedAt: integer('models_fetched_at', { mode: 'timestamp' }).notNull(),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(false),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`)
      .$onUpdate(() => new Date()),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.provider] }),
    // The database refuses a second active row, whatever the code does.
    uniqueIndex('user_ai_credentials_one_active')
      .on(t.userId)
      .where(sql`${t.isActive} = 1`),
  ],
);
