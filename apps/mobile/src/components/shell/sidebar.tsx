import { TabTrigger } from 'expo-router/ui';
import { View } from 'react-native';

import { DESTINATIONS } from './destinations';
import { NavItem } from './nav-item';

/**
 * The left rail: 186px, a hairline down its right edge, and nothing else - no
 * fill and no panel, as in `2e`. What separates it from the page is the rule.
 *
 * The triggers carry no `href`: outside a `<TabList>` they resolve by name
 * through the trigger map the navigator puts in context, which is what lets the
 * rail sit anywhere in the shell's layout rather than directly under `<Tabs>`.
 *
 * A disabled destination skips the trigger altogether. On web the trigger hands
 * its row an `href`, and a disabled anchor still follows it when clicked.
 */
export function Sidebar() {
  return (
    <View
      accessibilityRole="tablist"
      className="w-[186px] flex-none gap-1 border-r border-hairline px-4 py-5"
    >
      {DESTINATIONS.map((destination) =>
        'disabled' in destination ? (
          <NavItem key={destination.name} label={destination.label} disabled />
        ) : (
          <TabTrigger key={destination.name} name={destination.name} asChild>
            <NavItem label={destination.label} />
          </TabTrigger>
        ),
      )}
    </View>
  );
}
