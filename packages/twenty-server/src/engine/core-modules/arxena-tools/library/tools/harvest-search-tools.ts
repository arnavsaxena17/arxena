import {
  SEARCH_HARVEST_ACCOUNTS_TOOL_NAME,
  SEARCH_HARVEST_LEADS_TOOL_NAME,
} from 'src/engine/core-modules/arxena-tools/constants/arxena-tool-names.const';

import { callRestAPI } from '../api/rest-client';
import { McpTool } from '../types/tool-types';
import { descriptorToInputSchema } from '../utils/input-schema';
import {
  SEARCH_HARVEST_ACCOUNTS_INPUT_DESCRIPTOR,
  SEARCH_HARVEST_LEADS_INPUT_DESCRIPTOR,
} from '../utils/McpToolSchemas';

type HarvestSearchArgs = {
  searchParameters?: Record<string, unknown>;
  page?: number;
  limit?: number;
};

// Results route into an outreach list (and the project tab with projectId);
// the list records the spend
export const harvestSearchTools: McpTool[] = [
  {
    definition: {
      name: SEARCH_HARVEST_LEADS_TOOL_NAME,
      description:
        'Paid ($0.004 per record) LinkedIn Sales Navigator people search through Harvest; no LinkedIn seat needed. Pass queries[i].searchParameters from generate_linkedin_query_set with provider harvest. Returns listId, counts, costUsd and paging.nextPage.',
      inputSchema: descriptorToInputSchema(
        SEARCH_HARVEST_LEADS_INPUT_DESCRIPTOR,
      ),
    },
    handler: async (args, config) => {
      const { searchParameters, page, limit } = args as HarvestSearchArgs;

      return callRestAPI(
        config.baseUrl,
        config.apiToken,
        'harvest-search',
        'leads',
        { searchParameters, page, limit },
      );
    },
  },
  {
    definition: {
      name: SEARCH_HARVEST_ACCOUNTS_TOOL_NAME,
      description:
        'Paid ($0.004 per record) LinkedIn Sales Navigator company search through Harvest: headcount and growth, revenue, department headcount, hiring. Pass queries[i].searchParameters from generate_linkedin_query_set with provider harvest and category companies. Returns listId, counts, costUsd and paging.nextPage.',
      inputSchema: descriptorToInputSchema(
        SEARCH_HARVEST_ACCOUNTS_INPUT_DESCRIPTOR,
      ),
    },
    handler: async (args, config) => {
      const { searchParameters, page, limit } = args as HarvestSearchArgs;

      return callRestAPI(
        config.baseUrl,
        config.apiToken,
        'harvest-search',
        'accounts',
        { searchParameters, page, limit },
      );
    },
  },
];
