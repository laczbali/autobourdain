import path from 'node:path';

import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    cloudflareTest(async () => ({
      // The real Worker config: same routes, same bindings, same D1.
      wrangler: { configPath: '../../wrangler.jsonc' },
      miniflare: {
        // Spelled out rather than read from .dev.vars - a test run must not
        // depend on a developer's local secrets, or change with them. Every
        // value here is public.
        bindings: {
          // The generated migrations are the only description of the schema, so
          // tests build their database from the same files production does -
          // better-auth's four tables included.
          TEST_MIGRATIONS: await readD1Migrations(path.join(import.meta.dirname, 'migrations')),
          BETTER_AUTH_SECRET: 'test-secret-used-only-by-vitest-not-a-real-one',
          // Empty on purpose: auth then mirrors the request origin, which is
          // what dev does and what makes the origin assertions mean something.
          BETTER_AUTH_URL: '',
          TRUSTED_ORIGINS: 'http://localhost:8081',
          // Cloudflare's always-passes Turnstile secret. Its counterpart
          // 2x0000000000000000000000000000000AA always fails, and the captcha
          // tests swap it in to exercise the rejection path.
          TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA',
          // The matching always-passes site key, for the /api/turnstile page.
          // Overridden rather than taken from wrangler.jsonc so rotating the
          // real widget cannot break a test.
          TURNSTILE_SITE_KEY: '1x00000000000000000000AA',
          // Unset, so GitHub is not registered by default. The social provider
          // test supplies its own.
          GITHUB_CLIENT_ID: '',
          GITHUB_CLIENT_SECRET: '',
        },
      },
    })),
  ],
  test: {
    setupFiles: ['./test/apply-migrations.ts'],
  },
});
