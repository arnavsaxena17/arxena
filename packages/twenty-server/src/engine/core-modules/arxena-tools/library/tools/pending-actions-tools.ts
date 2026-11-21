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
): Array<{ id: string; status?: string; projectId?: string }> {
  const result = data as {
    candidates?: {
      edges?: Array<{
        node: { id: string; status?: string; projectId?: string };
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
//
