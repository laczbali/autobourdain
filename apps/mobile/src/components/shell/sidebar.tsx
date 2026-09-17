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
 */
export function Sidebar() {
  return (
    <View
      accessibilityRole="tablist"
      className="w-[186px] flex-none gap-1 border-r border-hairline px-4 py-5"
    >
      {DESTINATIONS.map((destination) => (
        <TabTrigger key={destination.name} name={destination.name} asChild>
          <NavItem label={destination.label} />
        </TabTrigger>
      ))}
    </View>
  );
}
