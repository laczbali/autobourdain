import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Caption, Heading } from '@/components/ui';

type Props = {
  title: string;
  /** The one line under the title, as `d5b` writes it. */
  note: string;
  /** Anything that belongs at the far end of the heading row. */
  aside?: ReactNode;
};

/** The head of a settings section: its name, and what it is for. */
export function SectionHeader({ title, note, aside }: Props) {
  return (
    <View className="flex-row items-start gap-4">
      <View className="flex-1 gap-1">
        <Heading level={2}>{title}</Heading>
        <Caption tone="secondary">{note}</Caption>
      </View>
      {aside}
    </View>
  );
}
