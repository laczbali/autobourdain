import { Body } from '@/components/ui';

import { Page } from './page';

type Props = {
  /** What will actually live here, in one line. Not a mock of it. */
  note: string;
};

/** A destination that routes but has nothing in it yet. */
export function Placeholder({ note }: Props) {
  return (
    <Page>
      <Body tone="secondary" large>
        {note}
      </Body>
    </Page>
  );
}
