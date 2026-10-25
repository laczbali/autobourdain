import { Text, View } from 'react-native';

import { typeScale } from '@/theme/tokens';

/**
 * The bar across the top, as `2e` draws it: no fill, one hairline underneath,
 * the wordmark at 24px Newsreader.
 *
 * `2e` puts the household on the right ("just me"). There are no households
 * yet, so that side is empty - the account and Sign out live in Settings.
 */
export function TopBar() {
  return (
    <View className="flex-row items-center gap-4 border-b border-hairline px-[26px] py-[18px]">
      <Text className={`${typeScale.wordmark} text-text`}>autobourdain</Text>
    </View>
  );
}
