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
 *
 * Hovering any other row previews that mark at a lower pitch: the label steps
 * up to `text`, over a `hairline` rule rather than the accent.
 *
 * A disabled row does not press, and is drawn in `muted` at 40% - the
 * Stepper's disabled opacity - since `muted` alone sits too close to
 * `secondary` to read as off. On web it keeps the default cursor, which the
 * label inherits; otherwise the label shows the text cursor.
 */
export function NavItem({ label, isFocused = false, disabled: disabledProp, ...rest }: Props) {
  const disabled = Boolean(disabledProp);

  const row = isFocused
    ? 'border-accent'
    : disabled
      ? 'border-transparent opacity-40 web:cursor-default'
      : 'group border-transparent hover:border-hairline active:opacity-70';
  const text = isFocused
    ? `${typeScale.navCurrent} text-text`
    : disabled
      ? `${typeScale.nav} text-muted`
      : `${typeScale.nav} text-secondary group-hover:text-text`;

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: isFocused, disabled }}
      disabled={disabled}
      className={`border-b-[1.5px] py-[7px] ${row}`}
      {...rest}
    >
      <Text className={text}>{label}</Text>
    </Pressable>
  );
}
