import {
  AI_PROVIDERS,
  aiModelSchema,
  type AiKey,
  type AiModel,
  type AiProvider,
} from '@autobourdain/shared';
import { eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { z } from 'zod';

import { userAiCredentials } from '../db/schema';
import { decryptApiKey, encryptApiKey } from './crypto';
import { AiError } from './errors';
import { ADAPTERS } from './registry';

/** How long a fetched model list is trusted before the provider is asked again. */
export const MODELS_TTL_MS = 24 * 60 * 60 * 1000;

const providerSchema = z.enum(AI_PROVIDERS);
const modelListSchema = z.array(aiModelSchema);

/** A user's stored key, checked. The key itself is still encrypted. */
type Credentials = {
  provider: AiProvider;
  model: string;
  keyHint: string;
  encryptedKey: string;
  /** Null when the stored list does not parse - treated as never fetched. */
  models: AiModel[] | null;
  modelsFetchedAt: Date;
};

type ModelList = { models: AiModel[]; fetchedAt: Date };

async function readCredentials(env: Env, userId: string): Promise<Credentials | null> {
  const [row] = await drizzle(env.DB)
    .select()
    .from(userAiCredentials)
    .where(eq(userAiCredentials.userId, userId));
  if (!row) return null;

  // A provider that has since been removed leaves the user with no key, and
  // they add one for a provider that exists.
  const provider = providerSchema.safeParse(row.provider);
  if (!provider.success) return null;

  const models = modelListSchema.safeParse(row.models);
  return {
    provider: provider.data,
    model: row.model,
    keyHint: row.keyHint,
    encryptedKey: row.encryptedKey,
    models: models.success ? models.data : null,
    modelsFetchedAt: row.modelsFetchedAt,
  };
}

function describe({ provider, model, keyHint }: Credentials): AiKey {
  return { provider, model, keyHint };
}

/** The model to use from a list: the one asked for if it is there, else the first. */
function pickModel(models: AiModel[], wanted: string | undefined): string {
  const chosen = models.find((model) => model.id === wanted) ?? models[0];
  if (!chosen) throw new AiError('no_models', 'The key has no models that can be used');
  return chosen.id;
}

export async function getAiKey(env: Env, userId: string): Promise<AiKey | null> {
  const credentials = await readCredentials(env, userId);
  return credentials && describe(credentials);
}

/** What `/api/suggest` needs to make the call. Null when no key is stored. */
export async function getAiKeyForUse(
  env: Env,
  userId: string,
): Promise<{ provider: AiProvider; model: string; apiKey: string } | null> {
  const credentials = await readCredentials(env, userId);
  if (!credentials) return null;
  return {
    provider: credentials.provider,
    model: credentials.model,
    apiKey: await decryptApiKey(env, userId, credentials.encryptedKey),
  };
}

/**
 * Checks a new key by listing its models, then stores it encrypted, with the
 * list and a model from it. Throws `key_invalid` and stores nothing when the
 * provider turns the key down.
 */
export async function saveAiKey(
  env: Env,
  userId: string,
  input: { provider: AiProvider; apiKey: string; model?: string },
): Promise<AiKey> {
  const models = await ADAPTERS[input.provider].listModels(input.apiKey);
  const model = pickModel(models, input.model);
  const values = {
    provider: input.provider,
    model,
    encryptedKey: await encryptApiKey(env, userId, input.apiKey),
    keyHint: input.apiKey.slice(-4),
    models,
    modelsFetchedAt: new Date(),
  };

  await drizzle(env.DB)
    .insert(userAiCredentials)
    .values({ userId, ...values })
    .onConflictDoUpdate({
      target: userAiCredentials.userId,
      // Spelled out: $onUpdate covers update(), not an upsert's update half.
      set: { ...values, updatedAt: sql`(unixepoch())` },
    });

  return { provider: input.provider, model, keyHint: values.keyHint };
}

export async function deleteAiKey(env: Env, userId: string): Promise<void> {
  await drizzle(env.DB).delete(userAiCredentials).where(eq(userAiCredentials.userId, userId));
}

/**
 * The models the user's key can use. The stored list is served while it is
 * younger than `MODELS_TTL_MS`, and otherwise - or on `refresh` - the provider
 * is asked again.
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
  const credentials = await readCredentials(env, userId);
  if (!credentials) return null;

  const { models: stored, modelsFetchedAt } = credentials;
  const fresh = Date.now() - modelsFetchedAt.getTime() < MODELS_TTL_MS;
  if (stored && fresh && !refresh) return { models: stored, fetchedAt: modelsFetchedAt };

  let models: AiModel[];
  try {
    const apiKey = await decryptApiKey(env, userId, credentials.encryptedKey);
    models = await ADAPTERS[credentials.provider].listModels(apiKey);
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
    .where(eq(userAiCredentials.userId, userId));

  return { models, fetchedAt };
}

/**
 * Switches the user's model. One the list does not have gets one refresh, in
 * case the provider has added it since.
 */
export async function setAiModel(
  env: Env,
  userId: string,
  model: string,
): Promise<{ status: 'ok'; key: AiKey } | { status: 'no_key' } | { status: 'unknown_model' }> {
  let list = await getModels(env, userId);
  if (list && !list.models.some(({ id }) => id === model)) {
    list = await getModels(env, userId, { refresh: true });
  }
  if (!list) return { status: 'no_key' };
  if (!list.models.some(({ id }) => id === model)) return { status: 'unknown_model' };

  await drizzle(env.DB)
    .update(userAiCredentials)
    .set({ model })
    .where(eq(userAiCredentials.userId, userId));

  const credentials = await readCredentials(env, userId);
  if (!credentials) return { status: 'no_key' };
  return { status: 'ok', key: describe(credentials) };
}
