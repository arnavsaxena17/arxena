import {
  EXPAND_COMPANIES_INPUT_DESCRIPTOR,
  EXPAND_JOB_TITLES_INPUT_DESCRIPTOR,
  GENERATE_SEARCH_PARAMETERS_INPUT_DESCRIPTOR,
  PARSE_JOB_DESCRIPTION_INPUT_DESCRIPTOR,
  RESOLVE_PARAMETERS_INPUT_DESCRIPTOR
} from 'twenty-shared';

import { callRestAPI } from '../api/rest-client';
import { McpTool } from '../types/tool-types';
import { descriptorToInputSchema } from '../utils/input-schema';
export const candidateSearchTools: McpTool[] = [
  {
    definition: {
      name: 'parse_job_description',
      description:
        'Parse a job description (text or file path) and extract structured information for search. Returns parsed JD used by generate_search_parameters.',
      inputSchema: descriptorToInputSchema(PARSE_JOB_DESCRIPTION_INPUT_DESCRIPTOR),
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
      inputSchema: descriptorToInputSchema(GENERATE_SEARCH_PARAMETERS_INPUT_DESCRIPTOR),
    },
    handler: async (args, config) => {
      const body = args as Record<string, unknown>;
      return callRestAPI(
        config.baseUrl,
        config.apiToken,
        'candidate-search/pipeline',
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
      inputSchema: descriptorToInputSchema(RESOLVE_PARAMETERS_INPUT_DESCRIPTOR),
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
  {
    definition: {
      name: 'expand_companies',
      description:
        'Expand company names from a parsed requirement. Takes a parsed requirement object and returns similar companies, name variations, and company lists. Useful for finding companies similar to those mentioned in a job requirement (e.g., Big 4, FAANG, product companies).',
      inputSchema: (() => {
        const baseSchema = descriptorToInputSchema(EXPAND_COMPANIES_INPUT_DESCRIPTOR);
        return {
          ...baseSchema,
          properties: {
            ...baseSchema.properties,
            parsedRequirement: {
              type: 'object',
              description: 'Parsed requirement object with fields like primary_role_name, industry, location, company_type, requires_company_targeting, etc.',
            },
          },
        };
      })(),
    },
    handler: async (args, config) => {
      const body = args as Record<string, unknown>;
      return callRestAPI(
        config.baseUrl,
        config.apiToken,
        'candidate-search',
        'expand-companies',
        body,
      );
    },
  },



  {
    definition: {
      name: 'expand_job_titles',
      description: 'Expand job titles from a parsed requirement. Takes a parsed requirement object and returns job title variations across different levels and companies. Useful for finding similar job titles when searching for candidates (e.g., Software Engineer -> [Software Engineer, Software Developer, Backend Engineer, etc.]).',
      inputSchema: (() => {
        const baseSchema = descriptorToInputSchema(EXPAND_JOB_TITLES_INPUT_DESCRIPTOR);
        return {
          ...baseSchema,
          properties: {
            ...baseSchema.properties,
            parsedRequirement: {
              type: 'object',
              description: 'Parsed requirement object with fields like primary_role_name, industry, location, requires_job_title_expansion, etc.',
            },
          },
        };
      })(),
    },
    handler: async (args, config) => {
      const body = args as Record<string, unknown>;
      return callRestAPI(
        config.baseUrl,
        config.apiToken,
        'candidate-search',
        'expand-job-titles',
        body,
      );
    },
  },
];