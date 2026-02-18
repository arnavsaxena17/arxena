import { McpTool } from '../types/tool-types';
import { arxChatTools } from './arx-chat-tools';
import { candidateSearchTools } from './candidate-search-tools';
import { candidateTools } from './candidate-tools';
import { companyTools } from './company-tools';
import { jobTools } from './job-tools';
import { linkedinSearchTools } from './linkedin-search-tools';
import { orgChartTools } from './org-chart-tools';
import { personTools } from './person-tools';

export const allTools: McpTool[] = [
  ...jobTools,
  ...candidateTools,
  ...personTools,
  ...companyTools,
  ...orgChartTools,
  ...candidateSearchTools,
  ...linkedinSearchTools,
  ...arxChatTools,
];
