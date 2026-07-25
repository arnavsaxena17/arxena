import {
  getGraphqlToFindManyProjects,
  graphqlQueryToFindCvsent,
  graphqlQueryToFindScheduledClientMeetings,
  graphqlQueryToFindShortlists,
  graphqlToFetchAllCandidateData,
  resolveIsOrgChartEnabledFromWorkspace,
} from 'twenty-shared/graphql';
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
    if (!res.ok) {
      return resolveIsOrgChartEnabledFromWorkspace(undefined);
    }
    const keys = await res.json();
    return resolveIsOrgChartEnabledFromWorkspace(keys?.is_org_chart_enabled);
  } catch {
    return resolveIsOrgChartEnabledFromWorkspace(undefined);
  }
}

function extractProjects(
  data: unknown,
): Array<{ id: string; name?: string }> {
  const result = data as {
    projects?: {
      edges?: Array<{ node: { id: string; name?: string } }>;
    };
  };
  const edges = result?.projects?.edges ?? [];
  return edges.map((edge) => edge.node);
}

function extractCandidates(data: unknown): Array<{ id: string; status?: string; projectsId?: string }> {
  const result = data as { candidates?: { edges?: Array<{ node: { id: string; status?: string; projectsId?: string } }> } };
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
            description: 'When aggregating by status per job, max candidates to fetch per project(default: 200)',
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
      const jobsQuery = getGraphqlToFindManyProjects(isOrgChartEnabled);

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

      const projects = extractProjects(jobsData);
      const shortlists =
        (shortlistsData as { shortlists?: { edges?: unknown[] } })?.shortlists
          ?.edges ?? [];
      const cvSents =
        (cvSentsData as { cvsent?: { edges?: unknown[] } })?.cvsent?.edges ??
        [];
      const interviews = extractClientInterviews(interviewsData);

      const projectIds = projects.map((project) => project.id);
      const candidatesByJob: Record<string, Record<string, number>> = {};
      for (const project of projects) {
        candidatesByJob[project.id] = {};
      }

      if (projectIds.length > 0) {
        for (const projectId of projectIds) {
          const candidateData = await executeGraphQL(
            config.baseUrl,
            config.apiToken,
            graphqlToFetchAllCandidateData,
            {
              filter: { projectsId: { eq: projectId } },
              limit: maxCandidatesPerJob,
            },
          );
          const candidates = extractCandidates(candidateData);
          for (const candidate of candidates) {
            const status = candidate.status ?? 'Unknown';
            candidatesByJob[projectId][status] =
              (candidatesByJob[projectId][status] ?? 0) + 1;
          }
        }
      }

      const upcomingInterviews = interviews.filter(
        (interview) => !interview.clientInterviewCompleted,
      );

      return {
        summary: {
          activeJobsCount: projects.length,
          totalShortlists: shortlists.length,
          totalCvSents: cvSents.length,
          upcomingClientInterviewsCount: upcomingInterviews.length,
        },
        activeJobs: projects.map((project) => ({
          id: project.id,
          name: project.name,
          candidateCountByStatus: candidatesByJob[project.id] ?? {},
        })),
        upcomingClientInterviews: upcomingInterviews
          .slice(0, upcomingInterviewsLimit)
          .map((interview) => ({
            id: interview.id,
            name: interview.name,
            candidateId: interview.candidateId,
            interviewTime: interview.interviewTime,
          })),
      };
    },
  },
];
