import {
    SEARCH_COMPANIES_INDEX_INPUT_DESCRIPTOR,
    SEARCH_PEOPLE_INDEX_INPUT_DESCRIPTOR,
} from '../utils/McpToolSchemas';

import { callRestAPI, callRestAPIGet } from '../api/rest-client';
import { McpTool } from '../types/tool-types';
import { descriptorToInputSchema } from '../utils/input-schema';

const hasAtLeastOneFilter = (
  args: Record<string, unknown>,
  keys: string[],
): boolean =>
  keys.some((key) => {
    const value = args[key];
    return typeof value === 'string' && value.trim().length > 0;
  });

export const esIndexSearchTools: McpTool[] = [
  {
    definition: {
      name: 'search_people_index',
      title: 'Search people index',
      description:
        'Search the Arxena Elasticsearch people index (people_all) for professionals by name, title, company, function, grade, country, or LinkedIn URL. Returns profile fields from the global people database (not workspace CRM records).',
      annotations: { readOnlyHint: true },
      inputSchema: descriptorToInputSchema(SEARCH_PEOPLE_INDEX_INPUT_DESCRIPTOR),
    },
    handler: async (args, config) => {
      const filterKeys = [
        'query',
        'personName',
        'jobTitle',
        'companyId',
        'companyName',
        'website',
        'stdFunction',
        'stdGrade',
        'country',
        'linkedinUrl',
      ];

      if (!hasAtLeastOneFilter(args, filterKeys)) {
        throw new Error(
          'At least one search filter is required (query, personName, jobTitle, companyId, companyName, website, stdFunction, stdGrade, country, or linkedinUrl).',
        );
      }

      return callRestAPI(
        config.baseUrl,
        config.apiToken,
        'elasticsearch-search',
        'people',
        {
          query: args.query,
          personName: args.personName,
          jobTitle: args.jobTitle,
          companyId: args.companyId,
          companyName: args.companyName,
          website: args.website,
          stdFunction: args.stdFunction,
          stdGrade: args.stdGrade,
          country: args.country,
          linkedinUrl: args.linkedinUrl,
          limit: args.limit,
          offset: args.offset,
        },
      );
    },
  },
  {
    definition: {
      name: 'search_companies_index',
      title: 'Search companies index',
      description:
        'Search the Arxena Elasticsearch std_company_data_scores index for companies by name, website, industry, or company id. Returns scored company metadata (corporate_score, count_org, linkedin_url, is_org_chart) from the global companies database (not workspace CRM companies).',
      annotations: { readOnlyHint: true },
      inputSchema: descriptorToInputSchema(
        SEARCH_COMPANIES_INDEX_INPUT_DESCRIPTOR,
      ),
    },
    handler: async (args, config) => {
      const filterKeys = [
        'query',
        'companyName',
        'companyId',
        'website',
        'industry',
      ];

      if (!hasAtLeastOneFilter(args, filterKeys)) {
        throw new Error(
          'At least one search filter is required (query, companyName, companyId, website, or industry).',
        );
      }

      return callRestAPI(
        config.baseUrl,
        config.apiToken,
        'elasticsearch-search',
        'companies',
        {
          query: args.query,
          companyName: args.companyName,
          companyId: args.companyId,
          website: args.website,
          industry: args.industry,
          limit: args.limit,
          offset: args.offset,
        },
      );
    },
  },
  {
    definition: {
      name: 'get_elasticsearch_index_status',
      title: 'Elasticsearch index status',
      description:
        'Check whether the Arxena Elasticsearch people, companies, and org chart indices are configured and which index names are in use.',
      annotations: { readOnlyHint: true },
      inputSchema: { type: 'object', properties: {} },
    },
    handler: async (_args, config) =>
      callRestAPIGet(
        config.baseUrl,
        config.apiToken,
        'elasticsearch-search',
        'status',
      ),
  },
];
