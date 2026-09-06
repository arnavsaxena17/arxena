import axios from 'axios';

/**
 * Drives the seeded B/C path matrix to terminal stages using local mocks.
 *
 * Env:
 *   API_TOKEN (required)
 *   PROJECT_ID (default: latest fbf1… matrix from prior seed)
 *   SERVER_URL / SERVER_HOST
 */

const SERVER_URL = process.env.SERVER_URL || 'http://127.0.0.1:3000';
const SERVER_HOST = process.env.SERVER_HOST || 'arxena-4.localhost';
const GRAPHQL_URL = `${SERVER_URL}/graphql`;
const API_TOKEN = process.env.API_TOKEN;
const PROJECT_ID =
  process.env.PROJECT_ID || 'bd1aab15-03ef-4fdb-896e-44ada1041651';

type GraphQLResponse<T> = {
  data?: T;
  errors?: Array<{ message: string }>;
};

type CandidateRow = {
  id: string;
  name: string;
  outreachSequenceStage?: string | null;
  linkedinProfileId?: string | null;
};

type JourneyActiveRun = {
  workflowRunId: string;
  status: string;
  pendingStepId: string | null;
  pendingFormStepId: string | null;
  draftPreview: string | null;
  currentStepName: string | null;
  currentStepKind: string | null;
};

type Journey = {
  candidateId: string;
  outreachSequenceStage: string;
  activeRuns: JourneyActiveRun[];
  failedRuns: JourneyActiveRun[];
};

const SLUG_TO_KEY: Record<string, string> = {
  'test-alpha-anchor-bc-matrix': 'B-Alpha-anchor',
  'test-alpha-earlier-defer-bc-matrix': 'B-Alpha-earlier-defer',
  'test-alpha-contacted-defer-bc-matrix': 'B-Alpha-contacted-defer',
  'test-no-company-bc-matrix': 'B-no-company',
  'test-ignore-email-ok-bc-matrix': 'B-ignore-email-ok',
  'test-ignore-enrich-fail-bc-matrix': 'B-ignore-enrich-fail',
  'test-accept-silent-fu-bc-matrix': 'C-accept-silent-fu',
  'test-accept-reply-meeting-bc-matrix': 'C-accept-reply-meeting',
  'test-accept-reply-waitfail-bc-matrix': 'C-accept-reply-waitfail',
  'test-hitl-reject-opener-bc-matrix': 'C-hitl-reject-opener',
  'test-accept-fu1-then-reply-bc-matrix': 'C-accept-fu1-then-reply',
};

