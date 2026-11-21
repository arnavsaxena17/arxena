import { McpTool } from '../types/tool-types';
import { arxChatTools } from './arx-chat-tools';
import { candidateSearchTools } from './candidate-search-tools';
import { candidateTools } from './candidate-tools';
import { esIndexSearchTools } from './es-index-search-tools';
import { harvestSearchTools } from './harvest-search-tools';
import { internalTools } from './internal-tools';
import { linkedinSearchTools } from './linkedin-search-tools';
import { orgChartTools } from './org-chart-tools';
import { peopleApiTools } from './people-api-tools';
import { localBusinessDataTools } from './local-business-data-tools';
import { brightDataBusinessSearchTools } from './bright-data-business-search-tools';
import { personTools } from './person-tools';
import { resolveSurfaceTools } from './meta-tools';
import { searchFetchTools } from './search-fetch-tools';
import { shortlistCvsentTools } from './shortlist-cvsent-tools';
import { unipileControllersTools } from './unipile-controllers-tools';
import { wikidataTools } from './wikidata-tools';

export const publicTools: McpTool[] = [
  ...searchFetchTools,
  ...candidateTools,
  ...personTools,
  ...orgChartTools,
  ...peopleApiTools,
  ...localBusinessDataTools,
  ...brightDataBusinessSearchTools,
  ...esIndexSearchTools,
  ...candidateSearchTools,
  ...linkedinSearchTools,
  ...harvestSearchTools,
  ...wikidataTools,
  ...arxChatTools,
  ...shortlistCvsentTools,
  ...unipileControllersTools,
];

export const allTools: McpTool[] = [...publicTools, ...internalTools];

export const resolveListedTools = (
  tools: McpTool[],
  options: { metaToolsOnly: boolean },
): McpTool[] => resolveSurfaceTools(tools, options);
