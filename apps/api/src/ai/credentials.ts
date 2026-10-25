import {
  AI_PROVIDERS,
  aiModelSchema,
  isKeyedAiProvider,
  type AiConnection,
  type AiModel,
  type AiProvider,
  type AiSettings,
  type KeyedAiProvider,
} from '@autobourdain/shared';
import { and, eq, ne, sql } from 'drizzle-orm';
import type { BatchItem } from 'drizzle-orm/batch';
import { drizzle } from 'drizzle-orm/d1';
import { z } from 'zod';

import { userAiCredentials } from '../db/schema';
import { decryptApiKey, encryptApiKey } from './crypto';
import { AiError } from './errors';
import { ADAPTERS } from './registry';
import type { AiAccess } from './types';

const providerSchema = z.enum(AI_PROVIDERS);
const modelListSchema = z.array(aiModelSchema);

/** One of a user's stored providers, checked. A key is still encrypted. */
type Credentials = {
  provider: AiProvider;
  model: string;
  /** Both set for a keyed provider, both null for one without a key. */
  keyHint: string | null;
  encryptedKey: string | null;
  /** Null when the stored list does not parse - treated as never fetched. */
  models: AiModel[] | null;
  modelsFetchedAt: Date;
  active: boolean;
};

type ModelList = { models: AiModel[]; fetchedAt: Date };

/** The active provider, ready to call. */
export type ActiveConnection = { provider: AiProvider; model: string; access: AiAccess };

/** Every provider the user has stored, in `AI_PROVIDERS` order. */
async function readCredentials(env: Env, userId: string): Promise<Credentials[]> {
  const rows = await drizzle(env.DB)
    .select()
    .from(userAiCredentials)
    .where(eq(userAiCredentials.userId, userId));

  const credentials: Credentials[] = [];
  for (const row of rows) {
    // A provider that has since been removed is skipped, as if never set up.
    const provider = providerSchema.safeParse(row.provider);
    if (!provider.success) continue;
    // So is a keyed provider whose key has gone missing.
    const keyed = isKeyedAiProvider(provider.data);
    if (keyed && (!row.encryptedKey || !row.keyHint)) continue;

    const models = modelListSchema.safeParse(row.models);
    credentials.push({
      provider: provider.data,
      model: row.model,
      keyHint: keyed ? row.keyHint : null,
      encryptedKey: keyed ? row.encryptedKey : null,
      models: models.success ? models.data : null,
      modelsFetchedAt: row.modelsFetchedAt,
      active: row.isActive,
    });
  }
  return credentials.sort(
    (a, b) => AI_PROVIDERS.indexOf(a.provider) - AI_PROVIDERS.indexOf(b.provider),
  );
}

async function readActive(env: Env, userId: string): Promise<Credentials | null> {
  return (await readCredentials(env, userId)).find(({ active }) => active) ?? null;
}

function describe({ provider, model, keyHint, active }: Credentials): AiConnection {
  return { provider, model, keyHint, active };
}

async function accessFor(env: Env, userId: string, credentials: Credentials): Promise<AiAccess> {
  return {
    apiKey: credentials.encryptedKey
      ? await decryptApiKey(env, userId, credentials.encryptedKey)
      : null,
    ai: env.AI,
  };
}

/** The model to use from a list: the one asked for if it is there, else the first. */
function pickModel(models: AiModel[], wanted: string | undefined): string {
  const chosen = models.find((model) => model.id === wanted) ?? models[0];
  if (!chosen) throw new AiError('no_models', 'The provider has no models that can be used');
  return chosen.id;
}

function whereProvider(userId: string, provider: AiProvider) {
  return and(eq(userAiCredentials.userId, userId), eq(userAiCredentials.provider, provider));
}

/**
 * Makes `provider` the user's only active one, with `write` - an upsert or
 * update of its row - run between switching the others off and the end of the
 * batch. Off first, because the database allows one active row per user.
 */
async function activate(
  env: Env,
  userId: string,
  provider: AiProvider,
  write: BatchItem<'sqlite'>,
): Promise<void> {
  const db = drizzle(env.DB);
  await db.batch([
    db
      .update(userAiCredentials)
      .set({ isActive: false })
      .where(and(eq(userAiCredentials.userId, userId), ne(userAiCredentials.provider, provider))),
    write,
  ]);
}

export async function getAiSettings(env: Env, userId: string): Promise<AiSettings> {
  return { connections: (await readCredentials(env, userId)).map(describe) };
}

/** What `/api/suggest` and the connection test call. Null when nothing is active. */
export async function getActiveConnection(
  env: Env,
  userId: string,
): Promise<ActiveConnection | null> {
  const credentials = await readActive(env, userId);
  if (!credentials) return null;
  return {
    provider: credentials.provider,
    model: credentials.model,
    access: await accessFor(env, userId, credentials),
  };
}

/** The active provider's name, without decrypting anything. */
export async function getActiveProvider(env: Env, userId: string): Promise<AiProvider | null> {
  return (await readActive(env, userId))?.provider ?? null;
}

/**
 * Checks a new key by listing its models, then stores it encrypted, with the
 * list and a model from it, and makes its provider the active one. Throws
 * `key_invalid` and stores nothing when the provider turns the key down.
 */
