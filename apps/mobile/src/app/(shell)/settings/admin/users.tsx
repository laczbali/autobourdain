import { ROLE_LABELS, ROLES, type AdminUser, type RoleLock } from '@autobourdain/shared';
import { Redirect } from 'expo-router';
import { Fragment } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { SectionHeader, SettingsPage } from '@/components/settings';
import { Caption, Card, Label, Select } from '@/components/ui';
import { useAdminUsers, useRole, useSetRole } from '@/lib/admin';
import { useTheme } from '@/theme/theme-provider';

/** Why a locked row's role is plain text rather than a select. */
const LOCK_NOTES: Record<RoleLock, string> = {
  self: 'You',
  admin_emails: 'Set by ADMIN_EMAILS',
};

/**
 * Every user and their role, for admins. Not in any frame, so it takes
 * Account's shape: one card, a row per user, hairlines between them.
 *
 * A role saves the moment it is picked, as Appearance does.
 */
export default function Users() {
  const isAdmin = useRole() === 'admin';
  const { palette } = useTheme();
  const users = useAdminUsers();
  const setRole = useSetRole();

  // The rail hides this page from everyone else, and the API refuses them.
  if (!isAdmin) return <Redirect href="/settings" />;

  return (
    <SettingsPage>
      <SectionHeader title="Users" note="Everyone with an account, and their role." />

      {users.isPending ? (
        <View className="self-start">
          <ActivityIndicator color={palette.accent} />
        </View>
      ) : users.isError ? (
        <Caption tone="accent">The users did not load. Try again later.</Caption>
      ) : (
        <Card className="gap-3">
          {users.data.users.map((user, index) => (
            <Fragment key={user.id}>
              {index > 0 && <View className="h-px bg-rule" />}
              <UserRow
                user={user}
                // Shown as picked while it saves, rather than snapping back.
                pendingRole={
                  setRole.isPending && setRole.variables?.id === user.id
                    ? setRole.variables.role
                    : null
                }
                onChange={(role) => setRole.mutate({ id: user.id, role })}
              />
            </Fragment>
          ))}
        </Card>
      )}

      {setRole.isError && (
        // The accent, for want of a danger colour - see the README's Later list.
        <Caption tone="accent">That did not save. Try again.</Caption>
      )}
    </SettingsPage>
  );
}

type RowProps = {
  user: AdminUser;
  pendingRole: AdminUser['role'] | null;
  onChange: (role: AdminUser['role']) => void;
};

/** Who they are on the left, their role on the right. */
function UserRow({ user, pendingRole, onChange }: RowProps) {
  return (
    <View className="flex-row items-center gap-4">
      <View className="flex-1 gap-0.5">
        <Label>{user.name || '-'}</Label>
        <Caption tone="secondary">{user.email}</Caption>
        {/* The date part of the ISO timestamp - no locale to get wrong. */}
        <Caption>Joined {user.createdAt.slice(0, 10)}</Caption>
      </View>

      {user.locked ? (
        <View className="w-36 items-end gap-0.5">
          <Label>{ROLE_LABELS[user.role]}</Label>
          <Caption>{LOCK_NOTES[user.locked]}</Caption>
        </View>
      ) : (
        <Select
          options={ROLES}
          value={pendingRole ?? user.role}
          onChange={(role) => {
            if (role !== user.role) onChange(role);
          }}
          placeholder="Role"
          labelFor={(role) => ROLE_LABELS[role]}
          accessibilityLabel={`Role for ${user.email}`}
          className="w-36"
        />
      )}
    </View>
  );
}
