import { Link, usePathname } from 'expo-router';
import { View } from 'react-native';

import { NavItem } from '@/components/shell';
import { Eyebrow } from '@/components/ui';
import { useRole } from '@/lib/admin';

import { SETTINGS_GROUPS } from './sections';

/**
 * The second rail, inside Settings: the categories from `d5b`, in `2e`'s
 * vocabulary. It mirrors the shell's rail - no fill, a hairline down the right
 * edge, the current row marked by the accent rule - with each group under an
 * eyebrow, as `d5b` heads them.
 */
export function CategoryRail() {
  const pathname = usePathname();
  const isAdmin = useRole() === 'admin';
  const groups = SETTINGS_GROUPS.filter((group) => !('adminOnly' in group) || isAdmin);

  return (
    <View
      accessibilityRole="tablist"
      className="w-[186px] flex-none gap-5 border-r border-hairline px-4 py-5"
    >
      {groups.map((group) => (
        <View key={group.label} className="gap-1">
          <Eyebrow className="mb-1">{group.label}</Eyebrow>
          {/* Indented under their eyebrow, which is otherwise too close in
              size and tone to tell from a section. */}
          <View className="gap-1 pl-3">
            {group.sections.map((section) => (
              // `role` is spelled out because Link hands down `role="link"`,
              // which outranks NavItem's accessibilityRole - a link in a tablist.
              <Link key={section.href} href={section.href} asChild>
                <NavItem role="tab" label={section.label} isFocused={pathname === section.href} />
              </Link>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}
