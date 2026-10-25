/**
 * Encrypts users' provider keys at rest, with AES-256-GCM.
 *
 * The secret is `AI_KEY_ENCRYPTION_KEY`, 32 random bytes in base64. Each key
 * gets a fresh IV, and the user's id is bound in as additional data, so a
 * ciphertext copied onto another user's row does not decrypt.
 *
 * Stored as `v1.<iv>.<ciphertext>`. The version leaves room to rotate the
 * secret later: a `v2` would decrypt `v1` rows with the old secret.
 */

const VERSION = 'v1';
const IV_BYTES = 12;

async function importSecret(secret: string | undefined): Promise<CryptoKey> {
  // Fails loudly rather than storing anything in the clear.
  if (!secret) throw new Error('AI_KEY_ENCRYPTION_KEY is not set');
  const raw = fromBase64(secret);
  if (raw.byteLength !== 32) {
    throw new Error('AI_KEY_ENCRYPTION_KEY must be 32 bytes, base64-encoded');
  }
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function encryptApiKey(env: Env, userId: string, apiKey: string): Promise<string> {
  const key = await importSecret(env.AI_KEY_ENCRYPTION_KEY);
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(userId) },
    key,
    new TextEncoder().encode(apiKey),
  );
  return [VERSION, toBase64(iv), toBase64(new Uint8Array(ciphertext))].join('.');
}

/** Throws on anything that does not decrypt: wrong user, altered, wrong secret. */
export async function decryptApiKey(env: Env, userId: string, stored: string): Promise<string> {
  const [version, iv, ciphertext] = stored.split('.');
  if (version !== VERSION || !iv || !ciphertext) {
    throw new Error('Unrecognised encrypted key format');
  }
  const key = await importSecret(env.AI_KEY_ENCRYPTION_KEY);
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(iv), additionalData: new TextEncoder().encode(userId) },
    key,
    fromBase64(ciphertext),
  );
  return new TextDecoder().decode(plaintext);
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}
