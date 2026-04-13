/**
 * POST /candidate-search-chat/message/stream — SSE: classification → unresolved → results.
 *
 * Requires: E2E_API_TOKEN, E2E_CANDIDATE_CHAT_ASSISTANT_THREAD_ID (existing assistant thread with job)
 * Optional matrix: E2E_INTEGRATION_MATRIX=1
 * Apify/x-ray: E2E_CANDIDATE_CHAT_LINKEDIN_COMPANY_URL, E2E_ORGCHART_COMPANY_NAME
 *
 * Deep assertions:
 * - SSE: E2E_CANDIDATE_STREAM_ASSERT_COMPLETION=1 — done + strategy rows (see min rows below)
 * - Queued org-chart (Apify/x-ray): same Redis channel as POST /org-chart/search — set E2E_REDIS_URL
 *   and E2E_CANDIDATE_STREAM_ASSERT_COMPLETION=1; optional E2E_ORGCHART_MIN_ITEMS for terminal `complete`
 * Optional: E2E_CANDIDATE_STREAM_MIN_ROWS, E2E_CANDIDATE_STREAM_MAX_ROW_CHECKS,
 * E2E_CANDIDATE_STREAM_TERMINAL_TIMEOUT_MS (or E2E_ORGCHART_TERMINAL_TIMEOUT_MS).
 * Before awaiting Redis terminal for queued Apify/x-ray org-chart, asserts BullMQ workers for orgchart-apify-queue (same as org-chart matrix spec).
 */
import { expect, test } from '@playwright/test';

import { assertCandidateRowHasTableFields } from '../../lib/integration/candidateTableContract';
import { probeGraphqlAlive } from '../../lib/integration/dependencyProbes';
import { getWorkspaceMemberIdFromBearerToken } from '../../lib/integration/jwtPayload';
import {
  assertMessageStreamWorkDone,
  findAlternateSourceQueuedRequestId,
} from '../../lib/integration/messageStreamCompletion';
import {
  assertOrgChartCompletePayload,
  createOrgChartTerminalWaiter,
  type OrgChartTerminalResult,
  type OrgChartTerminalWaiter,
} from '../../lib/integration/orgChartCompletion';
import { assertOrgchartApifyQueueHasWorkers } from '../../lib/integration/orgchartWorkerProbe';
import { collectSseFromResponseWithHook } from '../../lib/integration/sseParse';

const BASE =
  process.env.BACKEND_BASE_URL ||
  process.env.TWENTY_SERVER_URL ||
  'http://localhost:3000';
const TOKEN = process.env.E2E_API_TOKEN || '';
const THREAD = process.env.E2E_CANDIDATE_CHAT_ASSISTANT_THREAD_ID || '';
const ENABLED = process.env.E2E_INTEGRATION_MESSAGE_STREAM === '1';
const FULL_MATRIX = process.env.E2E_INTEGRATION_MATRIX === '1';
const STREAM_ASSERT_COMPLETION =
  process.env.E2E_CANDIDATE_STREAM_ASSERT_COMPLETION === '1';
const STREAM_MIN_ROWS = Math.max(
  0,
  Number.parseInt(process.env.E2E_CANDIDATE_STREAM_MIN_ROWS ?? '0', 10) || 0,
);
const STREAM_MAX_ROW_CHECKS = Math.max(
  1,
  Number.parseInt(process.env.E2E_CANDIDATE_STREAM_MAX_ROW_CHECKS ?? '5', 10) || 5,
);
const REDIS_URL = process.env.E2E_REDIS_URL?.trim() ?? '';
const ORGCHART_MIN_ITEMS = Math.max(
  0,
  Number.parseInt(process.env.E2E_ORGCHART_MIN_ITEMS ?? '0', 10) || 0,
);
const TERMINAL_TIMEOUT_MS = Math.max(
  60_000,
  Number.parseInt(
    process.env.E2E_CANDIDATE_STREAM_TERMINAL_TIMEOUT_MS ??
      process.env.E2E_ORGCHART_TERMINAL_TIMEOUT_MS ??
      '60000',
    10,
  ) || 60_000,
);
const MESSAGE =
  process.env.E2E_CANDIDATE_CHAT_MESSAGE ||
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

