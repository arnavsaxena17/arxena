import {
  buildPeopleApiOpenApiDocument,
  PEOPLE_API_DOCS_SERVERS,
  PEOPLE_API_LOCAL_SERVER_URL,
  PEOPLE_API_PRODUCTION_SERVER_URL,
} from '../people-api.openapi';

describe('buildPeopleApiOpenApiDocument', () => {
  it('documents people search and taxonomy paths', () => {
    const doc = buildPeopleApiOpenApiDocument('http://localhost:3000');
    const paths = Object.keys(doc.paths ?? {});

    expect(paths).toEqual(
      expect.arrayContaining([
        '/people-api/data-sources',
        '/people-api/credits',
        '/people-api/taxonomy/constants',
        '/people-api/taxonomy/tree',
        '/people-api/taxonomy/function-roots',
        '/people-api/taxonomy/functions',
        '/people-api/taxonomy/grades',
        '/people-api/taxonomy/boolean-strings',
        '/people-api/titles/expand',
        '/people-api/people/search-by-title',
        '/people-api/people/search-by-taxonomy',
        '/people-api/people/search',
      ]),
    );

    console.log('[people-api.openapi] paths', paths);
  });

  it('includes production and local servers by default', () => {
    const doc = buildPeopleApiOpenApiDocument();

    expect(doc.servers).toEqual(PEOPLE_API_DOCS_SERVERS);
    expect(doc.servers?.[0]?.url).toBe(PEOPLE_API_PRODUCTION_SERVER_URL);
    expect(doc.servers?.[1]?.url).toBe(PEOPLE_API_LOCAL_SERVER_URL);
  });
});
