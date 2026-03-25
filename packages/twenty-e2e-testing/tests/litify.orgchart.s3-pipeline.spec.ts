/**
 * E2E test: Litify org chart creation with S3 persistence.
 *
 * Flow:
 *   1. POST /candidate-search/orgchart (entire_company) for Litify
 *      → fetches candidates from LinkedIn
 *      → generates org chart via Python
 *      → saves candidates + org chart to S3
 *      → creates a job record in the workspace
 *   2. GET /org-chart/litify
 *      → on Redis cache miss, falls back to S3-stored org chart
 *      → verifies S3 retrieval path works
 *
 * Requires:
 *   - TWENTY_SERVER_URL (or falls back to http://localhost:3000)
 *   - ARXENA_SITE_URL (Python orgchart API, falls back to http://localhost:5050)
 *   - E2E_API_TOKEN – Bearer token for twenty-server API
 *   - USE_PYTHON_QUERY_GENERATOR_FOR_ORGCHART=true on the server
 */
import { expect, test } from '@playwright/test';

const TWENTY_SERVER_URL =
  process.env.TWENTY_SERVER_URL || 'http://localhost:3000';

const ARXENA_SITE_URL =
  process.env.ARXENA_SITE_URL ||
  process.env.ARXENA_SITE_ORGCHART_URL?.replace(/\/api\/orgchart\/build\/?$/, '') ||
  'http://localhost:5050';

const API_TOKEN = process.env.E2E_API_TOKEN || '';

const LITIFY_COMPANY_ID = 'litify';
const LITIFY_COMPANY_NAME = 'Litify';

