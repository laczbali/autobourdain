import { Pressable, Text, View } from 'react-native';

import { typeScale } from '@/theme/tokens';

import { Numeral } from './text';

type Props = {
  value: number;
  onChange: (value: number) => void;
  /** What is being counted, for screen readers: "portions". */
  label: string;
  min?: number;
  max?: number;
  className?: string;
};

/**
 * The `- 2 +` counter from `2e`'s portions row: bare signs either side of a
 * Newsreader numeral, no boxes. A sign that would cross a bound is dimmed and
 * does nothing.
 */
export function Stepper({ value, onChange, label, min = 1, max = 12, className = '' }: Props) {
  return (
    <View className={`flex-row items-center gap-1 ${className}`}>
      <Step
        sign="-"
        accessibilityLabel={`Fewer ${label}`}
        disabled={value <= min}
        onPress={() => onChange(value - 1)}
      />
      <Numeral accessibilityLabel={`${value} ${label}`} className="min-w-[24px] text-center">
        {value}
      </Numeral>
      <Step
        sign="+"
        accessibilityLabel={`More ${label}`}
        disabled={value >= max}
        onPress={() => onChange(value + 1)}
      />
    </View>
  );
}

function Step({
  sign,
  accessibilityLabel,
  disabled,
  onPress,
}: {
  sign: string;
  accessibilityLabel: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPress={onPress}
      className={`px-2 py-1 active:opacity-70 ${disabled ? 'opacity-40' : ''}`}
    >
      <Text className={`${typeScale.bodyLarge} text-secondary`}>{sign}</Text>
    </Pressable>
  );
}
