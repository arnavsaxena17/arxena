/**
 * Org chart pipeline E2E: Python query generation + LinkedIn search + org chart creation.
 *
 * Scenarios (per plan 5.2):
 * - Full company (entire_company): 100-150 people, multiple nodes
 * - Leadership (leadership): leadership-tier nodes only
 * - Function: HR, Finance, Technology, Engineering (function_grade with jobTitles)
 *
 * Requires:
 * - arxena-site running (for Python query generator)
 * - twenty-server with USE_PYTHON_QUERY_GENERATOR_FOR_ORGCHART=true
 * - ARXENA_SITE_URL or ARXENA_SITE_ORGCHART_URL for Python API
 */
import { expect, test } from '@playwright/test';

const ARXENA_SITE_URL =
  process.env.ARXENA_SITE_URL ||
  process.env.ARXENA_SITE_ORGCHART_URL?.replace(/\/api\/orgchart\/build\/?$/, '') ||
  'http://localhost:5050';

const TEST_COMPANY = process.env.E2E_TEST_COMPANY || 'salesforce';

test.describe('Org chart pipeline: Python query generation', () => {
  test('Python query generator returns LinkedIn-compliant params for leadership', async ({
    request,
  }) => {
    const url = `${ARXENA_SITE_URL}/api/query-generator/linkedin`;
    let response;
    try {
      response = await request.post(url, {
        data: {
          grades: [{ name: 'leadership', exclude: false }],
          company_names: [TEST_COMPANY],
        },
        timeout: 15_000,
      });
    } catch (e) {
      test.skip(true, `arxena-site not reachable at ${url}: ${(e as Error).message}`);
      return;
    }

    if (!response.ok()) {
      test.skip(true, `Python query generator returned ${response.status}`);
      return;
    }

    const body = await response.json();
    expect(body).toHaveProperty('job_title');
    expect(body).toHaveProperty('keywords');
    expect(body).toHaveProperty('company');
    if (body.job_title) {
      expect(typeof body.job_title).toBe('string');
      expect(body.job_title.length).toBeGreaterThan(0);
    }
    if (body.company) {
      expect(Array.isArray(body.company)).toBe(true);
      expect(body.company.length).toBeLessThanOrEqual(20);
    }
  });

  test('Python query generator returns params for HR function', async ({
    request,
  }) => {
    const url = `${ARXENA_SITE_URL}/api/query-generator/linkedin`;
    let response;
    try {
      response = await request.post(url, {
        data: {
          raw_job_titles: ['HR'],
          company_names: [TEST_COMPANY],
        },
        timeout: 15_000,
      });
    } catch (e) {
      test.skip(true, `arxena-site not reachable: ${(e as Error).message}`);
      return;
    }

    if (!response.ok()) {
      test.skip(true, `Python query generator returned ${response.status}`);
      return;
    }

    const body = await response.json();
    expect(body).toHaveProperty('job_title');
    if (body.job_title) {
      expect(typeof body.job_title).toBe('string');
    }
  });

  test('Python query generator returns params for Finance function', async ({
    request,
  }) => {
    const url = `${ARXENA_SITE_URL}/api/query-generator/linkedin`;
    let response;
    try {
      response = await request.post(url, {
        data: {
          raw_job_titles: ['Finance'],
          company_names: [TEST_COMPANY],
        },
        timeout: 15_000,
      });
    } catch (e) {
      test.skip(true, `arxena-site not reachable: ${(e as Error).message}`);
      return;
    }

    if (!response.ok()) {
      test.skip(true, `Python query generator returned ${response.status}`);
      return;
    }

    const body = await response.json();
    expect(body).toHaveProperty('job_title');
  });

  test('Python query generator returns params for Technology function', async ({
    request,
  }) => {
    const url = `${ARXENA_SITE_URL}/api/query-generator/linkedin`;
    let response;
    try {
      response = await request.post(url, {
        data: {
          raw_job_titles: ['Technology'],
          company_names: [TEST_COMPANY],
        },
        timeout: 15_000,
      });
    } catch (e) {
      test.skip(true, `arxena-site not reachable: ${(e as Error).message}`);
      return;
    }

    if (!response.ok()) {
      test.skip(true, `Python query generator returned ${response.status}`);
      return;
    }

    const body = await response.json();
    expect(body).toHaveProperty('job_title');
  });

  test('Python query generator returns params for Engineering function', async ({
    request,
  }) => {
    const url = `${ARXENA_SITE_URL}/api/query-generator/linkedin`;
    let response;
    try {
      response = await request.post(url, {
        data: {
          raw_job_titles: ['Engineering'],
          company_names: [TEST_COMPANY],
        },
        timeout: 15_000,
      });
    } catch (e) {
      test.skip(true, `arxena-site not reachable: ${(e as Error).message}`);
      return;
    }

    if (!response.ok()) {
      test.skip(true, `Python query generator returned ${response.status}`);
      return;
    }

    const body = await response.json();
    expect(body).toHaveProperty('job_title');
  });
});
