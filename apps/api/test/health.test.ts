import type { HealthResponse } from '@autobourdain/shared';
import { describe, expect, it } from 'vitest';

import { worker } from './helpers';

describe('GET /api/health', () => {
  it('reports the service as up', async () => {
    const response = await worker.fetch('http://localhost/api/health');

    expect(response.status).toBe(200);

    const body = await response.json<HealthResponse>();
    expect(body.ok).toBe(true);
    expect(body.service).toBe('autobourdain-api');
    expect(Number.isNaN(Date.parse(body.time))).toBe(false);
  });
});