const EXPECTED_TERMINAL: Record<string, string[]> = {
  'B-Alpha-anchor': [
    'CONNECTION_SENT',
    'CONNECTION_ACCEPTED',
    'FAILED_NO_REPLY',
  ],
  'B-Alpha-earlier-defer': ['DEFERRED'],
  'B-Alpha-contacted-defer': ['DEFERRED'],
  'B-no-company': ['CONNECTION_SENT', 'EMAIL_SENT', 'FAILED_ENRICH'],
  'B-ignore-email-ok': ['EMAIL_SENT'],
  'B-ignore-enrich-fail': ['FAILED_ENRICH'],
  'C-accept-silent-fu': ['FAILED_NO_REPLY'],
  'C-accept-reply-meeting': ['WAITING_REPLY', 'MEETING_BOOKED', 'REPLIED'],
  'C-accept-reply-waitfail': ['FAILED_NO_REPLY', 'WAITING_REPLY', 'REPLIED'],
  'C-hitl-reject-opener': [
    'CONNECTION_ACCEPTED',
    'OPENER_DRAFTED',
    'CONNECTION_SENT',
  ],
  'C-accept-fu1-then-reply': ['WAITING_REPLY', 'REPLIED', 'MEETING_BOOKED'],
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const authHeaders = () => {
  if (!API_TOKEN) {
    throw new Error('API_TOKEN is required');
  }

  return {
    Authorization: `Bearer ${API_TOKEN}`,
    'Content-Type': 'application/json',
    Host: SERVER_HOST,
  };
};

const graphqlRequest = async <T>(
  query: string,
  variables: Record<string, unknown>,
): Promise<T> => {
  const response = await axios.post<GraphQLResponse<T>>(
    GRAPHQL_URL,
    { query, variables },
    { headers: authHeaders() },
  );

  if (response.data.errors?.length) {
    throw new Error(
      response.data.errors.map((error) => error.message).join('; '),
    );
  }

  if (!response.data.data) {
    throw new Error('GraphQL response missing data');
  }

  return response.data.data;
};

const restPost = async <T>(
  path: string,
  body?: Record<string, unknown>,
): Promise<T> => {
  const response = await axios.post<T>(`${SERVER_URL}${path}`, body ?? {}, {
    headers: authHeaders(),
    validateStatus: () => true,
  });

  if (response.status >= 400) {
    throw new Error(
      `POST ${path} → ${response.status}: ${JSON.stringify(response.data)}`,
    );
  }

  return response.data;
};

const listCandidates = async (): Promise<
  Array<CandidateRow & { key: string }>
> => {
  const data = await graphqlRequest<{
    candidates: { edges: Array<{ node: CandidateRow }> };
  }>(
    `query MatrixCandidates($filter: CandidateFilterInput!) {
      candidates(filter: $filter, first: 50) {
        edges {
          node {
            id
            name
            outreachSequenceStage
            linkedinProfileId
          }
        }
      }
    }`,
    { filter: { projectsId: { eq: PROJECT_ID } } },
  );

  return data.candidates.edges
    .map((edge) => edge.node)
    .filter((node) =>
      Boolean(node.linkedinProfileId && SLUG_TO_KEY[node.linkedinProfileId]),
    )
    .map((node) => ({
      ...node,
      key: SLUG_TO_KEY[node.linkedinProfileId as string],
    }));
};

const getStage = async (candidateId: string): Promise<string | null> => {
  const data = await graphqlRequest<{
    candidates: {
      edges: Array<{ node: { outreachSequenceStage?: string } }>;
    };
  }>(
    `query Stage($filter: CandidateFilterInput!) {
      candidates(filter: $filter, first: 1) {
        edges { node { outreachSequenceStage } }
      }
    }`,
    { filter: { id: { eq: candidateId } } },
  );

  return data.candidates.edges[0]?.node.outreachSequenceStage ?? null;
};

const getJourney = async (candidateId: string): Promise<Journey> => {
  const response = await axios.get<Journey>(
    `${SERVER_URL}/outreach-command/projects/${PROJECT_ID}/candidates/${candidateId}/journey`,
    { headers: authHeaders() },
  );

  return response.data;
};

const waitFor = async ({
  label,
  timeoutMs = 180_000,
  intervalMs = 2_500,
  predicate,
}: {
  label: string;
  timeoutMs?: number;
  intervalMs?: number;
  predicate: () => Promise<boolean>;
}) => {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (await predicate()) {
      return;
    }
    await sleep(intervalMs);
  }

  throw new Error(`Timeout waiting for ${label}`);
};

const waitForStage = async (
  candidateId: string,
  stages: string[],
  timeoutMs = 180_000,
) => {
  await waitFor({
    label: `stages ${stages.join('|')} for ${candidateId}`,
    timeoutMs,
    predicate: async () => {
      const stage = await getStage(candidateId);

      return Boolean(stage && stages.includes(stage));
    },
  });

  return getStage(candidateId);
};

const skipPendingDelay = async (candidateId: string): Promise<boolean> => {
  const journey = await getJourney(candidateId);
  const run = journey.activeRuns.find(
    (activeRun) =>
      Boolean(activeRun.pendingStepId) && !activeRun.pendingFormStepId,
  );

  if (!run?.pendingStepId) {
    return false;
  }

  await restPost(
    `/outreach-command/projects/${PROJECT_ID}/candidates/${candidateId}/skip-step`,
    {
      workflowRunId: run.workflowRunId,
      stepId: run.pendingStepId,
    },
  );

  console.log(
    `    skip delay step=${run.pendingStepId} (${run.currentStepName ?? run.currentStepKind})`,
  );

  return true;
};

const waitAndSkipDelays = async (
  candidateId: string,
  untilStages: string[],
  maxSkips = 8,
) => {
  for (let index = 0; index < maxSkips; index += 1) {
    const stage = await getStage(candidateId);

    if (stage && untilStages.includes(stage)) {
      return stage;
    }

    const skipped = await skipPendingDelay(candidateId);

    if (!skipped) {
      await sleep(2_000);
      const again = await getStage(candidateId);

      if (again && untilStages.includes(again)) {
        return again;
      }
    } else {
      await sleep(1_500);
    }
  }

  return getStage(candidateId);
};

const waitForHitl = async (candidateId: string, timeoutMs = 120_000) => {
  await waitFor({
    label: `HITL form for ${candidateId}`,
    timeoutMs,
    predicate: async () => {
      const journey = await getJourney(candidateId);

      return journey.activeRuns.some((run) => Boolean(run.pendingFormStepId));
    },
  });
};

