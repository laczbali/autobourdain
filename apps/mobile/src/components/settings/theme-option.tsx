import { Pressable, View } from 'react-native';

import { Caption, Label } from '@/components/ui';
import { palettes } from '@/theme/palettes';
import { THEME_LABELS, THEME_NOTES, type ResolvedMode, type ThemeName } from '@/theme/tokens';

// The colours that say the most about a palette at a glance.
const SWATCHES = ['canvas', 'raised', 'accent', 'text'] as const;

type Props = {
  theme: ThemeName;
  /** The swatches are drawn in this mode, so they show what picking it gives. */
  mode: ResolvedMode;
  selected: boolean;
  onPress: () => void;
};

/**
 * One theme in the picker: its name, a row of its colours and the line under
 * it. The current one is ringed in the accent rather than filled, keeping to
 * `2e`. The ring is always there, in `hairline` when unselected, so choosing a
 * theme does not shift the layout.
 */
export function ThemeOption({ theme, mode, selected, onPress }: Props) {
  const palette = palettes[theme][mode];

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={THEME_LABELS[theme]}
      onPress={onPress}
      className={`gap-3 rounded-card border-[1.5px] bg-raised p-4 active:opacity-70 ${selected ? 'border-accent' : 'border-hairline'}`}
    >
      <View className="flex-row items-center justify-between">
        <Label>{THEME_LABELS[theme]}</Label>
        {selected && <Caption tone="accent">current</Caption>}
      </View>
      <View className="flex-row gap-2">
        {SWATCHES.map((token) => (
          // Hex rather than a className, the one exception to the rule: these
          // show another theme's colours, which the current palette's tokens
          // cannot.
          <View
            key={token}
            className="h-6 w-6 rounded-full border border-control"
            style={{ backgroundColor: palette[token] }}
          />
        ))}
      </View>
      <Caption>{THEME_NOTES[theme]}</Caption>
    </Pressable>
  );
}
