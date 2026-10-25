/**
 * Types shared between the Worker API (apps/api) and the Expo app (apps/mobile).
 * Types, small pure helpers and zod schemas only, since it is bundled by both
 * Metro and workerd. zod is the one runtime dependency - it is how both sides
 * agree on what a valid request looks like.
 */

export * from './ai';
export * from './errors';
export * from './preferences';
export * from './suggest';

export type HealthResponse = {
  ok: boolean;
  service: string;
  time: string;
};

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image?: string | null;
};

export type MeResponse = {
  user: SessionUser | null;
};
