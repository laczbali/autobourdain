import {
  AI_PROVIDER_LABELS,
  AI_PROVIDERS,
  canUseAiProvider,
  isKeyedAiProvider,
  type AiConnection,
  type AiProvider,
  type KeyedAiProvider,
} from '@autobourdain/shared';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { SectionHeader, SettingsPage } from '@/components/settings';
import { Button, Caption, Card, Chip, Field, Label, Select } from '@/components/ui';
import { useRole } from '@/lib/admin';
import {
  aiErrorMessage,
  useActivateAi,
  useAiModels,
  useAiSettings,
  useDeleteAiKey,
  useRefreshAiModels,
  useSaveAiKey,
  useTestAi,
  useUpdateAiModel,
} from '@/lib/ai';
import { useTheme } from '@/theme/theme-provider';

const NOTES: Record<'keyed' | 'app', string> = {
  keyed: 'Suggestions come from your own provider account, through your key.',
  app: "Suggestions run on Workers AI, on the app's own account. No key needed.",
};

/**
 * Where suggestions come from: the provider, its key if it takes one, and the
 * model. Not in `d5b`, so it takes Appearance's shape - a header, then a card
 * per decision.
 *
 * The chips pick the active provider. One that needs no key, or whose key is
 * stored, switches straight away; a keyed one without a key opens its form,
 * and saving the key switches. A stored key stays when switching away.
 *
 * Workers AI is offered to pro and admin only. Someone demoted while on it
 * still sees it, so they can tell why asks stopped, and switch.
 *
 * A key goes in and never comes back out. Once stored, all that shows is its
 * last four characters.
 */
export default function AiSettings() {
  const { palette } = useTheme();
  const role = useRole();
  const settings = useAiSettings();
  const activate = useActivateAi();
  const [opened, setOpened] = useState<KeyedAiProvider | null>(null);

  const connections = settings.data?.connections ?? [];
  const active = connections.find((connection) => connection.active) ?? null;
  // A switch shows straight away; the stored one catches up when it lands.
  const provider: AiProvider =
    (activate.isPending ? activate.variables.provider : null) ??
    opened ??
    active?.provider ??
    AI_PROVIDERS[0];
  const connection = connections.find((stored) => stored.provider === provider) ?? null;
  const offered = AI_PROVIDERS.filter(
    (option) => canUseAiProvider(option, role) || option === active?.provider,
  );

  const choose = (option: AiProvider) => {
    const stored = connections.some((existing) => existing.provider === option);
    if (isKeyedAiProvider(option) && !stored) {
      setOpened(option);
      return;
    }
    setOpened(null);
    if (option !== active?.provider) activate.mutate({ provider: option });
  };

  return (
    <SettingsPage>
      <SectionHeader title="AI" note={NOTES[isKeyedAiProvider(provider) ? 'keyed' : 'app']} />

      {settings.isPending ? (
        <View className="self-start">
          <ActivityIndicator color={palette.accent} />
        </View>
      ) : settings.isError ? (
        <Caption tone="danger">The AI settings did not load. Try again later.</Caption>
      ) : (
        <>
          <Card className="gap-3">
            <Label>Provider</Label>
            <View accessibilityRole="radiogroup" className="flex-row flex-wrap gap-2">
              {offered.map((option) => (
                <Chip
                  key={option}
                  label={AI_PROVIDER_LABELS[option]}
                  selected={provider === option}
                  onPress={() => choose(option)}
                />
              ))}
            </View>
            {activate.isError && (
              <Caption tone="danger">
                {aiErrorMessage(activate.error, activate.variables?.provider)?.message ??
                  'That did not switch. Try again.'}
              </Caption>
            )}
          </Card>

          {isKeyedAiProvider(provider) && (
            <KeyCard
              // A new provider needs a new key, so the form starts over.
              key={provider}
              provider={provider}
              stored={connection}
            />
          )}

          {!canUseAiProvider(provider, role) ? (
            <Card>
              <Caption tone="secondary">
                {`${AI_PROVIDER_LABELS[provider]} is for Pro and Admin users only. Choose another provider to keep getting suggestions.`}
              </Caption>
            </Card>
          ) : connection?.active ? (
            <>
              <ModelCard connection={connection} />
              <ConnectionCard
                // A result only speaks for the provider, key and model it was run with.
                key={`${connection.provider}:${connection.keyHint}:${connection.model}`}
                connection={connection}
              />
            </>
          ) : activate.isPending ? (
            <View className="self-start">
              <ActivityIndicator color={palette.accent} />
            </View>
          ) : null}
        </>
      )}
    </SettingsPage>
  );
}

function KeyCard({ provider, stored }: { provider: KeyedAiProvider; stored: AiConnection | null }) {
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
              onPress={() => remove.mutate(provider)}
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

      {remove.isError && <Caption tone="danger">The key was not removed. Try again.</Caption>}
    </Card>
  );
}

function ModelCard({ connection }: { connection: AiConnection }) {
  const { palette } = useTheme();
  const models = useAiModels(connection.provider);
  const refresh = useRefreshAiModels(connection.provider);
  const update = useUpdateAiModel();
  const name = AI_PROVIDER_LABELS[connection.provider];
  const keyed = isKeyedAiProvider(connection.provider);

  const list = models.data?.models ?? [];
  const labels = new Map(list.map(({ id, label }) => [id, label]));
  // The pick shows straight away; the stored model catches up when it saves.
  const current = update.isPending ? update.variables.model : connection.model;
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

      {keyed ? (
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
      ) : (
        // Picked by hand for the app, so there is nothing to refresh.
        <Caption>{`The ${name} models picked for this app.`}</Caption>
      )}

      {update.isError && <Caption tone="danger">That change did not save. Try again.</Caption>}
      {failure && (
        <Caption tone="danger">
          {aiErrorMessage(failure, connection.provider)?.message ??
            'The model list did not load. Try again.'}
        </Caption>
      )}
    </Card>
  );
}

/**
 * Sends the smallest real request to the active provider and model. Saving a
 * key only lists models, which works even on an account that cannot pay for
 * an ask - this is what catches that.
 */
function ConnectionCard({ connection }: { connection: AiConnection }) {
  const test = useTestAi();
  const name = AI_PROVIDER_LABELS[connection.provider];

  return (
    <Card className="gap-3">
      <View className="flex-row items-center gap-3">
        <Caption className="flex-1">
          {isKeyedAiProvider(connection.provider)
            ? `Sends ${name} a tiny request with your key and model. Costs a few tokens.`
            : `Sends ${name} a tiny request with the chosen model. Costs next to nothing.`}
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
        <Caption tone="danger">
          {aiErrorMessage(test.error, connection.provider)?.message ??
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
