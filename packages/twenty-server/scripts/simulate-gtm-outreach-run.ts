import axios from 'axios';

/**
 * Compressed GTM outreach simulator.
 *
 * Advances Candidate stages and Project ICP for Workflow A/B/C without real
 * Unipile delays. Pair with setup-gtm-command-dashboard.ts +
 * setup-gtm-outreach-workflow.ts.
 *
 * Env:
 *   API_TOKEN (required) — API key or user JWT for CRM updates
 *   SERVER_URL / SERVER_HOST
 *   GTM_PROJECT_ID (preferred) — active Project UUID
 *   GTM_SIMULATE_MODE = accept | ignore | reply | bootstrap | full (default full)
 */

const SERVER_URL = process.env.SERVER_URL || 'http://127.0.0.1:3000';
const SERVER_HOST = process.env.SERVER_HOST || 'arxena.localhost';
const GRAPHQL_URL = `${SERVER_URL}/graphql`;
const API_TOKEN = process.env.API_TOKEN;
const GTM_PROJECT_ID = process.env.GTM_PROJECT_ID || '';
const MODE = (process.env.GTM_SIMULATE_MODE || 'full') as
  | 'accept'
  | 'ignore'
  | 'reply'
  | 'bootstrap'
  | 'full';

type GraphQLResponse<T> = {
  data?: T;
  errors?: Array<{ message: string }>;
};

const MOCKS = {
  icpSpec: {
    name: 'HR Tech buyers — Talent leaders',
    industries: ['HR Tech', 'SaaS'],
    employeeRange: '50-200',
    geos: ['US', 'UK'],
    buyerTitles: ['Head of Talent', 'VP People'],
    painSignals: ['slow time-to-hire', 'recruiter capacity'],
    // stdFunctions: ['talent acquisition', 'people'],
    // stdGrades: ['director', 'vp'],
  },
  connectionSent: {
    outreachSequenceStage: 'CONNECTION_SENT',
  },
  connectionAccepted: {
    event: 'connection_accepted',
    outreachSequenceStage: 'CONNECTION_ACCEPTED',
  },
  connectionIgnored: {
    event: 'connection_ignored',
    outreachSequenceStage: 'CONNECTION_IGNORED',
  },
  inboundReply: {
    event: 'inbound_reply',
    outreachSequenceStage: 'REPLIED',
  },
  meetingBooked: {
    event: 'meeting_booked',
    outreachSequenceStage: 'MEETING_BOOKED',
  },
  enrichEmailFound: {
    enrichStatus: 'FOUND',
    outreachSequenceStage: 'EMAIL_SENT',
  },
  callRecordingCheck: {
    status: 'READY',
    recordingUrl: 'https://example.com/recording.mp4',
  },
};

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

const findProjects = async (projectId?: string) => {
  const filter = projectId ? { id: { eq: projectId } } : undefined;

  const data = await graphqlRequest<{
    projects: {
      edges: Array<{
        node: {
          id: string;
          name?: string;
          icpSpec?: string | null;
          outreachWorkflowId?: string | null;
        };
      }>;
    };
  }>(
    `query FindGtmProjects($filter: ProjectFilterInput) {
      projects(filter: $filter, first: 20, orderBy: { updatedAt: DescNullsLast }) {
        edges {
          node {
            id
            name
            icpSpec
            outreachWorkflowId
          }
        }
      }
    }`,
    { filter },
  );

  return data.projects.edges.map((edge) => edge.node);
};

const updateProject = async (id: string, data: Record<string, unknown>) => {
  await graphqlRequest(
    `mutation UpdateProject($id: ID!, $data: ProjectUpdateInput!) {
      updateProject(id: $id, data: $data) { id }
    }`,
    { id, data },
  );
};

const findCandidates = async (projectId: string) => {
  const data = await graphqlRequest<{
    candidates: {
      edges: Array<{
        node: {
          id: string;
          name?: string;
          outreachSequenceStage?: string;
        };
      }>;
    };
  }>(
    `query FindGtmCandidates($filter: CandidateFilterInput!) {
      candidates(filter: $filter, first: 50) {
        edges {
          node {
            id
            name
            outreachSequenceStage
          }
        }
      }
    }`,
    {
      filter: { projectsId: { eq: projectId } },
    },
  );

  return data.candidates.edges.map((edge) => edge.node);
};

const updateCandidate = async (
  id: string,
  projectId: string,
  data: Record<string, unknown>,
) => {
  await graphqlRequest(
    `mutation UpdateCandidate($id: ID!, $data: CandidateUpdateInput!) {
      updateCandidate(id: $id, data: $data) { id }
    }`,
    {
      id,
      data: {
        projectsId: projectId,
        campaign: projectId,
        ...data,
      },
    },
  );
};

type ResolvedGtmProject = {
  id: string;
  name?: string;
  outreachWorkflowId?: string | null;
};

const resolveGtmProject = async (): Promise<ResolvedGtmProject> => {
  const projects = await findProjects(GTM_PROJECT_ID || undefined);
  const project =
    projects.find((row) => row.id === GTM_PROJECT_ID) ??
    projects.find((row) => (row.name ?? '').startsWith('GTM')) ??
    projects[0];

  if (!project) {
    throw new Error(
      GTM_PROJECT_ID
        ? `No Project id=${GTM_PROJECT_ID}. Open /gtm-home and create a project, or seed dashboard.`
        : 'Pass GTM_PROJECT_ID. Seed dashboard first.',
    );
  }

  return project;
};

