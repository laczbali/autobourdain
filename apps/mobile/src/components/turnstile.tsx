import { useImperativeHandle, useRef, useState } from 'react';
import { useColorScheme } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { API_URL } from '@/lib/config';

import type { TurnstileProps } from './turnstile.types';

export type { TurnstileHandle, TurnstileProps } from './turnstile.types';

/** Matches the min-height the page reserves for the widget. */
const HEIGHT = 65;

/**
 * Native Turnstile. There is no React Native binding for the widget, so the
 * real one runs in a WebView pointed at the Worker's own /api/turnstile page -
 * same origin as the web app, which is what keeps the widget's hostname check
 * happy in production. The token comes back over the WebView bridge.
 */
export function Turnstile({ ref, onToken }: TurnstileProps) {
  const webView = useRef<WebView>(null);
  const scheme = useColorScheme();

  // Baked into the URL and fixed for the component's lifetime: reacting to a
  // theme change would reload the page and silently drop a solved token.
  const [uri] = useState(
    () => `${API_URL}/api/turnstile?theme=${scheme === 'dark' ? 'dark' : 'light'}`,
  );

  useImperativeHandle(
    ref,
    () => ({
      reset: () => {
        onToken(null);
        // Trailing `true;` keeps iOS from warning about the return value.
        webView.current?.injectJavaScript(
          'window.turnstileReset && window.turnstileReset(); true;',
        );
      },
    }),
    [onToken],
  );

  function handleMessage(event: WebViewMessageEvent) {
    try {
      const message: unknown = JSON.parse(event.nativeEvent.data);
      if (
        typeof message === 'object' &&
        message !== null &&
        'type' in message &&
        message.type === 'turnstile'
      ) {
        const token = 'token' in message ? message.token : null;
        onToken(typeof token === 'string' ? token : null);
      }
    } catch {
      onToken(null);
    }
  }

  return (
    <WebView
      ref={webView}
      source={{ uri }}
      onMessage={handleMessage}
      // A page that never loads can never hand over a token, and the form is
      // gated on having one - so fail closed rather than leave it pending.
      onError={() => onToken(null)}
      onHttpError={() => onToken(null)}
      scrollEnabled={false}
      // The page paints no background of its own, so the form's shows through
      // instead of the WebView's default white.
      style={{ height: HEIGHT, backgroundColor: 'transparent' }}
    />
  );
}
