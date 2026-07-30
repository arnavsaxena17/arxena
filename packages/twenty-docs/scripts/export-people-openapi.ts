import fs from 'fs';
import path from 'path';

import {
  buildPeopleApiOpenApiDocument,
  PEOPLE_API_DOCS_SERVERS,
  PEOPLE_API_LOCAL_SERVER_URL,
  PEOPLE_API_PRODUCTION_SERVER_URL,
  type PeopleApiOpenApiServer,
} from '../../twenty-server/src/engine/core-modules/api-docs/people-api.openapi';

const resolveServersFromEnv = (): PeopleApiOpenApiServer[] => {
  const serverUrlOverride = process.env.PEOPLE_API_DOCS_SERVER_URL;

  if (serverUrlOverride === undefined || serverUrlOverride.length === 0) {
    return PEOPLE_API_DOCS_SERVERS;
  }

  if (serverUrlOverride === PEOPLE_API_PRODUCTION_SERVER_URL) {
    return PEOPLE_API_DOCS_SERVERS;
  }

  if (serverUrlOverride === PEOPLE_API_LOCAL_SERVER_URL) {
    return [
      {
        url: PEOPLE_API_LOCAL_SERVER_URL,
        description: 'Local development',
      },
      {
        url: PEOPLE_API_PRODUCTION_SERVER_URL,
        description: 'Production',
      },
    ];
  }

  return [
    {
      url: serverUrlOverride,
      description: 'Custom server',
    },
    ...PEOPLE_API_DOCS_SERVERS,
  ];
};

const servers = resolveServersFromEnv();
const outputPath = path.resolve(__dirname, '../openapi/people-api.json');

const document = buildPeopleApiOpenApiDocument(servers);

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(document, null, 2)}\n`);

console.log(`Wrote People API OpenAPI to ${outputPath}`);
console.log(
  `servers = ${servers.map((server) => `${server.description}: ${server.url}`).join(', ')}`,
);
