import {
  CLASSIFY_TAXONOMY_PROFILE_INPUT_DESCRIPTOR,
  LIST_TAXONOMY_INPUT_DESCRIPTOR,
  LIST_TAXONOMY_SLICE_INPUT_DESCRIPTOR,
  SEARCH_PEOPLE_API_INPUT_DESCRIPTOR,
  SEARCH_PEOPLE_BY_JOB_TITLE_INPUT_DESCRIPTOR,
} from '../utils/McpToolSchemas';

import { callRestAPI, callRestAPIGet } from '../api/rest-client';
import { McpTool } from '../types/tool-types';
import { descriptorToInputSchema } from '../utils/input-schema';

const hasNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

export const peopleApiTools: McpTool[] = [
  {
    definition: {
      name: 'search_people_api',
      title: 'Search people (People API)',
      description:
        'PRIMARY people tool: pass naturalLanguage (e.g. "CEO at StayVista", "CHRO at Apple"), or searchUrl for a pasted LinkedIn / Sales Nav / Recruiter people search. Taxonomy resolution is server-side for role utterances.',
      annotations: { readOnlyHint: true },
      inputSchema: descriptorToInputSchema(SEARCH_PEOPLE_API_INPUT_DESCRIPTOR),
    },
    handler: async (args, config) => {
      const filterKeys = [
        'naturalLanguage',
        'query',
        'personName',
        'jobTitle',
        'companyId',
        'companyName',
        'website',
        'stdFunction',
        'stdGrade',
        'country',
        'searchUrl',
      ];

      const hasFilter = filterKeys.some((key) => hasNonEmptyString(args[key]));

      if (!hasFilter) {
        throw new Error(
          'At least one search filter is required (naturalLanguage, query, personName, jobTitle, companyId, companyName, website, stdFunction, stdGrade, country, or searchUrl).',
        );
      }

      return callRestAPI(
        config.baseUrl,
        config.apiToken,
        'people-api',
        'people/search',
        {
          dataSource: args.dataSource,
          accountId: args.accountId,
          naturalLanguage: args.naturalLanguage,
          query: args.query,
          personName: args.personName,
          jobTitle: args.jobTitle,
          companyId: args.companyId,
          companyName: args.companyName,
          website: args.website,
          stdFunction: args.stdFunction,
          stdGrade: args.stdGrade,
          country: args.country,
          searchUrl: args.searchUrl,
          limit: args.limit,
        },
      );
    },
  },
  {
    definition: {
      name: 'search_people_by_job_title',
      title: 'Search people by job title',
      description:
        'Alias of search_people_api: pass jobTitle (e.g. "CEO at StayVista" or "CHRO") plus optional companyName/companyId/website. Prefer search_people_api with naturalLanguage.',
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

      return callRestAPI(
        config.baseUrl,
        config.apiToken,
        'people-api',
        'people/search',
        {
          naturalLanguage: jobTitle.trim(),
          dataSource: args.dataSource,
          accountId: args.accountId,
          companyId: args.companyId,
          companyName: args.companyName,
          website: args.website,
          country: args.country,
          limit: args.limit,
        },
      );
    },
  },
  {
    definition: {
      name: 'list_people_data_sources',
      title: 'List people data sources',
      description:
        'List configured people data source aliases (auto, index, apollo, pdl, contactout, harvest, pool, unipile) and whether each supports std_function/std_grade filters.',
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
      name: 'list_taxonomy_constants',
      title: 'List taxonomy constants',
      description:
        'Public flat vocabulary nouns (grade levels, grade categories, function roots). Use to understand what the system knows — not to invent filters. Prefer search_people_api with naturalLanguage for queries.',
      annotations: { readOnlyHint: true },
      inputSchema: { type: 'object', properties: {} },
    },
    handler: async (_args, config) =>
      callRestAPIGet(
        config.baseUrl,
        config.apiToken,
        'people-api',
        'taxonomy/constants',
      ),
  },
  {
    definition: {
      name: 'list_taxonomy_function_roots',
      title: 'List std function roots',
      description:
        'Advanced auth-gated list/classify. Prefer list_taxonomy_constants for nouns and search_people_api with naturalLanguage for queries.',
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
        'Advanced auth-gated function labels. Prefer search_people_api with naturalLanguage so agents do not chain raw taxonomy codes.',
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
        'Advanced auth-gated grades. Prefer list_taxonomy_constants for public grade-level nouns.',
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
  {
    definition: {
      name: 'list_taxonomy_slice',
      title: 'List taxonomy slice',
      description:
        'Auth-gated labels for one std_function_root (child functions plus std_grade list). Use before DIY two-step classification. Prefer classify_taxonomy_profile to classify a person.',
      annotations: { readOnlyHint: true },
      inputSchema: descriptorToInputSchema(LIST_TAXONOMY_SLICE_INPUT_DESCRIPTOR),
    },
    handler: async (args, config) => {
      if (!hasNonEmptyString(args.function_root)) {
        throw new Error('function_root is required.');
      }

      return callRestAPIGet(
        config.baseUrl,
        config.apiToken,
        'people-api',
        'taxonomy/slice',
        { function_root: args.function_root.trim() },
      );
    },
  },
  {
    definition: {
      name: 'classify_taxonomy_profile',
      title: 'Classify taxonomy profile',
      description:
        'Classify a formatted profile blob or a job title into std_function_root, std_function, std_grade, and std_grade_category. Prefer search_people_api with naturalLanguage when you also need to find people.',
      annotations: { readOnlyHint: true },
      inputSchema: descriptorToInputSchema(
        CLASSIFY_TAXONOMY_PROFILE_INPUT_DESCRIPTOR,
      ),
    },
    handler: async (args, config) => {
      const profile = hasNonEmptyString(args.profile)
        ? args.profile.trim()
        : '';
      const jobTitle = hasNonEmptyString(args.jobTitle)
        ? args.jobTitle.trim()
        : '';

      if (profile && jobTitle) {
        throw new Error('Provide either profile or jobTitle, not both.');
      }
      if (!profile && !jobTitle) {
        throw new Error('profile or jobTitle is required.');
      }

      const body = profile
        ? { profiles: [profile] }
        : { job_titles: [jobTitle] };

      return callRestAPI(
        config.baseUrl,
        config.apiToken,
        'people-api',
        'taxonomy/classify-llm',
        body,
      );
    },
  },
];
