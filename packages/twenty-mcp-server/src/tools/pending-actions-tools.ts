import {
    getGraphqlToFindManyJobs,
    graphqlQueryToFindCvsent,
    graphqlQueryToFindScheduledClientMeetings,
    graphqlQueryToFindShortlists,
    graphqlToFetchAllCandidateData,
} from 'twenty-shared';
import { executeGraphQL } from '../api/graphql-client';
import { McpTool } from '../types/tool-types';

async function getIsOrgChartEnabled(
  baseUrl: string,
  apiToken: string,
): Promise<boolean> {
  try {
    const serverBase = baseUrl.replace(/\/graphql\/?$/, '') || baseUrl;
    const res = await fetch(
      `${serverBase}/workspace-modifications/workspace-keys`,
      {
        headers: { Authorization: `Bearer ${apiToken}` },
      },
    );
    if (!res.ok) return process.env.IS_ORG_CHART_ENABLED === 'true';
    const keys = await res.json();
    const flag = keys?.is_org_chart_enabled ?? process.env.IS_ORG_CHART_ENABLED ?? 'true';
    return flag === 'true';
  } catch {
    return process.env.IS_ORG_CHART_ENABLED === 'true';
  }
}

function extractJobs(data: unknown): Array<{ id: string; name?: string }> {
  const result = data as { jobs?: { edges?: Array<{ node: { id: string; name?: string } }> } };
  const edges = result?.jobs?.edges ?? [];
  return edges.map((e) => e.node);
}

function extractCandidates(data: unknown): Array<{ id: string; status?: string; jobsId?: string }> {
  const result = data as { candidates?: { edges?: Array<{ node: { id: string; status?: string; jobsId?: string } }> } };
  const edges = result?.candidates?.edges ?? [];
  return edges.map((e) => e.node);
}

function extractClientInterviews(data: unknown): Array<{
  id: string;
  name?: string;
  candidateId?: string;
  interviewTime?: string;
  clientInterviewCompleted?: boolean;
}> {
  const result = data as {
    clientInterviews?: { edges?: Array<{ node: { id: string; name?: string; candidateId?: string; interviewTime?: string; clientInterviewCompleted?: boolean } }> };
  };
  const edges = result?.clientInterviews?.edges ?? [];
  return edges.map((e) => e.node);
}

/**
 * Returns a summary of pending recruiter actions for the heartbeat prompt:
 * active jobs, candidate counts by status per job, shortlists and CV Sents counts,
 * and upcoming client interviews. Use this to build the "what should I do?" prompt.
 */
export const pendingActionsTools: McpTool[] = [
  {
    definition: {
      name: 'get_pending_recruiter_actions',
      description:
        'Get a summary of pending recruiter actions for the workspace: active jobs, candidate counts by status per job, shortlist and CV Sent counts, and upcoming client interviews. Use this when building the autonomous recruiter heartbeat prompt or when the user asks what needs attention.',
      inputSchema: {
        type: 'object',
        properties: {
          maxJobs: {
            type: 'number',
            description: 'Maximum number of active jobs to include (default: 20)',
          },
          maxCandidatesPerJob: {
            type: 'number',
            description: 'When aggregating by status per job, max candidates to fetch per job (default: 200)',
          },
          upcomingInterviewsLimit: {
            type: 'number',
            description: 'Max upcoming client interviews to return (default: 20)',
          },
        },
      },
    },
    handler: async (args, config) => {
      const maxJobs = typeof args.maxJobs === 'number' ? args.maxJobs : 20;
      const maxCandidatesPerJob = typeof args.maxCandidatesPerJob === 'number' ? args.maxCandidatesPerJob : 200;
      const upcomingInterviewsLimit = typeof args.upcomingInterviewsLimit === 'number' ? args.upcomingInterviewsLimit : 20;

      const isOrgChartEnabled = await getIsOrgChartEnabled(
        config.baseUrl,
        config.apiToken,
      );
      const jobsQuery = getGraphqlToFindManyJobs(isOrgChartEnabled);

      const [jobsData, shortlistsData, cvSentsData, interviewsData] = await Promise.all([
        executeGraphQL(config.baseUrl, config.apiToken, jobsQuery, {
          filter: { isActive: { eq: true } },
          limit: maxJobs,
          orderBy: [{ updatedAt: 'DescNullsLast' }],
        }),
        executeGraphQL(config.baseUrl, config.apiToken, graphqlQueryToFindShortlists, {
          limit: 500,
          orderBy: [{ updatedAt: 'DescNullsLast' }],
        }),
        executeGraphQL(config.baseUrl, config.apiToken, graphqlQueryToFindCvsent, {
          limit: 500,
          orderBy: [{ createdAt: 'DescNullsLast' }],
        }),
        executeGraphQL(config.baseUrl, config.apiToken, graphqlQueryToFindScheduledClientMeetings, {
          limit: upcomingInterviewsLimit,
          orderBy: [{ interviewTime: 'AscNullsLast' }],
        }),
      ]);

      const jobs = extractJobs(jobsData);
      const shortlists = (shortlistsData as { shortlists?: { edges?: unknown[] } })?.shortlists?.edges ?? [];
      const cvSents = (cvSentsData as { cvsent?: { edges?: unknown[] } })?.cvsent?.edges ?? [];
      const interviews = extractClientInterviews(interviewsData);

      const jobIds = jobs.map((j) => j.id);
      const candidatesByJob: Record<string, Record<string, number>> = {};
      for (const j of jobs) {
        candidatesByJob[j.id] = {};
      }

      if (jobIds.length > 0) {
        for (const jobId of jobIds) {
          const candData = await executeGraphQL(config.baseUrl, config.apiToken, graphqlToFetchAllCandidateData, {
            filter: { jobsId: { eq: jobId } },
            limit: maxCandidatesPerJob,
          });
          const candidates = extractCandidates(candData);
          for (const c of candidates) {
            const status = c.status ?? 'Unknown';
            candidatesByJob[jobId][status] = (candidatesByJob[jobId][status] ?? 0) + 1;
          }
        }
      }

      const upcomingInterviews = interviews.filter((i) => !i.clientInterviewCompleted);

      return {
        summary: {
          activeJobsCount: jobs.length,
          totalShortlists: shortlists.length,
          totalCvSents: cvSents.length,
          upcomingClientInterviewsCount: upcomingInterviews.length,
        },
        activeJobs: jobs.map((j) => ({
          id: j.id,
          name: j.name,
          candidateCountByStatus: candidatesByJob[j.id] ?? {},
        })),
        upcomingClientInterviews: upcomingInterviews.slice(0, upcomingInterviewsLimit).map((i) => ({
          id: i.id,
          name: i.name,
          candidateId: i.candidateId,
          interviewTime: i.interviewTime,
        })),
      };
    },
  },
];
