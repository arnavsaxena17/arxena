import {
  applyFallbackCorsHeaders,
  getCorsOptionsForRequest,
  isDocsPlaygroundOrigin,
} from 'src/engine/utils/cors-options.util';

describe('cors-options.util', () => {
  it('treats docs.arxena.com and local Mintlify as playground origins', () => {
    expect(isDocsPlaygroundOrigin('https://docs.arxena.com')).toBe(true);
    expect(isDocsPlaygroundOrigin('http://localhost:3003')).toBe(true);
    expect(isDocsPlaygroundOrigin('https://app.arxena.com')).toBe(false);
  });

  it('reflects the docs origin and allows Authorization for playground requests', () => {
    const options = getCorsOptionsForRequest('https://docs.arxena.com');

    expect(options.origin).toBe('https://docs.arxena.com');
    expect(options.credentials).toBe(true);
    expect(options.allowedHeaders).toEqual(
      expect.arrayContaining(['Authorization', 'Content-Type']),
    );
  });

  it('keeps wildcard CORS for other browser origins', () => {
    const options = getCorsOptionsForRequest('https://example.com');

    expect(options.origin).toBe('*');
    expect(options.credentials).toBe(false);
  });

  it('writes matching CORS headers on fallback error responses', () => {
    const headers: Record<string, string> = {};
    const response = {
      header: (name: string, value: string) => {
        headers[name] = value;
      },
    };

    applyFallbackCorsHeaders(response, 'https://docs.arxena.com');

    expect(headers['Access-Control-Allow-Origin']).toBe(
      'https://docs.arxena.com',
    );
    expect(headers['Access-Control-Allow-Credentials']).toBe('true');
    expect(headers['Access-Control-Allow-Headers']).toContain('Authorization');
  });
});
