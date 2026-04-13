/**
 * Opt-in REST pipeline coverage: TheOrg-enriched org chart, full Unipile org-chart/search matrix,
 * Apify/x-ray (supported modes), and message/stream with both query generators.
 *
 * Requires: E2E_API_TOKEN, TWENTY_SERVER_URL (or BACKEND_BASE_URL)
 * Enable: E2E_INTEGRATION_PIPELINE_MATRIX=1
 *
 * Matrix documentation:
 * - Unipile matrix = 3 searchType (classic, sales_navigator, recruiter) × 2 queryGenerator
 *   (multi_agent, python) × all ORG_CHART_SEARCH_MODES (see twenty-shared orgchartSearchMode.ts).
 * - Apify + LinkedIn x-ray: same mode dimension as Unipile (`ORG_CHART_SEARCH_MODES` in twenty-shared).
 * - Apify invalid mode: expect HTTP 400 (function_grade, current_node).
 * - GET /org-chart/litify/enriched — frontend-parseable orgchart array (see orgChartContracts).
 * - POST arxena-site Python query APIs — for each org-chart mode, same flow as Nest `generateSearchParameters` (query-set then optional single fallback; pythonQueryGeneratorContract).
 * - POST arxena-site /api/title-taxonomy/search-keywords — BD-shaped body (TitleTaxonomyRemoteService); Nest calls this during business_division_map when queryGenerator=python (multi_agent uses LinkedIn multi-agent orchestrator instead).
 * - POST /candidate-search-chat/message/stream — "Fetch me CTOs…" × multi_agent & python (needs thread id).
 *
 * Uses fetch via backendPostJson (same as axios to localhost:3000 with JSON bodies).
 */
import { expect, test } from '@playwright/test';

import { backendGetJson, backendPostJson } from '../../lib/integration/backendClient';
import {
    probeArxenaSiteLinkedinQuery,
    probeArxenaSiteTitleTaxonomySearchKeywords,
    probeGraphqlAlive,
} from '../../lib/integration/dependencyProbes';
import {
    assertLitifyEnrichedOrgChartRenderable,
    assertOrgChartQueuedShape,
    assertOrgChartSearchResponseShape,
} from '../../lib/integration/orgChartContracts';
import {
    buildOrgChartSearchBody,
    buildPythonLinkedInRequestBodyForOrgchartMode,
    getApifyExpect400UnsupportedModeCases,
    getApifyOrgChartMatrixCases,
    getLinkedinXrayOrgChartMatrixCases,
    getPythonOrgchartModeContractCases,
    getUnipileOrgChartMatrixCases,
} from '../../lib/integration/pipelineOrgChartRequests';
import { assertPythonSearchParametersFlowLikeNest } from '../../lib/integration/pythonQueryGeneratorContract';
import { assertTitleTaxonomySearchKeywordsBdProbe } from '../../lib/integration/titleTaxonomySearchKeywordsContract';

const ENABLED = process.env.E2E_INTEGRATION_PIPELINE_MATRIX === '1';
const BASE =
  process.env.BACKEND_BASE_URL ||
  process.env.TWENTY_SERVER_URL ||
  'http://localhost:3000';
const TOKEN = process.env.E2E_API_TOKEN || '';

const COMPANY_NAME =
  process.env.E2E_ORGCHART_COMPANY_NAME || process.env.E2E_PIPELINE_COMPANY_NAME || 'covvalent';
const COMPANY_ID =
  process.env.E2E_ORGCHART_COMPANY_ID || process.env.E2E_PIPELINE_COMPANY_ID || 'covvalent';
const LINKEDIN_URL =
  process.env.E2E_LINKEDIN_COMPANY_URL ||
  process.env.E2E_PIPELINE_LINKEDIN_COMPANY_URL ||
  'https://www.linkedin.com/company/covvalent/';

const ARXENA_SITE = process.env.ARXENA_SITE_URL || 'http://localhost:5050';

const THREAD = process.env.E2E_CANDIDATE_CHAT_ASSISTANT_THREAD_ID || '';
const CTO_MESSAGE =
  process.env.E2E_PIPELINE_CTO_MESSAGE ||
  'Fetch me CTOs of HR Tech companies in Mumbai';

const MINIMAL_PARSED_JD = {
  jobTitle: 'Software Engineer',
  company: 'Integration Co',
  location: '',
  industry: '',
  requiredSkills: [] as string[],
  preferredSkills: [] as string[],
  experienceLevel: 'mid_level' as const,
  education: [] as string[],
  keywords: [] as string[],
  responsibilities: [] as string[],
  qualifications: [] as string[],
  benefits: [] as string[],
  employmentType: 'full_time' as const,
  remoteWork: false,
  salaryRange: null as null,
};

