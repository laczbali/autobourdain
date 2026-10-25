import type { ReactNode } from 'react';

import { Page } from '@/components/shell';

/**
 * The frame every settings section sits in. The column is capped, left-aligned,
 * so a wide window leaves empty canvas on the right rather than stretching
 * rows and cards across it. 640px is about what `2e`'s content column comes to
 * in its 1120px frame.
 *
 * The cap is on the content, not the scroll view, so the scrollbar still sits
 * at the window's edge.
 */
export function SettingsPage({ children }: { children?: ReactNode }) {
  return <Page contentClassName="w-full max-w-[640px]">{children}</Page>;
}
