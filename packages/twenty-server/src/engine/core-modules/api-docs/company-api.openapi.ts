import { OpenAPIV3_1 } from 'openapi-types';

import { COMPANY_DATA_SOURCE_CATEGORIES } from '../company-api/constants/company-data-source-aliases';

const dataSourceEnum = COMPANY_DATA_SOURCE_CATEGORIES.map(
  (category) => category.alias,
);
const resolvedDataSourceEnum = dataSourceEnum.filter(
  (alias) => alias !== 'auto',
);

export const COMPANY_API_PRODUCTION_SERVER_URL = 'https://app.arxena.com';
export const COMPANY_API_LOCAL_SERVER_URL = 'http://localhost:3000';

export type CompanyApiOpenApiServer = {
  url: string;
  description: string;
};

export const COMPANY_API_DOCS_SERVERS: CompanyApiOpenApiServer[] = [
  {
    url: COMPANY_API_PRODUCTION_SERVER_URL,
    description: 'Production',
  },
  {
    url: COMPANY_API_LOCAL_SERVER_URL,
    description: 'Local development',
  },
];

const resolveServers = (
  servers: string | CompanyApiOpenApiServer[],
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

export const buildCompanyApiOpenApiDocument = (
  servers: string | CompanyApiOpenApiServer[] = COMPANY_API_DOCS_SERVERS,
): OpenAPIV3_1.Document => ({
  openapi: '3.1.1',
  info: {
    title: 'Arxena Company API',
    description:
      'Company search across Elasticsearch, Unipile LinkedIn (Sales Navigator auto, classic/premium, Recruiter), and Harvest. Hits are returned in a standard format.',
    version: '1.0.0',
    contact: {
      email: 'felix@arxena.com',
    },
  },
  servers: resolveServers(servers),
  paths: {
    '/company-api/companies/search': {
      post: {
        operationId: 'searchCompanies',
        summary: 'Search companies',
        description:
          'Search companies. Omit `dataSource` or pass `auto` to resolve Unipile first, then Harvest, then the companies index. Pass `url` for a LinkedIn Sales Navigator account list, company search, or people search URL.',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CompanySearchRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Company search hits',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CompanySearchResponse' },
              },
            },
          },
        },
      },
    },
    '/company-api/data-sources': {
      get: {
        operationId: 'listCompanyDataSources',
        summary: 'List company search data sources',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Data source catalog',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/CompanyDataSourcesStatusResponse',
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
      CompanySearchHit: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          website: { type: 'string' },
          linkedinUrl: { type: 'string' },
          industry: { type: 'string' },
        },
        example: {
          id: 'acme',
          name: 'Acme',
          website: 'acme.com',
          linkedinUrl: 'https://www.linkedin.com/company/acme',
          industry: 'Software',
        },
      },
      CompanySearchRequest: {
        type: 'object',
        properties: {
          dataSource: {
            type: 'string',
            enum: dataSourceEnum,
            description:
              'auto prefers Unipile Sales Navigator, then Recruiter/classic, Harvest, then index.',
            example: 'auto',
          },
          accountId: { type: 'string' },
          query: { type: 'string' },
          keywords: { type: 'string' },
          companyName: { type: 'string', example: 'Acme' },
          website: { type: 'string' },
          industry: { type: 'string' },
          location: { type: 'string' },
          url: {
            type: 'string',
            description:
              'LinkedIn URL. Sales Navigator account lists (`/sales/accounts/dashboard?listId=...`) are parsed and searched with v1 `account_lists` unless `useV2` is true (or `UNIPILE_ACCOUNT_LIST_V2=true`), which browses the list via Unipile v2 sorted by date added descending. Other LinkedIn search URLs are sent as Unipile search-from-URL.',
            example:
              'https://www.linkedin.com/sales/accounts/dashboard?listGroup=CUSTOM_LISTS&listId=7378394885466337283',
          },
          useV2: {
            type: 'boolean',
            description:
              'When true, Sales Navigator account-list URLs use Unipile v2 browse (always newest first). When omitted, `UNIPILE_ACCOUNT_LIST_V2` is the default (false).',
            example: false,
          },
          limit: { type: 'number', minimum: 1, maximum: 100, default: 20 },
        },
        example: {
          companyName: 'Acme',
          dataSource: 'auto',
          limit: 10,
        },
      },
      CompanySearchResponse: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['ok'] },
          dataSource: { type: 'string', enum: resolvedDataSourceEnum },
          unipileProduct: { type: 'string' },
          total: { type: 'integer' },
          items: {
            type: 'array',
            items: { $ref: '#/components/schemas/CompanySearchHit' },
          },
        },
        example: {
          status: 'ok',
          dataSource: 'index',
          total: 1,
          items: [
            {
              id: 'acme',
              name: 'Acme',
              website: 'acme.com',
              linkedinUrl: 'https://www.linkedin.com/company/acme',
              industry: 'Software',
            },
          ],
        },
      },
      CompanyDataSourcesStatusResponse: {
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
