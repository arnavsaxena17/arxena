import { McpTool } from '../types/tool-types';
import { agentNotesTools } from './agent-notes-tools';
import { arxChatTools } from './arx-chat-tools';
import { candidateSearchTools } from './candidate-search-tools';
import { candidateTools } from './candidate-tools';
import { clientContactInterviewTools } from './client-contact-interview-tools';
import { companyTools } from './company-tools';
import { jobTools } from './job-tools';
import { linkedinSearchTools } from './linkedin-search-tools';
import { orgChartTools } from './org-chart-tools';
import { pendingActionsTools } from './pending-actions-tools';
import { personTools } from './person-tools';
import { reminderTools } from './reminder-tools';
import { shortlistCvsentTools } from './shortlist-cvsent-tools';

export const allTools: McpTool[] = [
  ...jobTools,
  ...candidateTools,
  ...personTools,
  ...companyTools,
  ...orgChartTools,
  ...candidateSearchTools,
  ...linkedinSearchTools,
  ...arxChatTools,
  ...shortlistCvsentTools,
  ...clientContactInterviewTools,
  ...pendingActionsTools,
  ...reminderTools,
  ...agentNotesTools,
];
