import {
  canDeleteUser,
  ROLE_LABELS,
  ROLES,
  type AdminUser,
  type RoleLock,
} from '@autobourdain/shared';
import { Redirect } from 'expo-router';
import { Fragment, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { SectionHeader, SettingsPage } from '@/components/settings';
import { Button, Caption, Card, Label, Select } from '@/components/ui';
import { useAdminUsers, useDeleteUser, useRole, useSetRole } from '@/lib/admin';
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
 * A role saves the moment it is picked, as Appearance does. A delete asks
 * first, under its row, and only one row asks at a time.
 */
export default function Users() {
  const isAdmin = useRole() === 'admin';
  const { palette } = useTheme();
  const users = useAdminUsers();
  const setRole = useSetRole();
  const remove = useDeleteUser();
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

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
        <Caption tone="danger">The users did not load. Try again later.</Caption>
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
                onDelete={() => {
                  remove.reset();
                  setConfirmingId(user.id);
                }}
              />
              {confirmingId === user.id && (
                <View className="gap-3">
                  <Caption tone="secondary">
                    {`Delete ${user.email}? Their preferences and AI keys go with them. It cannot be undone.`}
                  </Caption>
                  <View className="flex-row gap-3">
                    <Button
                      title="Delete user"
                      variant="danger"
                      size="sm"
                      pending={remove.isPending}
                      onPress={() =>
                        remove.mutate(user.id, { onSuccess: () => setConfirmingId(null) })
                      }
                    />
                    <Button
                      title="Keep"
                      variant="ghost"
                      size="sm"
                      onPress={() => setConfirmingId(null)}
                    />
                  </View>
                </View>
              )}
            </Fragment>
          ))}
        </Card>
      )}

      {setRole.isError && <Caption tone="danger">That did not save. Try again.</Caption>}
      {remove.isError && <Caption tone="danger">That user was not deleted. Try again.</Caption>}
    </SettingsPage>
  );
}

type RowProps = {
  user: AdminUser;
  pendingRole: AdminUser['role'] | null;
  onChange: (role: AdminUser['role']) => void;
  onDelete: () => void;
};

/** Who they are on the left, their role and the way to delete them on the right. */
function UserRow({ user, pendingRole, onChange, onDelete }: RowProps) {
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

      {/* A fixed slot, so the role column lines up whether or not it is filled.
          Ghost, since it sits on every row; the confirm is what wears danger. */}
      <View className="w-16 items-end">
        {canDeleteUser(user) && (
          <Button
            title="Delete"
            variant="ghost"
            size="sm"
            accessibilityLabel={`Delete ${user.email}`}
            onPress={onDelete}
          />
        )}
      </View>
    </View>
  );
}
