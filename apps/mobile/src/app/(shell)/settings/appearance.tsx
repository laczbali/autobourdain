import { View } from 'react-native';

import { SectionHeader, SettingsPage, ThemeOption } from '@/components/settings';
import { Caption, Card, Chip, Eyebrow, Label } from '@/components/ui';
import { useUpdatePreferences } from '@/lib/preferences';
import { useTheme } from '@/theme/theme-provider';
import { MODE_LABELS, MODES, THEMES } from '@/theme/tokens';

/**
 * Mode and theme, from `d5b-2`. Both are read off the ThemeProvider rather than
 * the query, since that is what is on screen - and a change lands there first.
 */
export default function Appearance() {
  const { theme, mode, resolvedMode } = useTheme();
  const update = useUpdatePreferences();

  return (
    <SettingsPage>
      <SectionHeader
        title="Appearance"
        note="Theme sets the palette, mode sets light or dark."
        aside={<Caption>saved automatically</Caption>}
      />

      <Card className="gap-3">
        <Label>Mode</Label>
        <View accessibilityRole="radiogroup" className="flex-row flex-wrap gap-2">
          {MODES.map((option) => (
            <Chip
              key={option}
              label={MODE_LABELS[option]}
              selected={mode === option}
              onPress={() => update.mutate({ mode: option })}
            />
          ))}
        </View>
        <Caption>Match system follows the device.</Caption>
      </Card>

      <View className="gap-3">
        <Eyebrow>Theme</Eyebrow>
        <View accessibilityRole="radiogroup" className="flex-row flex-wrap gap-3">
          {THEMES.map((option) => (
            // Two to a row in the capped column, and never wider than that -
            // a third theme wraps rather than squeezing all three.
            <View key={option} className="min-w-[240px] max-w-[290px] flex-1">
              <ThemeOption
                theme={option}
                mode={resolvedMode}
                selected={theme === option}
                onPress={() => update.mutate({ theme: option })}
              />
            </View>
          ))}
        </View>
      </View>

      {update.isError && (
        // The accent, for want of a danger colour - see the README's Later list.
        <Caption tone="accent">That change did not save. Try again.</Caption>
      )}
    </SettingsPage>
  );
}
