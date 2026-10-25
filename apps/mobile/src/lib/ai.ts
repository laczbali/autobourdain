import {
  AI_PROVIDER_LABELS,
  type AiConnection,
  type AiProvider,
  type AiSettings,
} from '@autobourdain/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  deleteAiKey,
  getAiModels,
  getAiSettings,
  patchAiModel,
  putAiActive,
  putAiKey,
  testAi,
} from './api';
import { errorCode } from './api-error';
import { useSession } from './auth-client';

/** Keyed by user, so one account's setup never stands in for another's. */
function aiSettingsKey(userId: string | undefined) {
  return ['ai', userId] as const;
}

/** And by provider, since each one offers its own list. */
function aiModelsKey(userId: string | undefined, provider?: AiProvider | null) {
  return provider === undefined
    ? (['ai-models', userId] as const)
    : (['ai-models', userId, provider] as const);
}

/** The provider suggestions come from, or null when none is. */
export function activeConnection(settings: AiSettings): AiConnection | null {
  return settings.connections.find(({ active }) => active) ?? null;
}

/** Every provider the user has set up, and which is active. Idle without a session. */
export function useAiSettings() {
  const { data: session } = useSession();
  const userId = session?.user.id;

  return useQuery({
    queryKey: aiSettingsKey(userId),
    queryFn: getAiSettings,
    enabled: Boolean(userId),
  });
}

/** The models the active provider offers. Only asked for once one is active. */
export function useAiModels(provider: AiProvider | null) {
  const { data: session } = useSession();
  const userId = session?.user.id;

  return useQuery({
    queryKey: aiModelsKey(userId, provider),
    queryFn: () => getAiModels(),
    enabled: Boolean(userId) && provider !== null,
  });
}

/**
 * Every AI mutation, sharing one way of keeping the cache true: the settings
 * query takes what the server answered, and the model lists are fetched again
 * whenever a key behind them changed.
 */
function useAiCache() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const userId = session?.user.id;

  return {
    setSettings: (settings: AiSettings) =>
      queryClient.setQueryData(aiSettingsKey(userId), settings),
    // A refresh can move the user off a model that has gone, and a delete
    // answers with nothing, so the settings are read again.
    refetchSettings: () => queryClient.invalidateQueries({ queryKey: aiSettingsKey(userId) }),
    resetModels: () => queryClient.resetQueries({ queryKey: aiModelsKey(userId) }),
    setModels: (provider: AiProvider, models: Awaited<ReturnType<typeof getAiModels>>) =>
      queryClient.setQueryData(aiModelsKey(userId, provider), models),
  };
}

/** Stores a key and makes its provider the active one. */
export function useSaveAiKey() {
  const cache = useAiCache();
  return useMutation({
    mutationFn: putAiKey,
    onSuccess: async (settings) => {
      cache.setSettings(settings);
      await cache.resetModels();
    },
  });
}

/** Switches the active provider. Workers AI is set up on the way. */
export function useActivateAi() {
  const cache = useAiCache();
  return useMutation({
    mutationFn: putAiActive,
    onSuccess: (settings) => cache.setSettings(settings),
  });
}

export function useUpdateAiModel() {
  const cache = useAiCache();
  return useMutation({
    mutationFn: patchAiModel,
    onSuccess: (settings) => cache.setSettings(settings),
  });
}

export function useDeleteAiKey() {
  const cache = useAiCache();
  return useMutation({
    mutationFn: deleteAiKey,
    onSuccess: async () => {
      await cache.refetchSettings();
      await cache.resetModels();
    },
  });
}

/** Asks the active provider for its list again, rather than serving the cached one. */
export function useRefreshAiModels(provider: AiProvider) {
  const cache = useAiCache();
  return useMutation({
    mutationFn: () => getAiModels(true),
    onSuccess: async (models) => {
      cache.setModels(provider, models);
      await cache.refetchSettings();
    },
  });
}

/** A tiny real request to the active provider and model. Changes nothing stored. */
export function useTestAi() {
  return useMutation({ mutationFn: testAi });
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
      return { message: 'Set up an AI provider to get suggestions.', toSettings: true };
    case 'ai_not_allowed':
      return {
        message: `${name} is for Pro and Admin users only. Choose another provider.`,
        toSettings: true,
      };
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
