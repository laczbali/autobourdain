import { applyD1Migrations } from 'cloudflare:test';
import { env } from 'cloudflare:workers';

// Storage is isolated per test file, so every file starts against an empty
// database and has to build the schema for itself.
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
