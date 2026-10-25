import { SUGGESTION_COUNT, type Suggestion } from '@autobourdain/shared';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Page } from '@/components/shell';
import {
  AiNotice,
  AskPanel,
  SuggestionCard,
  SuggestionCardsPending,
  useStacked,
  WhatItTakes,
  type MealType,
} from '@/components/today';
import { Body } from '@/components/ui';
import { activeConnection, aiErrorMessage, useAiSettings } from '@/lib/ai';
import { useSuggest } from '@/lib/suggest';

/**
 * Today: ask on the left, suggestions on the right, and the chosen one's
 * ingredients and method below them. Content from `D1d`, treatment from `2e`.
 *
 * Below `STACK_BELOW` it all goes into one column: ask, cards, recipe.
 *
 * Everything lives in screen state. The shell's tabs keep a visited screen
 * mounted, so it survives going elsewhere and coming back - just not a reload.
 */
export default function Today() {
  const [ask, setAsk] = useState('');
  const [mealType, setMealType] = useState<MealType | null>(null);
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [portions, setPortions] = useState(1);
  const suggest = useSuggest();
  const ai = useAiSettings();
  const active = ai.data ? activeConnection(ai.data) : undefined;
  const stacked = useStacked();

  const suggestions = suggest.data?.suggestions;
  const chosen = suggestions?.find((suggestion) => suggestion.id === chosenId);

  const submit = () => {
    if (!mealType) return;
    // A new set replaces the old one, so nothing stays chosen.
    setChosenId(null);
    suggest.mutate({ ask, mealType });
  };

  const choose = (suggestion: Suggestion) => {
    setChosenId(suggestion.id);
    setPortions(suggestion.portions);
  };

  const askPanel = (
    <AskPanel
      ask={ask}
      onAskChange={setAsk}
      mealType={mealType}
      onMealTypeChange={setMealType}
      onSuggest={submit}
      pending={suggest.isPending}
      // Only once the settings query says so, so it never flashes while loading.
      blocked={
        active === null ? (
          <AiNotice
            tone="secondary"
            message="Set up an AI provider to get suggestions."
            toSettings
          />
        ) : undefined
      }
      stacked={stacked}
    />
  );

  const results = suggest.isPending ? (
    <SuggestionCardsPending count={SUGGESTION_COUNT} stacked={stacked} />
  ) : suggest.isError ? (
    <AiNotice
      {...(aiErrorMessage(suggest.error, active?.provider) ?? {
        message: 'Those suggestions did not come through. Try again.',
        toSettings: false,
      })}
    />
  ) : suggestions ? (
    <>
      <View className={stacked ? 'gap-4' : 'flex-row gap-4'}>
        {suggestions.map((suggestion, index) => (
          <SuggestionCard
            key={suggestion.id}
            suggestion={suggestion}
            first={index === 0}
            chosen={suggestion.id === chosenId}
            onChoose={() => choose(suggestion)}
            stacked={stacked}
          />
        ))}
      </View>

      <View className="border-t border-hairline pt-[18px]">
        {chosen ? (
          <WhatItTakes
            suggestion={chosen}
            portions={portions}
            onPortionsChange={setPortions}
            stacked={stacked}
          />
        ) : (
          <Body tone="secondary">Choose one to see what it takes.</Body>
        )}
      </View>
    </>
  ) : (
    <Body tone="secondary" large>
      Pick a meal and ask - three suggestions come back here.
    </Body>
  );

  // Stacked, the ask runs edge to edge across the top and the whole page
  // scrolls as one. The results keep `Page`'s padding and spacing, and stop
  // at 640px like the ask's contents, so a wide window does not spread the
  // cards and ingredient rows across it.
  if (stacked) {
    return (
      <ScrollView className="flex-1 bg-canvas">
        {askPanel}
        <View className="px-6 py-5">
          <View className="w-full max-w-[640px] gap-[18px]">{results}</View>
        </View>
      </ScrollView>
    );
  }

  return (
    <View className="flex-1 flex-row">
      {askPanel}
      <Page contentClassName="w-full max-w-[960px]">{results}</Page>
    </View>
  );
}
