import axios from 'axios';

/**
 * Seeds a fresh Outreach project + QUEUED candidates that cover Stage B/C
 * branch ends and HITL yes/no/edit combinations (local 3‑minute waits).
 *
 * Env:
 *   API_TOKEN (required)
 *   SERVER_URL / SERVER_HOST (default arxena-4 local)
 *   OUTREACH_WORKFLOW_B_ID — bind Project.outreachWorkflowId (optional)
 *
 * Creation order matters for Alpha sibling DEFERRED paths.
 */

const SERVER_URL = process.env.SERVER_URL || 'http://127.0.0.1:3000';
const SERVER_HOST = process.env.SERVER_HOST || 'arxena-4.localhost';
const FRONT_HOST = process.env.FRONT_HOST || 'arxena-4.localhost';
const GRAPHQL_URL = `${SERVER_URL}/graphql`;
const API_TOKEN = process.env.API_TOKEN;
const OUTREACH_WORKFLOW_B_ID =
  process.env.OUTREACH_WORKFLOW_B_ID ||
  '6cea6e99-7b72-4d00-963f-6427008ca0ab';

const PROJECT_NAME = `B/C path matrix · ${new Date()
  .toISOString()
  .slice(0, 16)
  .replace('T', ' ')}`;

type GraphQLResponse<T> = {
  data?: T;
  errors?: Array<{ message: string }>;
};

type CandidateSeed = {
  key: string;
  name: string;
  jobTitle: string;
  jobCompanyName: string | null;
  linkedinSlug: string;
  note: string;
  createPhase: 1 | 2 | 3;
};

// Phase 1: Alpha anchor only (must stay QUEUED until phase 2).
// Phase 2: earlier-queued sibling + unique-company paths.
// Phase 3: contacted-defer after Alpha anchor is CONNECTION_SENT.
const CANDIDATES: CandidateSeed[] = [
  {
    key: 'B-Alpha-anchor',
    name: 'Test Alpha Anchor',
    jobTitle: 'VP Talent',
    jobCompanyName: 'Alpha Sibling Co',
    linkedinSlug: 'test-alpha-anchor-bc-matrix',
    note: 'Send connection; scaffolding for DEFERRED siblings',
    createPhase: 1,
  },
  {
    key: 'B-Alpha-earlier-defer',
    name: 'Test Alpha Earlier Defer',
    jobTitle: 'Head of People',
    jobCompanyName: 'Alpha Sibling Co',
    linkedinSlug: 'test-alpha-earlier-defer-bc-matrix',
    note: 'Create while anchor still QUEUED → DEFERRED earlier sibling',
    createPhase: 2,
  },
  {
    key: 'B-no-company',
    name: 'Test No Company',
    jobTitle: 'Independent Recruiter',
    jobCompanyName: null,
    linkedinSlug: 'test-no-company-bc-matrix',
    note: 'No jobCompanyName → no-company send path',
    createPhase: 2,
  },
  {
    key: 'B-ignore-email-ok',
    name: 'Test Ignore Email Ok',
    jobTitle: 'CTO',
    jobCompanyName: 'Beta Ignore Email Co',
    linkedinSlug: 'test-ignore-email-ok-bc-matrix',
    note: 'Never accept → enrich ok → EMAIL_SENT',
    createPhase: 2,
  },
  {
    key: 'B-ignore-enrich-fail',
    name: 'Test Ignore Enrich Fail',
    jobTitle: 'CFO',
    jobCompanyName: 'Gamma Enrich Fail Co',
    linkedinSlug: 'test-ignore-enrich-fail-bc-matrix',
    note: 'Never accept → enrich miss → FAILED_ENRICH',
    createPhase: 2,
  },
  {
    key: 'C-accept-silent-fu',
    name: 'Test Accept Silent FU',
    jobTitle: 'CEO',
    jobCompanyName: 'Delta Silent Fu Co',
    linkedinSlug: 'test-accept-silent-fu-bc-matrix',
    note: 'Accept <3m; HITL approve; no reply through FU3 → FAILED_NO_REPLY',
    createPhase: 2,
  },
  {
    key: 'C-accept-reply-meeting',
    name: 'Test Accept Reply Meeting',
    jobTitle: 'COO',
    jobCompanyName: 'Epsilon Meeting Co',
    linkedinSlug: 'test-accept-reply-meeting-bc-matrix',
    note: 'Accept; HITL edit on reply FORM; book meeting',
    createPhase: 2,
  },
  {
    key: 'C-accept-reply-waitfail',
    name: 'Test Accept Reply Waitfail',
    jobTitle: 'CMO',
    jobCompanyName: 'Zeta Waitfail Co',
    linkedinSlug: 'test-accept-reply-waitfail-bc-matrix',
    note: 'Accept; reply; no meeting times → WAITING_REPLY → fail',
    createPhase: 2,
  },
  {
    key: 'C-hitl-reject-opener',
    name: 'Test Hitl Reject Opener',
    jobTitle: 'VP Sales',
    jobCompanyName: 'Eta Hitl Reject Co',
    linkedinSlug: 'test-hitl-reject-opener-bc-matrix',
    note: 'Accept; HITL reject on opener FORM → run STOPPED, no send',
    createPhase: 2,
  },
  {
    key: 'C-accept-fu1-then-reply',
    name: 'Test Accept Fu1 Then Reply',
    jobTitle: 'VP Eng',
    jobCompanyName: 'Theta Fu1 Reply Co',
    linkedinSlug: 'test-accept-fu1-then-reply-bc-matrix',
    note: 'Accept; approve opener; FU1 send; then inbound reply',
    createPhase: 2,
  },
  {
    key: 'B-Alpha-contacted-defer',
    name: 'Test Alpha Contacted Defer',
    jobTitle: 'Director TA',
    jobCompanyName: 'Alpha Sibling Co',
    linkedinSlug: 'test-alpha-contacted-defer-bc-matrix',
    note: 'Create after anchor CONNECTION_SENT → DEFERRED contacted',
    createPhase: 3,
  },
];

