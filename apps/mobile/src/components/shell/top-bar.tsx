import { Pressable, Text, View } from 'react-native';

import { Caption } from '@/components/ui';
import { authClient, useSession } from '@/lib/auth-client';
import { typeScale } from '@/theme/tokens';

/**
 * The bar across the top, as `2e` draws it: no fill, one hairline underneath,
 * the wordmark at 24px Newsreader.
 *
 * The right-hand side is the one deliberate departure. `2e` puts the household
 * there ("just me"); there are no households yet, and signing out needs a home.
 */
export function TopBar() {
  const { data: session } = useSession();
  const user = session?.user;

  return (
    <View className="flex-row items-center gap-4 border-b border-hairline px-[26px] py-[18px]">
      <Text className={`${typeScale.wordmark} text-text`}>autobourdain</Text>
      {/* A quiet line rather than a Button: `2e` holds this whole side at one
          weight, and a bold control here outshouts the wordmark. */}
      <View className="ml-auto flex-row items-center gap-4">
        {user && <Caption tone="secondary">{user.name || user.email}</Caption>}
        <Pressable
          accessibilityRole="button"
          onPress={() => void authClient.signOut()}
          className="active:opacity-70"
        >
          <Caption tone="secondary" className="underline">
            Sign out
          </Caption>
        </Pressable>
      </View>
    </View>
  );
}
