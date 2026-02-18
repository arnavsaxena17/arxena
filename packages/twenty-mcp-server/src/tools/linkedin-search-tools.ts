import {
  CHECK_CONTACT_AVAILABILITY_FROM_APOLLO_INPUT_DESCRIPTOR,
  CHECK_CONTACT_AVAILABILITY_FROM_ARXENA_INPUT_DESCRIPTOR,
  CHECK_CONTACT_AVAILABILITY_FROM_CONTACTOUT_INPUT_DESCRIPTOR,
  CHECK_CONTACT_AVAILABILITY_FROM_LUSHA_INPUT_DESCRIPTOR,
  CHECK_CONTACT_AVAILABILITY_FROM_PDL_INPUT_DESCRIPTOR,
  CHECK_CONTACT_AVAILABILITY_INPUT_DESCRIPTOR,
  FETCH_CONTACTS_FROM_APOLLO_INPUT_DESCRIPTOR,
  FETCH_CONTACTS_FROM_ARXENA_INPUT_DESCRIPTOR,
  FETCH_CONTACTS_FROM_CONTACTOUT_INPUT_DESCRIPTOR,
  FETCH_CONTACTS_FROM_LUSHA_INPUT_DESCRIPTOR,
  FETCH_CONTACTS_FROM_PDL_INPUT_DESCRIPTOR,
  FETCH_CONTACTS_INPUT_DESCRIPTOR,
  GENERATE_LINKEDIN_QUERY_AGENT1_INPUT_DESCRIPTOR,
  GENERATE_LINKEDIN_QUERY_AGENT2_INPUT_DESCRIPTOR,
  GENERATE_LINKEDIN_QUERY_AGENT3_INPUT_DESCRIPTOR,
  GENERATE_LINKEDIN_QUERY_AGENT4_INPUT_DESCRIPTOR,
  GENERATE_LINKEDIN_QUERY_BATCH_INPUT_DESCRIPTOR,
  GENERATE_LINKEDIN_QUERY_SET_INPUT_DESCRIPTOR,
  GET_CONTACT_ENRICHMENT_JOB_INPUT_DESCRIPTOR,
  SEARCH_LINKEDIN_COMPANIES_INPUT_DESCRIPTOR,
  SEARCH_LINKEDIN_JOBS_INPUT_DESCRIPTOR,
  SEARCH_LINKEDIN_PARAMETERS_INPUT_DESCRIPTOR,
  SEARCH_LINKEDIN_PEOPLE_INPUT_DESCRIPTOR,
  VALIDATE_LINKEDIN_QUERY_SET_INPUT_DESCRIPTOR
} from '../utils/McpToolSchemas';

import { callRestAPI, callRestAPIGet } from '../api/rest-client';
import { handleStreamingResponse } from '../api/streaming-client';
import { McpTool } from '../types/tool-types';
import { descriptorToInputSchema } from '../utils/input-schema';

