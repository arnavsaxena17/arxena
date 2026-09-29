import {
    SEARCH_COMPANIES_INDEX_INPUT_DESCRIPTOR,
    SEARCH_PEOPLE_INDEX_INPUT_DESCRIPTOR,
    RESOLVE_COMPANY_FROM_RAW_NAME_INPUT_DESCRIPTOR,
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
        'Search Arxena company Elasticsearch indices (free_company_dataset first, then std_company_data_scores) by name, website, industry, or company id. Returns company metadata (website, linkedin_url, industry, size) from the global companies database (not workspace CRM companies).',
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
      name: 'resolve_company_from_raw_name',
      title: 'Resolve company from raw name',
      description:
        'Resolve a messy / raw company name to a standardized company profile from the std_company_data_scores Elasticsearch index (CompanyCollector-style bool query). Returns cleaned query, resolved name/id/website/LinkedIn URL/count_org, and edit distance. Prefer over search_companies_index when the input is a noisy employer string and you need one best match.',
      annotations: { readOnlyHint: true },
      inputSchema: descriptorToInputSchema(
        RESOLVE_COMPANY_FROM_RAW_NAME_INPUT_DESCRIPTOR,
      ),
    },
    handler: async (args, config) => {
      const companyName =
        typeof args.companyName === 'string' ? args.companyName.trim() : '';
      const companyNames = Array.isArray(args.companyNames)
        ? args.companyNames.filter(
            (name): name is string =>
              typeof name === 'string' && name.trim().length > 0,
          )
        : [];

      if (!companyName && companyNames.length === 0) {
        throw new Error('companyName or companyNames is required.');
      }

      return callRestAPI(
        config.baseUrl,
        config.apiToken,
        'elasticsearch-search',
        'resolve-company-name',
        {
          companyName: companyName || undefined,
          companyNames: companyNames.length > 0 ? companyNames : undefined,
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
