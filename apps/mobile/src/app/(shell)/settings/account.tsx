import { parseRole, ROLE_LABELS } from '@autobourdain/shared';
import { useState } from 'react';
import { View } from 'react-native';

import { SectionHeader, SettingsPage } from '@/components/settings';
import { Button, Caption, Card, Field, Label } from '@/components/ui';
import { deleteAccountMessage, useDeleteAccount, useHasPassword } from '@/lib/account';
import { authClient, useSession } from '@/lib/auth-client';

/**
 * Who is signed in, and the way out. Moved here from the top bar, which `2e`
 * keeps for the household.
 */
export default function Account() {
  const { data: session } = useSession();
  const user = session?.user;
  const role = parseRole(user?.role);

  return (
    <SettingsPage>
      <SectionHeader title="Account" note="Who is signed in on this device." />

      {user && (
        <Card className="gap-3">
          <Row label="Name" value={user.name} />
          <View className="h-px bg-rule" />
          <Row label="Email" value={user.email} />
          <View className="h-px bg-rule" />
          <Row label="Role" value={ROLE_LABELS[role]} />
        </Card>
      )}

      {/* The session gate sends a signed-out visitor to sign-in, so nothing
          here has to navigate. */}
      <Button
        title="Sign out"
        variant="secondary"
        size="sm"
        className="self-start"
        onPress={() => void authClient.signOut()}
      />

      {/* An admin only gets the reason they cannot. The API refuses it too, so
          the last admin can never go. */}
      <SectionHeader
        title="Delete account"
        note={
          role === 'admin'
            ? 'An admin cannot delete their own account. Another admin has to change your role first.'
            : 'Your account and everything in it - preferences and AI keys. It cannot be undone.'
        }
      />
      {role !== 'admin' && <DeleteAccount />}
    </SettingsPage>
  );
}

/**
 * Asks before it deletes, as removing an AI key does. The password is only
 * asked of someone who has one - better-auth wants a fresh session from the
 * rest.
 */
function DeleteAccount() {
  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState('');
  const hasPassword = useHasPassword();
  const remove = useDeleteAccount();

  if (!confirming) {
    return (
      <Button
        title="Delete account"
        variant="danger"
        size="sm"
        className="self-start"
        onPress={() => setConfirming(true)}
      />
    );
  }

  const needsPassword = hasPassword.data === true;

  return (
    <Card className="gap-3">
      <Caption tone="secondary">Delete your account for good?</Caption>
      {needsPassword && (
        <Field
          label="Password"
          value={password}
          onChangeText={setPassword}
          placeholder="Your password"
          secureTextEntry
          autoComplete="current-password"
        />
      )}
      <View className="flex-row gap-3">
        <Button
          title="Delete for good"
          variant="danger"
          size="sm"
          pending={remove.isPending}
          // Held until the accounts load, so a password is never skipped.
          disabled={hasPassword.isPending || (needsPassword && !password)}
          onPress={() => remove.mutate(needsPassword ? password : undefined)}
        />
        <Button
          title="Keep it"
          variant="ghost"
          size="sm"
          onPress={() => {
            setConfirming(false);
            setPassword('');
            remove.reset();
          }}
        />
      </View>
      {remove.isError && <Caption tone="danger">{deleteAccountMessage(remove.error)}</Caption>}
    </Card>
  );
}

/** A label in a fixed column, its value right beside it. */
function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-baseline gap-4">
      <Caption tone="secondary" className="w-20">
        {label}
      </Caption>
      <Label className="flex-1">{value || '-'}</Label>
    </View>
  );
}
