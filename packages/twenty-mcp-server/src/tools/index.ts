import { McpTool } from '../types/tool-types';
import { agentNotesTools } from './agent-notes-tools';
import { arxChatTools } from './arx-chat-tools';
import { candidateSearchTools } from './candidate-search-tools';
import { candidateTools } from './candidate-tools';
import { companyTools } from './company-tools';
import { esIndexSearchTools } from './es-index-search-tools';
import { internalTools } from './internal-tools';
import { projectTools } from './project-tools';
import { linkedinSearchTools } from './linkedin-search-tools';
import { orgChartTools } from './org-chart-tools';
import { peopleApiTools } from './people-api-tools';
import { localBusinessDataTools } from './local-business-data-tools';
import { pendingActionsTools } from './pending-actions-tools';
import { personTools } from './person-tools';
import { resolveSurfaceTools } from './meta-tools';
import { searchFetchTools } from './search-fetch-tools';
import { shortlistCvsentTools } from './shortlist-cvsent-tools';
import { unipileControllersTools } from './unipile-controllers-tools';
import { wikidataTools } from './wikidata-tools';

export const publicTools: McpTool[] = [
  ...searchFetchTools,
  ...projectTools,
  ...candidateTools,
  ...personTools,
  ...companyTools,
  ...orgChartTools,
  ...peopleApiTools,
  ...localBusinessDataTools,
  ...esIndexSearchTools,
  ...candidateSearchTools,
  ...linkedinSearchTools,
  ...wikidataTools,
  ...arxChatTools,
  ...shortlistCvsentTools,
  ...pendingActionsTools,
  ...agentNotesTools,
  ...unipileControllersTools,
];

export const allTools: McpTool[] = [...publicTools, ...internalTools];

export const resolveListedTools = (
  tools: McpTool[],
  options: { metaToolsOnly: boolean },
): McpTool[] => resolveSurfaceTools(tools, options);