const hitl = async (candidateId: string, body: Record<string, unknown>) => {
  return restPost(`/outreach-mock/candidates/${candidateId}/hitl`, {
    projectId: PROJECT_ID,
    ...body,
  });
};

const accept = async (candidateId: string) => {
  return restPost(`/outreach-mock/candidates/${candidateId}/accept`);
};

const reply = async (candidateId: string, text: string) => {
  return restPost(`/outreach-mock/candidates/${candidateId}/reply`, {
    text,
    delayMinutes: 0,
  });
};

const driveIgnoreEmailOk = async (candidateId: string) => {
  console.log('  → skip accept wait → enrich ok → email HITL → EMAIL_SENT');
  await waitAndSkipDelays(
    candidateId,
    ['EMAIL_SENT', 'FAILED_ENRICH', 'EMAIL_ENRICHING'],
    6,
  );

  const journey = await getJourney(candidateId);
  if (journey.activeRuns.some((run) => Boolean(run.pendingFormStepId))) {
    await approvePendingHitl(candidateId);
  }

  return waitForStage(candidateId, ['EMAIL_SENT']);
};

const driveIgnoreEnrichFail = async (candidateId: string) => {
  console.log('  → skip accept wait → enrich fail → FAILED_ENRICH');
  await waitAndSkipDelays(candidateId, ['FAILED_ENRICH', 'EMAIL_SENT'], 6);
  return waitForStage(candidateId, ['FAILED_ENRICH']);
};

const driveHitlReject = async (candidateId: string) => {
  console.log('  → accept → HITL reject opener');
  await accept(candidateId);
  await waitForHitl(candidateId);
  await hitl(candidateId, { decision: 'reject' });
  await sleep(3_000);
  return getStage(candidateId);
};

const approvePendingHitl = async (
  candidateId: string,
  extra: Record<string, unknown> = {},
) => {
  await waitForHitl(candidateId);
  const journey = await getJourney(candidateId);
  const draft =
    journey.activeRuns.find((run) => run.pendingFormStepId)?.draftPreview ??
    'Mock approved outreach draft for path matrix.';

  await hitl(candidateId, {
    decision: 'approve',
    editedBody: draft,
    ...extra,
  });
};

const driveSilentFu = async (candidateId: string) => {
  console.log('  → accept → approve opener + FUs → FAILED_NO_REPLY');
  await accept(candidateId);
  await approvePendingHitl(candidateId);

  // FU1/2/3: skip waits and approve each FORM
  for (let round = 0; round < 4; round += 1) {
    const stage = await getStage(candidateId);

    if (stage === 'FAILED_NO_REPLY') {
      break;
    }

    await waitAndSkipDelays(
      candidateId,
      ['FAILED_NO_REPLY', 'WAITING_REPLY'],
      3,
    );

    const journey = await getJourney(candidateId);
    const hasForm = journey.activeRuns.some((run) =>
      Boolean(run.pendingFormStepId),
    );

    if (hasForm) {
      await approvePendingHitl(candidateId);
      await sleep(2_000);
    }
  }

  return waitForStage(candidateId, ['FAILED_NO_REPLY'], 240_000);
};

const driveReplyMeeting = async (candidateId: string) => {
  console.log('  → accept → approve opener → reply → HITL edit+times');
  await accept(candidateId);
  await approvePendingHitl(candidateId);
  await sleep(3_000);

  const startsAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
  startsAt.setMinutes(0, 0, 0);
  const endsAt = new Date(startsAt.getTime() + 30 * 60 * 1000);

  await reply(
    candidateId,
    'Yes interested — can we meet Tue afternoon? Looking forward to it.',
  );

  await waitForHitl(candidateId, 180_000);
  await hitl(candidateId, {
    decision: 'edit',
    editedBody:
      'Thanks — locking in a slot. Looking forward to speaking with you.',
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
  });

  return waitForStage(
    candidateId,
    ['WAITING_REPLY', 'MEETING_BOOKED', 'REPLIED'],
    180_000,
  );
};

const driveReplyWaitfail = async (candidateId: string) => {
  console.log('  → accept → approve → reply → no times → skip wait → fail');
  await accept(candidateId);
  await approvePendingHitl(candidateId);
  await sleep(3_000);
  await reply(
    candidateId,
    'Interesting — tell me more when you have bandwidth.',
  );
  await waitForHitl(candidateId, 180_000);
  await approvePendingHitl(candidateId);
  await waitAndSkipDelays(candidateId, ['FAILED_NO_REPLY'], 6);
  return waitForStage(
    candidateId,
    ['FAILED_NO_REPLY', 'WAITING_REPLY'],
    180_000,
  );
};