export const linkedinSearchTools: McpTool[] = [
  // ==================== LinkedIn Search Tools ====================


  // {
  //   definition: {
  //     name: 'search_linkedin_with_query',
  //     description:
  //       'Full LinkedIn search flow using candidate search handlers. Handles query understanding, parameter generation, resolution, search execution, validation, and scoring with streaming support.',
  //     inputSchema: (() => {
  //       const baseSchema = descriptorToInputSchema(SEARCH_LINKEDIN_WITH_QUERY_INPUT_DESCRIPTOR);
  //       return {
  //         ...baseSchema,
  //         properties: {
  //           ...baseSchema.properties,
  //           searchType: {
  //             ...baseSchema.properties.searchType,
  //             enum: ['classic', 'sales_navigator', 'recruiter'],
  //           },
  //           searchCategory: {
  //             ...baseSchema.properties.searchCategory,
  //             enum: ['people', 'companies', 'posts', 'jobs'],
  //           },
  //         },
  //       };
  //     })(),
  //   },
  //   handler: async (args, config) => {
  //     const { query, searchType, searchCategory, searchFilterId, parsedJD, includeJd } = args as {
  //       query: string;
  //       searchType: string;
  //       searchCategory: string;
  //       searchFilterId: string;
  //       parsedJD?: Record<string, unknown>;
  //       includeJd?: boolean;
  //     };

  //     return handleStreamingResponse(
  //       config.baseUrl,
  //       config.apiToken,
  //       'candidate-search',
  //       'message/stream',
  //       {
  //         message: query,
  //         searchFilterId,
  //         parsedJD,
  //         searchType,
  //         searchCategory,
  //         includeJd: includeJd !== false,
  //       },
  //     );
  //   },
  // },
  
  {
    definition: {
      name: 'search_linkedin_people',
      description:
      'Search for people on LinkedIn. Do not  use if unless you have generated parameters already.. Supports classic, sales_navigator, and recruiter search types. Requires parsed JSON Can use either searchParameters for direct search or query for full search flow.',
      inputSchema: (() => {
        const baseSchema = descriptorToInputSchema(SEARCH_LINKEDIN_PEOPLE_INPUT_DESCRIPTOR);
        return {
          ...baseSchema,
          properties: {
            ...baseSchema.properties,
            searchType: {
              ...baseSchema.properties.searchType,
              enum: ['classic', 'sales_navigator', 'recruiter'],
            },
          },
        };
      })(),
    },
    handler: async (args, config) => {
      const { searchType, searchParameters, query, searchFilterId, parsedJD, cursor, limit } =
        args as {
          searchType: string;
          searchParameters?: Record<string, unknown>;
          query?: string;
          searchFilterId?: string;
          parsedJD?: Record<string, unknown>;
          cursor?: string;
          limit?: number;
        };

      // If query provided, use candidate search streaming flow
      if (query && searchFilterId) {
        return handleStreamingResponse(
          config.baseUrl,
          config.apiToken,
          'candidate-search',
          'message/stream',
          {
            message: query,
            searchFilterId,
            parsedJD,
            searchType,
            searchCategory: 'people',
            includeJd: !!parsedJD,
          },
        );
      }

      // Otherwise use direct LinkedIn search
      if (!searchParameters) {
        throw new Error('Either searchParameters or query with searchFilterId must be provided');
      }

      const endpoint =
        searchType === 'sales_navigator'
          ? 'search/sales-navigator/people'
          : searchType === 'recruiter'
            ? 'search/recruiter/people'
            : 'search/people';

      const queryParams: Record<string, string> = {};
      if (cursor) queryParams.cursor = cursor;
      if (limit) queryParams.limit = String(limit);

      return callRestAPI(
        config.baseUrl,
        config.apiToken,
        'linkedin-search',
        endpoint,
        searchParameters,
        Object.keys(queryParams).length > 0 ? queryParams : undefined,
      );
    },
  },

  {
    definition: {
      name: 'search_linkedin_companies',
      description:
        'Search for companies on LinkedIn. Supports classic and sales_navigator search types.',
      inputSchema: (() => {
        const baseSchema = descriptorToInputSchema(SEARCH_LINKEDIN_COMPANIES_INPUT_DESCRIPTOR);
        return {
          ...baseSchema,
          properties: {
            ...baseSchema.properties,
            searchType: {
              ...baseSchema.properties.searchType,
              enum: ['classic', 'sales_navigator'],
            },
          },
        };
      })(),
    },
    handler: async (args, config) => {
      const { searchType, searchParameters, cursor, limit } = args as {
        searchType: string;
        searchParameters: Record<string, unknown>;
        cursor?: string;
        limit?: number;
      };

      const endpoint =
        searchType === 'sales_navigator'
          ? 'search/sales-navigator/companies'
          : 'search/companies';

      const queryParams: Record<string, string> = {};
      if (cursor) queryParams.cursor = cursor;
      if (limit) queryParams.limit = String(limit);

      return callRestAPI(
        config.baseUrl,
        config.apiToken,
        'linkedin-search',
        endpoint,
        searchParameters,
        Object.keys(queryParams).length > 0 ? queryParams : undefined,
      );
    },
  },

  {
    definition: {
      name: 'search_linkedin_jobs',
      description: 'Search for jobs on LinkedIn using classic search.',
      inputSchema: descriptorToInputSchema(SEARCH_LINKEDIN_JOBS_INPUT_DESCRIPTOR),
    },
    handler: async (args, config) => {
      const { searchParameters, cursor, limit } = args as {
        searchParameters: Record<string, unknown>;
        cursor?: string;
        limit?: number;
      };

      const queryParams: Record<string, string> = {};
      if (cursor) queryParams.cursor = cursor;
      if (limit) queryParams.limit = String(limit);

      return callRestAPI(
        config.baseUrl,
        config.apiToken,
        'linkedin-search',
        'search/jobs',
        searchParameters,
        Object.keys(queryParams).length > 0 ? queryParams : undefined,
      );
    },
  },

  {
    definition: {
      name: 'search_linkedin_parameters',
      description:
        'Get LinkedIn search parameters (locations, industries, companies, schools, job titles, skills).',
      inputSchema: (() => {
        const baseSchema = descriptorToInputSchema(SEARCH_LINKEDIN_PARAMETERS_INPUT_DESCRIPTOR);
        return {
          ...baseSchema,
          properties: {
            ...baseSchema.properties,
            parameterType: {
              ...baseSchema.properties.parameterType,
              enum: [
                'locations',
                'industries',
                'companies',
                'schools',
                'job-titles',
                'skills',
                'saved-searches',
                'recent-searches',
              ],
            },
          },
        };
      })(),
    },
    handler: async (args, config) => {
      const { parameterType, keywords, limit } = args as {
        parameterType: string;
        keywords?: string;
        limit?: number;
      };

      const queryParams: Record<string, string> = {};
      if (keywords) queryParams.keywords = keywords;
      if (limit) queryParams.limit = String(limit);

      // Handle special endpoints
      if (parameterType === 'locations') {
        return callRestAPIGet(
          config.baseUrl,
          config.apiToken,
          'linkedin-search',
          'parameters/locations',
          queryParams,
        );
      }
      if (parameterType === 'industries') {
        return callRestAPIGet(
          config.baseUrl,
          config.apiToken,
          'linkedin-search',
          'parameters/industries',
          queryParams,
        );
      }
      if (parameterType === 'companies') {
        return callRestAPIGet(
          config.baseUrl,
          config.apiToken,
          'linkedin-search',
          'parameters/companies',
          queryParams,
        );
      }
      if (parameterType === 'schools') {
        return callRestAPIGet(
          config.baseUrl,
          config.apiToken,
          'linkedin-search',
          'parameters/schools',
          queryParams,
        );
      }
      if (parameterType === 'job-titles') {
        return callRestAPIGet(
          config.baseUrl,
          config.apiToken,
          'linkedin-search',
          'parameters/job-titles',
          queryParams,
        );
      }
      if (parameterType === 'skills') {
        return callRestAPIGet(
          config.baseUrl,
          config.apiToken,
          'linkedin-search',
          'parameters/skills',
          queryParams,
        );
      }
      if (parameterType === 'saved-searches') {
        return callRestAPIGet(
          config.baseUrl,
          config.apiToken,
          'linkedin-search',
          'parameters/saved-searches',
          queryParams,
        );
      }
      if (parameterType === 'recent-searches') {
        return callRestAPIGet(
          config.baseUrl,
          config.apiToken,
          'linkedin-search',
          'parameters/recent-searches',
          queryParams,
        );
      }

      // Default: use generic endpoint
      return callRestAPIGet(
        config.baseUrl,
        config.apiToken,
        'linkedin-search',
        `parameters/${parameterType}`,
        queryParams,
      );
    },
  },



  // ==================== LinkedIn Query Generation Tools ====================

  {
    definition: {
      name: 'generate_linkedin_query_set',
      description:
        'Generate LinkedIn search query set from natural language requirement using full orchestrator (runs all 4 agents: parse, master lists, primary query, factoring). IMPORTANT: Do not call this tool multiple times with the same rawRequirement - results are cached and duplicate calls will be skipped. Only call once per unique requirement.',
      inputSchema: descriptorToInputSchema(GENERATE_LINKEDIN_QUERY_SET_INPUT_DESCRIPTOR),
    },
    handler: async (args, config) => {
      const { rawRequirement, queryIpLocation, model, temperature, verbose } = args as {
        rawRequirement: string;
        queryIpLocation?: string;
        model?: string;
        temperature?: number;
        verbose?: boolean;
      };

      return callRestAPI(
        config.baseUrl,
        config.apiToken,
        'linkedin-query-generation',
        'generate',
        {
          rawRequirement,
          queryIpLocation,
          model,
          temperature,
          verbose,
        },
      );
    },
  },

  {
    definition: {
      name: 'generate_linkedin_query_agent1',
      description: 'Parse raw requirement into structured format (Agent 1).',
      inputSchema: descriptorToInputSchema(GENERATE_LINKEDIN_QUERY_AGENT1_INPUT_DESCRIPTOR),
    },
    handler: async (args, config) => {
      const { rawRequirement, queryIpLocation, model, temperature } = args as {
        rawRequirement: string;
        queryIpLocation?: string;
        model?: string;
        temperature?: number;
      };

      return callRestAPI(
        config.baseUrl,
        config.apiToken,
        'linkedin-query-generation',
        'agent1/parse',
        {
          rawRequirement,
          queryIpLocation,
          model,
          temperature,
        },
      );
    },
  },

  {
    definition: {
      name: 'generate_linkedin_query_agent2',
      description: 'Generate master lists (keywords, job titles, companies, locations) from parsed requirement (Agent 2).',
      inputSchema: descriptorToInputSchema(GENERATE_LINKEDIN_QUERY_AGENT2_INPUT_DESCRIPTOR),
    },
    handler: async (args, config) => {
      const { parsedRequirement, model, temperature } = args as {
        parsedRequirement: Record<string, unknown>;
        model?: string;
        temperature?: number;
      };

      return callRestAPI(
        config.baseUrl,
        config.apiToken,
        'linkedin-query-generation',
        'agent2/master-lists',
        {
          parsedRequirement,
          model,
          temperature,
        },
      );
    },
  },

  {
    definition: {
      name: 'generate_linkedin_query_agent3',
      description: 'Create primary query from parsed requirement and master lists (Agent 3).',
      inputSchema: descriptorToInputSchema(GENERATE_LINKEDIN_QUERY_AGENT3_INPUT_DESCRIPTOR),
    },
    handler: async (args, config) => {
      const { parsedRequirement, masterLists, model, temperature } = args as {
        parsedRequirement: Record<string, unknown>;
        masterLists: Record<string, unknown>;
        model?: string;
        temperature?: number;
      };

      return callRestAPI(
        config.baseUrl,
        config.apiToken,
        'linkedin-query-generation',
        'agent3/primary-query',
        {
          parsedRequirement,
          masterLists,
          model,
          temperature,
        },
      );
    },
  },

  {
    definition: {
      name: 'generate_linkedin_query_agent4',
      description: 'Factor primary query into LinkedIn-compatible format (Agent 4).',
      inputSchema: descriptorToInputSchema(GENERATE_LINKEDIN_QUERY_AGENT4_INPUT_DESCRIPTOR),
    },
    handler: async (args, config) => {
      const { parsedRequirement, primaryQuery, model, temperature } = args as {
        parsedRequirement: Record<string, unknown>;
        primaryQuery: Record<string, unknown>;
        model?: string;
        temperature?: number;
      };

      return callRestAPI(
        config.baseUrl,
        config.apiToken,
        'linkedin-query-generation',
        'agent4/factoring',
        {
          parsedRequirement,
          primaryQuery,
          model,
          temperature,
        },
      );
    },
  },

  {
    definition: {
      name: 'generate_linkedin_query_batch',
      description: 'Generate query sets for multiple requirements (sequentially or in parallel).',
      inputSchema: (() => {
        const baseSchema = descriptorToInputSchema(GENERATE_LINKEDIN_QUERY_BATCH_INPUT_DESCRIPTOR);
        return {
          ...baseSchema,
          properties: {
            ...baseSchema.properties,
            requirements: {
              type: 'array',
              items: { type: 'string' },
              description: 'Array of raw natural language requirements',
            },
          },
        };
      })(),
    },
    handler: async (args, config) => {
      const { requirements, parallel, verbose, queryIpLocation, model, temperature } = args as {
        requirements: string[];
        parallel?: boolean;
        verbose?: boolean;
        queryIpLocation?: string;
        model?: string;
        temperature?: number;
      };

      return callRestAPI(
        config.baseUrl,
        config.apiToken,
        'linkedin-query-generation',
        'generate/batch',
        {
          requirements,
          parallel,
          verbose,
          queryIpLocation,
          model,
          temperature,
        },
      );
    },
  },

  {
    definition: {
      name: 'validate_linkedin_query_set',
      description: 'Validate query set against LinkedIn limits (max 6 terms per field, max 10 combined terms).',
      inputSchema: descriptorToInputSchema(VALIDATE_LINKEDIN_QUERY_SET_INPUT_DESCRIPTOR),
    },
    handler: async (args, config) => {
      const { querySet } = args as { querySet: Record<string, unknown> };

      return callRestAPI(
        config.baseUrl,
        config.apiToken,
        'linkedin-query-generation',
        'validate',
        {
          querySet,
        },
      );
    },
  },

  // ==================== Contact Enrichment Tools ====================

  {
    definition: {
      name: 'check_contact_availability',
      description:
        'Check if email/phone are available for LinkedIn profile(s) using waterfall approach (tries providers in order: arxena → pdl → contactout → lusha → apollo).',
      inputSchema: (() => {
        const baseSchema = descriptorToInputSchema(CHECK_CONTACT_AVAILABILITY_INPUT_DESCRIPTOR);
        return {
          ...baseSchema,
          properties: {
            ...baseSchema.properties,
            linkedinUrls: {
              type: 'array',
              items: { type: 'string' },
              description: 'Array of LinkedIn profile URLs',
            },
          },
        };
      })(),
    },
    handler: async (args, config) => {
      const { linkedinUrl, linkedinUrls } = args as {
        linkedinUrl?: string;
        linkedinUrls?: string[];
      };

      if (!linkedinUrl && !linkedinUrls) {
        throw new Error('Either linkedinUrl or linkedinUrls must be provided');
      }

      const body: Record<string, unknown> = {};
      if (linkedinUrl) {
        body.linkedinUrl = linkedinUrl;
      }
      if (linkedinUrls) {
        body.linkedinUrls = linkedinUrls;
      }

      // Try POST first, fallback to GET if single URL
      if (linkedinUrl && !linkedinUrls) {
        try {
          return callRestAPIGet(
            config.baseUrl,
            config.apiToken,
            'contact-enrichment',
            'availability',
            { linkedinUrl },
          );
        } catch {
          // Fallback to POST
        }
      }

      return callRestAPI(config.baseUrl, config.apiToken, 'contact-enrichment', 'availability', body);
    },
  },

  {
    definition: {
      name: 'check_contact_availability_from_arxena',
      description: 'Check contact availability using only Arxena provider.',
      inputSchema: (() => {
        const baseSchema = descriptorToInputSchema(CHECK_CONTACT_AVAILABILITY_FROM_ARXENA_INPUT_DESCRIPTOR);
        return {
          ...baseSchema,
          properties: {
            ...baseSchema.properties,
            linkedinUrls: {
              type: 'array',
              items: { type: 'string' },
              description: 'Array of LinkedIn profile URLs',
            },
          },
        };
      })(),
    },
    handler: async (args, config) => {
      const { linkedinUrl, linkedinUrls } = args as {
        linkedinUrl?: string;
        linkedinUrls?: string[];
      };

      if (!linkedinUrl && !linkedinUrls) {
        throw new Error('Either linkedinUrl or linkedinUrls must be provided');
      }

      const body: Record<string, unknown> = {};
      if (linkedinUrl) {
        body.linkedinUrl = linkedinUrl;
      }
      if (linkedinUrls) {
        body.linkedinUrls = linkedinUrls;
      }

      if (linkedinUrl && !linkedinUrls) {
        try {
          return callRestAPIGet(
            config.baseUrl,
            config.apiToken,
            'contact-enrichment',
            'availability/arxena',
            { linkedinUrl },
          );
        } catch {
          // Fallback to POST
        }
      }

      return callRestAPI(
        config.baseUrl,
        config.apiToken,
        'contact-enrichment',
        'availability/arxena',
        body,
      );
    },
  },

  {
    definition: {
      name: 'check_contact_availability_from_pdl',
      description: 'Check contact availability using only PDL provider.',
      inputSchema: (() => {
        const baseSchema = descriptorToInputSchema(CHECK_CONTACT_AVAILABILITY_FROM_PDL_INPUT_DESCRIPTOR);
        return {
          ...baseSchema,
          properties: {
            ...baseSchema.properties,
            linkedinUrls: {
              type: 'array',
              items: { type: 'string' },
              description: 'Array of LinkedIn profile URLs',
            },
          },
        };
      })(),
    },
    handler: async (args, config) => {
      const { linkedinUrl, linkedinUrls } = args as {
        linkedinUrl?: string;
        linkedinUrls?: string[];
      };

      if (!linkedinUrl && !linkedinUrls) {
        throw new Error('Either linkedinUrl or linkedinUrls must be provided');
      }

      const body: Record<string, unknown> = {};
      if (linkedinUrl) {
        body.linkedinUrl = linkedinUrl;
      }
      if (linkedinUrls) {
        body.linkedinUrls = linkedinUrls;
      }

      if (linkedinUrl && !linkedinUrls) {
        try {
          return callRestAPIGet(
            config.baseUrl,
            config.apiToken,
            'contact-enrichment',
            'availability/pdl',
            { linkedinUrl },
          );
        } catch {
          // Fallback to POST
        }
      }

      return callRestAPI(
        config.baseUrl,
        config.apiToken,
        'contact-enrichment',
        'availability/pdl',
        body,
      );
    },
  },

  {
    definition: {
      name: 'check_contact_availability_from_contactout',
      description: 'Check contact availability using only ContactOut provider.',
      inputSchema: (() => {
        const baseSchema = descriptorToInputSchema(CHECK_CONTACT_AVAILABILITY_FROM_CONTACTOUT_INPUT_DESCRIPTOR);
        return {
          ...baseSchema,
          properties: {
            ...baseSchema.properties,
            linkedinUrls: {
              type: 'array',
              items: { type: 'string' },
              description: 'Array of LinkedIn profile URLs',
            },
          },
        };
      })(),
    },
    handler: async (args, config) => {
      const { linkedinUrl, linkedinUrls } = args as {
        linkedinUrl?: string;
        linkedinUrls?: string[];
      };

      if (!linkedinUrl && !linkedinUrls) {
        throw new Error('Either linkedinUrl or linkedinUrls must be provided');
      }

      const body: Record<string, unknown> = {};
      if (linkedinUrl) {
        body.linkedinUrl = linkedinUrl;
      }
      if (linkedinUrls) {
        body.linkedinUrls = linkedinUrls;
      }

      if (linkedinUrl && !linkedinUrls) {
        try {
          return callRestAPIGet(
            config.baseUrl,
            config.apiToken,
            'contact-enrichment',
            'availability/contactout',
            { linkedinUrl },
          );
        } catch {
          // Fallback to POST
        }
      }

      return callRestAPI(
        config.baseUrl,
        config.apiToken,
        'contact-enrichment',
        'availability/contactout',
        body,
      );
    },
  },

  {
    definition: {
      name: 'check_contact_availability_from_lusha',
      description: 'Check contact availability using only Lusha provider.',
      inputSchema: (() => {
        const baseSchema = descriptorToInputSchema(CHECK_CONTACT_AVAILABILITY_FROM_LUSHA_INPUT_DESCRIPTOR);
        return {
          ...baseSchema,
          properties: {
            ...baseSchema.properties,
            linkedinUrls: {
              type: 'array',
              items: { type: 'string' },
              description: 'Array of LinkedIn profile URLs',
            },
          },
        };
      })(),
    },
    handler: async (args, config) => {
      const { linkedinUrl, linkedinUrls } = args as {
        linkedinUrl?: string;
        linkedinUrls?: string[];
      };

      if (!linkedinUrl && !linkedinUrls) {
        throw new Error('Either linkedinUrl or linkedinUrls must be provided');
      }

      const body: Record<string, unknown> = {};
      if (linkedinUrl) {
        body.linkedinUrl = linkedinUrl;
      }
      if (linkedinUrls) {
        body.linkedinUrls = linkedinUrls;
      }

      if (linkedinUrl && !linkedinUrls) {
        try {
          return callRestAPIGet(
            config.baseUrl,
            config.apiToken,
            'contact-enrichment',
            'availability/lusha',
            { linkedinUrl },
          );
        } catch {
          // Fallback to POST
        }
      }

      return callRestAPI(
        config.baseUrl,
        config.apiToken,
        'contact-enrichment',
        'availability/lusha',
        body,
      );
    },
  },

  {
    definition: {
      name: 'check_contact_availability_from_apollo',
      description: 'Check contact availability using only Apollo provider.',
      inputSchema: (() => {
        const baseSchema = descriptorToInputSchema(CHECK_CONTACT_AVAILABILITY_FROM_APOLLO_INPUT_DESCRIPTOR);
        return {
          ...baseSchema,
          properties: {
            ...baseSchema.properties,
            linkedinUrls: {
              type: 'array',
              items: { type: 'string' },
              description: 'Array of LinkedIn profile URLs',
            },
          },
        };
      })(),
    },
    handler: async (args, config) => {
      const { linkedinUrl, linkedinUrls } = args as {
        linkedinUrl?: string;
        linkedinUrls?: string[];
      };

      if (!linkedinUrl && !linkedinUrls) {
        throw new Error('Either linkedinUrl or linkedinUrls must be provided');
      }

      const body: Record<string, unknown> = {};
      if (linkedinUrl) {
        body.linkedinUrl = linkedinUrl;
      }
      if (linkedinUrls) {
        body.linkedinUrls = linkedinUrls;
      }

      if (linkedinUrl && !linkedinUrls) {
        try {
          return callRestAPIGet(
            config.baseUrl,
            config.apiToken,
            'contact-enrichment',
            'availability/apollo',
            { linkedinUrl },
          );
        } catch {
          // Fallback to POST
        }
      }

      return callRestAPI(
        config.baseUrl,
        config.apiToken,
        'contact-enrichment',
        'availability/apollo',
        body,
      );
    },
  },

  {
    definition: {
      name: 'fetch_contacts',
      description:
        'Fetch emails/phones for LinkedIn profile(s) using waterfall approach (tries providers in order: arxena → pdl → contactout → lusha → apollo).',
      inputSchema: (() => {
        const baseSchema = descriptorToInputSchema(FETCH_CONTACTS_INPUT_DESCRIPTOR);
        return {
          ...baseSchema,
          properties: {
            ...baseSchema.properties,
            linkedinUrls: {
              type: 'array',
              items: { type: 'string' },
              description: 'Array of LinkedIn profile URLs',
            },
          },
        };
      })(),
    },
    handler: async (args, config) => {
      const { linkedinUrl, linkedinUrls, wantEmail, wantPhone } = args as {
        linkedinUrl?: string;
        linkedinUrls?: string[];
        wantEmail?: boolean;
        wantPhone?: boolean;
      };

      if (!linkedinUrl && !linkedinUrls) {
        throw new Error('Either linkedinUrl or linkedinUrls must be provided');
      }

      const body: Record<string, unknown> = {};
      if (linkedinUrl) {
        body.linkedinUrl = linkedinUrl;
      }
      if (linkedinUrls) {
        body.linkedinUrls = linkedinUrls;
      }
      if (wantEmail !== undefined) {
        body.wantEmail = wantEmail;
      }
      if (wantPhone !== undefined) {
        body.wantPhone = wantPhone;
      }

      return callRestAPI(config.baseUrl, config.apiToken, 'contact-enrichment', 'fetch', body);
    },
  },

  {
    definition: {
      name: 'fetch_contacts_from_arxena',
      description: 'Fetch contacts using only Arxena provider.',
      inputSchema: (() => {
        const baseSchema = descriptorToInputSchema(FETCH_CONTACTS_FROM_ARXENA_INPUT_DESCRIPTOR);
        return {
          ...baseSchema,
          properties: {
            ...baseSchema.properties,
            linkedinUrls: {
              type: 'array',
              items: { type: 'string' },
              description: 'Array of LinkedIn profile URLs',
            },
          },
        };
      })(),
    },
    handler: async (args, config) => {
      const { linkedinUrl, linkedinUrls, wantEmail, wantPhone } = args as {
        linkedinUrl?: string;
        linkedinUrls?: string[];
        wantEmail?: boolean;
        wantPhone?: boolean;
      };

      if (!linkedinUrl && !linkedinUrls) {
        throw new Error('Either linkedinUrl or linkedinUrls must be provided');
      }

      const body: Record<string, unknown> = {};
      if (linkedinUrl) {
        body.linkedinUrl = linkedinUrl;
      }
      if (linkedinUrls) {
        body.linkedinUrls = linkedinUrls;
      }
      if (wantEmail !== undefined) {
        body.wantEmail = wantEmail;
      }
      if (wantPhone !== undefined) {
        body.wantPhone = wantPhone;
      }

      return callRestAPI(
        config.baseUrl,
        config.apiToken,
        'contact-enrichment',
        'fetch/arxena',
        body,
      );
    },
  },

  {
    definition: {
      name: 'fetch_contacts_from_pdl',
      description: 'Fetch contacts using only PDL provider.',
      inputSchema: (() => {
        const baseSchema = descriptorToInputSchema(FETCH_CONTACTS_FROM_PDL_INPUT_DESCRIPTOR);
        return {
          ...baseSchema,
          properties: {
            ...baseSchema.properties,
            linkedinUrls: {
              type: 'array',
              items: { type: 'string' },
              description: 'Array of LinkedIn profile URLs',
            },
          },
        };
      })(),
    },
    handler: async (args, config) => {
      const { linkedinUrl, linkedinUrls, wantEmail, wantPhone } = args as {
        linkedinUrl?: string;
        linkedinUrls?: string[];
        wantEmail?: boolean;
        wantPhone?: boolean;
      };

      if (!linkedinUrl && !linkedinUrls) {
        throw new Error('Either linkedinUrl or linkedinUrls must be provided');
      }

      const body: Record<string, unknown> = {};
      if (linkedinUrl) {
        body.linkedinUrl = linkedinUrl;
      }
      if (linkedinUrls) {
        body.linkedinUrls = linkedinUrls;
      }
      if (wantEmail !== undefined) {
        body.wantEmail = wantEmail;
      }
      if (wantPhone !== undefined) {
        body.wantPhone = wantPhone;
      }

      return callRestAPI(
        config.baseUrl,
        config.apiToken,
        'contact-enrichment',
        'fetch/pdl',
        body,
      );
    },
  },

  {
    definition: {
      name: 'fetch_contacts_from_contactout',
      description: 'Fetch contacts using only ContactOut provider.',
      inputSchema: (() => {
        const baseSchema = descriptorToInputSchema(FETCH_CONTACTS_FROM_CONTACTOUT_INPUT_DESCRIPTOR);
        return {
          ...baseSchema,
          properties: {
            ...baseSchema.properties,
            linkedinUrls: {
              type: 'array',
              items: { type: 'string' },
              description: 'Array of LinkedIn profile URLs',
            },
          },
        };
      })(),
    },
    handler: async (args, config) => {
      const { linkedinUrl, linkedinUrls, wantEmail, wantPhone } = args as {
        linkedinUrl?: string;
        linkedinUrls?: string[];
        wantEmail?: boolean;
        wantPhone?: boolean;
      };

      if (!linkedinUrl && !linkedinUrls) {
        throw new Error('Either linkedinUrl or linkedinUrls must be provided');
      }

      const body: Record<string, unknown> = {};
      if (linkedinUrl) {
        body.linkedinUrl = linkedinUrl;
      }
      if (linkedinUrls) {
        body.linkedinUrls = linkedinUrls;
      }
      if (wantEmail !== undefined) {
        body.wantEmail = wantEmail;
      }
      if (wantPhone !== undefined) {
        body.wantPhone = wantPhone;
      }

      return callRestAPI(
        config.baseUrl,
        config.apiToken,
        'contact-enrichment',
        'fetch/contactout',
        body,
      );
    },
  },

  {
    definition: {
      name: 'fetch_contacts_from_lusha',
      description: 'Fetch contacts using only Lusha provider.',
      inputSchema: (() => {
        const baseSchema = descriptorToInputSchema(FETCH_CONTACTS_FROM_LUSHA_INPUT_DESCRIPTOR);
        return {
          ...baseSchema,
          properties: {
            ...baseSchema.properties,
            linkedinUrls: {
              type: 'array',
              items: { type: 'string' },
              description: 'Array of LinkedIn profile URLs',
            },
          },
        };
      })(),
    },
    handler: async (args, config) => {
      const { linkedinUrl, linkedinUrls, wantEmail, wantPhone } = args as {
        linkedinUrl?: string;
        linkedinUrls?: string[];
        wantEmail?: boolean;
        wantPhone?: boolean;
      };

      if (!linkedinUrl && !linkedinUrls) {
        throw new Error('Either linkedinUrl or linkedinUrls must be provided');
      }

      const body: Record<string, unknown> = {};
      if (linkedinUrl) {
        body.linkedinUrl = linkedinUrl;
      }
      if (linkedinUrls) {
        body.linkedinUrls = linkedinUrls;
      }
      if (wantEmail !== undefined) {
        body.wantEmail = wantEmail;
      }
      if (wantPhone !== undefined) {
        body.wantPhone = wantPhone;
      }

      return callRestAPI(
        config.baseUrl,
        config.apiToken,
        'contact-enrichment',
        'fetch/lusha',
        body,
      );
    },
  },

  {
    definition: {
      name: 'fetch_contacts_from_apollo',
      description: 'Fetch contacts using only Apollo provider.',
      inputSchema: (() => {
        const baseSchema = descriptorToInputSchema(FETCH_CONTACTS_FROM_APOLLO_INPUT_DESCRIPTOR);
        return {
          ...baseSchema,
          properties: {
            ...baseSchema.properties,
            linkedinUrls: {
              type: 'array',
              items: { type: 'string' },
              description: 'Array of LinkedIn profile URLs',
            },
          },
        };
      })(),
    },
    handler: async (args, config) => {
      const { linkedinUrl, linkedinUrls, wantEmail, wantPhone } = args as {
        linkedinUrl?: string;
        linkedinUrls?: string[];
        wantEmail?: boolean;
        wantPhone?: boolean;
      };

      if (!linkedinUrl && !linkedinUrls) {
        throw new Error('Either linkedinUrl or linkedinUrls must be provided');
      }

      const body: Record<string, unknown> = {};
      if (linkedinUrl) {
        body.linkedinUrl = linkedinUrl;
      }
      if (linkedinUrls) {
        body.linkedinUrls = linkedinUrls;
      }
      if (wantEmail !== undefined) {
        body.wantEmail = wantEmail;
      }
      if (wantPhone !== undefined) {
        body.wantPhone = wantPhone;
      }

      return callRestAPI(
        config.baseUrl,
        config.apiToken,
        'contact-enrichment',
        'fetch/apollo',
        body,
      );
    },
  },

  {
    definition: {
      name: 'get_contact_enrichment_job',
      description: 'Get progress and results for async contact enrichment job.',
      inputSchema: descriptorToInputSchema(GET_CONTACT_ENRICHMENT_JOB_INPUT_DESCRIPTOR),
    },
    handler: async (args, config) => {
      const { jobId } = args as { jobId: string };

      return callRestAPIGet(
        config.baseUrl,
        config.apiToken,
        'contact-enrichment',
        `jobs/${jobId}`,
      );
    },
  },
];
