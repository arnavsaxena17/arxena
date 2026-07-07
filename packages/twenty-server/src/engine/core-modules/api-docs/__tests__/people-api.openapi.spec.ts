import { buildPeopleApiOpenApiDocument } from '../people-api.openapi';

describe('buildPeopleApiOpenApiDocument', () => {
  it('documents people search and taxonomy paths', () => {
    const doc = buildPeopleApiOpenApiDocument('http://localhost:3000');
    const paths = Object.keys(doc.paths ?? {});

    expect(paths).toEqual(
      expect.arrayContaining([
        '/people-api/data-sources',
        '/people-api/taxonomy/function-roots',
        '/people-api/taxonomy/functions',
        '/people-api/taxonomy/grades',
        '/people-api/people/search-by-title',
        '/people-api/people/search',
      ]),
    );

    console.log('[people-api.openapi] paths', paths);
  });
});
