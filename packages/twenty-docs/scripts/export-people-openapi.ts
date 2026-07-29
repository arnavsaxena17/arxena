import fs from 'fs';
import path from 'path';

import { buildPeopleApiOpenApiDocument } from '../../twenty-server/src/engine/core-modules/api-docs/people-api.openapi';

const DEFAULT_SERVER_URL = 'https://app.arxena.com';

const serverUrl = process.env.PEOPLE_API_DOCS_SERVER_URL ?? DEFAULT_SERVER_URL;
const outputPath = path.resolve(__dirname, '../openapi/people-api.json');

const document = buildPeopleApiOpenApiDocument(serverUrl);

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(document, null, 2)}\n`);

console.log(`Wrote People API OpenAPI to ${outputPath}`);
console.log(`servers[0].url = ${serverUrl}`);
