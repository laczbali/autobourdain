import { describe, expect, it } from 'vitest';

import { get, worker } from './helpers';

/** The Expo dev server, as listed in the test TRUSTED_ORIGINS binding. */
const TRUSTED = 'http://localhost:8081';

function preflight(origin: string): Request {
  return new Request('http://localhost/api/health', {
    method: 'OPTIONS',
    headers: {
      Origin: origin,
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type,x-captcha-response',
    },
  });
}

describe('CORS', () => {
  it('lets a trusted origin preflight with credentials', async () => {
    const response = await worker.fetch(preflight(TRUSTED));

    expect(response.headers.get('access-control-allow-origin')).toBe(TRUSTED);
    expect(response.headers.get('access-control-allow-credentials')).toBe('true');
    // Sign-in and sign-up send the Turnstile token in this header, so the
    // browser has to be told it is allowed.
    expect(response.headers.get('access-control-allow-headers')?.toLowerCase()).toContain(
      'x-captcha-response',
    );
  });

  it('exposes the token header the Expo client reads', async () => {
    const response = await worker.fetch(get('/api/health', { origin: TRUSTED }));

    expect(response.headers.get('access-control-expose-headers')?.toLowerCase()).toContain(
      'set-auth-token',
    );
  });

  it('refuses an origin that is not trusted', async () => {
    const response = await worker.fetch(get('/api/health', { origin: 'https://evil.example' }));

    expect(response.headers.get('access-control-allow-origin')).toBeNull();
  });
});
