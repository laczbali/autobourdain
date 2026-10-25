import { RECIPE_PREFERENCES_MAX } from '@autobourdain/shared';
import { useState } from 'react';
import { View } from 'react-native';

import { SectionHeader, SettingsPage } from '@/components/settings';
import { Button, Caption, Card, Field } from '@/components/ui';
import { usePreferences, useUpdatePreferences } from '@/lib/preferences';

/**
 * What the user likes, dislikes or cannot eat, in their own words. It goes
 * into every suggest prompt, after the app's own instructions.
 *
 * Saved with a button rather than as it is typed, unlike Appearance: it is a
 * paragraph, and every keystroke is not a change worth sending.
 */
export default function LikesAndDislikes() {
  const { data } = usePreferences();
  const update = useUpdatePreferences();
  const saved = data?.recipePreferences ?? '';
  // Null until the user types, so the stored text shows once it loads.
  const [draft, setDraft] = useState<string | null>(null);

  const text = draft ?? saved;
  const changed = draft !== null && draft.trim() !== saved;

  const save = () =>
    update.mutate({ recipePreferences: text }, { onSuccess: () => setDraft(null) });

  return (
    <SettingsPage>
      <SectionHeader
        title="Likes & dislikes"
        note="What suggestions should keep in mind: food you love, avoid or cannot eat."
      />

      <Card className="gap-3">
        <Field
          accessibilityLabel="Likes & dislikes"
          value={text}
          onChangeText={setDraft}
          placeholder="No mushrooms. Love anything spicy. Vegetarian on weekdays."
          multiline
          maxLength={RECIPE_PREFERENCES_MAX}
          inputClassName="min-h-[160px]"
          // Android centres multiline text vertically otherwise.
          style={{ textAlignVertical: 'top' }}
          hint={`${text.length} / ${RECIPE_PREFERENCES_MAX}`}
        />
        <Caption tone="secondary">
          Added to every ask, after the app&apos;s own instructions.
        </Caption>
      </Card>

      <View className="flex-row items-center gap-3">
        <Button
          title="Save"
          size="sm"
          onPress={save}
          disabled={!changed}
          pending={update.isPending}
        />
        {update.isError ? (
          <Caption tone="danger">That did not save. Try again.</Caption>
        ) : (
          update.isSuccess && !changed && <Caption>Saved.</Caption>
        )}
      </View>
    </SettingsPage>
  );
}
