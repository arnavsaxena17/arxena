/**
 * GET /org-chart/litify/enriched — TheOrg-enriched org chart JSON (frontend-renderable shape).
 *
 * Requires: TWENTY_SERVER_URL, E2E_API_TOKEN
 * Opt-in: E2E_INTEGRATION_LITIFY_ENRICHED=1
 */
import { expect, test } from '@playwright/test';

import { backendGetJson } from '../../lib/integration/backendClient';
import { probeGraphqlAlive } from '../../lib/integration/dependencyProbes';
import { assertLitifyEnrichedOrgChartRenderable } from '../../lib/integration/orgChartContracts';

const ENABLED = process.env.E2E_INTEGRATION_LITIFY_ENRICHED === '1';
const BASE =
  process.env.BACKEND_BASE_URL ||
  process.env.TWENTY_SERVER_URL ||
  'http://localhost:3000';
const TOKEN = process.env.E2E_API_TOKEN || '';

test.describe('Litify TheOrg-enriched org chart (REST)', () => {
  test.skip(!ENABLED, 'Set E2E_INTEGRATION_LITIFY_ENRICHED=1 to run');
  test.skip(!TOKEN, 'E2E_API_TOKEN is required');

  test('services up + enriched payload shape', async () => {
    const alive = await probeGraphqlAlive(BASE);
    expect(alive, 'twenty-server GraphQL should respond').toBe(true);

    const query = new URLSearchParams({ companyName: 'Litify' }).toString();
    const { status, data } = await backendGetJson<Record<string, unknown>>(
      `/org-chart/litify/enriched?${query}`,
    );

    console.log(
      '[litify-enriched] status=',
      status,
      'keys=',
      data && typeof data === 'object' ? Object.keys(data).join(',') : '',
    );

    if (status >= 500) {
      test.skip(true, `Server error ${status} — skip (TheOrg/Python/ES may be down)`);
      return;
    }

    expect(status >= 200 && status < 300).toBe(true);
    const body = data;
    assertLitifyEnrichedOrgChartRenderable(body);
  });
});
