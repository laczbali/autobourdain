import { parseRole, ROLE_LABELS } from '@autobourdain/shared';
import { View } from 'react-native';

import { SectionHeader, SettingsPage } from '@/components/settings';
import { Button, Caption, Card, Label } from '@/components/ui';
import { authClient, useSession } from '@/lib/auth-client';

/**
 * Who is signed in, and the way out. Moved here from the top bar, which `2e`
 * keeps for the household.
 */
export default function Account() {
  const { data: session } = useSession();
  const user = session?.user;

  return (
    <SettingsPage>
      <SectionHeader title="Account" note="Who is signed in on this device." />

      {user && (
        <Card className="gap-3">
          <Row label="Name" value={user.name} />
          <View className="h-px bg-rule" />
          <Row label="Email" value={user.email} />
          <View className="h-px bg-rule" />
          <Row label="Role" value={ROLE_LABELS[parseRole(user.role)]} />
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
    </SettingsPage>
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
