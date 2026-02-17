import { callRestAPI } from '../api/rest-client';
import { McpTool } from '../types/tool-types';

export const candidateSearchTools: McpTool[] = [
  {
    definition: {
      name: 'parse_job_description',
      description:
        'Parse a job description (text or file path) and extract structured information for search. Returns parsed JD used by generate_search_parameters.',
      inputSchema: {
        type: 'object',
        properties: {
          jobDescription: { type: 'string', description: 'Raw job description text' },
          filePath: { type: 'string', description: 'Alternative: path to JD file' },
        },
      },
    },
    handler: async (args, config) => {
      const body = args as Record<string, unknown>;
      return callRestAPI(
        config.baseUrl,
        config.apiToken,
        'candidate-search',
        'parse-job-description',
        body,
      );
    },
  },

  {
    definition: {
      name: 'generate_search_parameters',
      description:
        'Generate LinkedIn search parameters from a parsed job description. Pass parsedJobDescription, searchType, searchCategory, and searchFilterId.',
      inputSchema: {
        type: 'object',
        properties: {
          parsedJobDescription: { type: 'object', description: 'Output from parse_job_description' },
          searchType: {
            type: 'string',
            description: 'One of: classic, sales_navigator, recruiter',
          },
          searchCategory: {
            type: 'string',
            description: 'One of: people, companies, posts, jobs',
          },
          searchFilterId: { type: 'string', description: 'Search filter ID' },
        },
        required: ['parsedJobDescription', 'searchType', 'searchCategory', 'searchFilterId'],
      },
    },
    handler: async (args, config) => {
      const body = args as Record<string, unknown>;
      return callRestAPI(
        config.baseUrl,
        config.apiToken,
        'candidate-search',
        'generate-search-parameters',
        body,
      );
    },
  },

  {
    definition: {
      name: 'resolve_parameters',
      description:
        'Resolve search parameter names to LinkedIn IDs. Pass searchParameters, searchType, and searchCategory.',
      inputSchema: {
        type: 'object',
        properties: {
          searchParameters: { type: 'object', description: 'Search parameters object' },
          searchType: {
            type: 'string',
            description: 'One of: classic, sales_navigator, recruiter',
          },
          searchCategory: {
            type: 'string',
            description: 'One of: people, companies, posts, jobs',
          },
        },
        required: ['searchParameters', 'searchType', 'searchCategory'],
      },
    },
    handler: async (args, config) => {
      const body = args as Record<string, unknown>;
      return callRestAPI(
        config.baseUrl,
        config.apiToken,
        'candidate-search',
        'resolve-parameters',
        body,
      );
    },
  },
];