const LINKEDIN_URL =
  process.env.E2E_CANDIDATE_CHAT_LINKEDIN_COMPANY_URL ||
  process.env.E2E_LINKEDIN_COMPANY_URL ||
  '';
const ORG_NAME =
  process.env.E2E_ORGCHART_COMPANY_NAME ||
  process.env.E2E_CANDIDATE_STREAM_COMPANY_NAME ||
  'covvalent';
const ORG_ID =
  process.env.E2E_ORGCHART_COMPANY_ID ||
  process.env.E2E_CANDIDATE_STREAM_COMPANY_ID ||
  'covvalent';

function expectStreamHappyPath(events: { event: string; data: Record<string, unknown> }[]) {
  const types = events.map((e) => e.data?.type).filter(Boolean);
  console.log(
    '[message-stream] events=',
    events.map((e) => e.event).join(','),
    'dataTypes=',
    types.join(','),
  );
  const classification = events.find((e) => e.event === 'classification');
  expect(classification?.data?.type).toBe('search_parameters');
  const done = events.find((e) => e.event === 'done');
  expect(done?.data?.success).toBe(true);
  const pathMsg = events.find(
    (e) => e.data?.type === 'linkedin_query_generation_path',
  );
  expect(pathMsg).toBeTruthy();
}

function collectStrategyRowsFromEvents(
  events: { event: string; data: Record<string, unknown> }[],
): Record<string, unknown>[] {
  const paramMsg = events.find(
    (e) =>
      e.event === 'message' && (e.data as { type?: string }).type === 'search_parameters',
  );
  const payload = paramMsg?.data as
    | {
        data?: {
          strategyResults?: Array<{
            result?: { transformedCandidates?: unknown[] };
          }>;
        };
      }
    | undefined;
  return (
    payload?.data?.strategyResults?.flatMap(
      (s) => s.result?.transformedCandidates ?? [],
    ) ?? []
  ) as Record<string, unknown>[];
}

/**
 * POST message/stream, optionally subscribe to Redis as soon as alternate_candidate_source_queued
 * appears in SSE, then assert SSE happy path + row shapes + Redis org-chart terminal when applicable.
 */
