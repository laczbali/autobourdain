import { Slot } from 'expo-router';
import { View } from 'react-native';

import { CategoryRail } from '@/components/settings';

/** Settings as `d5b` lays it out: the category rail, then the section. */
export default function SettingsLayout() {
  return (
    <View className="flex-1 flex-row">
      <CategoryRail />
      <View className="flex-1">
        <Slot />
      </View>
    </View>
  );
}
