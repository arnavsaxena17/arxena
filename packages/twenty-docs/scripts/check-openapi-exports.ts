import fs from 'fs';
import path from 'path';

import {
  buildCompanyApiOpenApiDocument,
  COMPANY_API_DOCS_SERVERS,
} from '../../twenty-server/src/engine/core-modules/api-docs/company-api.openapi';
import {
  buildJobsApiOpenApiDocument,
  JOBS_API_DOCS_SERVERS,
} from '../../twenty-server/src/engine/core-modules/api-docs/jobs-api.openapi';
import {
  buildPeopleApiOpenApiDocument,
  PEOPLE_API_DOCS_SERVERS,
} from '../../twenty-server/src/engine/core-modules/api-docs/people-api.openapi';
import {
  buildPostsApiOpenApiDocument,
  POSTS_API_DOCS_SERVERS,
} from '../../twenty-server/src/engine/core-modules/api-docs/posts-api.openapi';

const checks = [
  {
    name: 'people-api',
    exportScript: 'yarn docs:export-people-openapi',
    fileName: 'people-api.json',
    document: buildPeopleApiOpenApiDocument(PEOPLE_API_DOCS_SERVERS),
  },
  {
    name: 'company-api',
    exportScript: 'yarn docs:export-company-openapi',
    fileName: 'company-api.json',
    document: buildCompanyApiOpenApiDocument(COMPANY_API_DOCS_SERVERS),
  },
  {
    name: 'jobs-api',
    exportScript: 'yarn docs:export-jobs-openapi',
    fileName: 'jobs-api.json',
    document: buildJobsApiOpenApiDocument(JOBS_API_DOCS_SERVERS),
  },
  {
    name: 'posts-api',
    exportScript: 'yarn docs:export-posts-openapi',
    fileName: 'posts-api.json',
    document: buildPostsApiOpenApiDocument(POSTS_API_DOCS_SERVERS),
  },
] as const;

const openApiDir = path.resolve(__dirname, '../openapi');
const stale: string[] = [];

for (const check of checks) {
  const filePath = path.join(openApiDir, check.fileName);
  const expected = `${JSON.stringify(check.document, null, 2)}\n`;
  const actual = fs.readFileSync(filePath, 'utf8');

  if (actual !== expected) {
    stale.push(
      `${check.fileName} is out of date with ${check.name}.openapi.ts. Run \`${check.exportScript}\` and commit the result.`,
    );
  }
}

if (stale.length > 0) {
  console.error(stale.join('\n'));
  process.exit(1);
}

console.log('Mintlify OpenAPI exports match the server OpenAPI builders.');
