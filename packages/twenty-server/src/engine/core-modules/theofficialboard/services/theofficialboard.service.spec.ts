import { TheOfficialBoardService } from 'src/engine/core-modules/theofficialboard/services/theofficialboard.service';

const notFoundHtml = `
  <html>
    <head><title>Oops! The page you're looking for can't be found</title></head>
    <body><h1>Oops! The page you're looking for can't be found</h1></body>
  </html>
`;

const companyHtml = `
  <html>
    <head><title>Shapoorji Pallonji Org Chart</title></head>
    <body>
      <h1>Shapoorji Pallonji Org Chart</h1>
      <p>Shapoorji Pallonji has 93 executives and 3 subsidiaries</p>
      <div id="orgchart"></div>
      <div id="subsidiaries-bubble">
        <ul class="obTree">
          <li>
            <a href="/org-chart/shapoorji-pallonji">Shapoorji Pallonji</a>
            <ul>
              <li><a href="/org-chart/afcons-infrastructure">Afcons Infrastructure</a></li>
            </ul>
          </li>
        </ul>
      </div>
    </body>
  </html>
`;

describe('TheOfficialBoardService', () => {
  it('treats The Official Board 200 Oops pages as misses and retries slug candidates', async () => {
    const unlocker = {
      isConfigured: jest.fn(() => true),
      requestRaw: jest.fn(async ({ url }: { url: string }) => ({
        statusCode: 200,
        headers: {},
        body: url.endsWith('/org-chart/shapoorji-pallonji-group')
          ? notFoundHtml
          : companyHtml,
      })),
    };
    const service = new TheOfficialBoardService(
      { write: jest.fn() } as any,
      { isConfigured: jest.fn(() => false) } as any,
      unlocker as any,
      { isConfigured: jest.fn(() => false) } as any,
    );

    const result = await service.fetchCompanyDetailsResolvingSlug(
      'shapoorji pallonji group',
      { persist: false },
    );

    expect(result.companyName).toBe('Shapoorji Pallonji');
    expect(result.slugResolution).toEqual({
      inputSlug: 'shapoorji-pallonji-group',
      attemptedSlugs: ['shapoorji-pallonji-group', 'shapoorji-pallonji'],
      successfulCandidate: 'shapoorji-pallonji',
    });
  });

  it('uses Bright Data SERP to discover the official slug after local candidates miss', async () => {
    const unlocker = {
      isConfigured: jest.fn(() => true),
      requestRaw: jest.fn(async ({ url }: { url: string }) => ({
        statusCode: 200,
        headers: {},
        body: url.endsWith('/org-chart/acme-official')
          ? companyHtml.replace(/Shapoorji Pallonji/g, 'Acme Official')
          : notFoundHtml,
      })),
    };
    const serp = {
      isConfigured: jest.fn(() => true),
      requestSerpGoogleJson: jest.fn(async () => ({
        organic: [
          {
            link: 'https://www.theofficialboard.com/org-chart/acme-official',
          },
        ],
      })),
    };
    const service = new TheOfficialBoardService(
      { write: jest.fn() } as any,
      serp as any,
      unlocker as any,
      { isConfigured: jest.fn(() => false) } as any,
    );

    const result = await service.fetchCompanyDetailsResolvingSlug(
      'mystery holdings',
      { persist: false },
    );

    expect(serp.requestSerpGoogleJson).toHaveBeenCalledWith(
      'https://www.google.com/search?q=mystery%20holdings%20site%3Atheofficialboard.com%2Forg-chart',
    );
    expect(result.companyName).toBe('Acme Official');
    expect(result.slugResolution).toEqual({
      inputSlug: 'mystery-holdings',
      attemptedSlugs: ['mystery-holdings', 'mystery', 'acme-official'],
      successfulCandidate: 'acme-official',
      discoveredViaBrightDataSerp: true,
    });
  });
});
