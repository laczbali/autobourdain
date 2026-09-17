import { Pressable, Text, type PressableProps } from 'react-native';

import { typeScale } from '@/theme/tokens';

type Props = Omit<PressableProps, 'children'> & {
  label: string;
  selected?: boolean;
  className?: string;
};

/** The small selectable pill: meal types, refinements, time limits. */
export function Chip({ label, selected = false, className = '', ...rest }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      className={`rounded-card px-3 py-2 active:opacity-70 ${selected ? 'bg-accent' : 'border border-control'} ${className}`}
      {...rest}
    >
      <Text className={`${typeScale.caption} ${selected ? 'text-on-accent' : 'text-secondary'}`}>
        {label}
      </Text>
    </Pressable>
  );
}
