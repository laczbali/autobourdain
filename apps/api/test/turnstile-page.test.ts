import { createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

import app from '../src/index';
import { envWith, get, worker } from './helpers';

/** The site key vitest.config.ts binds - Cloudflare's always-passes test one. */
const SITE_KEY = '1x00000000000000000000AA';

const page = async (path = '/api/turnstile') => (await worker.fetch(get(path))).text();

describe('GET /api/turnstile', () => {
  it('serves the widget page with the configured site key', async () => {
    const response = await worker.fetch(get('/api/turnstile'));

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('text/html');
    expect(await response.text()).toContain(`data-sitekey="${SITE_KEY}"`);
  });

  it('keeps the two things the native component talks to', async () => {
    // apps/mobile/src/components/turnstile.tsx reads tokens off the WebView
    // bridge and calls turnstileReset() through injectJavaScript(). Renaming
    // either without touching the app breaks sign-in on native only.
    const html = await page();

    expect(html).toContain('window.ReactNativeWebView.postMessage');
    expect(html).toContain(`JSON.stringify({ type: 'turnstile', token: token })`);
    expect(html).toContain('window.turnstileReset = function ()');
  });

  it('takes the theme from the query string, and ignores anything else', async () => {
    const themeOf = async (query: string) =>
      /data-theme="(\w+)"/.exec(await page(`/api/turnstile${query}`))?.[1];

    await expect(themeOf('?theme=dark')).resolves.toBe('dark');
    await expect(themeOf('?theme=light')).resolves.toBe('light');
    await expect(themeOf('?theme=chartreuse')).resolves.toBe('auto');
    await expect(themeOf('')).resolves.toBe('auto');
  });

  it('escapes a site key that would otherwise break out of its attribute', async () => {
    const ctx = createExecutionContext();
    const env = envWith({ TURNSTILE_SITE_KEY: '"><script>alert(1)</script>' });

    const response = await app.fetch(get('/api/turnstile'), env, ctx);
    await waitOnExecutionContext(ctx);
    const html = await response.text();

    expect(html).not.toContain('<script>alert(1)');
    expect(html).toContain('data-sitekey="&quot;&gt;&lt;script&gt;alert(1)');
  });
});