const graphqlRequest = async <T>(
  query: string,
  variables: Record<string, unknown>,
): Promise<T> => {
  if (!API_TOKEN) {
    throw new Error('API_TOKEN environment variable is required');
  }

  const response = await axios.post<GraphQLResponse<T>>(
    GRAPHQL_URL,
    { query, variables },
    {
      headers: {
        Authorization: `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json',
        Host: SERVER_HOST,
      },
    },
  );

  if (response.data.errors?.length) {
    throw new Error(
      response.data.errors.map((error) => error.message).join('; '),
    );
  }

  if (!response.data.data) {
    throw new Error('GraphQL response did not include data');
  }

  return response.data.data;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const createProject = async (): Promise<{ id: string; name: string }> => {
  const data = await graphqlRequest<{
    createProject: { id: string; name: string; outreachWorkflowId?: string };
  }>(
    `mutation CreateOutreachMatrixProject($data: ProjectCreateInput!) {
      createProject(data: $data) {
        id
        name
        outreachWorkflowId
      }
    }`,
    {
      data: {
        name: PROJECT_NAME,
        isActive: true,
        outreachSendMode: 'APPROVAL',
        outreachWorkflowId: OUTREACH_WORKFLOW_B_ID,
        outreachConfig: {
          v: 1,
          maxPersonasPerCompany: 2,
          inMailFallbackEnabled: false,
          sendTimezone: 'Asia/Kolkata',
          sendWindowStart: '10:00',
          sendWindowEnd: '20:00',
          sendWindowDays: '1,2,3,4,5,6',
          icpSpec: null,
          experimentConfig: null,
          updatedAt: new Date().toISOString(),
        },
      },
    },
  );

  return data.createProject;
};

const createCandidate = async ({
  projectId,
  seed,
}: {
  projectId: string;
  seed: CandidateSeed;
}): Promise<{ id: string; key: string }> => {
  const linkedinUrl = `https://www.linkedin.com/in/${seed.linkedinSlug}`;
  const data = await graphqlRequest<{
    createCandidate: { id: string; name?: string };
  }>(
    `mutation CreateMatrixCandidate($data: CandidateCreateInput!) {
      createCandidate(data: $data) {
        id
        name
      }
    }`,
    {
      data: {
        name: seed.name,
        jobTitle: seed.jobTitle,
        ...(seed.jobCompanyName
          ? { jobCompanyName: seed.jobCompanyName }
          : {}),
        email: {
          primaryEmail: `${seed.linkedinSlug}@bc-matrix.test`,
        },
        linkedinUrl: {
          primaryLinkUrl: linkedinUrl,
          primaryLinkLabel: seed.linkedinSlug,
        },
        linkedinProfileId: seed.linkedinSlug,
        projectsId: projectId,
        campaign: projectId,
        outreachSequenceStage: 'QUEUED',
        source: 'bc-path-matrix-seed',
        remarks: seed.note,
      },
    },
  );

  return { id: data.createCandidate.id, key: seed.key };
};

const findCandidateStage = async (candidateId: string) => {
  const data = await graphqlRequest<{
    candidates: {
      edges: Array<{
        node: { id: string; outreachSequenceStage?: string };
      }>;
    };
  }>(
    `query CandidateStage($filter: CandidateFilterInput!) {
      candidates(filter: $filter, first: 1) {
        edges {
          node {
            id
            outreachSequenceStage
          }
        }
      }
    }`,
    { filter: { id: { eq: candidateId } } },
  );

  return data.candidates.edges[0]?.node.outreachSequenceStage ?? null;
};

const waitForStage = async ({
  candidateId,
  stages,
  timeoutMs = 90_000,
}: {
  candidateId: string;
  stages: string[];
  timeoutMs?: number;
}) => {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const stage = await findCandidateStage(candidateId);

    if (stage && stages.includes(stage)) {
      return stage;
    }

    await sleep(2_000);
  }

  return findCandidateStage(candidateId);
};

const main = async () => {
  console.log(`Creating project "${PROJECT_NAME}"…`);
  const project = await createProject();
  console.log(`  projectId=${project.id}`);
  console.log(`  outreachWorkflowId=${OUTREACH_WORKFLOW_B_ID}`);

  const created: Array<{
    key: string;
    id: string;
    note: string;
    phase: number;
  }> = [];

  const phase1 = CANDIDATES.filter((seed) => seed.createPhase === 1);
  const phase2 = CANDIDATES.filter((seed) => seed.createPhase === 2);
  const phase3 = CANDIDATES.filter((seed) => seed.createPhase === 3);

  console.log('\nPhase 1 — Alpha anchor (QUEUED)…');
  for (const seed of phase1) {
    const candidate = await createCandidate({ projectId: project.id, seed });
    created.push({
      key: candidate.key,
      id: candidate.id,
      note: seed.note,
      phase: 1,
    });
    console.log(`  ${seed.key} → ${candidate.id}`);
  }

  const anchor = created.find((row) => row.key === 'B-Alpha-anchor');

  if (!anchor) {
    throw new Error('Alpha anchor missing');
  }

  // Brief pause so B run attaches while still QUEUED before sibling create.
  await sleep(1_500);

  console.log(
    '\nPhase 2 — earlier-defer sibling + unique-company paths (while anchor QUEUED)…',
  );
  for (const seed of phase2) {
    const candidate = await createCandidate({ projectId: project.id, seed });
    created.push({
      key: candidate.key,
      id: candidate.id,
      note: seed.note,
      phase: 2,
    });
    console.log(`  ${seed.key} → ${candidate.id}`);
    // Stagger creates so earlier-queued sibling filter is deterministic.
    await sleep(400);
  }

  console.log(
    '\nWaiting for Alpha anchor to leave QUEUED (CONNECTION_SENT / DEFERRED)…',
  );
  const anchorStage = await waitForStage({
    candidateId: anchor.id,
    stages: ['CONNECTION_SENT', 'DEFERRED', 'CONNECTION_ACCEPTED'],
  });
  console.log(`  Alpha anchor stage=${anchorStage}`);

  console.log('\nPhase 3 — contacted-defer sibling…');
  for (const seed of phase3) {
    const candidate = await createCandidate({ projectId: project.id, seed });
    created.push({
      key: candidate.key,
      id: candidate.id,
      note: seed.note,
      phase: 3,
    });
    console.log(`  ${seed.key} → ${candidate.id}`);
  }

  console.log('\n=== Seed complete ===');
  console.log(`projectId=${project.id}`);
  console.log(
    `Outreach Home: http://${FRONT_HOST}:3001/outreach-home?projectId=${project.id}`,
  );
  console.log(
    `Workflow B: http://${FRONT_HOST}:3001/object/workflow/${OUTREACH_WORKFLOW_B_ID}`,
  );
  console.log('\nCandidates:');
  for (const row of created) {
    console.log(`  ${row.key}\t${row.id}\t${row.note}`);
  }

  console.log(`
Drive checklist (mocks):
  Upload:  POST /outreach-mock/projects/:projectId/upload-profiles  { "count": 5 }
  Accept:  POST /outreach-mock/candidates/:id/accept
  Reply:   POST /outreach-mock/candidates/:id/reply  { "text": "…" }
  HITL:    POST /outreach-mock/candidates/:id/hitl   { "decision": "approve"|"reject"|"edit", "editedBody"?: "…" }
           aliases: yes | no | change

HITL matrix:
  C-accept-silent-fu        → hitl decision=approve (default draft goes out)
  C-accept-reply-meeting    → hitl decision=edit + editedBody + startsAt/endsAt on reply FORM
  C-hitl-reject-opener      → hitl decision=reject (run STOPPED, no LinkedIn send)
  C-accept-fu1-then-reply   → approve opener/FU forms as-is
`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
