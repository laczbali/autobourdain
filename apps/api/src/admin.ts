import { parseRole, type AdminUser, type Role, type RoleLock } from '@autobourdain/shared';
import { asc, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';

import { isAdminEmail } from './auth';
import { user } from './db/schema';

/**
 * Why a role cannot be changed from the Users page. An admin's own role is
 * locked so the last admin can never be demoted, and a listed email's because
 * ADMIN_EMAILS would put it back on the next sign-in.
 */
function lockFor(env: Env, viewerId: string, row: { id: string; email: string }): RoleLock | null {
  if (row.id === viewerId) return 'self';
  if (isAdminEmail(env, row.email)) return 'admin_emails';
  return null;
}

/** Every user, oldest first, as `viewerId` sees them. */
export async function listUsers(env: Env, viewerId: string): Promise<AdminUser[]> {
  const rows = await drizzle(env.DB)
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
    })
    .from(user)
    .orderBy(asc(user.createdAt), asc(user.email));

  return rows.map((row) => ({
    ...row,
    role: parseRole(row.role),
    createdAt: row.createdAt.toISOString(),
    locked: lockFor(env, viewerId, row),
  }));
}

export type SetRoleResult =
  | { status: 'ok'; user: AdminUser }
  | { status: 'not_found' }
  | { status: 'locked'; lock: RoleLock };

export async function setRole(
  env: Env,
  viewerId: string,
  userId: string,
  role: Role,
): Promise<SetRoleResult> {
  const db = drizzle(env.DB);
  const [row] = await db
    .select({ id: user.id, email: user.email })
    .from(user)
    .where(eq(user.id, userId));
  if (!row) return { status: 'not_found' };

  const lock = lockFor(env, viewerId, row);
  if (lock) return { status: 'locked', lock };

  const [updated] = await db.update(user).set({ role }).where(eq(user.id, userId)).returning({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
  });
  return {
    status: 'ok',
    user: {
      ...updated,
      role: parseRole(updated.role),
      createdAt: updated.createdAt.toISOString(),
      locked: null,
    },
  };
}
