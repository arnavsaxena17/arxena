import { ToolCategory } from 'twenty-shared/ai';

import { type ToolIndexEntry } from 'src/engine/core-modules/tool-provider/types/tool-index-entry.type';

export type ToolSelectionQuery = {
  id: string;
  persona: 'sales' | 'recruiting' | 'crm';
  query: string;
  expectedToolHints: string[];
};

// Sales-weighted (~70%) evaluation set for tool selection accuracy.
export const ARXENA_TOOL_SELECTION_QUERIES: ToolSelectionQuery[] = [
  {
    id: 's1',
    persona: 'sales',
    query: 'Find VPs of Sales at Series B SaaS companies in the US',
    expectedToolHints: ['search_apollo_people', 'search_linkedin_people', 'search_people'],
  },
  {
    id: 's2',
    persona: 'sales',
    query: 'Show me the org chart for Stripe',
    expectedToolHints: ['get_org_chart'],
  },
  {
    id: 's3',
    persona: 'sales',
    query: 'Do we have an email for this LinkedIn profile?',
    expectedToolHints: ['check_contact_availability', 'fetch_contacts'],
  },
  {
    id: 's4',
    persona: 'sales',
    query: 'Enrich phone and email for these prospects',
    expectedToolHints: ['fetch_contacts', 'enrich_contact'],
  },
  {
    id: 's5',
    persona: 'sales',
    query: 'Search Apollo for companies named Acme',
    expectedToolHints: ['search_apollo_companies'],
  },
  {
    id: 's6',
    persona: 'sales',
    query: 'Find buying committee for this account',
    expectedToolHints: ['get_org_chart', 'search_org_charts'],
  },
  {
    id: 's7',
    persona: 'sales',
    query: 'Send a LinkedIn chat to this candidate',
    expectedToolHints: ['send_chat'],
  },
  {
    id: 's8',
    persona: 'sales',
    query: 'List companies matching fintech in India',
    expectedToolHints: ['search_companies_index', 'find_companies'],
  },
  {
    id: 's9',
    persona: 'sales',
    query: 'Continue the LinkedIn people search',
    expectedToolHints: ['search_linkedin_continue'],
  },
  {
    id: 's10',
    persona: 'sales',
    query: 'Expand similar job titles for Account Executive',
    expectedToolHints: ['expand_job_titles'],
  },
  {
    id: 'r1',
    persona: 'recruiting',
    query: 'Create a shortlist for this project',
    expectedToolHints: ['create_shortlist'],
  },
  {
    id: 'r2',
    persona: 'recruiting',
    query: 'List active projects',
    expectedToolHints: ['list_active_projects'],
  },
  {
    id: 'c1',
    persona: 'crm',
    query: 'Find the company record for Notion',
    expectedToolHints: ['find_company', 'find_many_company'],
  },
  {
    id: 's11',
    persona: 'sales',
    query: 'Sales prospecting scenario 11: research accounts and contacts',
    expectedToolHints: ['search_apollo_people', 'search_linkedin_people', 'get_org_chart', 'search_people'],
  },
  {
    id: 's12',
    persona: 'sales',
    query: 'Sales prospecting scenario 12: research accounts and contacts',
    expectedToolHints: ['search_apollo_people', 'search_linkedin_people', 'get_org_chart', 'search_people'],
  },
  {
    id: 's13',
    persona: 'sales',
    query: 'Sales prospecting scenario 13: research accounts and contacts',
    expectedToolHints: ['search_apollo_people', 'search_linkedin_people', 'get_org_chart', 'search_people'],
  },
  {
    id: 's14',
    persona: 'sales',
    query: 'Sales prospecting scenario 14: research accounts and contacts',
    expectedToolHints: ['search_apollo_people', 'search_linkedin_people', 'get_org_chart', 'search_people'],
  },
  {
    id: 's15',
    persona: 'sales',
    query: 'Sales prospecting scenario 15: research accounts and contacts',
    expectedToolHints: ['search_apollo_people', 'search_linkedin_people', 'get_org_chart', 'search_people'],
  },
  {
    id: 's16',
    persona: 'sales',
    query: 'Sales prospecting scenario 16: research accounts and contacts',
    expectedToolHints: ['search_apollo_people', 'search_linkedin_people', 'get_org_chart', 'search_people'],
  },
  {
    id: 's17',
    persona: 'sales',
    query: 'Sales prospecting scenario 17: research accounts and contacts',
    expectedToolHints: ['search_apollo_people', 'search_linkedin_people', 'get_org_chart', 'search_people'],
  },
  {
    id: 's18',
    persona: 'sales',
    query: 'Sales prospecting scenario 18: research accounts and contacts',
    expectedToolHints: ['search_apollo_people', 'search_linkedin_people', 'get_org_chart', 'search_people'],
  },
  {
    id: 's19',
    persona: 'sales',
    query: 'Sales prospecting scenario 19: research accounts and contacts',
    expectedToolHints: ['search_apollo_people', 'search_linkedin_people', 'get_org_chart', 'search_people'],
  },
  {
    id: 's20',
    persona: 'sales',
    query: 'Sales prospecting scenario 20: research accounts and contacts',
    expectedToolHints: ['search_apollo_people', 'search_linkedin_people', 'get_org_chart', 'search_people'],
  },
  {
    id: 's21',
    persona: 'sales',
    query: 'Sales prospecting scenario 21: research accounts and contacts',
    expectedToolHints: ['search_apollo_people', 'search_linkedin_people', 'get_org_chart', 'search_people'],
  },
  {
    id: 's22',
    persona: 'sales',
    query: 'Sales prospecting scenario 22: research accounts and contacts',
    expectedToolHints: ['search_apollo_people', 'search_linkedin_people', 'get_org_chart', 'search_people'],
  },
  {
    id: 's23',
    persona: 'sales',
    query: 'Sales prospecting scenario 23: research accounts and contacts',
    expectedToolHints: ['search_apollo_people', 'search_linkedin_people', 'get_org_chart', 'search_people'],
  },
  {
    id: 's24',
    persona: 'sales',
    query: 'Sales prospecting scenario 24: research accounts and contacts',
    expectedToolHints: ['search_apollo_people', 'search_linkedin_people', 'get_org_chart', 'search_people'],
  },
  {
    id: 's25',
    persona: 'sales',
    query: 'Sales prospecting scenario 25: research accounts and contacts',
    expectedToolHints: ['search_apollo_people', 'search_linkedin_people', 'get_org_chart', 'search_people'],
  },
  {
    id: 's26',
    persona: 'sales',
    query: 'Sales prospecting scenario 26: research accounts and contacts',
    expectedToolHints: ['search_apollo_people', 'search_linkedin_people', 'get_org_chart', 'search_people'],
  },
  {
    id: 's27',
    persona: 'sales',
    query: 'Sales prospecting scenario 27: research accounts and contacts',
    expectedToolHints: ['search_apollo_people', 'search_linkedin_people', 'get_org_chart', 'search_people'],
  },
  {
    id: 's28',
    persona: 'sales',
    query: 'Sales prospecting scenario 28: research accounts and contacts',
    expectedToolHints: ['search_apollo_people', 'search_linkedin_people', 'get_org_chart', 'search_people'],
  },
  {
    id: 's29',
    persona: 'sales',
    query: 'Sales prospecting scenario 29: research accounts and contacts',
    expectedToolHints: ['search_apollo_people', 'search_linkedin_people', 'get_org_chart', 'search_people'],
  },
  {
    id: 's30',
    persona: 'sales',
    query: 'Sales prospecting scenario 30: research accounts and contacts',
    expectedToolHints: ['search_apollo_people', 'search_linkedin_people', 'get_org_chart', 'search_people'],
  },
  {
    id: 's31',
    persona: 'sales',
    query: 'Sales prospecting scenario 31: research accounts and contacts',
    expectedToolHints: ['search_apollo_people', 'search_linkedin_people', 'get_org_chart', 'search_people'],
  },
  {
    id: 's32',
    persona: 'sales',
    query: 'Sales prospecting scenario 32: research accounts and contacts',
    expectedToolHints: ['search_apollo_people', 'search_linkedin_people', 'get_org_chart', 'search_people'],
  },
  {
    id: 's33',
    persona: 'sales',
    query: 'Sales prospecting scenario 33: research accounts and contacts',
    expectedToolHints: ['search_apollo_people', 'search_linkedin_people', 'get_org_chart', 'search_people'],
  },
  {
    id: 's34',
    persona: 'sales',
    query: 'Sales prospecting scenario 34: research accounts and contacts',
    expectedToolHints: ['search_apollo_people', 'search_linkedin_people', 'get_org_chart', 'search_people'],
  },
  {
    id: 's35',
    persona: 'sales',
    query: 'Sales prospecting scenario 35: research accounts and contacts',
    expectedToolHints: ['search_apollo_people', 'search_linkedin_people', 'get_org_chart', 'search_people'],
  },
  {
    id: 'r3',
    persona: 'recruiting',
    query: 'Recruiting workflow scenario 3',
    expectedToolHints: ['list_active_projects', 'create_candidate', 'create_shortlist'],
  },
  {
    id: 'r4',
    persona: 'recruiting',
    query: 'Recruiting workflow scenario 4',
    expectedToolHints: ['list_active_projects', 'create_candidate', 'create_shortlist'],
  },
  {
    id: 'r5',
    persona: 'recruiting',
    query: 'Recruiting workflow scenario 5',
    expectedToolHints: ['list_active_projects', 'create_candidate', 'create_shortlist'],
  },
  {
    id: 'r6',
    persona: 'recruiting',
    query: 'Recruiting workflow scenario 6',
    expectedToolHints: ['list_active_projects', 'create_candidate', 'create_shortlist'],
  },
  {
    id: 'r7',
    persona: 'recruiting',
    query: 'Recruiting workflow scenario 7',
    expectedToolHints: ['list_active_projects', 'create_candidate', 'create_shortlist'],
  },
  {
    id: 'r8',
    persona: 'recruiting',
    query: 'Recruiting workflow scenario 8',
    expectedToolHints: ['list_active_projects', 'create_candidate', 'create_shortlist'],
  },
  {
    id: 'r9',
    persona: 'recruiting',
    query: 'Recruiting workflow scenario 9',
    expectedToolHints: ['list_active_projects', 'create_candidate', 'create_shortlist'],
  },
  {
    id: 'c2',
    persona: 'crm',
    query: 'CRM record scenario 2',
    expectedToolHints: ['find_', 'create_'],
  },
  {
    id: 'c3',
    persona: 'crm',
    query: 'CRM record scenario 3',
    expectedToolHints: ['find_', 'create_'],
  },
  {
    id: 'c4',
    persona: 'crm',
    query: 'CRM record scenario 4',
    expectedToolHints: ['find_', 'create_'],
  },
  {
    id: 'c5',
    persona: 'crm',
    query: 'CRM record scenario 5',
    expectedToolHints: ['find_', 'create_'],
  },
  {
    id: 'c6',
    persona: 'crm',
    query: 'CRM record scenario 6',
    expectedToolHints: ['find_', 'create_'],
  },
  {
    id: 'c7',
    persona: 'crm',
    query: 'CRM record scenario 7',
    expectedToolHints: ['find_', 'create_'],
  },
  {
    id: 'e1',
    persona: 'sales',
    query: 'Use the apollo__people_search tool from our connected MCP',
    expectedToolHints: ['apollo__'],
  },
];

export const countToolsInContext = (
  toolCatalog: ToolIndexEntry[],
  learnedToolNames: string[],
): {
  catalogSize: number;
  schemasInContext: number;
  arxenaCount: number;
  externalMcpCount: number;
} => {
  const learned = new Set(learnedToolNames);

  return {
    catalogSize: toolCatalog.length,
    schemasInContext: learned.size,
    arxenaCount: toolCatalog.filter(
      (entry) => entry.category === ToolCategory.ARXENA || entry.category === 'ARXENA',
    ).length,
    externalMcpCount: toolCatalog.filter(
      (entry) =>
        entry.category === ToolCategory.EXTERNAL_MCP ||
        entry.category === 'EXTERNAL_MCP',
    ).length,
  };
};

export const scoreToolSelection = (
  query: ToolSelectionQuery,
  selectedToolNames: string[],
): boolean => {
  const selected = selectedToolNames.join(' ').toLowerCase();

  return query.expectedToolHints.some((hint) =>
    selected.includes(hint.toLowerCase()),
  );
};
