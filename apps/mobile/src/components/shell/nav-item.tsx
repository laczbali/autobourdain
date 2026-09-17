import { Pressable, Text, type PressableProps } from 'react-native';

import { typeScale } from '@/theme/tokens';

type Props = Omit<PressableProps, 'children'> & {
  label: string;
  /**
   * Handed down by `<TabTrigger asChild>`, along with `onPress` and - on web -
   * an `href`, which turns the row into a real anchor. Optional because
   * nothing in the type system knows the trigger will supply it.
   */
  isFocused?: boolean;
};

/**
 * One row of the rail.
 *
 * The current one is marked the way `2e` marks it: a 1.5px accent rule under
 * the full width of the row, and the label stepped up from `secondary` to
 * `text` in the medium weight. No fill, no pill - the rail carries no boxes at
 * all. The rule is there when unfocused too, in `transparent`, so selecting a
 * row does not shift the ones below it.
 */
export function NavItem({ label, isFocused = false, ...rest }: Props) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: isFocused }}
      className={`border-b-[1.5px] py-[7px] active:opacity-70 ${isFocused ? 'border-accent' : 'border-transparent'}`}
      {...rest}
    >
      <Text
        className={
          isFocused ? `${typeScale.navCurrent} text-text` : `${typeScale.nav} text-secondary`
        }
      >
        {label}
      </Text>
    </Pressable>
  );
}
