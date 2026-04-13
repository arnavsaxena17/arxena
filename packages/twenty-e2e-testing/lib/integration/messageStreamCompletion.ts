import type { SseEventRecord } from './sseParse';

import { assertCandidateRowHasTableFields } from './candidateTableContract';

export function findAlternateSourceQueuedRequestId(
  events: SseEventRecord[],
): string | null {
  for (const e of events) {
    if (e.event !== 'message') {
      continue;
    }
    const d = e.data as { type?: string; requestId?: unknown };
    if (
      d.type === 'alternate_candidate_source_queued' &&
      typeof d.requestId === 'string' &&
      d.requestId.length > 0
    ) {
      return d.requestId;
    }
  }
  return null;
}

/**
 * When SSE stream finishes successfully, optionally require minimum candidate rows
 * (people search + org-chart-related payloads in strategyResults).
 * When Apify/x-ray queued the org-chart job, strategy rows may be empty in the same stream —
 * pass minCandidateRows 0 and assert counts via Redis org-chart terminal (see integration spec).
 */
export function assertMessageStreamWorkDone(args: {
  events: SseEventRecord[];
  label: string;
  minCandidateRows: number;
  maxRowsToShapeCheck: number;
}): void {
  const { events, label, minCandidateRows, maxRowsToShapeCheck } = args;
  const done = events.find((e) => e.event === 'done');
  if (done?.data?.success !== true) {
    throw new Error(
      `[${label}] SSE done missing or success!==true: ${JSON.stringify(done?.data)}`,
    );
  }

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

  const rows =
    payload?.data?.strategyResults?.flatMap(
      (s) => s.result?.transformedCandidates ?? [],
    ) ?? [];

  if (minCandidateRows > 0 && rows.length < minCandidateRows) {
    throw new Error(
      `[${label}] expected at least ${minCandidateRows} candidate rows from strategyResults, got ${rows.length}`,
    );
  }

  const n = Math.min(rows.length, maxRowsToShapeCheck);
  for (let i = 0; i < n; i += 1) {
    assertCandidateRowHasTableFields(rows[i] as Record<string, unknown>);
  }
}
