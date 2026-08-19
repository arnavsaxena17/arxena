import fs from 'fs';
import path from 'path';

import {
  buildCompanyApiOpenApiDocument,
  COMPANY_API_DOCS_SERVERS,
  COMPANY_API_LOCAL_SERVER_URL,
  COMPANY_API_PRODUCTION_SERVER_URL,
  type CompanyApiOpenApiServer,
} from '../../twenty-server/src/engine/core-modules/api-docs/company-api.openapi';

const resolveServersFromEnv = (): CompanyApiOpenApiServer[] => {
  const serverUrlOverride = process.env.COMPANY_API_DOCS_SERVER_URL;

  if (serverUrlOverride === undefined || serverUrlOverride.length === 0) {
    return COMPANY_API_DOCS_SERVERS;
  }

  if (serverUrlOverride === COMPANY_API_PRODUCTION_SERVER_URL) {
    return COMPANY_API_DOCS_SERVERS;
  }

  if (serverUrlOverride === COMPANY_API_LOCAL_SERVER_URL) {
    return [
      {
        url: COMPANY_API_LOCAL_SERVER_URL,
        description: 'Local development',
      },
      {
        url: COMPANY_API_PRODUCTION_SERVER_URL,
        description: 'Production',
      },
    ];
  }

  return [
    {
      url: serverUrlOverride,
      description: 'Custom server',
    },
    ...COMPANY_API_DOCS_SERVERS,
  ];
};

const servers = resolveServersFromEnv();
const outputPath = path.resolve(__dirname, '../openapi/company-api.json');

const document = buildCompanyApiOpenApiDocument(servers);

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(document, null, 2)}\n`);

console.log(`Wrote Company API OpenAPI to ${outputPath}`);
console.log(
  `servers = ${servers.map((server) => `${server.description}: ${server.url}`).join(', ')}`,
);
