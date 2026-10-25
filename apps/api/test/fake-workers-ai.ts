import type { Role } from '@autobourdain/shared';
import { createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { env } from 'cloudflare:workers';

import app from '../src/index';
import { envWith, userIdFor } from './helpers';

/**
 * A stand-in for the Worker's `AI` binding, so no test spends neurons or needs
 * a Cloudflare login. The real binding only exists remotely, and the pool runs
 * with remote bindings off, so it cannot be spied on - the fake goes in
 * through `envWith()`, and requests go straight to the Hono app.
 */

export type AiRun = { model: string; inputs: Record<string, unknown>; options?: AiOptions };

/**
 * Answered in order, the last one repeating. An Error is thrown, the way the
 * binding fails, and anything else is what `run` resolves with.
 */
export function fakeWorkersAi(replies: unknown[] = [{ response: 'OK' }]) {
  const runs: AiRun[] = [];
  let index = 0;

  const ai = {
    async run(model: string, inputs: Record<string, unknown>, options?: AiOptions) {
      runs.push({ model, inputs, options });
      const reply = replies[Math.min(index++, replies.length - 1)];
      if (reply instanceof Error) throw reply;
      return reply;
    },
  };

  /** The Worker, with the fake as its AI binding. */
  async function fetch(request: Request): Promise<Response> {
    const ctx = createExecutionContext();
    const response = await app.fetch(request, envWith({ AI: ai }), ctx);
    await waitOnExecutionContext(ctx);
    return response;
  }

  return { runs, fetch };
}

/** Sets a role the way nothing in the app can: straight in the table. */
export async function setRole(cookie: string, role: Role): Promise<void> {
  await env.DB.prepare('UPDATE user SET role = ? WHERE id = ?')
    .bind(role, await userIdFor(cookie))
    .run();
}
