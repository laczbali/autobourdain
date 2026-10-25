import {
  AI_PROVIDER_LABELS,
  AI_PROVIDERS,
  type AiKey,
  type AiProvider,
} from '@autobourdain/shared';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { SectionHeader, SettingsPage } from '@/components/settings';
import { Button, Caption, Card, Chip, Field, Label, Select } from '@/components/ui';
import {
  aiErrorMessage,
  useAiKey,
  useAiModels,
  useDeleteAiKey,
  useRefreshAiModels,
  useSaveAiKey,
  useTestAiKey,
  useUpdateAiModel,
} from '@/lib/ai';
import { useTheme } from '@/theme/theme-provider';

/**
 * The user's own AI provider: which one, the key, and the model. Not in `d5b`,
 * so it takes Appearance's shape - a header, then a card per decision.
 *
 * The key goes in and never comes back out. Once stored, all that shows is
 * its last four characters.
 */
export default function AiSettings() {
  const { palette } = useTheme();
  const key = useAiKey();
  const stored = key.data ?? null;
  const [chosen, setChosen] = useState<AiProvider | null>(null);
  const provider = chosen ?? stored?.provider ?? AI_PROVIDERS[0];

  return (
    <SettingsPage>
      <SectionHeader
        title="AI"
        note="Suggestions come from your own provider account, through your key."
      />

      {key.isPending ? (
        <View className="self-start">
          <ActivityIndicator color={palette.accent} />
        </View>
      ) : key.isError ? (
        <Caption tone="accent">The AI settings did not load. Try again later.</Caption>
      ) : (
        <>
          <Card className="gap-3">
            <Label>Provider</Label>
            <View accessibilityRole="radiogroup" className="flex-row flex-wrap gap-2">
              {AI_PROVIDERS.map((option) => (
                <Chip
                  key={option}
                  label={AI_PROVIDER_LABELS[option]}
                  selected={provider === option}
                  onPress={() => setChosen(option)}
                />
              ))}
            </View>
          </Card>

          <KeyCard
            // A new provider needs a new key, so the form starts over.
            key={provider}
            provider={provider}
            stored={stored?.provider === provider ? stored : null}
          />

          {stored && stored.provider === provider && (
            <>
              <ModelCard stored={stored} />
              <ConnectionCard
                // A result only speaks for the key and model it was run with.
                key={`${stored.keyHint}:${stored.model}`}
                stored={stored}
              />
            </>
          )}
        </>
      )}
    </SettingsPage>
  );
}

function KeyCard({ provider, stored }: { provider: AiProvider; stored: AiKey | null }) {
  const save = useSaveAiKey();
  const remove = useDeleteAiKey();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [confirming, setConfirming] = useState(false);
  const name = AI_PROVIDER_LABELS[provider];

  const submit = () =>
    save.mutate(
      { provider, apiKey: draft.trim() },
      {
        onSuccess: () => {
          setDraft('');
          setEditing(false);
        },
      },
    );

  if (!stored || editing) {
    const error = save.isError
      ? (aiErrorMessage(save.error, provider)?.message ?? 'That key did not save. Try again.')
      : undefined;

    return (
      <Card className="gap-3">
        <Field
          label="API key"
          value={draft}
          onChangeText={setDraft}
          placeholder={`Your ${name} API key`}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          error={error}
          hint="Stored encrypted. It cannot be shown again."
        />
        <View className="flex-row gap-3">
          <Button
            title="Save key"
            size="sm"
            onPress={submit}
            disabled={!draft.trim()}
            pending={save.isPending}
          />
          {stored && (
            <Button
              title="Cancel"
              variant="ghost"
              size="sm"
              onPress={() => {
                setEditing(false);
                setDraft('');
                save.reset();
              }}
            />
          )}
        </View>
      </Card>
    );
  }

  return (
    <Card className="gap-3">
      <View className="flex-row items-baseline gap-4">
        <Caption tone="secondary" className="w-20">
          Key
        </Caption>
        <Label className="flex-1">{`....${stored.keyHint}`}</Label>
      </View>

      {confirming ? (
        <View className="gap-3">
          <Caption tone="secondary">
            Remove the key? Suggestions stop until you add one again.
          </Caption>
          <View className="flex-row gap-3">
            <Button
              title="Remove key"
              variant="secondary"
              size="sm"
              pending={remove.isPending}
              onPress={() => remove.mutate()}
            />
            <Button
              title="Keep it"
              variant="ghost"
              size="sm"
              onPress={() => setConfirming(false)}
            />
          </View>
        </View>
      ) : (
        <View className="flex-row gap-3">
          <Button title="Replace" variant="secondary" size="sm" onPress={() => setEditing(true)} />
          <Button
            title="Remove"
            variant="secondary"
            size="sm"
            onPress={() => setConfirming(true)}
          />
        </View>
      )}

      {remove.isError && (
        // The accent, for want of a danger colour - see the README's Later list.
        <Caption tone="accent">The key was not removed. Try again.</Caption>
      )}
    </Card>
  );
}

