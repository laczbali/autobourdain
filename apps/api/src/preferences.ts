import {
  DEFAULT_PREFERENCES,
  preferencesSchema,
  type Preferences,
  type PreferencesPatch,
} from '@autobourdain/shared';
import { eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';

import { userPreferences } from './db/schema';

/**
 * A user's stored rows, folded over the defaults into one object.
 *
 * The database checks nothing, so a row is only trusted once it passes its
 * key's schema. One whose key has been retired, or whose value no longer fits
 * - a theme that was removed, say - is skipped, and the default stands in.
 */
export async function readPreferences(env: Env, userId: string): Promise<Preferences> {
  const rows = await drizzle(env.DB)
    .select({ key: userPreferences.key, value: userPreferences.value })
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId));

  const shape = preferencesSchema.shape;
  const stored: Record<string, unknown> = {};
  for (const { key, value } of rows) {
    if (!Object.hasOwn(shape, key)) continue;
    const parsed = shape[key as keyof typeof shape].safeParse(value);
    if (parsed.success) stored[key] = parsed.data;
  }

  return { ...DEFAULT_PREFERENCES, ...stored };
}

/**
 * Upserts every key in an already-validated patch. One D1 batch, so the keys
 * land together or not at all.
 */
export async function writePreferences(
  env: Env,
  userId: string,
  patch: PreferencesPatch,
): Promise<void> {
  const db = drizzle(env.DB);
  const statements = Object.entries(patch).map(([key, value]) =>
    db
      .insert(userPreferences)
      .values({ userId, key, value })
      .onConflictDoUpdate({
        target: [userPreferences.userId, userPreferences.key],
        // Spelled out: $onUpdate covers update(), not an upsert's update half.
        set: { value, updatedAt: sql`(unixepoch())` },
      }),
  );

  // D1 rejects an empty batch, and an empty patch has nothing to write.
  if (statements.length === 0) return;
  const [first, ...rest] = statements;
  await db.batch([first, ...rest]);
}
