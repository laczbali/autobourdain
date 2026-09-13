// Secrets are not part of wrangler.jsonc, so they are not in the generated
// worker-configuration.d.ts. Declared here and merged into the global Env.
// Set them with `npx wrangler secret put <NAME>` (or the Cloudflare dashboard),
// and in .dev.vars for local development.
interface Env {
  BETTER_AUTH_SECRET: string;
  // Turnstile. Required - sign-in and sign-up fail without it.
  TURNSTILE_SECRET_KEY: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
}
