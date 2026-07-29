const getDocumentationBaseUrl = (baseUrl: string): string => {
  const parsedUrl = new URL(baseUrl);
  const { hostname } = parsedUrl;

  if (
    hostname.startsWith('app.') ||
    hostname.startsWith('api.') ||
    hostname.startsWith('mcp.')
  ) {
    parsedUrl.hostname = hostname.replace(/^(app|api|mcp)\./, 'docs.');

    return parsedUrl.origin;
  }

  return 'https://docs.twenty.com';
};

// service-desc points at each host's live OpenAPI, which is generated per
// workspace and so includes that workspace's custom objects.
export const buildApiCatalog = (baseUrl: string) => {
  const documentationBaseUrl = getDocumentationBaseUrl(baseUrl);
  const apiDocsUrl = `${documentationBaseUrl}/developers/extend/api`;
  const mcpDocsUrl = `${documentationBaseUrl}/user-guide/ai/capabilities/mcp`;

  return {
    linkset: [
      {
        anchor: `${baseUrl}/rest`,
        'service-desc': [
          { href: `${baseUrl}/rest/open-api/core`, type: 'application/json' },
        ],
        'service-doc': [{ href: apiDocsUrl, type: 'text/html' }],
        'service-meta': [
          {
            href: `${baseUrl}/.well-known/oauth-protected-resource`,
            type: 'application/json',
          },
        ],
      },
      {
        anchor: `${baseUrl}/rest/metadata`,
        'service-desc': [
          {
            href: `${baseUrl}/rest/open-api/metadata`,
            type: 'application/json',
          },
        ],
        'service-doc': [{ href: apiDocsUrl, type: 'text/html' }],
      },
      {
        anchor: `${baseUrl}/graphql`,
        'service-doc': [{ href: apiDocsUrl, type: 'text/html' }],
      },
      {
        anchor: `${baseUrl}/mcp`,
        'service-desc': [
          {
            href: `${baseUrl}/.well-known/mcp/server-card.json`,
            type: 'application/json',
          },
        ],
        'service-doc': [{ href: mcpDocsUrl, type: 'text/html' }],
      },
    ],
  };
};