const driveFu1ThenReply = async (candidateId: string) => {
  console.log('  → accept → approve opener → skip to FU1 → reply');
  await accept(candidateId);
  await approvePendingHitl(candidateId);
  await sleep(2_000);

  // Skip FU1 delay; approve FU1 form if present
  await waitAndSkipDelays(candidateId, ['FAILED_NO_REPLY'], 4);
  const journey = await getJourney(candidateId);

  if (journey.activeRuns.some((run) => Boolean(run.pendingFormStepId))) {
    await approvePendingHitl(candidateId);
    await sleep(2_000);
  }

  await reply(
    candidateId,
    'Sorry for the delay — yes, happy to chat about this.',
  );
  await waitForHitl(candidateId, 180_000);
  await approvePendingHitl(candidateId);

  return waitForStage(
    candidateId,
    ['WAITING_REPLY', 'REPLIED', 'MEETING_BOOKED'],
    180_000,
  );
};

const main = async () => {
  console.log(`Driving B/C matrix projectId=${PROJECT_ID}`);
  const candidates = await listCandidates();

  if (candidates.length < 9) {
    throw new Error(`Expected ≥9 matrix candidates, got ${candidates.length}`);
  }

  console.log(`Loaded ${candidates.length} candidates`);
  for (const candidate of candidates) {
    console.log(
      `  ${candidate.key}\t${candidate.outreachSequenceStage}\t${candidate.id}`,
    );
  }

  const byKey = Object.fromEntries(
    candidates.map((candidate) => [candidate.key, candidate]),
  );

  // Terminal already: deferred siblings + scaffolding anchors (leave SENT)
  console.log('\n=== Deferred / scaffolding (assert only) ===');
  for (const key of [
    'B-Alpha-earlier-defer',
    'B-Alpha-contacted-defer',
    'B-Alpha-anchor',
    'B-no-company',
  ]) {
    const candidate = byKey[key];
    if (!candidate) {
      console.log(`  MISSING ${key}`);
      continue;
    }
    console.log(`  ${key}: ${candidate.outreachSequenceStage}`);
  }

  console.log('\n=== B ignore paths ===');
  if (byKey['B-ignore-email-ok']) {
    console.log('B-ignore-email-ok');
    await driveIgnoreEmailOk(byKey['B-ignore-email-ok'].id);
  }
  if (byKey['B-ignore-enrich-fail']) {
    console.log('B-ignore-enrich-fail');
    await driveIgnoreEnrichFail(byKey['B-ignore-enrich-fail'].id);
  }

  console.log('\n=== C HITL reject ===');
  if (byKey['C-hitl-reject-opener']) {
    console.log('C-hitl-reject-opener');
    await driveHitlReject(byKey['C-hitl-reject-opener'].id);
  }

  console.log('\n=== C accept silent FU ===');
  if (byKey['C-accept-silent-fu']) {
    console.log('C-accept-silent-fu');
    await driveSilentFu(byKey['C-accept-silent-fu'].id);
  }

  console.log('\n=== C accept reply meeting ===');
  if (byKey['C-accept-reply-meeting']) {
    console.log('C-accept-reply-meeting');
    await driveReplyMeeting(byKey['C-accept-reply-meeting'].id);
  }

  console.log('\n=== C accept reply waitfail ===');
  if (byKey['C-accept-reply-waitfail']) {
    console.log('C-accept-reply-waitfail');
    await driveReplyWaitfail(byKey['C-accept-reply-waitfail'].id);
  }

  console.log('\n=== C FU1 then reply ===');
  if (byKey['C-accept-fu1-then-reply']) {
    console.log('C-accept-fu1-then-reply');
    await driveFu1ThenReply(byKey['C-accept-fu1-then-reply'].id);
  }

  console.log('\n=== Final stages ===');
  const finalRows = await listCandidates();
  let failures = 0;

  for (const candidate of finalRows) {
    const expected = EXPECTED_TERMINAL[candidate.key] ?? [];
    const stage = candidate.outreachSequenceStage ?? '?';
    const ok = expected.includes(stage);
    console.log(
      `  ${ok ? 'OK' : 'FAIL'}\t${candidate.key}\t${stage}\t(expected ${expected.join('|')})`,
    );
    if (!ok) {
      failures += 1;
    }
  }

  if (failures > 0) {
    process.exitCode = 1;
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
