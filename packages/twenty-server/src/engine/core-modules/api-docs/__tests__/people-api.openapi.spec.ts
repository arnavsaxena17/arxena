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
        '/people-api/taxonomy/manual-boolean-queries',
        '/people-api/titles/expand',
        '/people-api/people/search-by-title',
        '/people-api/people/search-by-taxonomy',
        '/people-api/people/search',
      ]),
    );

    const searchRequest = doc.components?.schemas?.PeopleSearchRequest as {
      properties?: {
        naturalLanguage?: { description?: string; example?: string };
        query?: { description?: string };
        dataSource?: unknown;
        candidateSource?: unknown;
        accountId?: unknown;
        linkedInAccountId?: unknown;
        stdFunctionRoot?: { enum?: string[] };
        stdGrade?: { enum?: string[] };
        stdFunction?: { enum?: string[] };
      };
    };
    expect(searchRequest.properties?.accountId).toBeDefined();
    expect(
      (searchRequest.properties as { searchUrl?: unknown } | undefined)
        ?.searchUrl,
    ).toBeDefined();
    expect(searchRequest.properties?.linkedInAccountId).toBeUndefined();
    expect(searchRequest.properties?.stdFunctionRoot?.enum).toEqual(
      expect.arrayContaining(['engineering', 'human resources', 'corporate']),
    );
    expect(searchRequest.properties?.stdGrade?.enum).toEqual([
      'entry',
      'mid',
      'leadership',
    ]);
    expect(searchRequest.properties?.stdFunction?.enum).toBeUndefined();
    expect(searchRequest.properties?.naturalLanguage).toBeDefined();
    expect(searchRequest.properties?.naturalLanguage?.example).toBe('');
    expect(searchRequest.properties?.naturalLanguage?.description).toMatch(
      /LLM extracts/,
    );
    expect(searchRequest.properties?.query?.description).toMatch(
      /Not classified/,
    );
    expect(searchRequest.properties?.candidateSource).toBeUndefined();
    expect(searchRequest.properties?.dataSource).toBeDefined();
    expect(
      (searchRequest.properties?.dataSource as { enum?: string[]; default?: string })
        ?.enum,
    ).toEqual(
      expect.arrayContaining(['auto', 'index', 'unipile', 'pool']),
    );
    expect(
      (searchRequest.properties?.dataSource as { default?: string }).default,
    ).toBe('auto');

    const searchBody = doc.paths?.['/people-api/people/search']?.post
      ?.requestBody as {
      content?: {
        'application/json'?: {
          example?: {
            naturalLanguage?: string;
            companyName?: string;
            website?: string;
          };
          examples?: Record<string, unknown>;
        };
      };
    };
    const jsonBody = searchBody.content?.['application/json'];
    expect(jsonBody?.example).toEqual({
      naturalLanguage: '',
      dataSource: 'auto',
      limit: 10,
    });
    expect(jsonBody?.examples).toBeUndefined();

    console.log('[people-api.openapi] paths', paths);
  });

  it('documents natural-language resolved fields including locations', () => {
    const doc = buildPeopleApiOpenApiDocument('http://localhost:3000');
    const searchResponse = doc.components?.schemas?.PeopleSearchResponse as {
      properties?: {
        resolved?: {
          properties?: {
            locations?: unknown;
            stdFunction?: unknown;
          };
        };
      };
    };

    expect(searchResponse.properties?.resolved?.properties?.locations).toEqual({
      type: 'array',
      items: { type: 'string' },
    });
    expect(
      searchResponse.properties?.resolved?.properties?.stdFunction,
    ).toBeDefined();
  });

  it('includes production and local servers by default', () => {
    const doc = buildPeopleApiOpenApiDocument();

    expect(doc.servers).toEqual(PEOPLE_API_DOCS_SERVERS);
    expect(doc.servers?.[0]?.url).toBe(PEOPLE_API_PRODUCTION_SERVER_URL);
    expect(doc.servers?.[1]?.url).toBe(PEOPLE_API_LOCAL_SERVER_URL);
  });
});