// Workflow A — persist ICP preferences on the GTM Project (Ask AI skill equivalent).
const simulateBootstrap = async (project: ResolvedGtmProject) => {
  await updateProject(project.id, {
    icpSegment: MOCKS.icpSpec.name,
    icpSpec: JSON.stringify(MOCKS.icpSpec),
    outreachSendMode: 'APPROVAL',
    maxPersonasPerCompany: 2,
    inMailFallbackEnabled: true,
    sendTimezone: 'Asia/Kolkata',
    sendWindowStart: '08:00',
    sendWindowEnd: '10:00',
  });

  console.log(`  bootstrap ICP → project ${project.id}`);
  console.log(
    `  outreachWorkflowId=${project.outreachWorkflowId ?? 'none (run setup-gtm-outreach-workflow.ts)'}`,
  );
};

// Workflow B prelude — move a few QUEUED candidates into CONNECTION_SENT.
const simulateConnectionSent = async (
  projectId: string,
  candidates: Array<{ id: string; outreachSequenceStage?: string }>,
) => {
  const queued = candidates.filter(
    (candidate) =>
      !candidate.outreachSequenceStage ||
      candidate.outreachSequenceStage === 'QUEUED',
  );

  for (const candidate of queued.slice(0, 5)) {
    await updateCandidate(candidate.id, projectId, {
      ...MOCKS.connectionSent,
      lastOutboundAt: new Date().toISOString(),
    });
    console.log(`  connection_sent → ${candidate.id}`);
  }
};

const simulateAccept = async (
  projectId: string,
  candidates: Array<{ id: string; outreachSequenceStage?: string }>,
) => {
  const sent = candidates.filter(
    (candidate) => candidate.outreachSequenceStage === 'CONNECTION_SENT',
  );

  for (const candidate of sent.slice(0, 3)) {
    await updateCandidate(candidate.id, projectId, {
      outreachSequenceStage: MOCKS.connectionAccepted.outreachSequenceStage,
      lastOutboundAt: new Date().toISOString(),
    });
    console.log(`  accept → ${candidate.id}`);
  }
};

const simulateIgnore = async (
  projectId: string,
  candidates: Array<{ id: string; outreachSequenceStage?: string }>,
) => {
  const sent = candidates.filter(
    (candidate) => candidate.outreachSequenceStage === 'CONNECTION_SENT',
  );

  for (const candidate of sent.slice(0, 2)) {
    await updateCandidate(candidate.id, projectId, {
      outreachSequenceStage: MOCKS.connectionIgnored.outreachSequenceStage,
      enrichStatus: 'RUNNING',
      pendingChannel: null,
    });
    await updateCandidate(candidate.id, projectId, {
      ...MOCKS.enrichEmailFound,
      enrichStatus: 'FOUND',
    });
    console.log(`  ignore→email → ${candidate.id}`);
  }
};

// Workflow C — reply → negotiate → meeting booked (+ recording mock).
const simulateReply = async (
  projectId: string,
  candidates: Array<{ id: string }>,
) => {
  const target = candidates[0];

  if (!target) {
    return;
  }

  await updateCandidate(target.id, projectId, {
    outreachSequenceStage: MOCKS.inboundReply.outreachSequenceStage,
    lastInboundAt: new Date().toISOString(),
  });
  console.log(`  reply → ${target.id}`);

  await updateCandidate(target.id, projectId, {
    outreachSequenceStage: 'NEGOTIATING',
  });

  await updateCandidate(target.id, projectId, {
    outreachSequenceStage: MOCKS.meetingBooked.outreachSequenceStage,
  });
  console.log(`  meeting booked → ${target.id}`);
  console.log(
    `  call recording check: ${MOCKS.callRecordingCheck.status} ${MOCKS.callRecordingCheck.recordingUrl}`,
  );
};

const main = async () => {
  const project = await resolveGtmProject();

  console.log(
    `Simulating GTM outreach projectId=${project.id} mode=${MODE}`,
  );
  console.log('Compressed delay env GTM_DELAY_MS=', process.env.GTM_DELAY_MS);

  if (MODE === 'bootstrap' || MODE === 'full') {
    console.log('Workflow A (bootstrap / ICP)');
    await simulateBootstrap(project);
  }

  const candidates = await findCandidates(project.id);

  if (candidates.length === 0) {
    throw new Error(
      `No candidates for projectId=${project.id}. Seed dashboard or enroll from /gtm-home?projectId=${project.id}.`,
    );
  }

  console.log(`Found ${candidates.length} candidates`);

  if (MODE === 'full') {
    console.log('Workflow B (connection sent)');
    await simulateConnectionSent(project.id, candidates);
  }

  if (MODE === 'accept' || MODE === 'full') {
    console.log('Workflow B (accept)');
    await simulateAccept(project.id, candidates);
  }

  if (MODE === 'ignore' || MODE === 'full') {
    console.log('Workflow B (ignore → email)');
    await simulateIgnore(project.id, candidates);
  }

  if (MODE === 'reply' || MODE === 'full') {
    console.log('Workflow C (reply → meeting)');
    await simulateReply(project.id, candidates);
  }

  console.log('Simulation complete');
  console.log(`Open /gtm-home?projectId=${project.id}`);
};

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error('simulate-gtm-outreach-run failed:', message);
  process.exit(1);
});