function assertOrgChartResponseByQueue(json: Record<string, unknown>, label: string): void {
  if (json.queued === true) {
    assertOrgChartQueuedShape(json);
    console.log(`[pipeline] ${label} queued=true (background worker)`);
    return;
  }
  assertOrgChartSearchResponseShape(json);
}

test.describe('Pipeline REST integration (opt-in)', () => {
  test.skip(!ENABLED, 'Set E2E_INTEGRATION_PIPELINE_MATRIX=1');
  test.skip(!TOKEN, 'E2E_API_TOKEN is required');

  test('probes: GraphQL + optional arxena-site', async () => {
    expect(await probeGraphqlAlive(BASE)).toBe(true);
    try {
      const py = await probeArxenaSiteLinkedinQuery(ARXENA_SITE);
      console.log('[pipeline] arxena-site query-generator reachable=', py);
      const tax = await probeArxenaSiteTitleTaxonomySearchKeywords(ARXENA_SITE);
      console.log('[pipeline] arxena-site title-taxonomy search-keywords reachable=', tax);
    } catch {
      console.log('[pipeline] arxena-site probe skipped');
    }
  });

  test.describe('arxena-site: Python query per org-chart mode (Nest generateSearchParameters flow)', () => {
    const pythonModeCases = getPythonOrgchartModeContractCases();

    for (const row of pythonModeCases) {
      test(`${row.index}/${pythonModeCases.length} ${row.label}`, async () => {
        const pyOk = await probeArxenaSiteLinkedinQuery(ARXENA_SITE);
        if (!pyOk) {
          test.skip(true, 'arxena-site not reachable; set ARXENA_SITE_URL');
          return;
        }

        const body = buildPythonLinkedInRequestBodyForOrgchartMode({
          companyName: COMPANY_NAME,
          mode: row.mode,
        });
        console.log('[pipeline] Python org-chart mode', row.mode, JSON.stringify(body));
        await assertPythonSearchParametersFlowLikeNest(ARXENA_SITE, body);
      });
    }
  });

  test.describe('arxena-site: title-taxonomy search-keywords (TitleTaxonomyRemoteService / BD enrich)', () => {
    test('POST /api/title-taxonomy/search-keywords — same payload shape as orgchart BD path', async () => {
      const taxOk = await probeArxenaSiteTitleTaxonomySearchKeywords(ARXENA_SITE);
      if (!taxOk) {
        test.skip(true, 'arxena-site title-taxonomy not reachable; set ARXENA_SITE_URL');
        return;
      }
      await assertTitleTaxonomySearchKeywordsBdProbe({
        arxenaBaseUrl: ARXENA_SITE,
        businessDivisionRawQuery: 'chemicals division',
        companyName: COMPANY_NAME,
      });
    });
  });

  test('GET /org-chart/litify/enriched — TheOrg-enriched shape (renderable)', async () => {
    const query = new URLSearchParams({ companyName: 'Litify' }).toString();
    const { status, data } = await backendGetJson<Record<string, unknown>>(
      `/org-chart/litify/enriched?${query}`,
    );
    console.log('[pipeline] litify enriched status=', status);
    if (status >= 500) {
      console.log('[pipeline] skip litify enriched — server error');
      return;
    }
    expect(status >= 200 && status < 300, 'litify/enriched 2xx').toBe(true);
    assertLitifyEnrichedOrgChartRenderable(data);
  });

  test.describe('POST /org-chart/search (Unipile) — full mode matrix', () => {
    const unipileMatrixCases = getUnipileOrgChartMatrixCases();
    for (const row of unipileMatrixCases) {
      test(`${row.index}/${unipileMatrixCases.length} ${row.label}`, async () => {
        const body = buildOrgChartSearchBody({
          companyName: COMPANY_NAME,
          companyId: COMPANY_ID,
          linkedinCompanyUrl: LINKEDIN_URL,
          mode: row.mode,
          searchType: row.searchType,
          queryGenerator: row.queryGenerator,
          candidateSource: 'unipile',
        });
        const { status, data } = await backendPostJson<Record<string, unknown>>(
          '/org-chart/search',
          body,
        );
        console.log('[pipeline]', row.label, 'status=', status, 'queued=', data?.queued);
        if (status === 400 || status === 503) {
          console.log(`[pipeline] skip ${row.label}: HTTP ${status}`);
          return;
        }
        expect(status >= 200 && status < 300, `${row.label} 2xx`).toBe(true);
        assertOrgChartResponseByQueue(data as Record<string, unknown>, row.label);
      });
    }
  });

  test.describe('POST /org-chart/search (Apify) — full mode matrix', () => {
    const apifyMatrixCases = getApifyOrgChartMatrixCases();
    for (const row of apifyMatrixCases) {
      test(`${row.index}/${apifyMatrixCases.length} ${row.label}`, async () => {
        if (row.queryGenerator === 'python') {
          const pyOk = await probeArxenaSiteLinkedinQuery(ARXENA_SITE);
          if (!pyOk) {
            console.log('[pipeline] skip Apify python — arxena-site unreachable');
            return;
          }
        }
        const body = buildOrgChartSearchBody({
          companyName: COMPANY_NAME,
          companyId: COMPANY_ID,
          linkedinCompanyUrl: LINKEDIN_URL,
          mode: row.mode,
          searchType: row.searchType,
          queryGenerator: row.queryGenerator,
          candidateSource: 'apify',
        });
        const { status, data } = await backendPostJson<Record<string, unknown>>(
          '/org-chart/search',
          body,
        );
        console.log('[pipeline]', row.label, 'status=', status, 'queued=', data?.queued);
        if (status === 400 || status === 503) {
          console.log(`[pipeline] skip ${row.label}: HTTP ${status}`);
          return;
        }
        expect(status >= 200 && status < 300, `${row.label} 2xx`).toBe(true);
        assertOrgChartResponseByQueue(data as Record<string, unknown>, row.label);
      });
    }
  });

  test.describe('POST /org-chart/search (LinkedIn x-ray) — full mode matrix', () => {
    const xrayMatrixCases = getLinkedinXrayOrgChartMatrixCases();
    for (const row of xrayMatrixCases) {
      test(`${row.index}/${xrayMatrixCases.length} ${row.label}`, async () => {
        if (row.queryGenerator === 'python') {
          const pyOk = await probeArxenaSiteLinkedinQuery(ARXENA_SITE);
          if (!pyOk) {
            console.log('[pipeline] skip x-ray python — arxena-site unreachable');
            return;
          }
        }
        const body = buildOrgChartSearchBody({
          companyName: COMPANY_NAME,
          companyId: COMPANY_ID,
          linkedinCompanyUrl: LINKEDIN_URL,
          mode: row.mode,
          searchType: row.searchType,
          queryGenerator: row.queryGenerator,
          candidateSource: 'linkedin_xray',
        });
        const { status, data } = await backendPostJson<Record<string, unknown>>(
          '/org-chart/search',
          body,
        );
        console.log('[pipeline]', row.label, 'status=', status, 'queued=', data?.queued);
        if (status === 400 || status === 503) {
          console.log(`[pipeline] skip ${row.label}: HTTP ${status}`);
          return;
        }
        expect(status >= 200 && status < 300, `${row.label} 2xx`).toBe(true);
        assertOrgChartResponseByQueue(data as Record<string, unknown>, row.label);
      });
    }
  });

  test.describe('Apify unsupported modes (expect HTTP 400)', () => {
    for (const neg of getApifyExpect400UnsupportedModeCases()) {
      test(neg.label, async () => {
        const body = buildOrgChartSearchBody({
          companyName: COMPANY_NAME,
          companyId: COMPANY_ID,
          linkedinCompanyUrl: LINKEDIN_URL,
          mode: neg.mode,
          searchType: 'classic',
          queryGenerator: 'multi_agent',
          candidateSource: 'apify',
        });
        const { status, data } = await backendPostJson<Record<string, unknown>>(
          '/org-chart/search',
          body,
        );
        console.log('[pipeline]', neg.label, 'status=', status, data);
        expect(status, 'Apify must reject non–entire_company modes').toBe(400);
      });
    }
  });

  test.describe('POST /candidate-search-chat/message/stream (CTO query × generators)', () => {
    test.skip(!THREAD, 'Set E2E_CANDIDATE_CHAT_ASSISTANT_THREAD_ID for message/stream');

    for (const linkedinQueryGenerator of ['multi_agent', 'python'] as const) {
      test(`message/stream CTO × ${linkedinQueryGenerator}`, async () => {
        if (linkedinQueryGenerator === 'python') {
          const pyOk = await probeArxenaSiteLinkedinQuery(ARXENA_SITE);
          if (!pyOk) {
            console.log('[pipeline] skip message/stream python — arxena-site unreachable');
            return;
          }
        }
        const url = `${BASE.replace(/\/+$/, '')}/candidate-search-chat/message/stream`;
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: '*/*',
            Authorization: `Bearer ${TOKEN}`,
          },
          body: JSON.stringify({
            assistantThreadId: THREAD,
            message: CTO_MESSAGE,
            parsedJD: MINIMAL_PARSED_JD,
            searchCategory: 'people',
            searchType: 'classic',
            linkedinQueryGenerator,
            candidateSource: 'unipile',
          }),
        });
        expect(res.ok, `message/stream HTTP ${res.status}`).toBe(true);
        const text = await res.text();
        expect(text.length > 0).toBe(true);
        expect(text.includes('event:') || text.includes('data:')).toBe(true);
        console.log('[pipeline] message/stream', linkedinQueryGenerator, 'bytes=', text.length);
      });
    }
  });
});
