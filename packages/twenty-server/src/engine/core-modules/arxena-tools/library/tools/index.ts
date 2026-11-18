import { McpTool } from '../types/tool-types';
import { agentNotesTools } from './agent-notes-tools';
import { arxChatTools } from './arx-chat-tools';
import { candidateSearchTools } from './candidate-search-tools';
import { candidateTools } from './candidate-tools';
// SIMPLIFIED_SEARCH: every people/company source except Bright Data is off, so
// its tool family is not imported and never reaches the agent surface.
// import { esIndexSearchTools } from './es-index-search-tools';
// import { harvestSearchTools } from './harvest-search-tools';
import { internalTools } from './internal-tools';
import { projectTools } from './project-tools';
// import { linkedinSearchTools } from './linkedin-search-tools';
// import { orgChartTools } from './org-chart-tools';
// import { peopleApiTools } from './people-api-tools';
import { localBusinessDataTools } from './local-business-data-tools';
import { brightDataBusinessSearchTools } from './bright-data-business-search-tools';
import { pendingActionsTools } from './pending-actions-tools';
import { personTools } from './person-tools';
import { resolveSurfaceTools } from './meta-tools';
import { searchFetchTools } from './search-fetch-tools';
import { shortlistCvsentTools } from './shortlist-cvsent-tools';
// import { unipileControllersTools } from './unipile-controllers-tools';
// import { wikidataTools } from './wikidata-tools';

export const publicTools: McpTool[] = [
  ...searchFetchTools,
  ...projectTools,
  ...candidateTools,
  ...personTools,
  // SIMPLIFIED_SEARCH: Bright Data is the only source. The org chart, People
  // API, LinkedIn, Harvest, wikidata, ES-index and Unipile tool families are
  // commented out above and here, so no agent can call another database.
  // ...orgChartTools,
  // ...peopleApiTools,
  ...localBusinessDataTools,
  ...brightDataBusinessSearchTools,
  // ...esIndexSearchTools,
  ...candidateSearchTools,
  // ...linkedinSearchTools,
  // ...harvestSearchTools,
  // ...wikidataTools,
  ...arxChatTools,
  ...shortlistCvsentTools,
  ...pendingActionsTools,
  ...agentNotesTools,
  // ...unipileControllersTools,
];

export const allTools: McpTool[] = [...publicTools, ...internalTools];

export const resolveListedTools = (
  tools: McpTool[],
  options: { metaToolsOnly: boolean },
): McpTool[] => resolveSurfaceTools(tools, options);
