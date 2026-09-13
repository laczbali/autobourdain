import type { Ref } from 'react';

export type TurnstileHandle = {
  /** Drop the current token and ask Turnstile for a fresh one. */
  reset: () => void;
};

export type TurnstileProps = {
  ref?: Ref<TurnstileHandle>;
  /** Called with a token once the challenge passes, and with null when it is
   *  cleared, expired or failed. */
  onToken: (token: string | null) => void;
};
