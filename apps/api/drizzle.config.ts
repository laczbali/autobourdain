import { defineConfig } from 'drizzle-kit';

// Generates SQL migrations into apps/api/migrations, which wrangler applies to
// D1 (`npm run db:migrate` locally, `db:migrate:remote` against Cloudflare).
export default defineConfig({
  dialect: 'sqlite',
  schema: './src/db/schema.ts',
  out: './migrations',
});
