import { z } from 'zod';

/**
 * The groups a user can be in, one each. Everyone starts as `normal`. `pro`
 * unlocks Workers AI - see `canUseAiProvider` - and `admin` has that too, and
 * sees the Admin section of settings.
 */
export const ROLES = ['normal', 'pro', 'admin'] as const;
export type Role = (typeof ROLES)[number];

export const DEFAULT_ROLE: Role = 'normal';

export const ROLE_LABELS: Record<Role, string> = {
  normal: 'Normal',
  pro: 'Pro',
  admin: 'Admin',
};

export const roleSchema = z.enum(ROLES);

/**
 * A stored role, or the default when it is missing or not one of ROLES - the
 * database checks nothing.
 */
export function parseRole(value: unknown): Role {
  const parsed = roleSchema.safeParse(value);
  return parsed.success ? parsed.data : DEFAULT_ROLE;
}

/** The body of `PATCH /api/admin/users/:id`. */
export const roleUpdateSchema = z.object({ role: roleSchema }).strict();

export type RoleUpdate = z.infer<typeof roleUpdateSchema>;

/**
 * Why a user's role cannot be changed from the Users page: it is the admin's
 * own, or `ADMIN_EMAILS` would put it back on their next sign-in.
 */
export type RoleLock = 'self' | 'admin_emails';

/** One row of the admin user list. */
export type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  /** ISO 8601. */
  createdAt: string;
  locked: RoleLock | null;
};

export type AdminUsersResponse = {
  users: AdminUser[];
};

/**
 * Whether an admin can delete a user from the Users page. Never another admin,
 * who has to be demoted first, and never a locked role, since a locked role
 * cannot be demoted.
 */
export function canDeleteUser(user: Pick<AdminUser, 'role' | 'locked'>): boolean {
  return user.locked === null && user.role !== 'admin';
}
