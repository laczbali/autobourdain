import { describe, expect, it } from 'vitest';

import { trustedOrigins } from '../src/auth';
import { envWith } from './helpers';

describe('trustedOrigins', () => {
  it('splits the configured list and keeps the native scheme last', () => {
    const origins = trustedOrigins(
      envWith({ TRUSTED_ORIGINS: 'http://localhost:8081,http://localhost:19006' }),
    );

    expect(origins).toEqual(['http://localhost:8081', 'http://localhost:19006', 'autobourdain://']);
  });

  it('trims whitespace and drops empty entries', () => {
    const origins = trustedOrigins(
      envWith({ TRUSTED_ORIGINS: ' https://a.example , ,https://b.example ' }),
    );

    expect(origins).toEqual(['https://a.example', 'https://b.example', 'autobourdain://']);
  });

  it('still allows the native app when nothing is configured', () => {
    expect(trustedOrigins(envWith({ TRUSTED_ORIGINS: '' }))).toEqual(['autobourdain://']);
    expect(trustedOrigins(envWith({ TRUSTED_ORIGINS: undefined }))).toEqual(['autobourdain://']);
  });
});
