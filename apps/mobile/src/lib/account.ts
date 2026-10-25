import { useMutation, useQuery } from '@tanstack/react-query';

import { authClient, useSession } from './auth-client';

/**
 * Whether the signed-in user can sign in with a password. Someone who only
 * ever used GitHub has none, and better-auth asks them for a fresh session
 * instead.
 */
export function useHasPassword() {
  const { data: session } = useSession();
  const userId = session?.user.id;

  return useQuery({
    queryKey: ['has-password', userId],
    queryFn: async () => {
      const { data, error } = await authClient.listAccounts();
      if (error) throw new Error(error.message ?? 'The sign-in accounts did not load');
      return data.some((account) => account.providerId === 'credential');
    },
    enabled: Boolean(userId),
  });
}

/** A refused delete, with better-auth's code for why. */
export class DeleteAccountError extends Error {
  constructor(readonly code: string | undefined) {
    super(`Account not deleted: ${code ?? 'unknown'}`);
    this.name = 'DeleteAccountError';
  }
}

/**
 * Deletes the signed-in user's own account. better-auth signals the session
 * on the way out, and the shell's gate takes it from there.
 */
export function useDeleteAccount() {
  return useMutation({
    mutationFn: async (password: string | undefined) => {
      const { error } = await authClient.deleteUser(password ? { password } : {});
      if (error) throw new DeleteAccountError(error.code);
    },
  });
}

/** What to tell the user when their account was not deleted. */
export function deleteAccountMessage(error: unknown): string {
  const code = error instanceof DeleteAccountError ? error.code : undefined;
  if (code === 'INVALID_PASSWORD') return 'That password is not right.';
  if (code === 'SESSION_EXPIRED') {
    return 'You signed in over a day ago. Sign out and back in, then try again.';
  }
  return 'Your account was not deleted. Try again.';
}
