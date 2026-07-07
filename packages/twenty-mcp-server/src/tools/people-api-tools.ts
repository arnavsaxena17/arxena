import {
  LIST_TAXONOMY_INPUT_DESCRIPTOR,
  SEARCH_PEOPLE_API_INPUT_DESCRIPTOR,
  SEARCH_PEOPLE_BY_JOB_TITLE_INPUT_DESCRIPTOR,
} from '../utils/McpToolSchemas';

import { callRestAPI, callRestAPIGet } from '../api/rest-client';
import { McpTool } from '../types/tool-types';
import { descriptorToInputSchema } from '../utils/input-schema';

const hasCompanyScope = (args: Record<string, unknown>): boolean =>
  ['companyId', 'companyName', 'website'].some((key) => {
    const value = args[key];
    return typeof value === 'string' && value.trim().length > 0;
  });

export const peopleApiTools: McpTool[] = [
  {
    definition: {
      name: 'search_people_by_job_title',
      title: 'Search people by job title',
      description:
        'Classify a sample job title into std_function and std_grade, then search people at a company. Use for queries like "marketing heads at Salesforce" by passing jobTitle="Head of Marketing" (or "VP Marketing", "CMO") with companyName or companyId.',
      annotations: { readOnlyHint: true },
      inputSchema: descriptorToInputSchema(
        SEARCH_PEOPLE_BY_JOB_TITLE_INPUT_DESCRIPTOR,
      ),
    },
    handler: async (args, config) => {
      const jobTitle = args.jobTitle;
      if (typeof jobTitle !== 'string' || !jobTitle.trim()) {
        throw new Error('jobTitle is required.');
      }
      if (!hasCompanyScope(args)) {
        throw new Error(
          'At least one of companyId, companyName, or website is required.',
        );
      }

      return callRestAPI(
        config.baseUrl,
        config.apiToken,
        'people-api',
        'people/search-by-title',
        {
          jobTitle: jobTitle.trim(),
          dataSource: args.dataSource,
          companyId: args.companyId,
          companyName: args.companyName,
          website: args.website,
          country: args.country,
          limit: args.limit,
          offset: args.offset,
        },
      );
    },
  },
  {
    definition: {
      name: 'search_people_api',
      title: 'Search people (People API)',
      description:
        'Search people via the People API using std_function, std_grade, company, and other filters. Prefer search_people_by_job_title when you have a natural-language job title to resolve.',
      annotations: { readOnlyHint: true },
      inputSchema: descriptorToInputSchema(SEARCH_PEOPLE_API_INPUT_DESCRIPTOR),
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

      const hasFilter = filterKeys.some((key) => {
        const value = args[key];
        return typeof value === 'string' && value.trim().length > 0;
      });

      if (!hasFilter) {
        throw new Error(
          'At least one search filter is required (query, personName, jobTitle, companyId, companyName, website, stdFunction, stdGrade, country, or linkedinUrl).',
        );
      }

      return callRestAPI(
        config.baseUrl,
        config.apiToken,
        'people-api',
        'people/search',
        {
          dataSource: args.dataSource,
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
      name: 'list_people_data_sources',
      title: 'List people data sources',
      description:
        'List configured people data source aliases (index, apollo, pdl, contactout, harvest) and whether each supports std_function/std_grade filters.',
      annotations: { readOnlyHint: true },
      inputSchema: { type: 'object', properties: {} },
    },
    handler: async (_args, config) =>
      callRestAPIGet(
        config.baseUrl,
        config.apiToken,
        'people-api',
        'data-sources',
      ),
  },
  {
    definition: {
      name: 'list_taxonomy_function_roots',
      title: 'List std function roots',
      description:
        'List std_function_root taxonomy values. Pass title to classify a job title into a function root.',
      annotations: { readOnlyHint: true },
      inputSchema: descriptorToInputSchema(LIST_TAXONOMY_INPUT_DESCRIPTOR),
    },
    handler: async (args, config) =>
      callRestAPIGet(
        config.baseUrl,
        config.apiToken,
        'people-api',
        'taxonomy/function-roots',
        typeof args.title === 'string' && args.title.trim()
          ? { title: args.title.trim() }
          : undefined,
      ),
  },
  {
    definition: {
      name: 'list_taxonomy_functions',
      title: 'List std functions',
      description:
        'List std_function taxonomy values, optionally filtered by function_root. Pass title to classify a job title.',
      annotations: { readOnlyHint: true },
      inputSchema: descriptorToInputSchema([
        ...LIST_TAXONOMY_INPUT_DESCRIPTOR,
        {
          key: 'function_root',
          type: 'string',
          description: 'Optional function root filter (e.g. marketing, sales)',
          required: false,
        },
      ]),
    },
    handler: async (args, config) => {
      const query: Record<string, string> = {};
      if (typeof args.function_root === 'string' && args.function_root.trim()) {
        query.function_root = args.function_root.trim();
      }
      if (typeof args.title === 'string' && args.title.trim()) {
        query.title = args.title.trim();
      }

      return callRestAPIGet(
        config.baseUrl,
        config.apiToken,
        'people-api',
        'taxonomy/functions',
        Object.keys(query).length > 0 ? query : undefined,
      );
    },
  },
  {
    definition: {
      name: 'list_taxonomy_grades',
      title: 'List std grades',
      description:
        'List std_grade taxonomy values. Pass title to classify a job title into a grade, or grade_level to filter (entry, mid, leadership).',
      annotations: { readOnlyHint: true },
      inputSchema: descriptorToInputSchema([
        ...LIST_TAXONOMY_INPUT_DESCRIPTOR,
        {
          key: 'grade_level',
          type: 'string',
          description: 'Optional grade level filter (entry, mid, leadership)',
          required: false,
        },
      ]),
    },
    handler: async (args, config) => {
      const query: Record<string, string> = {};
      if (typeof args.grade_level === 'string' && args.grade_level.trim()) {
        query.grade_level = args.grade_level.trim();
      }
      if (typeof args.title === 'string' && args.title.trim()) {
        query.title = args.title.trim();
      }

      return callRestAPIGet(
        config.baseUrl,
        config.apiToken,
        'people-api',
        'taxonomy/grades',
        Object.keys(query).length > 0 ? query : undefined,
      );
    },
  },
];
