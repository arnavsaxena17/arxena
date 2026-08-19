import { OpenAPIV3_1 } from 'openapi-types';

import { POST_DATA_SOURCE_CATEGORIES } from '../posts-api/constants/post-data-source-aliases';

const dataSourceEnum = POST_DATA_SOURCE_CATEGORIES.map(
  (category) => category.alias,
);
const resolvedDataSourceEnum = dataSourceEnum.filter(
  (alias) => alias !== 'auto',
);

export const POSTS_API_PRODUCTION_SERVER_URL = 'https://app.arxena.com';
export const POSTS_API_LOCAL_SERVER_URL = 'http://localhost:3000';

export type PostsApiOpenApiServer = {
  url: string;
  description: string;
};

export const POSTS_API_DOCS_SERVERS: PostsApiOpenApiServer[] = [
  {
    url: POSTS_API_PRODUCTION_SERVER_URL,
    description: 'Production',
  },
  {
    url: POSTS_API_LOCAL_SERVER_URL,
    description: 'Local development',
  },
];

const resolveServers = (
  servers: string | PostsApiOpenApiServer[],
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

export const buildPostsApiOpenApiDocument = (
  servers: string | PostsApiOpenApiServer[] = POSTS_API_DOCS_SERVERS,
): OpenAPIV3_1.Document => ({
  openapi: '3.1.1',
  info: {
    title: 'Arxena Posts API',
    description:
      'LinkedIn post search via Unipile (Sales Navigator auto account resolution) and Harvest. Hits are returned in a standard format.',
    version: '1.0.0',
    contact: {
      email: 'felix@arxena.com',
    },
  },
  servers: resolveServers(servers),
  paths: {
    '/posts-api/posts/search': {
      post: {
        operationId: 'searchPosts',
        summary: 'Search posts',
        description:
          'Search LinkedIn posts. Omit `dataSource` or pass `auto` to resolve Unipile first, then Harvest.',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/PostSearchRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Post search hits',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/PostSearchResponse' },
              },
            },
          },
        },
      },
    },
    '/posts-api/data-sources': {
      get: {
        operationId: 'listPostDataSources',
        summary: 'List post search data sources',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Data source catalog',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/PostDataSourcesStatusResponse',
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
      PostSearchHit: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          socialId: { type: 'string' },
          shareUrl: { type: 'string' },
          title: { type: 'string' },
          text: { type: 'string' },
          postedAt: { type: 'string' },
          authorName: { type: 'string' },
          authorUrl: { type: 'string' },
          reactionCount: { type: 'number' },
          commentCount: { type: 'number' },
          isRepost: { type: 'boolean' },
        },
        example: {
          id: 'post-1',
          socialId: 'urn:li:activity:1',
          shareUrl: 'https://www.linkedin.com/feed/update/urn:li:activity:1',
          title: 'Hiring',
          text: 'We are hiring Account Executives',
          postedAt: '2026-08-01T12:00:00.000Z',
          authorName: 'Jane Doe',
          authorUrl: 'https://www.linkedin.com/in/jane-doe',
          reactionCount: 12,
          commentCount: 3,
          isRepost: false,
        },
      },
      PostSearchRequest: {
        type: 'object',
        properties: {
          dataSource: {
            type: 'string',
            enum: dataSourceEnum,
            example: 'auto',
          },
          accountId: { type: 'string' },
          keywords: { type: 'string', example: 'hiring' },
          sortBy: {
            type: 'string',
            enum: ['relevance', 'date'],
          },
          datePosted: {
            type: 'string',
            enum: ['past_day', 'past_week', 'past_month'],
          },
          contentType: {
            type: 'string',
            enum: [
              'videos',
              'images',
              'live_videos',
              'collaborative_articles',
              'documents',
            ],
          },
          limit: { type: 'number', minimum: 1, maximum: 100, default: 20 },
        },
        example: {
          keywords: 'hiring',
          dataSource: 'auto',
          limit: 10,
        },
      },
      PostSearchResponse: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['ok'] },
          dataSource: { type: 'string', enum: resolvedDataSourceEnum },
          total: { type: 'integer' },
          items: {
            type: 'array',
            items: { $ref: '#/components/schemas/PostSearchHit' },
          },
        },
        example: {
          status: 'ok',
          dataSource: 'unipile',
          total: 1,
          items: [
            {
              id: 'post-1',
              socialId: 'urn:li:activity:1',
              shareUrl:
                'https://www.linkedin.com/feed/update/urn:li:activity:1',
              title: 'Hiring',
              text: 'We are hiring Account Executives',
              postedAt: '2026-08-01T12:00:00.000Z',
              authorName: 'Jane Doe',
              authorUrl: 'https://www.linkedin.com/in/jane-doe',
              reactionCount: 12,
              commentCount: 3,
              isRepost: false,
            },
          ],
        },
      },
      PostDataSourcesStatusResponse: {
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
