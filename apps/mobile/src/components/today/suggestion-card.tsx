import type { Suggestion } from '@autobourdain/shared';
import { Image } from 'expo-image';
import { View } from 'react-native';

import { Body, Button, Caption, Heading } from '@/components/ui';

type Props = {
  suggestion: Suggestion;
  chosen: boolean;
  onChoose: () => void;
  first: boolean;
  /** One card per row, photo beside the text, rather than three across. */
  stacked: boolean;
};

/**
 * Every card but the first sits behind a hairline, as in `2e` - beside it
 * three across, above it stacked.
 */
function divider(first: boolean, stacked: boolean) {
  if (first) return '';
  return stacked ? 'border-t border-hairline pt-4' : 'border-l border-hairline pl-4';
}

/**
 * One suggestion: photo, title, a line of description, and Choose. The recipe
 * itself shows below the cards once chosen, so the card carries no Recipe
 * button. The chosen one is marked the way `2e` marks it - an accent rule
 * under the photo and a filled button - rather than by boxing the card.
 */
export function SuggestionCard({ suggestion, chosen, onChoose, first, stacked }: Props) {
  const choose = (
    <Button
      title={chosen ? 'Chosen' : 'Choose'}
      variant={chosen ? 'primary' : 'secondary'}
      size="sm"
      accessibilityState={{ selected: chosen }}
      onPress={onChoose}
      className={stacked ? 'mt-auto self-start px-5' : 'mt-auto'}
    />
  );

  return (
    <View
      accessibilityLabel={suggestion.title}
      accessibilityState={{ selected: chosen }}
      className={`${stacked ? 'flex-row gap-4' : 'flex-1 gap-2.5'} ${divider(first, stacked)}`}
    >
      {stacked ? (
        <>
          <Photo url={suggestion.imageUrl} chosen={chosen} className="h-[96px] w-[128px]" />
          <View className="flex-1 gap-2">
            <Heading level={3}>{suggestion.title}</Heading>
            <Body tone="secondary">{suggestion.description}</Body>
            {choose}
          </View>
        </>
      ) : (
        <>
          <Photo url={suggestion.imageUrl} chosen={chosen} className="h-[128px]" />
          <Heading level={2}>{suggestion.title}</Heading>
          <Body tone="secondary">{suggestion.description}</Body>
          {choose}
        </>
      )}
    </View>
  );
}

/**
 * The dish photo, or a quiet stand-in while there is none - there is no photo
 * store yet. The rule underneath is transparent until chosen, so choosing
 * does not shift the card.
 */
function Photo({
  url,
  chosen,
  className,
}: {
  url: string | null;
  chosen: boolean;
  /** The size, which depends on the layout. */
  className: string;
}) {
  return (
    <View
      className={`flex-none items-center justify-center overflow-hidden rounded-card border-b-2 bg-inset ${chosen ? 'border-accent' : 'border-transparent'} ${className}`}
    >
      {url ? (
        // expo-image takes no className, so it fills the frame by style.
        <Image source={{ uri: url }} contentFit="cover" style={{ width: '100%', height: '100%' }} />
      ) : (
        <Caption>no photo yet</Caption>
      )}
    </View>
  );
}

/** Where the cards will be, while they are being asked for. */
export function SuggestionCardsPending({ count, stacked }: { count: number; stacked: boolean }) {
  return (
    <View accessibilityLabel="Finding suggestions" className={stacked ? 'gap-4' : 'flex-row gap-4'}>
      {Array.from({ length: count }, (_, index) => (
        <View
          key={index}
          className={`${stacked ? 'flex-row gap-4' : 'flex-1 gap-2.5'} ${divider(index === 0, stacked)}`}
        >
          <View
            className={`flex-none rounded-card bg-inset ${stacked ? 'h-[96px] w-[128px]' : 'h-[128px]'}`}
          />
          <View className="flex-1 gap-2.5">
            <View className="h-[22px] w-3/4 rounded-card bg-inset" />
            <View className="h-[13px] w-full rounded-card bg-inset" />
            <View className="h-[13px] w-2/3 rounded-card bg-inset" />
          </View>
        </View>
      ))}
    </View>
  );
}