function ModelCard({ stored }: { stored: AiKey }) {
  const { palette } = useTheme();
  const models = useAiModels(true);
  const refresh = useRefreshAiModels();
  const update = useUpdateAiModel();
  const name = AI_PROVIDER_LABELS[stored.provider];

  const list = models.data?.models ?? [];
  const labels = new Map(list.map(({ id, label }) => [id, label]));
  // The pick shows straight away; the stored model catches up when it saves.
  const current = update.isPending ? update.variables.model : stored.model;
  const failure = refresh.error ?? models.error;

  return (
    <Card className="gap-3">
      {models.isPending ? (
        <View className="self-start">
          <ActivityIndicator color={palette.accent} />
        </View>
      ) : (
        <Select
          label="Model"
          options={list.map(({ id }) => id)}
          value={current}
          labelFor={(id) => labels.get(id) ?? id}
          onChange={(model) => update.mutate({ model })}
          placeholder="Pick a model"
        />
      )}

      <View className="flex-row items-center gap-3">
        <Caption className="flex-1">
          {models.data
            ? `The models your key can use, from ${name}. Updated ${formatDate(models.data.fetchedAt)}.`
            : `The models your key can use, from ${name}.`}
        </Caption>
        <Button
          title="Refresh"
          variant="ghost"
          size="sm"
          pending={refresh.isPending}
          onPress={() => refresh.mutate()}
        />
      </View>

      {update.isError && <Caption tone="accent">That change did not save. Try again.</Caption>}
      {failure && (
        <Caption tone="accent">
          {aiErrorMessage(failure, stored.provider)?.message ??
            'The model list did not load. Try again.'}
        </Caption>
      )}
    </Card>
  );
}

/**
 * Sends the smallest real request with the stored key and model. Saving a key
 * only lists models, which works even on an account that cannot pay for an
 * ask - this is what catches that.
 */
function ConnectionCard({ stored }: { stored: AiKey }) {
  const test = useTestAiKey();
  const name = AI_PROVIDER_LABELS[stored.provider];

  return (
    <Card className="gap-3">
      <View className="flex-row items-center gap-3">
        <Caption className="flex-1">
          {`Sends ${name} a tiny request with your key and model. Costs a few tokens.`}
        </Caption>
        <Button
          title="Test connection"
          variant="secondary"
          size="sm"
          pending={test.isPending}
          onPress={() => test.mutate()}
        />
      </View>

      {test.isSuccess && <Caption tone="secondary">It works - the model answered.</Caption>}
      {test.isError && (
        <Caption tone="accent">
          {aiErrorMessage(test.error, stored.provider)?.message ??
            'The test did not go through. Try again.'}
        </Caption>
      )}
    </Card>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}
