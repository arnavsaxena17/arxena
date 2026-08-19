import { OpenAPIV3_1 } from 'openapi-types';

import { JOB_DATA_SOURCE_CATEGORIES } from '../jobs-api/constants/job-data-source-aliases';

const dataSourceEnum = JOB_DATA_SOURCE_CATEGORIES.map(
  (category) => category.alias,
);
const resolvedDataSourceEnum = dataSourceEnum.filter(
  (alias) => alias !== 'auto',
);

export const JOBS_API_PRODUCTION_SERVER_URL = 'https://app.arxena.com';
export const JOBS_API_LOCAL_SERVER_URL = 'http://localhost:3000';

export type JobsApiOpenApiServer = {
  url: string;
  description: string;
};

export const JOBS_API_DOCS_SERVERS: JobsApiOpenApiServer[] = [
  {
    url: JOBS_API_PRODUCTION_SERVER_URL,
    description: 'Production',
  },
  {
    url: JOBS_API_LOCAL_SERVER_URL,
    description: 'Local development',
  },
];

const resolveServers = (
  servers: string | JobsApiOpenApiServer[],
): OpenAPIV3_1.ServerObject[] => {
  if (typeof servers === 'string') {
    return [{ url: servers, description: 'Arxena server' }];
  }

  return servers.map((server) => ({
    url: server.url,
    description: server.description,
  }));
};

const bearerAuth: OpenAPIV3_1.SecuritySchemeObject = {
  type: 'http',
  scheme: 'bearer',
};

export const buildJobsApiOpenApiDocument = (
  servers: string | JobsApiOpenApiServer[] = JOBS_API_DOCS_SERVERS,
): OpenAPIV3_1.Document => ({
  openapi: '3.1.1',
  info: {
    title: 'Arxena Jobs API',
    description:
      'Job search via Unipile LinkedIn (Sales Navigator auto account resolution) and Harvest. Hits are returned in a standard format.',
    version: '1.0.0',
    contact: {
      email: 'felix@arxena.com',
    },
  },
  servers: resolveServers(servers),
  paths: {
    '/jobs-api/jobs/search': {
      post: {
        operationId: 'searchJobs',
        summary: 'Search jobs',
        description:
          'Search jobs. Omit `dataSource` or pass `auto` to resolve Unipile first, then Harvest.',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/JobSearchRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Job search hits',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/JobSearchResponse' },
              },
            },
          },
        },
      },
    },
    '/jobs-api/data-sources': {
      get: {
        operationId: 'listJobDataSources',
        summary: 'List job search data sources',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Data source catalog',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/JobDataSourcesStatusResponse',
                },
              },
            },
          },
        },
      },
    },
  },
  components: {
    securitySchemes: { bearerAuth },
    schemas: {
      JobSearchHit: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          location: { type: 'string' },
          url: { type: 'string' },
          companyName: { type: 'string' },
          postedAt: { type: 'string' },
        },
        example: {
          id: 'job-1',
          title: 'Account Executive',
          location: 'San Francisco',
          url: 'https://www.linkedin.com/jobs/view/1',
          companyName: 'Acme',
          postedAt: '2026-08-01',
        },
      },
      JobSearchRequest: {
        type: 'object',
        properties: {
          dataSource: {
            type: 'string',
            enum: dataSourceEnum,
            example: 'auto',
          },
          accountId: { type: 'string' },
          keywords: { type: 'string', example: 'account executive' },
          location: { type: 'string' },
          company: { type: 'string' },
          datePosted: { type: 'number' },
          limit: { type: 'number', minimum: 1, maximum: 100, default: 20 },
        },
        example: {
          keywords: 'account executive',
          dataSource: 'auto',
          limit: 10,
        },
      },
      JobSearchResponse: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['ok'] },
          dataSource: { type: 'string', enum: resolvedDataSourceEnum },
          total: { type: 'integer' },
          items: {
            type: 'array',
            items: { $ref: '#/components/schemas/JobSearchHit' },
          },
        },
        example: {
          status: 'ok',
          dataSource: 'unipile',
          total: 1,
          items: [
            {
              id: 'job-1',
              title: 'Account Executive',
              location: 'San Francisco',
              url: 'https://www.linkedin.com/jobs/view/1',
              companyName: 'Acme',
              postedAt: '2026-08-01',
            },
          ],
        },
      },
      JobDataSourcesStatusResponse: {
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
                configured: { type: 'boolean' },
              },
            },
          },
        },
      },
    },
  },
});
