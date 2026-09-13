// Secrets only. Plain vars live in wrangler.jsonc and reach the global Env
// through the generated worker-configuration.d.ts; secrets are not in that
// file, so they are declared here and merged in. Set them with
// `npx wrangler secret put <NAME>` (or the Cloudflare dashboard), and in
// .dev.vars for local development.
interface Env {
  BETTER_AUTH_SECRET: string;
  // Turnstile. Required - sign-in and sign-up fail without it.
  TURNSTILE_SECRET_KEY: string;
  GITHUB_CLIENT_SECRET?: string;
}