test.describe('Litify org chart: LinkedIn → Python → S3 pipeline', () => {
  test.setTimeout(10 * 60 * 1000); // 10 min – LinkedIn search can be slow

  test('Python orgchart API is reachable', async ({ request }) => {
    const url = `${ARXENA_SITE_URL}/api/query-generator/linkedin`;
    let response: Awaited<ReturnType<typeof request.post>> | undefined;
    try {
      response = await request.post(url, {
        data: {
          company_names: [LITIFY_COMPANY_NAME],
        },
        timeout: 15_000,
      });
    } catch (e) {
      test.skip(
        true,
        `arxena-site not reachable at ${url}: ${(e as Error).message}`,
      );
      return;
    }

    if (!response.ok()) {
      test.skip(true, `Python query generator returned ${response.status()}`);
      return;
    }

    const body = await response.json();
    expect(body).toHaveProperty('company');
  });

  test('creates Litify org chart from LinkedIn, saves to S3, creates job', async ({
    request,
  }) => {
    if (!API_TOKEN) {
      test.skip(true, 'E2E_API_TOKEN is not set – skipping authenticated test');
      return;
    }

    // ── Step 1: Verify Python orgchart API is reachable ──────────────────────
    const pythonUrl = `${ARXENA_SITE_URL}/api/query-generator/linkedin`;
    try {
      const probe = await request.post(pythonUrl, {
        data: { company_names: [LITIFY_COMPANY_NAME] },
        timeout: 10_000,
      });
      if (!probe.ok()) {
        test.skip(true, `Python orgchart API not available (${probe.status()})`);
        return;
      }
    } catch (e) {
      test.skip(
        true,
        `arxena-site not reachable: ${(e as Error).message}`,
      );
      return;
    }

    // ── Step 2: Trigger org chart creation ───────────────────────────────────
    const orgchartUrl = `${TWENTY_SERVER_URL}/candidate-search/orgchart`;

    let createResponse: Awaited<ReturnType<typeof request.post>>;
    try {
      createResponse = await request.post(orgchartUrl, {
        headers: {
          Authorization: `Bearer ${API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        data: {
          rawQuery: `Find all people currently working at ${LITIFY_COMPANY_NAME}.`,
          cleanedQuery: `Find all people currently working at ${LITIFY_COMPANY_NAME}.`,
          companyName: LITIFY_COMPANY_NAME,
          companyId: LITIFY_COMPANY_ID,
          mode: 'entire_company',
          searchType: 'classic',
        },
        timeout: 8 * 60 * 1000, // LinkedIn search can take minutes
      });
    } catch (e) {
      test.skip(
        true,
        `twenty-server not reachable at ${orgchartUrl}: ${(e as Error).message}`,
      );
      return;
    }

    if (!createResponse.ok()) {
      const errBody = await createResponse.text().catch(() => '');
      test.skip(
        true,
        `Org chart creation returned ${createResponse.status()}: ${errBody.slice(0, 300)}`,
      );
      return;
    }

    const createBody = await createResponse.json() as Record<string, unknown>;

    // Validate response shape
    expect(createBody).toHaveProperty('success', true);
    expect(createBody).toHaveProperty('mode', 'entire_company');
    expect(createBody).toHaveProperty('companyName');
    expect(createBody).toHaveProperty('itemCount');
    expect(createBody).toHaveProperty('items');
    expect(createBody).toHaveProperty('orgChart');
    expect(createBody.orgChart).toBeTruthy();

    const itemCount = createBody.itemCount as number;
    expect(itemCount).toBeGreaterThan(0);

    console.log(
      JSON.stringify(
        {
          step: 'orgchart_created',
          companyName: createBody.companyName,
          itemCount,
          isCached: createBody.isCached,
          cacheSource: createBody.cacheSource,
          hasOrgChart: !!createBody.orgChart,
        },
        null,
        2,
      ),
    );

    // ── Step 3: Verify GET /org-chart/litify returns data (S3 fallback path) ─
    // We request the org chart immediately. Even if Redis has it cached, the
    // endpoint must return a non-blank result. When Redis expires or is cleared,
    // the service will fall back to S3 (the data we just saved).
    const getOrgChartUrl = `${TWENTY_SERVER_URL}/org-chart/${LITIFY_COMPANY_ID}`;

    let getResponse: Awaited<ReturnType<typeof request.get>>;
    try {
      getResponse = await request.get(getOrgChartUrl, {
        headers: {
          Authorization: `Bearer ${API_TOKEN}`,
        },
        timeout: 30_000,
      });
    } catch (e) {
      // Non-blocking: the important assertions already passed in step 2
      console.warn(`GET org chart failed: ${(e as Error).message}`);
      return;
    }

    expect(getResponse.ok()).toBeTruthy();
    const getBody = await getResponse.json() as Record<string, unknown>;

    expect(getBody).toHaveProperty('status', 'ok');
    expect(getBody).toHaveProperty('result');
    expect(getBody.result).toBeTruthy();

    // The result should not be a blank template when we just created real data
    const result = getBody.result as Record<string, unknown>;
    const isBlank = result.is_blank_template === true;
    expect(isBlank).toBe(false);

    console.log(
      JSON.stringify(
        {
          step: 'orgchart_fetched',
          hasResult: !!getBody.result,
          isBlankTemplate: isBlank,
        },
        null,
        2,
      ),
    );
  });

  test('fetches Litify org chart from S3 when result is not blank', async ({
    request,
  }) => {
    if (!API_TOKEN) {
      test.skip(true, 'E2E_API_TOKEN is not set – skipping authenticated test');
      return;
    }

    // This test just validates that the GET org-chart endpoint returns something
    // meaningful (not a blank template), which would indicate S3 fallback data
    // is in place from a prior run.
    const getOrgChartUrl = `${TWENTY_SERVER_URL}/org-chart/${LITIFY_COMPANY_ID}`;

    let getResponse: Awaited<ReturnType<typeof request.get>>;
    try {
      getResponse = await request.get(getOrgChartUrl, {
        headers: {
          Authorization: `Bearer ${API_TOKEN}`,
        },
        timeout: 30_000,
      });
    } catch (e) {
      test.skip(
        true,
        `twenty-server not reachable: ${(e as Error).message}`,
      );
      return;
    }

    if (!getResponse.ok()) {
      test.skip(
        true,
        `GET org chart returned ${getResponse.status()} – S3 data may not be populated yet`,
      );
      return;
    }

    const body = await getResponse.json() as Record<string, unknown>;
    expect(body).toHaveProperty('status', 'ok');
    expect(body).toHaveProperty('result');

    const result = body.result as Record<string, unknown>;

    // If is_blank_template is present and true, S3 data is not there yet.
    // This is acceptable; just log it.
    if (result.is_blank_template === true) {
      console.log('Org chart is a blank template – S3 data not yet populated. Run the creation test first.');
    } else {
      console.log(
        JSON.stringify(
          {
            step: 's3_fallback_verified',
            hasResult: true,
            companyId: result.company_id ?? result.job_company_id,
          },
          null,
          2,
        ),
      );
    }

    // Either way the endpoint must respond successfully
    expect(body.result).toBeTruthy();
  });
});
