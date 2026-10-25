import { Link } from 'expo-router';
import { Pressable, View } from 'react-native';

import { Caption } from '@/components/ui';

type Props = {
  message: string;
  /** Whether the fix is in AI settings, so a link there belongs underneath. */
  toSettings: boolean;
  /** Danger for a failure, quieter for a setup note. */
  tone?: 'danger' | 'secondary';
};

/** A line about the AI side of an ask, with the way to AI settings when that helps. */
export function AiNotice({ message, toSettings, tone = 'danger' }: Props) {
  return (
    <View className="gap-1">
      <Caption tone={tone}>{message}</Caption>
      {toSettings && (
        <Link href="/settings/ai" asChild>
          <Pressable accessibilityRole="link" className="self-start active:opacity-70">
            <Caption tone="accent" className="underline">
              Open AI settings
            </Caption>
          </Pressable>
        </Link>
      )}
    </View>
  );
}
