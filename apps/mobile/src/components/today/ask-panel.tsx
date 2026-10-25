import { ScrollView, Text, TextInput, View } from 'react-native';

import { Button, Heading, Select } from '@/components/ui';
import { MEAL_TYPES } from '@/lib/suggest';
import { useTheme } from '@/theme/theme-provider';
import { typeScale } from '@/theme/tokens';

export type MealType = (typeof MEAL_TYPES)[number];

type Props = {
  ask: string;
  onAskChange: (ask: string) => void;
  mealType: MealType | null;
  onMealTypeChange: (mealType: MealType) => void;
  onSuggest: () => void;
  pending: boolean;
  /** Full width across the top of the page, rather than a column beside it. */
  stacked: boolean;
};

/**
 * The ask column from `2e`: a 300px `raised` panel beside the rail, holding the
 * question, the ask itself and the button. Asking again is how a set of
 * suggestions is refined, so there is no separate refine row. Stacked, the
 * same panel runs across the top, with a hairline under it instead of beside.
 *
 * A meal type is required, the ask text is not - an empty ask is "surprise me".
 */
export function AskPanel({
  ask,
  onAskChange,
  mealType,
  onMealTypeChange,
  onSuggest,
  pending,
  stacked,
}: Props) {
  const { palette } = useTheme();

  const content = (
    <>
      {/* `2e` says "tonight", which stops being true at breakfast. */}
      <Heading level={1}>
        What are we{'\n'}
        <Text className="font-display-italic">eating today?</Text>
      </Heading>

      <TextInput
        accessibilityLabel="Ask"
        value={ask}
        onChangeText={onAskChange}
        placeholder="Ingredients, cravings, anything to go on"
        // Not a className - RN styles the placeholder by prop.
        placeholderTextColor={palette.muted}
        multiline
        maxLength={500}
        className={`min-h-[72px] border-l-2 border-accent bg-inset px-[14px] py-[13px] text-text ${typeScale.body}`}
        // Android centres multiline text vertically otherwise.
        style={{ textAlignVertical: 'top' }}
      />

      <Select
        options={MEAL_TYPES}
        value={mealType}
        onChange={onMealTypeChange}
        placeholder="Pick a meal"
        label="Meal"
        hint={mealType ? undefined : 'Pick one to get suggestions.'}
      />

      {/* Full width in the 300px column, its own width stacked. */}
      <View className={stacked ? 'self-start pt-1' : 'pt-1'}>
        <Button title="Suggest a meal" onPress={onSuggest} pending={pending} disabled={!mealType} />
      </View>
    </>
  );

  // Stacked, the page scrolls as one, so the panel is a plain View in it. The
  // panel still runs edge to edge, but its contents stop at the Settings
  // column's width, or the field and button stretch across the whole window.
  // Padded like the results below, so the two columns line up.
  return stacked ? (
    <View className="border-b border-hairline bg-raised px-6 py-5">
      <View className="w-full max-w-[640px] gap-[13px]">{content}</View>
    </View>
  ) : (
    <ScrollView
      className="w-[300px] flex-none border-r border-hairline bg-raised"
      contentContainerClassName="gap-[13px] p-5"
    >
      {content}
    </ScrollView>
  );
}
