import { AI_PROVIDER_LABELS, type AiKeyResponse, type AiProvider } from '@autobourdain/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { deleteAiKey, getAiKey, getAiModels, patchAiKey, putAiKey, testAiKey } from './api';
import { errorCode } from './api-error';
import { useSession } from './auth-client';

/** Keyed by user, so one account's key never stands in for another's. */
function aiKeyKey(userId: string | undefined) {
  return ['ai-key', userId] as const;
}

function aiModelsKey(userId: string | undefined) {
  return ['ai-models', userId] as const;
}

/** The stored key's provider, model and hint, or null. Idle without a session. */
export function useAiKey() {
  const { data: session } = useSession();
  const userId = session?.user.id;

  return useQuery({
    queryKey: aiKeyKey(userId),
    queryFn: getAiKey,
    enabled: Boolean(userId),
  });
}

/** The models the key can use. Only asked for once a key is stored. */
export function useAiModels(hasKey: boolean) {
  const { data: session } = useSession();
  const userId = session?.user.id;

  return useQuery({
    queryKey: aiModelsKey(userId),
    queryFn: () => getAiModels(),
    enabled: Boolean(userId) && hasKey,
  });
}

/**
 * Every AI mutation, sharing one way of keeping the cache true: the key query
 * takes what the server answered, and the model list is fetched again
 * whenever the key behind it changed.
 */
function useAiCache() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const userId = session?.user.id;

  return {
    setKey: (key: AiKeyResponse) => queryClient.setQueryData(aiKeyKey(userId), key),
    // A refresh can move the user off a model that has gone, so the key is
    // read again too.
    refetchKey: () => queryClient.invalidateQueries({ queryKey: aiKeyKey(userId) }),
    resetModels: () => queryClient.resetQueries({ queryKey: aiModelsKey(userId) }),
    setModels: (models: Awaited<ReturnType<typeof getAiModels>>) =>
      queryClient.setQueryData(aiModelsKey(userId), models),
  };
}

export function useSaveAiKey() {
  const cache = useAiCache();
  return useMutation({
    mutationFn: putAiKey,
    onSuccess: async (key) => {
      cache.setKey(key);
      await cache.resetModels();
    },
  });
}

export function useUpdateAiModel() {
  const cache = useAiCache();
  return useMutation({
    mutationFn: patchAiKey,
    onSuccess: (key) => cache.setKey(key),
  });
}

export function useDeleteAiKey() {
  const cache = useAiCache();
  return useMutation({
    mutationFn: deleteAiKey,
    onSuccess: async () => {
      cache.setKey(null);
      await cache.resetModels();
    },
  });
}

/** Asks the provider for the list again, rather than serving the cached one. */
export function useRefreshAiModels() {
  const cache = useAiCache();
  return useMutation({
    mutationFn: () => getAiModels(true),
    onSuccess: async (models) => {
      cache.setModels(models);
      await cache.refetchKey();
    },
  });
}

/** A tiny real request with the stored key and model. Changes nothing stored. */
export function useTestAiKey() {
  return useMutation({ mutationFn: testAiKey });
}

/**
 * What to tell the user about a failed AI call, by its error code. Null for
 * anything without a code the screens know - they keep their own fallback.
 */
export function aiErrorMessage(
  error: unknown,
  provider: AiProvider = 'anthropic',
): { message: string; toSettings: boolean } | null {
  const name = AI_PROVIDER_LABELS[provider];

  switch (errorCode(error)) {
    case 'no_ai_key':
      return { message: 'Add an API key to get suggestions.', toSettings: true };
    case 'ai_key_invalid':
      return { message: `${name} did not accept the API key.`, toSettings: true };
    case 'ai_no_models':
      return { message: 'The API key has no models that can be used.', toSettings: true };
    case 'ai_model_unavailable':
      return { message: 'The chosen model is not available any more.', toSettings: true };
    case 'ai_rejected':
      // The provider's own reason - a spent credit balance, say.
      return { message: `${name}: ${(error as Error).message}`, toSettings: false };
    case 'ai_rate_limited':
      return { message: `${name} is limiting requests. Wait a moment.`, toSettings: false };
    case 'ai_unavailable':
      return { message: `Could not reach ${name}. Try again.`, toSettings: false };
    case 'ai_refused':
      return {
        message: 'The model declined that ask. Try putting it another way.',
        toSettings: false,
      };
    default:
      return null;
  }
}
