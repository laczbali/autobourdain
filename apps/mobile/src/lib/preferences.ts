import { DEFAULT_PREFERENCES, type Preferences, type PreferencesPatch } from '@autobourdain/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useTheme } from '@/theme/theme-provider';

import { getPreferences, patchPreferences } from './api';
import { useSession } from './auth-client';

/** Keyed by user, so one account's preferences never stand in for another's. */
function preferencesKey(userId: string | undefined) {
  return ['preferences', userId] as const;
}

/** The signed-in user's stored preferences. Idle while there is no session. */
export function usePreferences() {
  const { data: session } = useSession();
  const userId = session?.user.id;

  return useQuery({
    queryKey: preferencesKey(userId),
    queryFn: getPreferences,
    enabled: Boolean(userId),
  });
}

/**
 * Changes preferences optimistically: the palette switches on the press, and
 * goes back if the server refuses.
 */
export function useUpdatePreferences() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const { theme, mode, setTheme, setMode } = useTheme();
  const key = preferencesKey(session?.user.id);

  const apply = (preferences: Partial<Preferences>) => {
    if (preferences.theme) setTheme(preferences.theme);
    if (preferences.mode) setMode(preferences.mode);
  };

  return useMutation({
    mutationFn: patchPreferences,
    onMutate: async (patch: PreferencesPatch) => {
      // A refetch landing mid-change would put the old value back.
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Preferences>(key);
      // The appearance on screen, over whatever else is stored - what to go
      // back to, even before the query has ever loaded.
      const applied: Preferences = { ...DEFAULT_PREFERENCES, ...previous, theme, mode };

      queryClient.setQueryData<Preferences>(key, (current) => ({
        ...(current ?? applied),
        ...patch,
      }));
      apply(patch);

      return { previous, applied };
    },
    onError: (_error, _patch, context) => {
      if (!context) return;
      queryClient.setQueryData(key, context.previous);
      apply(context.applied);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });
}
