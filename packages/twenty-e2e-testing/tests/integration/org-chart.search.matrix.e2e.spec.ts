/**
 * POST /org-chart/search matrix (Unipile / Apify / X-ray × modes × generators).
 *
 * Requires: E2E_API_TOKEN, TWENTY_SERVER_URL
 * Full matrix: E2E_INTEGRATION_MATRIX=1
 * Covvalent defaults: E2E_ORGCHART_COMPANY_NAME, E2E_ORGCHART_COMPANY_ID, E2E_LINKEDIN_COMPANY_URL
 * Optional arxena-site: POST /api/title-taxonomy/search-keywords (business_division_map enrichment contract).
 *   twenty-server calls this only for business_division_map when queryGenerator=python (not asserted here).
 *
 * End-to-end completion (queued jobs): set E2E_ORGCHART_ASSERT_COMPLETION=1 and E2E_REDIS_URL (same Redis as twenty-server).
 * Workspace member id is read from JWT or E2E_WORKSPACE_MEMBER_ID. Optional: E2E_ORGCHART_MIN_ITEMS, E2E_ORGCHART_TERMINAL_TIMEOUT_MS.
 * Queued-job waits: asserts BullMQ getWorkersCount>0 for orgchart-apify-queue on E2E_REDIS_URL before awaiting Redis terminal events.
 *
 * Full matrix defaults to strict: HTTP 4xx/5xx and queued-without-terminal are failures. Set E2E_ORGCHART_MATRIX_RELAXED=1 to
 * restore HTTP-only acceptance (201 queued passes without waiting). Smoke test stays relaxed unless you use strict matrix envs.
 *
 * Nx (repo root): yarn nx run twenty-e2e-testing:test:integration-rest
 */
import { expect, test } from '@playwright/test';

import { backendPostJson } from '../../lib/integration/backendClient';
import {
    probeArxenaSiteLinkedinQuery,
    probeArxenaSiteTitleTaxonomySearchKeywords,
    probeGraphqlAlive,
} from '../../lib/integration/dependencyProbes';
import { getWorkspaceMemberIdFromBearerToken } from '../../lib/integration/jwtPayload';
import {
    assertOrgChartCompletePayload,
    createOrgChartTerminalWaiter,
    type OrgChartTerminalResult,
} from '../../lib/integration/orgChartCompletion';
import {
    assertOrgChartQueuedShape,
    assertOrgChartSearchResponseShape,
} from '../../lib/integration/orgChartContracts';
import { assertOrgchartApifyQueueHasWorkers } from '../../lib/integration/orgchartWorkerProbe';
import { assertTitleTaxonomySearchKeywordsBdProbe } from '../../lib/integration/titleTaxonomySearchKeywordsContract';

const BASE =
  process.env.BACKEND_BASE_URL ||
  process.env.TWENTY_SERVER_URL ||
  'http://localhost:3000';
const TOKEN = process.env.E2E_API_TOKEN || '';
const FULL_MATRIX = process.env.E2E_INTEGRATION_MATRIX === '1';

const COMPANY_NAME =
  process.env.E2E_ORGCHART_COMPANY_NAME || 'covvalent';
const COMPANY_ID = process.env.E2E_ORGCHART_COMPANY_ID || 'covvalent';
const LINKEDIN_URL =
  process.env.E2E_LINKEDIN_COMPANY_URL ||
  'https://www.linkedin.com/company/covvalent/';
const ARXENA_SITE =
  process.env.ARXENA_SITE_URL || 'http://localhost:5050';

const ASSERT_COMPLETION = process.env.E2E_ORGCHART_ASSERT_COMPLETION === '1';
const REDIS_URL = process.env.E2E_REDIS_URL?.trim() ?? '';
const MIN_ITEMS = Math.max(
  0,
  Number.parseInt(process.env.E2E_ORGCHART_MIN_ITEMS ?? '0', 10) || 0,
);
const TERMINAL_TIMEOUT_MS = Math.max(
  60_000,
  Number.parseInt(process.env.E2E_ORGCHART_TERMINAL_TIMEOUT_MS ?? '60000', 10) ||
    60_000,
);

/** Full matrix: fail on error responses and on queued jobs that never reach a Redis terminal (unless relaxed). */
const MATRIX_RELAXED = process.env.E2E_ORGCHART_MATRIX_RELAXED === '1';

type Mode =
  | 'current_node'
  | 'leadership'
  | 'entire_company'
  | 'function_grade'
  | 'business_division_map'
  | 'selected_nodes';

