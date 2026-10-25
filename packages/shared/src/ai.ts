import { z } from 'zod';

/**
 * The model providers the API has an adapter for. Which models each one
 * offers is not listed here - the API asks the provider, with the user's key.
 */
export const AI_PROVIDERS = ['anthropic'] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];

export const AI_PROVIDER_LABELS: Record<AiProvider, string> = {
  anthropic: 'Anthropic',
};

/** One model a user's key can use, as the provider names it. */
export const aiModelSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
});

export type AiModel = z.infer<typeof aiModelSchema>;

/** What `GET /api/ai-key` says about the stored key. Never the key itself. */
export type AiKey = {
  provider: AiProvider;
  model: string;
  /** The key's last four characters, so the user can tell which one it is. */
  keyHint: string;
};

/** `null` when the user has not stored a key. */
export type AiKeyResponse = AiKey | null;

/**
 * The body of `PUT /api/ai-key`. The model is optional because the list of
 * models only exists once the key has been checked - without one, the first
 * model the provider lists is used.
 */
export const aiKeyPutSchema = z
  .object({
    provider: z.enum(AI_PROVIDERS),
    apiKey: z.string().trim().min(1).max(500),
    model: z.string().min(1).optional(),
  })
  .strict();

export type AiKeyPut = z.infer<typeof aiKeyPutSchema>;

/** The body of `PATCH /api/ai-key`: a model from the user's list. */
export const aiKeyPatchSchema = z.object({ model: z.string().min(1) }).strict();

export type AiKeyPatch = z.infer<typeof aiKeyPatchSchema>;

/** `POST /api/ai-key/test` succeeded. A failure is an error with an AI code. */
export type AiKeyTestResponse = {
  ok: true;
  /** The model that answered. */
  model: string;
};

export type AiModelsResponse = {
  models: AiModel[];
  /** When the provider was last asked, as an ISO timestamp. */
  fetchedAt: string;
};
