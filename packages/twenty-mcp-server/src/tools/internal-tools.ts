import {
  GENERATE_SEARCH_PARAMETERS_INPUT_DESCRIPTOR,
  RESOLVE_PARAMETERS_INPUT_DESCRIPTOR
} from '../utils/McpToolSchemas';

import { callRestAPI } from '../api/rest-client';
import { McpTool } from '../types/tool-types';
import { descriptorToInputSchema } from '../utils/input-schema';
export const internalTools: McpTool[] = [
  // {
  //   definition: {
  //     name: 'parse_job_description',
  //     description:
  //       'Parse a job description (text or file path) and extract structured information for search. Returns parsed JD.',
  //     inputSchema: descriptorToInputSchema(PARSE_JOB_DESCRIPTION_INPUT_DESCRIPTOR),
  //   },
  //   handler: async (args, config) => {
  //     const body = args as Record<string, unknown>;
  //     return callRestAPI(
  //       config.baseUrl,
  //       config.apiToken,
  //       'candidate-search',
  //       'parse-job-description',
  //       body,
  //     );
  //   },
  // },


  // {
  //   definition: {
  //     name: 'job_brief_understanding',
  //     description: 'Understand the requirement and generate a detailed job brief understanding.',
  //     inputSchema: descriptorToInputSchema(JOB_BRIEF_UNDERSTANDING_INPUT_DESCRIPTOR),
  //   },
  //   handler: async (args, config) => {
  //     const body = args as Record<string, unknown>;
  //     return callRestAPI(
  //       config.baseUrl,
  //       config.apiToken,
  //       'candidate-search/pipeline',
  //       'job-brief-understanding',
  //       body,
  //     );
  //   },
  // },


  {
    definition: {
      name: 'generate_unresolved_search_parameters',
      description:
        'Generate unresolved search parameters from a query. IMPORTANT: Do not call this tool multiple times with the same query parameters - results are cached and duplicate calls will be skipped. Only call once per unique query.',
      inputSchema: descriptorToInputSchema(GENERATE_SEARCH_PARAMETERS_INPUT_DESCRIPTOR),
    },
    handler: async (args, config) => {
      const body = args as Record<string, unknown>;
      return callRestAPI(
        config.baseUrl,
        config.apiToken,
        'candidate-search/pipeline',
        'generate-unresolved-search-parameters',
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


  // {
  //   definition: {
  //     name: 'expand_companies',
  //     description:
  //       'Expand company names from a parsed requirement. Takes a parsed requirement object and returns similar companies, name variations, and company lists. Useful for finding companies similar to those mentioned in a job requirement (e.g., Big 4, FAANG, product companies).',
  //     inputSchema: (() => {
  //       const baseSchema = descriptorToInputSchema(EXPAND_COMPANIES_INPUT_DESCRIPTOR);
  //       return {
  //         ...baseSchema,
  //         properties: {
  //           ...baseSchema.properties,
  //           parsedRequirement: {
  //             type: 'object',
  //             description: 'Parsed requirement object with fields like primary_role_name, industry, location, company_type, requires_company_targeting, etc.',
  //           },
  //         },
  //       };
  //     })(),
  //   },
  //   handler: async (args, config) => {
  //     const body = args as Record<string, unknown>;
  //     return callRestAPI(
  //       config.baseUrl,
  //       config.apiToken,
  //       'candidate-search',
  //       'expand-companies',
  //       body,
  //     );
  //   },
  // },



  // {
  //   definition: {
  //     name: 'expand_job_titles',
  //     description: 'Expand job titles from a parsed requirement. Takes a parsed requirement object and returns job title variations across different levels and companies. Useful for finding similar job titles when searching for candidates (e.g., Software Engineer -> [Software Engineer, Software Developer, Backend Engineer, etc.]).',
  //     inputSchema: (() => {
  //       const baseSchema = descriptorToInputSchema(EXPAND_JOB_TITLES_INPUT_DESCRIPTOR);
  //       return {
  //         ...baseSchema,
  //         properties: {
  //           ...baseSchema.properties,
  //           parsedRequirement: {
  //             type: 'object',
  //             description: 'Parsed requirement object with fields like primary_role_name, industry, location, requires_job_title_expansion, etc.',
  //           },
  //         },
  //       };
  //     })(),
  //   },
  //   handler: async (args, config) => {
  //     const body = args as Record<string, unknown>;
  //     return callRestAPI(
  //       config.baseUrl,
  //       config.apiToken,
  //       'candidate-search',
  //       'expand-job-titles',
  //       body,
  //     );
  //   },
  // },
];