function buildBody(args: {
  mode: Mode;
  searchType: 'classic' | 'sales_navigator' | 'recruiter';
  queryGenerator: 'python' | 'multi_agent';
  candidateSource: 'unipile' | 'apify' | 'linkedin_xray';
  requestId?: string;
}): Record<string, unknown> {
  const requestId =
    args.requestId?.trim() ||
    `orgchart-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const base: Record<string, unknown> = {
    rawQuery: `Find all people currently working at ${COMPANY_NAME}.`,
    cleanedQuery: `Find all people currently working at ${COMPANY_NAME}.`,
    companyName: COMPANY_NAME,
    companyId: COMPANY_ID,
    jobTitles: [] as string[],
    mode: args.mode,
    searchType: args.searchType,
    requestId,
    country: 'global',
    functionRoot:
      args.mode === 'function_grade'
        ? 'human resources'
        : args.mode === 'entire_company'
          ? 'fullcompany'
          : 'human resources',
    candidateSource: args.candidateSource,
    linkedinCompanyUrl: LINKEDIN_URL,
    queryGenerator: args.queryGenerator,
  };

  if (args.mode === 'business_division_map') {
    base.rawQuery = `Map business division at ${COMPANY_NAME}. User request: chemicals division`;
    base.cleanedQuery = base.rawQuery;
    base.businessDivisionRawQuery = 'chemicals division';
    base.functionRoot = 'human resources';
  }

  if (args.mode === 'function_grade') {
    base.rawQuery = `Find people at ${COMPANY_NAME} in similar functions and seniority.`;
    base.cleanedQuery = base.rawQuery;
    base.functionRoot = 'human resources';
  }

  if (args.mode === 'current_node') {
    base.rawQuery = `Find people in the same position at ${COMPANY_NAME}. Key titles: Manufacturing AVP.`;
    base.cleanedQuery = base.rawQuery;
    base.jobTitles = ['Manufacturing AVP'];
    base.functionRoot = 'human resources';
  }

  if (args.mode === 'leadership') {
    base.rawQuery = `Find leadership roles at ${COMPANY_NAME}.`;
    base.cleanedQuery = base.rawQuery;
  }

  if (args.mode === 'selected_nodes') {
    base.rawQuery = `Find people for the selected nodes at ${COMPANY_NAME}.`;
    base.cleanedQuery = base.rawQuery;
    base.jobTitles = ['Manufacturing AVP'];
  }

  if (args.candidateSource === 'linkedin_xray') {
    base.xraySearchEngine = process.env.E2E_XRAY_SEARCH_ENGINE || 'google';
  }

  if (args.candidateSource === 'apify') {
    base.apifyMaxItems = Number(process.env.E2E_APIFY_MAX_ITEMS || 50);
  }

  return base;
}

type PostOrgChartStrictness = {
  /**
   * When true: non-2xx fails; queued responses must await Redis terminal (strict matrix) or throw if completion cannot be waited on.
   */
  strict: boolean;
};

async function postOrgChartSearchAndAssertWorkDone(
  label: string,
  body: Record<string, unknown>,
  strictness: PostOrgChartStrictness,
): Promise<void> {
  const { strict } = strictness;
  const requestId = typeof body.requestId === 'string' ? body.requestId : '';

  const workspaceMemberId = ASSERT_COMPLETION
    ? getWorkspaceMemberIdFromBearerToken(TOKEN)
    : null;
  const useRedisWait =
    ASSERT_COMPLETION &&
    Boolean(REDIS_URL) &&
    Boolean(workspaceMemberId) &&
    Boolean(requestId);

  let waiter: ReturnType<typeof createOrgChartTerminalWaiter> | null = null;
  if (useRedisWait) {
    waiter = createOrgChartTerminalWaiter({
      redisUrl: REDIS_URL,
      workspaceMemberId: workspaceMemberId as string,
      requestId,
      timeoutMs: TERMINAL_TIMEOUT_MS,
    });
    await waiter.ready;
  }

  const { status, data: json } = await backendPostJson<Record<string, unknown>>(
    '/org-chart/search',
    body,
  );
  console.log('[orgchart-matrix]', label, 'status=', status, 'queued=', json?.queued);
  if (status === 503 || status === 400 || status === 401) {
    waiter?.cancel();
    if (strict) {
      throw new Error(
        `[${label}] unexpected HTTP ${status}: ${JSON.stringify(json)}`,
      );
    }
    console.log('[orgchart-matrix] skip', label, json);
    return;
  }
  expect(status >= 200 && status < 300).toBe(true);

  if (json.queued === true) {
    assertOrgChartQueuedShape(json);
    if (strict) {
      if (!ASSERT_COMPLETION) {
        waiter?.cancel();
        throw new Error(
          `[${label}] strict matrix: got queued=true — set E2E_ORGCHART_ASSERT_COMPLETION=1 and E2E_REDIS_URL (or E2E_ORGCHART_MATRIX_RELAXED=1 for HTTP-only).`,
        );
      }
      if (!REDIS_URL) {
        waiter?.cancel();
        throw new Error(
          `[${label}] strict matrix: E2E_ORGCHART_ASSERT_COMPLETION=1 but E2E_REDIS_URL is missing`,
        );
      }
      if (!workspaceMemberId) {
        waiter?.cancel();
        throw new Error(
          `[${label}] strict matrix: cannot resolve workspace member id from token (set E2E_WORKSPACE_MEMBER_ID or a JWT with workspaceMemberId)`,
        );
      }
      if (!requestId) {
        waiter?.cancel();
        throw new Error(`[${label}] missing requestId on queued body`);
      }
      if (!waiter) {
        throw new Error(
          `[${label}] strict matrix: queued but Redis waiter was not created`,
        );
      }
      console.log(
        `[orgchart-matrix] awaiting Redis terminal event requestId=${requestId} timeoutMs=${TERMINAL_TIMEOUT_MS}`,
      );
      let terminal: OrgChartTerminalResult;
      try {
        await assertOrgchartApifyQueueHasWorkers(REDIS_URL);
        terminal = await waiter.result;
      } catch (err) {
        waiter.cancel();
        throw err;
      }
      assertOrgChartCompletePayload({ terminal, minItemCount: MIN_ITEMS, label });
      console.log(`[orgchart-matrix] ${label} terminal=`, terminal.kind);
      return;
    }
    if (!ASSERT_COMPLETION) {
      waiter?.cancel();
      return;
    }
    if (!REDIS_URL) {
      waiter?.cancel();
      console.log(
        '[orgchart-matrix] E2E_ORGCHART_ASSERT_COMPLETION=1 but E2E_REDIS_URL missing — cannot wait for worker terminal event',
      );
      return;
    }
    if (!workspaceMemberId) {
      waiter?.cancel();
      console.log(
        '[orgchart-matrix] cannot resolve workspace member id from E2E_API_TOKEN (set E2E_WORKSPACE_MEMBER_ID)',
      );
      return;
    }
    if (!requestId) {
      waiter?.cancel();
      throw new Error(`[${label}] missing requestId on queued body`);
    }
    if (!waiter) {
      console.log(
        `[${label}] queued — cannot await terminal (set E2E_REDIS_URL + E2E_WORKSPACE_MEMBER_ID or JWT workspaceMemberId)`,
      );
      return;
    }
    console.log(
      `[orgchart-matrix] awaiting Redis terminal event requestId=${requestId} timeoutMs=${TERMINAL_TIMEOUT_MS}`,
    );
    let terminal: OrgChartTerminalResult;
    try {
      await assertOrgchartApifyQueueHasWorkers(REDIS_URL);
      terminal = await waiter.result;
    } catch (err) {
      waiter.cancel();
      throw err;
    }
    assertOrgChartCompletePayload({ terminal, minItemCount: MIN_ITEMS, label });
    console.log(`[orgchart-matrix] ${label} terminal=`, terminal.kind);
    return;
  }

  waiter?.cancel();
  assertOrgChartSearchResponseShape(json);
  if (!ASSERT_COMPLETION) {
    return;
  }
  const itemCount = json.itemCount;
  if (typeof itemCount !== 'number' || itemCount < MIN_ITEMS) {
    throw new Error(
      `[${label}] sync response: expected itemCount >= ${MIN_ITEMS}, got ${String(itemCount)}`,
    );
  }
  const orgErr = json.orgChartError;
  if (typeof orgErr === 'string' && orgErr.length > 0) {
    console.log(`[orgchart-matrix] ${label} orgChartError (soft):`, orgErr);
  }
  const items = json.items;
  if (!Array.isArray(items)) {
    throw new Error(`[${label}] sync response: items must be an array`);
  }
  if (items.length < MIN_ITEMS) {
    throw new Error(
      `[${label}] sync response: items.length ${items.length} < MIN_ITEMS ${MIN_ITEMS}`,
    );
  }
}

/**
 * Server rejects Apify for modes other than entire_company (see OrgChartLinkedInBuildService).
 */
async function assertApifyUnsupportedModeReturns400(
  label: string,
  body: Record<string, unknown>,
): Promise<void> {
  const { status, data: json } = await backendPostJson<Record<string, unknown>>(
    '/org-chart/search',
    body,
  );
  console.log('[orgchart-matrix]', label, 'expected 400 for Apify×mode, status=', status);
  if (status !== 400) {
    throw new Error(
      `[${label}] expected HTTP 400 (Apify only for entire_company), got ${status}: ${JSON.stringify(json)}`,
    );
  }
}

test.describe('Org-chart search matrix (REST)', () => {
  test.skip(!TOKEN, 'E2E_API_TOKEN is required');

  test('probe: GraphQL + optional Python site', async () => {
    const ok = await probeGraphqlAlive(BASE);
    expect(ok).toBe(true);
    try {
      const py = await probeArxenaSiteLinkedinQuery(ARXENA_SITE);
      console.log('[orgchart-matrix] arxena-site query-generator reachable=', py);
      const tax = await probeArxenaSiteTitleTaxonomySearchKeywords(ARXENA_SITE);
      console.log('[orgchart-matrix] arxena-site title-taxonomy search-keywords reachable=', tax);
    } catch {
      console.log('[orgchart-matrix] arxena-site probe skipped');
    }
  });

  test('arxena-site: title-taxonomy search-keywords (BD query + company; Nest TitleTaxonomyRemoteService contract)', async () => {
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

  test('smoke: Unipile entire_company classic multi_agent', async () => {
    const body = buildBody({
      mode: 'entire_company',
      searchType: 'classic',
      queryGenerator: 'multi_agent',
      candidateSource: 'unipile',
    });
    await postOrgChartSearchAndAssertWorkDone(
      'smoke/unipile/entire_company/classic/multi_agent',
      body,
      { strict: false },
    );
  });

  test('full matrix', async () => {
    test.skip(!FULL_MATRIX, 'Set E2E_INTEGRATION_MATRIX=1 for full matrix');

    const alive = await probeGraphqlAlive(BASE);
    expect(alive).toBe(true);

    const modes: Mode[] = [
      'current_node',
      'leadership',
      'entire_company',
      'function_grade',
      'business_division_map',
      'selected_nodes',
    ];
    const searchTypes: Array<'classic' | 'sales_navigator' | 'recruiter'> = [
      'classic',
      'sales_navigator',
      'recruiter',
    ];
    const generators: Array<'python' | 'multi_agent'> = ['multi_agent', 'python'];
    const sources: Array<'unipile' | 'apify' | 'linkedin_xray'> = [
      // 'unipile',
      'apify',
      'linkedin_xray',
    ];

    const matrixStrict = !MATRIX_RELAXED;

    for (const candidateSource of sources) {
      for (const mode of modes) {
        if (candidateSource === 'apify' && mode !== 'entire_company') {
          if (matrixStrict) {
            const body = buildBody({
              mode,
              searchType: 'classic',
              queryGenerator: 'multi_agent',
              candidateSource,
            });
            await assertApifyUnsupportedModeReturns400(
              `apify/${mode}/unsupported`,
              body,
            );
          } else {
            console.log('[orgchart-matrix] skip Apify ×', mode);
          }
          continue;
        }
        for (const searchType of searchTypes) {
          if (candidateSource !== 'unipile' && searchType !== 'classic') {
            continue;
          }
          for (const queryGenerator of generators) {
            if (candidateSource !== 'unipile' && queryGenerator === 'python') {
              const pyOk = await probeArxenaSiteLinkedinQuery(ARXENA_SITE);
              if (!pyOk) {
                if (matrixStrict) {
                  throw new Error(
                    `[orgchart-matrix] strict matrix: arxena-site query-generator not reachable at ${ARXENA_SITE} (python path required)`,
                  );
                }
                console.log('[orgchart-matrix] skip python — arxena-site down');
                continue;
              }
            }
            const body = buildBody({
              mode,
              searchType,
              queryGenerator,
              candidateSource,
            });
            const label = `${candidateSource}/${mode}/${searchType}/${queryGenerator}`;
            await postOrgChartSearchAndAssertWorkDone(label, body, {
              strict: matrixStrict,
            });
          }
        }
      }
    }
  });
});
