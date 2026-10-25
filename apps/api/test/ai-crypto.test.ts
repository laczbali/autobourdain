import { describe, expect, it } from 'vitest';

import { decryptApiKey, encryptApiKey } from '../src/ai/crypto';
import { envWith } from './helpers';

const KEY = 'sk-ant-test-1234567890';

// The test env as the Worker types it - secrets are declared on Env only, and
// vitest.config.ts binds this one.
const env = envWith({});

describe('API key encryption', () => {
  it('decrypts what it encrypted', async () => {
    const stored = await encryptApiKey(env, 'user-a', KEY);

    await expect(decryptApiKey(env, 'user-a', stored)).resolves.toBe(KEY);
  });

  it('never stores the key in the clear', async () => {
    const stored = await encryptApiKey(env, 'user-a', KEY);

    expect(stored).toMatch(/^v1\./);
    expect(stored).not.toContain(KEY);
  });

  it('encrypts the same key differently every time', async () => {
    const first = await encryptApiKey(env, 'user-a', KEY);
    const second = await encryptApiKey(env, 'user-a', KEY);

    expect(first).not.toBe(second);
  });

  it("will not decrypt under another user's id", async () => {
    const stored = await encryptApiKey(env, 'user-a', KEY);

    await expect(decryptApiKey(env, 'user-b', stored)).rejects.toThrow();
  });

  it('will not decrypt an altered ciphertext', async () => {
    const stored = await encryptApiKey(env, 'user-a', KEY);
    const [version, iv, ciphertext = ''] = stored.split('.');
    const flipped = (ciphertext[0] === 'A' ? 'B' : 'A') + ciphertext.slice(1);

    await expect(decryptApiKey(env, 'user-a', `${version}.${iv}.${flipped}`)).rejects.toThrow();
  });

  it('will not decrypt with another secret', async () => {
    const stored = await encryptApiKey(env, 'user-a', KEY);
    const other = envWith({ AI_KEY_ENCRYPTION_KEY: btoa('x'.repeat(32)) });

    await expect(decryptApiKey(other, 'user-a', stored)).rejects.toThrow();
  });

  it('refuses to encrypt without a secret', async () => {
    await expect(
      encryptApiKey(envWith({ AI_KEY_ENCRYPTION_KEY: '' }), 'user-a', KEY),
    ).rejects.toThrow('AI_KEY_ENCRYPTION_KEY is not set');
  });
});
