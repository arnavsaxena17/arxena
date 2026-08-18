import { OpenAPIV3_1 } from 'openapi-types';

import { COMPANY_DATA_SOURCE_CATEGORIES } from '../company-api/constants/company-data-source-aliases';

const dataSourceEnum = COMPANY_DATA_SOURCE_CATEGORIES.map(
  (category) => category.alias,
);

export const COMPANY_API_PRODUCTION_SERVER_URL = 'https://app.arxena.com';
export const COMPANY_API_LOCAL_SERVER_URL = 'http://localhost:3000';

export const buildCompanyApiOpenApiDocument = (
  serverUrl: string = COMPANY_API_PRODUCTION_SERVER_URL,
): OpenAPIV3_1.Document => ({
  openapi: '3.1.1',
  info: {
    title: 'Arxena Company API',
    description:
      'Company search across Elasticsearch, Unipile LinkedIn (Sales Navigator auto, classic/premium, Recruiter account), and Harvest.',
    version: '1.0.0',
    contact: {
      email: 'felix@arxena.com',
    },
  },
  servers: [{ url: serverUrl, description: 'Arxena server' }],
  paths: {
    '/company-api/companies/search': {
      post: {
        operationId: 'searchCompanies',
        summary: 'Search companies',
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
                    description:
                      'auto prefers Unipile Sales Navigator, then Recruiter/classic, Harvest, then index.',
                  },
                  accountId: { type: 'string' },
                  query: { type: 'string' },
                  keywords: { type: 'string' },
                  companyName: { type: 'string' },
                  website: { type: 'string' },
                  industry: { type: 'string' },
                  location: { type: 'string' },
                  limit: { type: 'number', minimum: 1, maximum: 100 },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Company search hits',
          },
        },
      },
    },
    '/company-api/data-sources': {
      get: {
        operationId: 'listCompanyDataSources',
        summary: 'List company search data sources',
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