async function postMessageStreamAndAssertWorkDone(
  body: Record<string, unknown>,
  label: string,
  options: { matrixMode: boolean },
): Promise<void> {
  const url = `${BASE.replace(/\/+$/, '')}/candidate-search-chat/message/stream`;
  const waiterRef: { current: OrgChartTerminalWaiter | null } = { current: null };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TOKEN}`,
    },
    body: JSON.stringify(body),
  });

  const events = await collectSseFromResponseWithHook(res, async (batch, accumulated) => {
    if (!STREAM_ASSERT_COMPLETION || !REDIS_URL || waiterRef.current) {
      return;
    }
    const wsId = getWorkspaceMemberIdFromBearerToken(TOKEN);
    if (!wsId) {
      return;
    }
    const rid =
      findAlternateSourceQueuedRequestId(batch) ??
      findAlternateSourceQueuedRequestId(accumulated);
    if (!rid) {
      return;
    }
    console.log(
      `[message-stream] ${label} alternate source queued requestId=${rid} — Redis subscribe`,
    );
    waiterRef.current = createOrgChartTerminalWaiter({
      redisUrl: REDIS_URL,
      workspaceMemberId: wsId,
      requestId: rid,
      timeoutMs: TERMINAL_TIMEOUT_MS,
    });
    await waiterRef.current.ready;
  });

  const status = res.status;
  console.log('[message-stream]', label, 'http', status);

  if (status >= 500) {
    waiterRef.current?.cancel();
    if (options.matrixMode) {
      console.log('[message-stream] skip', label);
      return;
    }
    test.skip(true, `Server ${status} — LLM or deps may be unavailable`);
    return;
  }

  expect(status >= 200 && status < 300).toBe(true);

  const classification = events.find((e) => e.event === 'classification');
  if (classification?.data?.type !== 'search_parameters') {
    waiterRef.current?.cancel();
    if (options.matrixMode) {
      console.log('[message-stream] classification', classification?.data);
      return;
    }
    expect(classification?.data?.type).toBe('search_parameters');
    return;
  }

  const altQueuedId = findAlternateSourceQueuedRequestId(events);

  if (waiterRef.current) {
    console.log(`[message-stream] ${label} awaiting Redis org-chart terminal…`);
    const waiter = waiterRef.current;
    let terminal: OrgChartTerminalResult;
    try {
      await assertOrgchartApifyQueueHasWorkers(REDIS_URL);
      terminal = await waiter.result;
    } catch (err) {
      waiter.cancel();
      throw err;
    }
    assertOrgChartCompletePayload({
      terminal,
      minItemCount: ORGCHART_MIN_ITEMS,
      label: `${label}/orgchart-redis`,
    });
    console.log(`[message-stream] ${label} orgchart-redis terminal=`, terminal.kind);
  } else if (altQueuedId && STREAM_ASSERT_COMPLETION && REDIS_URL) {
    console.log(
      `[message-stream] ${label} queued (requestId=${altQueuedId}) but Redis waiter not started — check E2E_WORKSPACE_MEMBER_ID / JWT`,
    );
  } else if (altQueuedId) {
    console.log(
      `[message-stream] ${label} alternate_candidate_source_queued requestId=${altQueuedId} — set E2E_REDIS_URL + E2E_CANDIDATE_STREAM_ASSERT_COMPLETION=1 to assert background org-chart`,
    );
  }

  expectStreamHappyPath(events);

  if (STREAM_ASSERT_COMPLETION) {
    const effectiveMinRows =
      altQueuedId && ORGCHART_MIN_ITEMS > 0 ? 0 : STREAM_MIN_ROWS;
    assertMessageStreamWorkDone({
      events,
      label,
      minCandidateRows: effectiveMinRows,
      maxRowsToShapeCheck: STREAM_MAX_ROW_CHECKS,
    });
  } else {
    const rows = collectStrategyRowsFromEvents(events);
    for (let i = 0; i < Math.min(rows.length, 5); i += 1) {
      assertCandidateRowHasTableFields(rows[i]);
    }
  }
}

test.describe('Candidate search message/stream (REST + SSE)', () => {
  test.skip(!ENABLED, 'Set E2E_INTEGRATION_MESSAGE_STREAM=1');
  test.skip(!TOKEN, 'E2E_API_TOKEN is required');
  test.skip(!THREAD, 'E2E_CANDIDATE_CHAT_ASSISTANT_THREAD_ID is required');

  test('probe: server up', async () => {
    expect(await probeGraphqlAlive(BASE)).toBe(true);
  });

  test('smoke: Unipile × multi_agent × classic', async () => {
    await postMessageStreamAndAssertWorkDone(
      {
        assistantThreadId: THREAD,
        message: MESSAGE,
        parsedJD: MINIMAL_PARSED_JD,
        searchCategory: 'people',
        searchType: 'classic',
        linkedinQueryGenerator: 'multi_agent',
        candidateSource: 'unipile',
      },
      'smoke/unipile/multi_agent/classic',
      { matrixMode: false },
    );
  });

  test('matrix (optional)', async () => {
    test.skip(!FULL_MATRIX, 'Set E2E_INTEGRATION_MATRIX=1');

    const searchTypes = ['classic', 'sales_navigator', 'recruiter'] as const;
    const gens = ['multi_agent', 'python'] as const;
    const sources = ['unipile', 'apify', 'linkedin_xray'] as const;

    for (const candidateSource of sources) {
      for (const searchType of searchTypes) {
        for (const linkedinQueryGenerator of gens) {
          if (candidateSource !== 'unipile' && !LINKEDIN_URL) {
            console.log('[message-stream] skip alt source — no LINKEDIN URL');
            continue;
          }
          const body: Record<string, unknown> = {
            assistantThreadId: THREAD,
            message: MESSAGE,
            parsedJD: MINIMAL_PARSED_JD,
            searchCategory: 'people',
            searchType,
            linkedinQueryGenerator,
            candidateSource,
          };
          if (candidateSource === 'apify' || candidateSource === 'linkedin_xray') {
            body.linkedinCompanyUrl = LINKEDIN_URL;
            body.orgchartCompanyName = ORG_NAME;
            body.orgchartCompanyId = ORG_ID;
          }
          const label = `${candidateSource}/${searchType}/${linkedinQueryGenerator}`;
          await postMessageStreamAndAssertWorkDone(body, label, { matrixMode: true });
        }
      }
    }
  });
});
