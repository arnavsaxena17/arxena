import {
  getGraphqlToFindManyProjects,
  graphqlQueryToFindCvsent,
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
    const keys = (await res.json()) as {
      is_org_chart_enabled?: string | null;
    };
    return resolveIsOrgChartEnabledFromWorkspace(keys.is_org_chart_enabled);
  } catch {
    return resolveIsOrgChartEnabledFromWorkspace(undefined);
  }
}

function extractProjects(data: unknown): Array<{ id: string; name?: string }> {
  const result = data as {
    projects?: {
      edges?: Array<{ node: { id: string; name?: string } }>;
    };
  };
  const edges = result?.projects?.edges ?? [];
  return edges.map((edge) => edge.node);
}

function extractCandidates(
  data: unknown,
): Array<{ id: string; status?: string; projectsId?: string }> {
  const result = data as {
    candidates?: {
      edges?: Array<{
        node: { id: string; status?: string; projectsId?: string };
      }>;
    };
  };
  const edges = result?.candidates?.edges ?? [];
  return edges.map((e) => e.node);
}

function extractCountFromConnection(data: unknown, key: string): number {
  const result = data as Record<string, { edges?: unknown[] } | undefined>;
  return result?.[key]?.edges?.length ?? 0;
}

/**
 * Returns a summary of pending recruiter actions for the heartbeat prompt:
 * active jobs, candidate counts by status per job, shortlists and CV Sents counts.
 */
export const pendingActionsTools: McpTool[] = [
  {
    definition: {
      name: 'get_pending_recruiter_actions',
      description:
        'Get a summary of pending recruiter actions for the workspace: active jobs, candidate counts by status per job, and shortlist and CV Sent counts. Use this when building the autonomous recruiter heartbeat prompt or when the user asks what needs attention.',
      inputSchema: {
        type: 'object',
        properties: {
          maxJobs: {
            type: 'number',
            description:
              'Maximum number of active jobs to include (default: 20)',
          },
          maxCandidatesPerJob: {
            type: 'number',
            description:
              'When aggregating by status per job, max candidates to fetch per project(default: 200)',
          },
        },
      },
    },
    handler: async (args, config) => {
      const maxJobs = typeof args.maxJobs === 'number' ? args.maxJobs : 20;
      const maxCandidatesPerJob =
        typeof args.maxCandidatesPerJob === 'number'
          ? args.maxCandidatesPerJob
          : 200;

      const isOrgChartEnabled = await getIsOrgChartEnabled(
        config.baseUrl,
        config.apiToken,
      );
      const jobsQuery = getGraphqlToFindManyProjects(isOrgChartEnabled);

      const [jobsData, shortlistsData, cvSentsData] = await Promise.all([
        executeGraphQL(config.baseUrl, config.apiToken, jobsQuery, {
          filter: { isActive: { eq: true } },
          limit: maxJobs,
          orderBy: [{ updatedAt: 'DescNullsLast' }],
        }),
        executeGraphQL(
          config.baseUrl,
          config.apiToken,
          graphqlQueryToFindShortlists,
          {
            limit: 500,
            orderBy: [{ updatedAt: 'DescNullsLast' }],
          },
        ),
        executeGraphQL(
          config.baseUrl,
          config.apiToken,
          graphqlQueryToFindCvsent,
          {
            limit: 500,
            orderBy: [{ createdAt: 'DescNullsLast' }],
          },
        ),
      ]);

      const projects = extractProjects(jobsData);
      const shortlistsCount = extractCountFromConnection(
        shortlistsData,
        'shortlists',
      );
      const cvSentsCount = extractCountFromConnection(cvSentsData, 'cvsent');

      const candidatesByJob: Record<string, Record<string, number>> = {};
      for (const project of projects) {
        candidatesByJob[project.id] = {};
      }

      for (const project of projects) {
        const candidateData = await executeGraphQL(
          config.baseUrl,
          config.apiToken,
          graphqlToFetchAllCandidateData,
          {
            filter: { projectsId: { eq: project.id } },
            limit: maxCandidatesPerJob,
          },
        );
        const candidates = extractCandidates(candidateData);
        for (const candidate of candidates) {
          const status = candidate.status ?? 'Unknown';
          candidatesByJob[project.id][status] =
            (candidatesByJob[project.id][status] ?? 0) + 1;
        }
      }

      return {
        summary: {
          activeJobsCount: projects.length,
          totalShortlists: shortlistsCount,
          totalCvSents: cvSentsCount,
        },
        activeJobs: projects.map((project) => ({
          id: project.id,
          name: project.name,
          candidateCountByStatus: candidatesByJob[project.id] ?? {},
        })),
      };
    },
  },
];
