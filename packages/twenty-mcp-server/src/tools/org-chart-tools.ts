import {
  GET_ORG_CHART_INPUT_DESCRIPTOR,
  SEARCH_ORG_CHARTS_BY_COUNTRY_INPUT_DESCRIPTOR,
  SEARCH_ORG_CHARTS_BY_FUNCTION_INPUT_DESCRIPTOR,
} from 'twenty-shared';

import { fetchOrgChart } from '../api/org-chart-api';
import { callRestAPI } from '../api/rest-client';
import { McpTool } from '../types/tool-types';
import { descriptorToInputSchema } from '../utils/input-schema';

function generateSlug(companyName: string): string {
  return companyName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}


export const orgChartTools: McpTool[] = [
  {
    definition: {
      name: 'get_org_chart',
      description:
        'Get an org chart for a company. Returns org chart data with metadata including company ID, name, and URL slug for viewing the full chart.',
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
        throw new Error(
          'Either companyId or companyName must be provided',
        );
      }

      const orgChartData = await fetchOrgChart(config.baseUrl, config.apiToken, companyId, {
        companyName,
        country,
        functionRoot,
      });

      const slug = companyName ? generateSlug(companyName) : generateSlug(companyId);

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
      inputSchema: descriptorToInputSchema(SEARCH_ORG_CHARTS_BY_COUNTRY_INPUT_DESCRIPTOR),
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
        throw new Error(
          'Either companyId or companyName must be provided',
        );
      }

      const orgChartData = await fetchOrgChart(config.baseUrl, config.apiToken, companyId, {
        companyName,
        country,
      });

      const slug = companyName ? generateSlug(companyName) : generateSlug(companyId);

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
      inputSchema: descriptorToInputSchema(SEARCH_ORG_CHARTS_BY_FUNCTION_INPUT_DESCRIPTOR),
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
        throw new Error(
          'Either companyId or companyName must be provided',
        );
      }

      const orgChartData = await fetchOrgChart(config.baseUrl, config.apiToken, companyId, {
        companyName,
        functionRoot,
      });

      const slug = companyName ? generateSlug(companyName) : generateSlug(companyId);

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
];
