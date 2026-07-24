import { McpTool } from '../types/tool-types';
import { agentNotesTools } from './agent-notes-tools';
import { arxChatTools } from './arx-chat-tools';
import { candidateSearchTools } from './candidate-search-tools';
import { candidateTools } from './candidate-tools';
import { clientContactInterviewTools } from './client-contact-interview-tools';
import { companyTools } from './company-tools';
import { esIndexSearchTools } from './es-index-search-tools';
import { internalTools } from './internal-tools';
import { jobTools } from './job-tools';
import { linkedinSearchTools } from './linkedin-search-tools';
import { orgChartTools } from './org-chart-tools';
import { peopleApiTools } from './people-api-tools';
import { pendingActionsTools } from './pending-actions-tools';
import { personTools } from './person-tools';
import { reminderTools } from './reminder-tools';
import { searchFetchTools } from './search-fetch-tools';
import { shortlistCvsentTools } from './shortlist-cvsent-tools';
import { unipileControllersTools } from './unipile-controllers-tools';

export const publicTools: McpTool[] = [
  ...searchFetchTools,
  ...jobTools,
  ...candidateTools,
  ...personTools,
  ...companyTools,
  ...orgChartTools,
  ...peopleApiTools,
  ...esIndexSearchTools,
  ...candidateSearchTools,
  ...linkedinSearchTools,
  ...arxChatTools,
  ...shortlistCvsentTools,
  ...clientContactInterviewTools,
  ...pendingActionsTools,
  ...reminderTools,
  ...agentNotesTools,
  ...unipileControllersTools,
];

export const allTools: McpTool[] = [...publicTools, ...internalTools];
