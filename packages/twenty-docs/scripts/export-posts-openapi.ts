import fs from 'fs';
import path from 'path';

import {
  buildPostsApiOpenApiDocument,
  POSTS_API_DOCS_SERVERS,
  POSTS_API_LOCAL_SERVER_URL,
  POSTS_API_PRODUCTION_SERVER_URL,
  type PostsApiOpenApiServer,
} from '../../twenty-server/src/engine/core-modules/api-docs/posts-api.openapi';

const resolveServersFromEnv = (): PostsApiOpenApiServer[] => {
  const serverUrlOverride = process.env.POSTS_API_DOCS_SERVER_URL;

  if (serverUrlOverride === undefined || serverUrlOverride.length === 0) {
    return POSTS_API_DOCS_SERVERS;
  }

  if (serverUrlOverride === POSTS_API_PRODUCTION_SERVER_URL) {
    return POSTS_API_DOCS_SERVERS;
  }

  if (serverUrlOverride === POSTS_API_LOCAL_SERVER_URL) {
    return [
      {
        url: POSTS_API_LOCAL_SERVER_URL,
        description: 'Local development',
      },
      {
        url: POSTS_API_PRODUCTION_SERVER_URL,
        description: 'Production',
      },
    ];
  }

  return [
    {
      url: serverUrlOverride,
      description: 'Custom server',
    },
    ...POSTS_API_DOCS_SERVERS,
  ];
};

const servers = resolveServersFromEnv();
const outputPath = path.resolve(__dirname, '../openapi/posts-api.json');

const document = buildPostsApiOpenApiDocument(servers);

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(document, null, 2)}\n`);

console.log(`Wrote Posts API OpenAPI to ${outputPath}`);
console.log(
  `servers = ${servers.map((server) => `${server.description}: ${server.url}`).join(', ')}`,
);
