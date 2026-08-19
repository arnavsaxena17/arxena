import fs from 'fs';
import path from 'path';

import {
  buildJobsApiOpenApiDocument,
  JOBS_API_DOCS_SERVERS,
  JOBS_API_LOCAL_SERVER_URL,
  JOBS_API_PRODUCTION_SERVER_URL,
  type JobsApiOpenApiServer,
} from '../../twenty-server/src/engine/core-modules/api-docs/jobs-api.openapi';

const resolveServersFromEnv = (): JobsApiOpenApiServer[] => {
  const serverUrlOverride = process.env.JOBS_API_DOCS_SERVER_URL;

  if (serverUrlOverride === undefined || serverUrlOverride.length === 0) {
    return JOBS_API_DOCS_SERVERS;
  }

  if (serverUrlOverride === JOBS_API_PRODUCTION_SERVER_URL) {
    return JOBS_API_DOCS_SERVERS;
  }

  if (serverUrlOverride === JOBS_API_LOCAL_SERVER_URL) {
    return [
      {
        url: JOBS_API_LOCAL_SERVER_URL,
        description: 'Local development',
      },
      {
        url: JOBS_API_PRODUCTION_SERVER_URL,
        description: 'Production',
      },
    ];
  }

  return [
    {
      url: serverUrlOverride,
      description: 'Custom server',
    },
    ...JOBS_API_DOCS_SERVERS,
  ];
};

const servers = resolveServersFromEnv();
const outputPath = path.resolve(__dirname, '../openapi/jobs-api.json');

const document = buildJobsApiOpenApiDocument(servers);

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(document, null, 2)}\n`);

console.log(`Wrote Jobs API OpenAPI to ${outputPath}`);
console.log(
  `servers = ${servers.map((server) => `${server.description}: ${server.url}`).join(', ')}`,
);
