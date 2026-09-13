import { useEffect, useImperativeHandle, useRef } from 'react';

import { TURNSTILE_SITE_KEY } from '@/lib/config';

import type { TurnstileProps } from './turnstile.types';

export type { TurnstileHandle, TurnstileProps } from './turnstile.types';

const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

type RenderOptions = {
  sitekey: string;
  theme: 'auto' | 'light' | 'dark';
  size: 'normal' | 'compact' | 'flexible';
  callback: (token: string) => void;
  'error-callback': () => void;
  'expired-callback': () => void;
};

type TurnstileApi = {
  render: (el: HTMLElement, options: RenderOptions) => string;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

/** Shared across mounts so the <script> tag is only ever added once. Cleared on
 *  failure so a later mount can retry instead of inheriting a rejected promise. */
let scriptPromise: Promise<TurnstileApi> | null = null;

function loadTurnstile(): Promise<TurnstileApi> {
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<TurnstileApi>((resolve, reject) => {
    if (window.turnstile) {
      resolve(window.turnstile);
      return;
    }

    const fail = () => {
      scriptPromise = null;
      reject(new Error('Turnstile failed to load'));
    };

    const script = document.createElement('script');
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : fail());
    script.onerror = fail;
    document.head.appendChild(script);
  });

  return scriptPromise;
}

/**
 * The managed Turnstile widget. `theme: 'auto'` follows prefers-color-scheme,
 * which is the same OS preference _layout.tsx pushes into NativeWind, so the
 * widget matches the form without re-rendering on a theme change.
 */
export function Turnstile({ ref, onToken }: TurnstileProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const apiRef = useRef<TurnstileApi | null>(null);

  useImperativeHandle(
    ref,
    () => ({
      reset: () => {
        onToken(null);
        if (apiRef.current && widgetIdRef.current) apiRef.current.reset(widgetIdRef.current);
      },
    }),
    [onToken],
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let cancelled = false;

    loadTurnstile()
      .then((api) => {
        if (cancelled) return;
        apiRef.current = api;
        widgetIdRef.current = api.render(el, {
          sitekey: TURNSTILE_SITE_KEY,
          theme: 'auto',
          size: 'flexible',
          callback: (token) => onToken(token),
          'error-callback': () => onToken(null),
          'expired-callback': () => onToken(null),
        });
      })
      .catch(() => {
        if (!cancelled) onToken(null);
      });

    return () => {
      cancelled = true;
      // Effects run twice in development. Without remove() the second pass
      // stacks a duplicate widget onto the same node.
      if (apiRef.current && widgetIdRef.current) apiRef.current.remove(widgetIdRef.current);
      widgetIdRef.current = null;
    };
  }, [onToken]);

  // Turnstile renders into a real DOM node, so this is a div rather than a
  // View. min-height reserves the managed widget's space to stop the form
  // jumping once it loads.
  return <div ref={containerRef} style={{ minHeight: 65 }} />;
}
