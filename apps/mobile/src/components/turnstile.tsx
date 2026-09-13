import { useEffect, useImperativeHandle } from 'react';

import type { TurnstileProps } from './turnstile.types';

export type { TurnstileHandle, TurnstileProps } from './turnstile.types';

/**
 * Native stub. Turnstile is a browser widget with no React Native binding, and
 * the real one lives in turnstile.web.tsx. Reporting "no token" makes native
 * sign-in fail closed against the gated API rather than silently skipping the
 * check - there is no native build yet. When there is, this is the place for
 * an Expo DOM component ('use dom'), which renders the web widget in a WebView.
 */
export function Turnstile({ ref, onToken }: TurnstileProps) {
  useImperativeHandle(ref, () => ({ reset: () => onToken(null) }), [onToken]);

  useEffect(() => {
    onToken(null);
  }, [onToken]);

  return null;
}
