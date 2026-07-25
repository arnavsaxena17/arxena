import { OpenAPIV3_1 } from 'openapi-types';

import { PEOPLE_DATA_SOURCE_CATEGORIES } from '../people-api/constants/people-data-source-aliases';

const dataSourceEnum = PEOPLE_DATA_SOURCE_CATEGORIES.map(
  (category) => category.alias,
);

export const buildPeopleApiOpenApiDocument = (
  serverUrl: string,
): OpenAPIV3_1.Document => ({
  openapi: '3.1.1',
  info: {
    title: 'Arxena People API',
    description:
      'Search people by standardized function and grade, browse the std taxonomy, and query configured data source categories by alias.',
    version: '1.0.0',
    contact: {
      email: 'felix@arxena.com',
    },
  },
  servers: [
    {
      url: serverUrl,
      description: 'Arxena server',
    },
  ],
  tags: [
    { name: 'Data sources', description: 'Configured people data source aliases' },
    { name: 'Taxonomy', description: 'std_function_root, std_function, std_grade' },
    { name: 'People', description: 'People search' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Workspace JWT from Arxena auth.',
      },
    },
    schemas: {
      TaxonomyItem: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          label: { type: 'string' },
          name: { type: 'string' },
          parent_id: { type: ['string', 'null'] },
          level: {
            oneOf: [{ type: 'string' }, { type: 'number' }, { type: 'null' }],
          },
        },
        required: ['id', 'label', 'name'],
      },
      PeopleSearchRequest: {
        type: 'object',
        properties: {
          dataSource: {
            type: 'string',
            enum: dataSourceEnum,
            default: 'index',
            description:
              'Data source category alias. Use `index` for std_function and std_grade filters.',
          },
          companyId: { type: 'string' },
          companyName: { type: 'string' },
          website: { type: 'string' },
          stdFunction: {
            type: 'string',
            description: 'Standardized function (e.g. engineering, sales).',
          },
          stdGrade: {
            type: 'string',
            description: 'Standardized grade (e.g. leadership, mid, entry).',
          },
          country: { type: 'string' },
          query: { type: 'string' },
          personName: { type: 'string' },
          jobTitle: { type: 'string' },
          linkedinUrl: { type: 'string' },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          offset: { type: 'integer', minimum: 0, default: 0 },
        },
      },
      PeopleSearchResponse: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['ok'] },
          dataSource: { type: 'string', enum: dataSourceEnum },
          total: { type: 'integer' },
          items: {
            type: 'array',
            items: { type: 'object', additionalProperties: true },
          },
        },
      },
      TitleFromJobSearchRequest: {
        type: 'object',
        required: ['jobTitle'],
        properties: {
          jobTitle: {
            type: 'string',
            description:
              'Sample job title to classify into std_function and std_grade before searching.',
          },
          dataSource: {
            type: 'string',
            enum: dataSourceEnum,
            default: 'index',
          },
          companyId: { type: 'string' },
          companyName: { type: 'string' },
          website: { type: 'string' },
          country: { type: 'string' },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          offset: { type: 'integer', minimum: 0, default: 0 },
        },
      },
      PeopleSearchByTitleResponse: {
        allOf: [
          { $ref: '#/components/schemas/PeopleSearchResponse' },
          {
            type: 'object',
            properties: {
              resolved: {
                type: 'object',
                properties: {
                  jobTitle: { type: 'string' },
                  normalizedTitle: { type: ['string', 'null'] },
                  stdFunction: { type: ['string', 'null'] },
                  stdFunctionRoot: { type: ['string', 'null'] },
                  stdGrade: { type: ['string', 'null'] },
                  confidence: { type: 'number' },
                },
              },
            },
          },
        ],
      },
      DataSourcesResponse: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['ok'] },
          sources: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                alias: { type: 'string', enum: dataSourceEnum },
                label: { type: 'string' },
                description: { type: 'string' },
                supportsStdFunctionFilter: { type: 'boolean' },
                supportsStdGradeFilter: { type: 'boolean' },
                configured: { type: 'boolean' },
              },
            },
          },
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    '/people-api/openapi.json': {
      get: {
        tags: ['Meta'],
        summary: 'OpenAPI document',
        operationId: 'getOpenApiDocument',
        security: [],
        responses: {
          '200': {
            description: 'OpenAPI 3.1 document',
            content: {
              'application/json': {
                schema: { type: 'object' },
              },
            },
          },
        },
      },
    },
    '/people-api/data-sources': {
      get: {
        tags: ['Data sources'],
        summary: 'List people data source categories',
        description:
          'Returns configured data source aliases (apollo, pdl, contactout, harvest, index). Vendor names are not exposed.',
        operationId: 'listPeopleDataSources',
        responses: {
          '200': {
            description: 'Data source categories',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/DataSourcesResponse' },
              },
            },
          },
        },
      },
    },
    '/people-api/taxonomy/function-roots': {
      get: {
        tags: ['Taxonomy'],
        summary: 'List std function roots',
        description:
          'Returns all std_function_root values. Pass `title` to classify a job title into a function root.',
        operationId: 'listFunctionRoots',
        parameters: [
          {
            name: 'title',
            in: 'query',
            required: false,
            schema: { type: 'string' },
            description: 'Optional job title to classify',
          },
        ],
        responses: {
          '200': {
            description: 'Function roots or single classified item',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string' },
                    items: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/TaxonomyItem' },
                    },
                    item: { $ref: '#/components/schemas/TaxonomyItem' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/people-api/taxonomy/functions': {
      get: {
        tags: ['Taxonomy'],
        summary: 'List std functions',
        description:
          'Returns std_function values, optionally filtered by function_root. Pass `title` to classify a job title.',
        operationId: 'listFunctions',
        parameters: [
          {
            name: 'function_root',
            in: 'query',
            required: false,
            schema: { type: 'string' },
          },
          {
            name: 'title',
            in: 'query',
            required: false,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description: 'Functions or single classified item',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string' },
                    items: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/TaxonomyItem' },
                    },
                    item: { $ref: '#/components/schemas/TaxonomyItem' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/people-api/taxonomy/grades': {
      get: {
        tags: ['Taxonomy'],
        summary: 'List std grades',
        description:
          'Returns std_grade values. Optionally filter by grade_level (entry, mid, leadership).',
        operationId: 'listGrades',
        parameters: [
          {
            name: 'grade_level',
            in: 'query',
            required: false,
            schema: { type: 'string' },
          },
          {
            name: 'title',
            in: 'query',
            required: false,
            schema: { type: 'string' },
            description: 'Optional job title to classify into a std grade',
          },
        ],
        responses: {
          '200': {
            description: 'Grade taxonomy items',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string' },
                    items: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/TaxonomyItem' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/people-api/people/search-by-title': {
      post: {
        tags: ['People'],
        summary: 'Resolve job title and search people',
        description:
          'Classifies a sample job title into std_function and std_grade, then searches people using those resolved values. Requires a company scope (companyId, companyName, or website).',
        operationId: 'searchPeopleByJobTitle',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/TitleFromJobSearchRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Resolved taxonomy and search results',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/PeopleSearchByTitleResponse',
                },
              },
            },
          },
          '400': { description: 'Invalid request' },
          '401': { description: 'Unauthorized' },
          '422': { description: 'Could not resolve title taxonomy' },
          '501': { description: 'Data source not implemented' },
          '503': { description: 'Data source or taxonomy not configured' },
        },
      },
    },
    '/people-api/people/search': {
      post: {
        tags: ['People'],
        summary: 'Search people',
        description:
          'Search people by std_function and std_grade using the `index` data source. Other aliases route to their respective providers.',
        operationId: 'searchPeople',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/PeopleSearchRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Search results',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/PeopleSearchResponse' },
              },
            },
          },
          '400': { description: 'Invalid request' },
          '401': { description: 'Unauthorized' },
          '501': { description: 'Data source not implemented' },
          '503': { description: 'Data source not configured' },
        },
      },
    },
  },
});
