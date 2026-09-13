/**
 * Types shared between the Worker API (apps/api) and the Expo app (apps/mobile).
 * Keep this package runtime-free: types and small pure helpers only, since it is
 * bundled by both Metro and workerd.
 */

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
