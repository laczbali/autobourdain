import type { ReactNode } from 'react';
import { ScrollView } from 'react-native';

/**
 * The frame every destination sits in, so no screen re-derives the canvas, the
 * page padding or the scroll behaviour. `2e`'s content column: 20px down, 24px
 * across, 18px between blocks.
 *
 * It carries no title. `2e` gives the content column no page heading either -
 * the rail's accent rule is what says where you are.
 */
export function Page({
  children,
  contentClassName = '',
}: {
  children?: ReactNode;
  /** Extra classes on the content column, inside the scroll area. */
  contentClassName?: string;
}) {
  return (
    <ScrollView
      className="flex-1 bg-canvas"
      contentContainerClassName={`gap-[18px] px-6 py-5 ${contentClassName}`}
    >
      {children}
    </ScrollView>
  );
}
