import { z } from 'zod';

import type { Role } from './roles';

/**
 * The model providers the API has an adapter for. Which models a keyed
 * provider offers is not listed here - the API asks it, with the user's key.
 */
export const AI_PROVIDERS = ['anthropic', 'workers-ai'] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];

/**
 * The providers that run on the user's own account, through their key. The
 * rest run on the app's account and take no key.
 */
export const KEYED_AI_PROVIDERS = ['anthropic'] as const satisfies readonly AiProvider[];
export type KeyedAiProvider = (typeof KEYED_AI_PROVIDERS)[number];

export function isKeyedAiProvider(provider: AiProvider): provider is KeyedAiProvider {
  return (KEYED_AI_PROVIDERS as readonly AiProvider[]).includes(provider);
}

export const AI_PROVIDER_LABELS: Record<AiProvider, string> = {
  anthropic: 'Anthropic',
  'workers-ai': 'Workers AI',
};

/**
 * Whether a role may use a provider. Anyone may use their own key. Workers AI
 * is paid for by the app, so it is for pro and admin only.
 */
export function canUseAiProvider(provider: AiProvider, role: Role): boolean {
  return provider !== 'workers-ai' || role === 'pro' || role === 'admin';
}

/** One model a provider offers, as the provider names it. */
export const aiModelSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
});

export type AiModel = z.infer<typeof aiModelSchema>;

/** One provider the user has set up. Never the key itself. */
export type AiConnection = {
  provider: AiProvider;
  model: string;
  /** The key's last four characters. Null for a provider without a key. */
  keyHint: string | null;
  /** Whether suggestions come from this one. At most one is. */
  active: boolean;
};

/** What `GET /api/ai` returns, and what every change to it answers with. */
export type AiSettings = {
  connections: AiConnection[];
};

/**
 * The body of `PUT /api/ai-key`. The model is optional because the list of
 * models only exists once the key has been checked - without one, the first
 * model the provider lists is used.
 */
export const aiKeyPutSchema = z
  .object({
    provider: z.enum(KEYED_AI_PROVIDERS),
    apiKey: z.string().trim().min(1).max(500),
    model: z.string().min(1).optional(),
  })
  .strict();

export type AiKeyPut = z.infer<typeof aiKeyPutSchema>;

/** The body of `PUT /api/ai`: the provider suggestions come from from now on. */
export const aiActivateSchema = z.object({ provider: z.enum(AI_PROVIDERS) }).strict();

export type AiActivate = z.infer<typeof aiActivateSchema>;

/** The body of `PATCH /api/ai`: a model from the active provider's list. */
export const aiModelPatchSchema = z.object({ model: z.string().min(1) }).strict();

export type AiModelPatch = z.infer<typeof aiModelPatchSchema>;

/** `POST /api/ai/test` succeeded. A failure is an error with an AI code. */
export type AiTestResponse = {
  ok: true;
  /** The model that answered. */
  model: string;
};

export type AiModelsResponse = {
  models: AiModel[];
  /** When the provider was last asked, as an ISO timestamp. */
  fetchedAt: string;
};