export async function saveAiKey(
  env: Env,
  userId: string,
  input: { provider: KeyedAiProvider; apiKey: string; model?: string },
): Promise<AiSettings> {
  const models = await ADAPTERS[input.provider].listModels({ apiKey: input.apiKey, ai: env.AI });
  const values = {
    model: pickModel(models, input.model),
    encryptedKey: await encryptApiKey(env, userId, input.apiKey),
    keyHint: input.apiKey.slice(-4),
    models,
    modelsFetchedAt: new Date(),
    isActive: true,
  };

  await activate(
    env,
    userId,
    input.provider,
    drizzle(env.DB)
      .insert(userAiCredentials)
      .values({ userId, provider: input.provider, ...values })
      .onConflictDoUpdate({
        target: [userAiCredentials.userId, userAiCredentials.provider],
        // Spelled out: $onUpdate covers update(), not an upsert's update half.
        set: { ...values, updatedAt: sql`(unixepoch())` },
      }),
  );

  return getAiSettings(env, userId);
}

/**
 * Makes a provider the active one. A keyed provider needs its key stored
 * first. One without a key is set up here on first use, with the first model
 * it offers.
 */
export async function activateProvider(
  env: Env,
  userId: string,
  provider: AiProvider,
): Promise<{ status: 'ok'; settings: AiSettings } | { status: 'no_key' }> {
  const stored = (await readCredentials(env, userId)).find((c) => c.provider === provider);
  const db = drizzle(env.DB);

  if (stored) {
    await activate(
      env,
      userId,
      provider,
      db.update(userAiCredentials).set({ isActive: true }).where(whereProvider(userId, provider)),
    );
  } else {
    if (isKeyedAiProvider(provider)) return { status: 'no_key' };
    const models = await ADAPTERS[provider].listModels({ apiKey: null, ai: env.AI });
    await activate(
      env,
      userId,
      provider,
      db
        .insert(userAiCredentials)
        .values({
          userId,
          provider,
          model: pickModel(models, undefined),
          models,
          modelsFetchedAt: new Date(),
          isActive: true,
        })
        // A row that failed the read - say its stored provider no longer
        // parsed - is taken over rather than tripping the primary key.
        .onConflictDoUpdate({
          target: [userAiCredentials.userId, userAiCredentials.provider],
          set: { isActive: true, updatedAt: sql`(unixepoch())` },
        }),
    );
  }

  return { status: 'ok', settings: await getAiSettings(env, userId) };
}

/** Removes a keyed provider. If it was the active one, nothing is active after. */
export async function deleteAiKey(
  env: Env,
  userId: string,
  provider: KeyedAiProvider,
): Promise<void> {
  await drizzle(env.DB).delete(userAiCredentials).where(whereProvider(userId, provider));
}

/**
 * The models the active provider offers. The stored list is served while it
 * is younger than the adapter's `modelsTtlMs`, and otherwise - or on
 * `refresh` - the provider is asked again.
 *
 * When the provider cannot be reached, a stale list beats none. A key it turns
 * down is passed on, so the user hears about it.
 *
 * If the chosen model has dropped off a fresh list, the first one replaces it.
 */
export async function getModels(
  env: Env,
  userId: string,
  { refresh = false } = {},
): Promise<ModelList | null> {
  const credentials = await readActive(env, userId);
  if (!credentials) return null;

  const { provider, models: stored, modelsFetchedAt } = credentials;
  const fresh = Date.now() - modelsFetchedAt.getTime() < ADAPTERS[provider].modelsTtlMs;
  if (stored && fresh && !refresh) return { models: stored, fetchedAt: modelsFetchedAt };

  let models: AiModel[];
  try {
    models = await ADAPTERS[provider].listModels(await accessFor(env, userId, credentials));
  } catch (error) {
    const transient =
      error instanceof AiError && (error.code === 'unavailable' || error.code === 'rate_limited');
    if (transient && stored) return { models: stored, fetchedAt: modelsFetchedAt };
    throw error;
  }

  const model = pickModel(models, credentials.model);
  const fetchedAt = new Date();
  await drizzle(env.DB)
    .update(userAiCredentials)
    .set({ models, modelsFetchedAt: fetchedAt, model })
    .where(whereProvider(userId, provider));

  return { models, fetchedAt };
}

/**
 * Switches the active provider's model. One the list does not have gets one
 * refresh, in case the provider has added it since.
 */
export async function setAiModel(
  env: Env,
  userId: string,
  model: string,
): Promise<
  { status: 'ok'; settings: AiSettings } | { status: 'no_key' } | { status: 'unknown_model' }
> {
  let list = await getModels(env, userId);
  if (list && !list.models.some(({ id }) => id === model)) {
    list = await getModels(env, userId, { refresh: true });
  }
  const provider = await getActiveProvider(env, userId);
  if (!list || !provider) return { status: 'no_key' };
  if (!list.models.some(({ id }) => id === model)) return { status: 'unknown_model' };

  await drizzle(env.DB)
    .update(userAiCredentials)
    .set({ model })
    .where(whereProvider(userId, provider));

  return { status: 'ok', settings: await getAiSettings(env, userId) };
}
