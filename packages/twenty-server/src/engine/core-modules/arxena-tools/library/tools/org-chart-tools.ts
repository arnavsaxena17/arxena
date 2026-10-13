import {
  GET_ORG_CHART_INPUT_DESCRIPTOR,
  GET_ORG_CHART_NODE_PEOPLE_INPUT_DESCRIPTOR,
  GOOGLE_SERP_SEARCH_INPUT_DESCRIPTOR,
  LIST_ORG_CHART_POSITIONS_INPUT_DESCRIPTOR,
  SEARCH_ORG_CHARTS_BY_COUNTRY_INPUT_DESCRIPTOR,
  SEARCH_ORG_CHARTS_BY_FUNCTION_INPUT_DESCRIPTOR,
} from '../utils/McpToolSchemas';

import { fetchOrgChart, fetchOrgChartNodePeople } from '../api/org-chart-api';
import { callRestAPI } from '../api/rest-client';
import { McpTool } from '../types/tool-types';
import { descriptorToInputSchema } from '../utils/input-schema';
import { projectOrgChartPositions } from '../utils/project-org-chart-positions';

function generateSlug(companyName: string): string {
  return companyName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const resolveCompanyId = async (
  config: { baseUrl: string; apiToken: string },
  companyId: string | undefined,
  companyName: string | undefined,
): Promise<{ companyId: string; companyName?: string }> => {
  if (companyId) {
    return { companyId, companyName };
  }

  if (!companyName) {
    throw new Error('Either companyId or companyName must be provided');
  }

  const result = (await callRestAPI(
    config.baseUrl,
    config.apiToken,
    'org-chart',
    'companies/find-by-name',
    { companyName },
  )) as {
    found: boolean;
    companyId?: string;
    companyName?: string;
    message?: string;
  };

  if (result.found && result.companyId) {
    return {
      companyId: result.companyId,
      companyName: result.companyName ?? companyName,
    };
  }

  throw new Error(
    result.message ??
      `Company "${companyName}" not found in local database or LinkedIn search`,
  );
};

export const orgChartTools: McpTool[] = [
  {
    definition: {
      name: 'list_org_chart_positions',
      description:
        'List compact org-chart positions (key, parent, headline, taxonomy, peopleCount) without embedded people. Prefer this over get_org_chart for Ask AI structure walks; then call get_org_chart_node_people for shortlisted nodes.',
      inputSchema: descriptorToInputSchema(
        LIST_ORG_CHART_POSITIONS_INPUT_DESCRIPTOR,
      ),
    },
    handler: async (args, config) => {
      const resolved = await resolveCompanyId(
        config,
        args.companyId as string | undefined,
        args.companyName as string | undefined,
      );
      const country =
        typeof args.country === 'string' ? args.country : undefined;
      const functionRoot =
        typeof args.functionRoot === 'string' ? args.functionRoot : undefined;
      const stdFunction =
        typeof args.stdFunction === 'string' ? args.stdFunction : undefined;
      const stdFunctionRoot =
        typeof args.stdFunctionRoot === 'string'
          ? args.stdFunctionRoot
          : undefined;
      const stdGrade =
        typeof args.stdGrade === 'string' ? args.stdGrade : undefined;
      const headlineContains =
        typeof args.headlineContains === 'string'
          ? args.headlineContains
          : undefined;
      const limit = typeof args.limit === 'number' ? args.limit : undefined;

      const orgChartData = await fetchOrgChart(
        config.baseUrl,
        config.apiToken,
        resolved.companyId,
        {
          companyName: resolved.companyName,
          country,
          functionRoot,
        },
      );

      const positions = projectOrgChartPositions(orgChartData, {
        stdFunction,
        stdFunctionRoot,
        stdGrade,
        headlineContains,
        limit,
      });

      const displayName = resolved.companyName || resolved.companyId;
      const slug = generateSlug(displayName);

      return {
        companyId: resolved.companyId,
        companyName: displayName,
        slug,
        country: country || 'global',
        functionRoot: functionRoot || 'fullcompany',
        positionCount: positions.length,
        positions,
        viewUrl: `/org-chart/${slug}/${resolved.companyId}/${slug}`,
      };
    },
  },

  {
    definition: {
      name: 'get_org_chart',
      description:
        'Get the full org chart payload for a company (includes embedded people). Prefer list_org_chart_positions for structure/people research — full charts often exceed size limits.',
      inputSchema: descriptorToInputSchema(GET_ORG_CHART_INPUT_DESCRIPTOR),
    },
    handler: async (args, config) => {
      let companyId = args.companyId as string | undefined;
      let companyName = args.companyName as string | undefined;
      const country = args.country as string | undefined;
      const functionRoot = args.functionRoot as string | undefined;

      // If companyId is not provided but companyName is, try to find it
      if (!companyId && companyName) {
        const result = (await callRestAPI(
          config.baseUrl,
          config.apiToken,
          'org-chart',
          'companies/find-by-name',
          { companyName },
        )) as {
          found: boolean;
          companyId?: string;
          companyName?: string;
          message?: string;
        };

        if (result.found && result.companyId) {
          companyId = result.companyId;
          companyName = result.companyName ?? companyName;
        } else {
          throw new Error(
            result.message ??
              `Company "${companyName}" not found in local database or LinkedIn search`,
          );
        }
      }

      if (!companyId) {
        throw new Error('Either companyId or companyName must be provided');
      }

      const orgChartData = await fetchOrgChart(
        config.baseUrl,
        config.apiToken,
        companyId,
        {
          companyName,
          country,
          functionRoot,
        },
      );

      const slug = companyName
        ? generateSlug(companyName)
        : generateSlug(companyId);

      const displayName = companyName || companyId;
      return {
        companyId,
        companyName: displayName,
        slug,
        country: country || 'global',
        functionRoot: functionRoot || 'fullcompany',
        orgChartData,
        viewUrl: `/org-chart/${slug}/${companyId}/${slug}`,
      };
    },
  },

  {
    definition: {
      name: 'search_org_charts_by_country',
      description:
        'Search for org charts filtered by country. Returns a list of org charts matching the criteria.',
      inputSchema: descriptorToInputSchema(
        SEARCH_ORG_CHARTS_BY_COUNTRY_INPUT_DESCRIPTOR,
      ),
    },
    handler: async (args, config) => {
      let companyId = args.companyId as string | undefined;
      let companyName = args.companyName as string | undefined;
      const country = args.country as string;
      const limit = typeof args.limit === 'number' ? args.limit : 10;

      // If companyId is not provided but companyName is, try to find it
      if (!companyId && companyName) {
        const result = (await callRestAPI(
          config.baseUrl,
          config.apiToken,
          'org-chart',
          'companies/find-by-name',
          { companyName },
        )) as {
          found: boolean;
          companyId?: string;
          companyName?: string;
          message?: string;
        };

        if (result.found && result.companyId) {
          companyId = result.companyId;
          companyName = result.companyName ?? companyName;
        } else {
          throw new Error(
            result.message ??
              `Company "${companyName}" not found in local database or LinkedIn search`,
          );
        }
      }

      if (!companyId) {
        throw new Error('Either companyId or companyName must be provided');
      }

      const orgChartData = await fetchOrgChart(
        config.baseUrl,
        config.apiToken,
        companyId,
        {
          companyName,
          country,
        },
      );

      const slug = companyName
        ? generateSlug(companyName)
        : generateSlug(companyId);

      const displayName = companyName || companyId;
      return {
        count: 1,
        orgCharts: [
          {
            companyId,
            companyName: displayName,
            slug,
            country,
            viewUrl: `/org-chart/${slug}/${companyId}/${slug}`,
            hasData: !!orgChartData?.orgchart,
          },
        ],
      };
    },
  },

  {
    definition: {
      name: 'search_org_charts_by_function',
      description:
        'Search for org charts filtered by function/department. Returns a list of org charts matching the criteria.',
      inputSchema: descriptorToInputSchema(
        SEARCH_ORG_CHARTS_BY_FUNCTION_INPUT_DESCRIPTOR,
      ),
    },
    handler: async (args, config) => {
      let companyId = args.companyId as string | undefined;
      let companyName = args.companyName as string | undefined;
      const functionRoot = args.functionRoot as string;
      const limit = typeof args.limit === 'number' ? args.limit : 10;

      // If companyId is not provided but companyName is, try to find it
      if (!companyId && companyName) {
        const result = (await callRestAPI(
          config.baseUrl,
          config.apiToken,
          'org-chart',
          'companies/find-by-name',
          { companyName },
        )) as {
          found: boolean;
          companyId?: string;
          companyName?: string;
          message?: string;
        };

        if (result.found && result.companyId) {
          companyId = result.companyId;
          companyName = result.companyName ?? companyName;
        } else {
          throw new Error(
            result.message ??
              `Company "${companyName}" not found in local database or LinkedIn search`,
          );
        }
      }

      if (!companyId) {
        throw new Error('Either companyId or companyName must be provided');
      }

      const orgChartData = await fetchOrgChart(
        config.baseUrl,
        config.apiToken,
        companyId,
        {
          companyName,
          functionRoot,
        },
      );

      const slug = companyName
        ? generateSlug(companyName)
        : generateSlug(companyId);

      const displayName = companyName || companyId;
      return {
        count: 1,
        orgCharts: [
          {
            companyId,
            companyName: displayName,
            slug,
            functionRoot,
            viewUrl: `/org-chart/${slug}/${companyId}/${slug}`,
            hasData: !!orgChartData?.orgchart,
          },
        ],
      };
    },
  },

  {
    definition: {
      name: 'get_org_chart_node_people',
      description:
        'List stored org-chart people for a shortlisted node (name, job title, headline, summary from the saved chart + candidates.json, not people_all). REQUIRED: nodeKey (preferred, from list_org_chart_positions) or stdFunction / stdFunctionRoot — never call with only companyId. Returns node metadata + people. Not for highlighting (use highlight_org_chart with nodeKeys).',
      inputSchema: descriptorToInputSchema(
        GET_ORG_CHART_NODE_PEOPLE_INPUT_DESCRIPTOR,
      ),
    },
    handler: async (args, config) => {
      const resolved = await resolveCompanyId(
        config,
        args.companyId as string | undefined,
        args.companyName as string | undefined,
      );
      const nodeKey =
        typeof args.nodeKey === 'number'
          ? args.nodeKey
          : typeof args.nodeKey === 'string' &&
              Number.isFinite(Number(args.nodeKey))
            ? Number(args.nodeKey)
            : undefined;
      const stdFunction =
        typeof args.stdFunction === 'string' ? args.stdFunction : undefined;
      const stdFunctionRoot =
        typeof args.stdFunctionRoot === 'string'
          ? args.stdFunctionRoot
          : undefined;
      const stdGrade =
        typeof args.stdGrade === 'string' ? args.stdGrade : undefined;
      const country =
        typeof args.country === 'string' ? args.country : undefined;
      const limit = typeof args.limit === 'number' ? args.limit : undefined;

      if (nodeKey === undefined && !stdFunction && !stdFunctionRoot) {
        throw new Error(
          'Provide nodeKey from list_org_chart_positions, or stdFunction / stdFunctionRoot',
        );
      }

      return fetchOrgChartNodePeople(
        config.baseUrl,
        config.apiToken,
        resolved.companyId,
        {
          companyName: resolved.companyName,
          nodeKey,
          stdFunction,
          stdFunctionRoot,
          stdGrade,
          country,
          limit,
        },
      );
    },
  },

  {
    definition: {
      name: 'google_serp_search',
      description:
        'Google organic web search (title, url, snippet) via Bright Data SERP. Use after get_org_chart_node_people to corroborate named people or public facts. Pass a focused query; not a people index and not a substitute for stored org-chart profiles.',
      inputSchema: descriptorToInputSchema(GOOGLE_SERP_SEARCH_INPUT_DESCRIPTOR),
    },
    handler: async (args, config) => {
      const query = typeof args.query === 'string' ? args.query.trim() : '';

      if (!query) {
        throw new Error('query is required');
      }

      const limit = typeof args.limit === 'number' ? args.limit : undefined;

      return callRestAPI(
        config.baseUrl,
        config.apiToken,
        'org-chart',
        'google-serp-search',
        {
          query,
          ...(limit !== undefined ? { limit } : {}),
        },
      );
    },
  },
];
