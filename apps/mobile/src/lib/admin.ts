import { parseRole, type AdminUsersResponse, type Role } from '@autobourdain/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getAdminUsers, patchUserRole } from './api';
import { useSession } from './auth-client';

/** The signed-in user's role, `normal` while there is no session. */
export function useRole(): Role {
  const { data: session } = useSession();
  return parseRole(session?.user.role);
}

/** Keyed by the admin looking, since the locks are worked out for them. */
function adminUsersKey(userId: string | undefined) {
  return ['admin-users', userId] as const;
}

/** Every user and their role. Idle unless the signed-in user is an admin. */
export function useAdminUsers() {
  const { data: session } = useSession();
  const userId = session?.user.id;
  const isAdmin = useRole() === 'admin';

  return useQuery({
    queryKey: adminUsersKey(userId),
    queryFn: getAdminUsers,
    enabled: Boolean(userId) && isAdmin,
  });
}

/** Changes one user's role, and puts the answer straight into the list. */
export function useSetRole() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const key = adminUsersKey(session?.user.id);

  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: Role }) => patchUserRole(id, { role }),
    onSuccess: (updated) =>
      queryClient.setQueryData<AdminUsersResponse>(key, (current) =>
        current
          ? {
              users: current.users.map((user) => (user.id === updated.id ? updated : user)),
            }
          : current,
      ),
  });
}
