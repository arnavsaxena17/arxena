import {
  buildCompanyApiOpenApiDocument,
  COMPANY_API_DOCS_SERVERS,
  COMPANY_API_LOCAL_SERVER_URL,
  COMPANY_API_PRODUCTION_SERVER_URL,
} from '../company-api.openapi';

describe('buildCompanyApiOpenApiDocument', () => {
  it('documents company search request fields including url', () => {
    const doc = buildCompanyApiOpenApiDocument('http://localhost:3000');
    const searchRequest = doc.components?.schemas?.CompanySearchRequest as {
      properties?: {
        url?: { description?: string };
        useV2?: unknown;
        sortBy?: unknown;
        sortOrder?: unknown;
        companyName?: unknown;
      };
    };

    expect(searchRequest.properties?.companyName).toBeDefined();
    expect(searchRequest.properties?.url).toBeDefined();
    expect(searchRequest.properties?.url?.description).toMatch(
      /Sales Navigator account lists/,
    );
    expect(searchRequest.properties?.useV2).toBeDefined();
    expect(searchRequest.properties?.sortBy).toBeUndefined();
    expect(searchRequest.properties?.sortOrder).toBeUndefined();
  });

  it('includes production and local servers by default', () => {
    const doc = buildCompanyApiOpenApiDocument();

    expect(doc.servers).toEqual(COMPANY_API_DOCS_SERVERS);
    expect(doc.servers?.[0]?.url).toBe(COMPANY_API_PRODUCTION_SERVER_URL);
    expect(doc.servers?.[1]?.url).toBe(COMPANY_API_LOCAL_SERVER_URL);
  });
});
