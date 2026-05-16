import { resolveArxenaSiteBaseUrlForTests } from '@/auth/utils/arxenaSiteUrl';

describe('arxenaSiteUrl', () => {
  it('uses local marketing site on arxena.localhost app host', () => {
    expect(
      resolveArxenaSiteBaseUrlForTests({
        nodeEnv: 'development',
        hostname: 'arxena.localhost',
        protocol: 'http:',
        sitePort: '3002',
      }),
    ).toBe('http://arxena.localhost:3002');
  });

  it('uses production site on arxena.com app host', () => {
    expect(
      resolveArxenaSiteBaseUrlForTests({
        nodeEnv: 'production',
        hostname: 'arxena.com',
        protocol: 'https:',
      }),
    ).toBe('https://arxena.com');
  });

  it('ignores production env override during local development', () => {
    expect(
      resolveArxenaSiteBaseUrlForTests({
        envBaseUrl: 'https://arxena.com',
        nodeEnv: 'development',
        hostname: 'arxena.localhost',
        protocol: 'http:',
        sitePort: '3002',
      }),
    ).toBe('http://arxena.localhost:3002');
  });

  it('respects explicit local env override', () => {
    expect(
      resolveArxenaSiteBaseUrlForTests({
        envBaseUrl: 'http://localhost:3002',
        nodeEnv: 'development',
        hostname: 'arxena.localhost',
        protocol: 'http:',
      }),
    ).toBe('http://localhost:3002');
  });
});
