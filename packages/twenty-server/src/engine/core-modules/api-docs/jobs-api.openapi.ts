import { OpenAPIV3_1 } from 'openapi-types';

import { JOB_DATA_SOURCE_CATEGORIES } from '../jobs-api/constants/job-data-source-aliases';

const dataSourceEnum = JOB_DATA_SOURCE_CATEGORIES.map(
  (category) => category.alias,
);

export const JOBS_API_PRODUCTION_SERVER_URL = 'https://app.arxena.com';

export const buildJobsApiOpenApiDocument = (
  serverUrl: string = JOBS_API_PRODUCTION_SERVER_URL,
): OpenAPIV3_1.Document => ({
  openapi: '3.1.1',
  info: {
    title: 'Arxena Jobs API',
    description:
      'Job search via Unipile LinkedIn (Sales Navigator auto account resolution) and Harvest.',
    version: '1.0.0',
    contact: {
      email: 'felix@arxena.com',
    },
  },
  servers: [{ url: serverUrl, description: 'Arxena server' }],
  paths: {
    '/jobs-api/jobs/search': {
      post: {
        operationId: 'searchJobs',
        summary: 'Search jobs',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  dataSource: {
                    type: 'string',
                    enum: dataSourceEnum,
                  },
                  accountId: { type: 'string' },
                  keywords: { type: 'string' },
                  location: { type: 'string' },
                  company: { type: 'string' },
                  datePosted: { type: 'number' },
                  limit: { type: 'number', minimum: 1, maximum: 100 },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Job search hits' },
        },
      },
    },
    '/jobs-api/data-sources': {
      get: {
        operationId: 'listJobDataSources',
        summary: 'List job search data sources',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Data source catalog' } },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
      },
    },
  },
});
