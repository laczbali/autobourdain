import type { D1Migration } from 'cloudflare:test';

declare global {
  namespace Cloudflare {
    // Merged into the generated Env from worker-configuration.d.ts.
    // TEST_MIGRATIONS is injected by vitest.config.ts and exists only here.
    interface Env {
      TEST_MIGRATIONS: D1Migration[];
    }
  }
}
