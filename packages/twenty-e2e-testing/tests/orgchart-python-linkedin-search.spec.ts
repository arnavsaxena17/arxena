/**
 * Optional E2E test for org chart search using Python query generation.
 * Requires USE_PYTHON_QUERY_GENERATOR_FOR_ORGCHART=true and arxena-site running.
 * Skips if ARXENA_SITE_URL is not reachable or Python path not enabled.
 */
import { expect, test } from '@playwright/test';

const ARXENA_SITE_URL =
  process.env.ARXENA_SITE_URL || process.env.ARXENA_SITE_ORGCHART_URL?.replace(
    /\/api\/orgchart\/build\/?$/,
    '',
  ) || 'http://localhost:5050';

test.describe('Org chart Python query generator', () => {
  test('Python query generator API returns LinkedIn-compliant params', async ({
    request,
  }) => {
    const url = `${ARXENA_SITE_URL}/api/query-generator/linkedin`;
    let response;
    try {
      response = await request.post(url, {
        data: {
          functions: [{ name: 'hr', exclude: false }],
          grades: [{ name: 'leadership', exclude: false }],
          company_names: ['Acme Corp'],
        },
        timeout: 10_000,
      });
    } catch (e) {
      test.skip(
        true,
        `arxena-site not reachable at ${url}: ${(e as Error).message}`,
      );
      return;
    }

    if (!response.ok()) {
      test.skip(
        true,
        `Python query generator returned ${response.status()}`,
      );
      return;
    }

    const body = await response.json();
    expect(body).toHaveProperty('keywords');
    expect(body).toHaveProperty('company');
    if (body.keywords) {
      expect(typeof body.keywords).toBe('string');
    }
    if (body.company) {
      expect(Array.isArray(body.company)).toBe(true);
      expect(body.company.length).toBeLessThanOrEqual(20);
    }
  });
});
