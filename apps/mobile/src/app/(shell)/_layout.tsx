import { Redirect } from 'expo-router';
import { TabSlot, useTabsWithTriggers } from 'expo-router/ui';
import { View } from 'react-native';

import { DESTINATIONS, Sidebar, TopBar } from '@/components/shell';
import { useSession } from '@/lib/auth-client';

const TRIGGERS = DESTINATIONS.map((destination) => ({
  type: 'internal' as const,
  name: destination.name,
  href: destination.href,
}));

/**
 * The gate. Everything in this group is behind a session, so the navigator is
 * not even built for a visitor who has none.
 */
export default function ShellLayout() {
  const { data: session, isPending } = useSession();

  // A bare canvas rather than the sign-in screen while the session resolves: a
  // reload that turns out to be authenticated must not flash a sign-in form.
  if (isPending) return <View className="flex-1 bg-canvas" />;
  if (!session?.user) return <Redirect href="/sign-in" />;

  return <Shell />;
}

/**
 * The shell itself.
 *
 * Built from the hook rather than `<Tabs><TabList>...`, because that form only
 * discovers triggers that are direct children of a `<TabList>` directly under
 * `<Tabs>` - which would force the top bar to sit beside the rail instead of
 * spanning above it. The hook leaves the layout entirely ours; the rail's
 * triggers find the navigator through context.
 */
function Shell() {
  // Not optional. React Compiler is on (app.json `experiments.reactCompiler`),
  // and it memoises the tree below into a single cached element. Navigating
  // changes the navigator's state, which re-renders this component - but the
  // cached element is identical, so React bails out of the whole subtree and
  // the providers inside NavigationContent keep handing out the previous
  // state. The symptom is a URL that changes while the screen and the selected
  // row do not. jest does not reproduce it, so nothing here guards it but this
  // comment.
  'use no memo';

  const { NavigationContent } = useTabsWithTriggers({ triggers: TRIGGERS });

  return (
    <NavigationContent>
      <View className="flex-1 bg-canvas">
        <TopBar />
        <View className="flex-1 flex-row">
          <Sidebar />
          <TabSlot style={{ flex: 1 }} />
        </View>
      </View>
    </NavigationContent>
  );
}
