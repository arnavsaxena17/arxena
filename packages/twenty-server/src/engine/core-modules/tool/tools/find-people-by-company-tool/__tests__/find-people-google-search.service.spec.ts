import {
  FindPeopleGoogleSearchService,
  resolveSerpCountry,
} from 'src/engine/core-modules/tool/tools/find-people-by-company-tool/find-people-google-search.service';

// the request-rate limiter would stall tests that run on fake timers
process.env.FIND_ROLE_SERP_REQUESTS_PER_MINUTE = '0';

const build = (
  requestSerpGoogleJson: jest.Mock,
  requestSerpGoogleJsonInZone: jest.Mock = jest
    .fn()
    .mockRejectedValue(new Error('empty page')),
) =>
  new FindPeopleGoogleSearchService({
    isConfigured: () => true,
    requestSerpGoogleJson,
    requestSerpGoogleJsonInZone,
  } as never);

describe('FindPeopleGoogleSearchService', () => {
  beforeEach(() => {
    jest.useRealTimers();
    // The local .env may enable the AI pass; tests opt in per case
    process.env.FIND_ROLE_AI_OVERVIEW = 'false';
  });

  afterEach(() => {
    jest.useFakeTimers();
    delete process.env.FIND_ROLE_AI_OVERVIEW;
    delete process.env.FIND_ROLE_AI_OVERVIEW_RETRY_MS;
    delete process.env.FIND_ROLE_SERP_COUNTRY;
    delete process.env.BRIGHT_DATA_SERP_AI_OVERVIEW_ZONE;
  });

  it('should return every result once, LinkedIn or not', async () => {
    const service = build(
      jest.fn().mockResolvedValue({
        organic: [
          {
            title: 'Vikesh Shah - 99 Pancakes | LinkedIn',
            link: 'https://in.linkedin.com/in/vikesh-shah-253a67204',
          },
          {
            title: 'About us',
            link: 'https://99pancakes.in/pages/about-us',
            description: 'Vikesh Shah, founder of 99 Pancakes',
          },
        ],
      }),
    );

    const result = await service.searchCompany({
      variants: ['99 Pancakes'],
      titles: ['founder'],
      roles: ['founder'],
    });

    // Every query returns the same two results, so each is kept once
    expect(result.results.map((item) => item.url)).toEqual([
      'https://in.linkedin.com/in/vikesh-shah-253a67204',
      'https://99pancakes.in/pages/about-us',
    ]);
  });

  it('should not merge two different sites that share a path', async () => {
    const service = build(
      jest.fn().mockResolvedValue({
        organic: [
          { title: 'About', link: 'https://a.com/about-us', description: 'x' },
          { title: 'About', link: 'https://b.com/about-us', description: 'y' },
        ],
      }),
    );

    const result = await service.searchCompany({
      variants: ['Acme'],
      titles: ['ceo'],
      roles: ['CEO'],
    });

    expect(result.results).toHaveLength(2);
  });

  it('should treat a Bright Data upstream failure as an error after retrying', async () => {
    const request = jest
      .fn()
      .mockRejectedValue(
        new Error('Bright Data SERP failed: HTTP 502 (upstream)'),
      );
    const service = build(request);

    const result = await service.searchCompany({
      variants: ['Acme'],
      titles: ['ceo'],
      roles: ['CEO'],
    });
    const queries = service.buildCompanyQueries({
      variants: ['Acme'],
      titles: ['ceo'],
      roles: ['CEO'],
    });

    expect(result.results).toEqual([]);
    expect(result.errors).toEqual([
      'Bright Data SERP failed: HTTP 502 (upstream)',
    ]);
    // First try plus two retries for every query
    expect(request).toHaveBeenCalledTimes(queries.length * 3);
  });

  it('should keep working when only some queries fail', async () => {
    const service = build(
      jest.fn().mockImplementation(async (url: string) => {
        if (decodeURIComponent(url).includes('site:linkedin.com/in')) {
          throw new Error('Bright Data SERP failed: HTTP 400 Bad Request');
        }

        return {
          organic: [
            {
              title: 'About us',
              link: 'https://acme.com/about',
              description: 'x',
            },
          ],
        };
      }),
    );

    const result = await service.searchCompany({
      variants: ['Acme'],
      titles: ['ceo'],
      roles: ['CEO'],
    });

    expect(result.results).toHaveLength(1);
    expect(result.errors).toEqual([
      'Bright Data SERP failed: HTTP 400 Bad Request',
    ]);
  });

  it('should hold requests back above the concurrency limit', async () => {
    process.env.FIND_ROLE_SERP_CONCURRENCY = '2';

    let running = 0;
    let peak = 0;
    const service = build(
      jest.fn().mockImplementation(async () => {
        running += 1;
        peak = Math.max(peak, running);
        await new Promise((resolve) => setTimeout(resolve, 10));
        running -= 1;

        return { organic: [] };
      }),
    );

    await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        service.request(`query ${index}`),
      ),
    );
    delete process.env.FIND_ROLE_SERP_CONCURRENCY;

    expect(peak).toBe(2);
  });

  describe('timing', () => {
    afterEach(() => {
      delete process.env.FIND_ROLE_SERP_ATTEMPT_TIMEOUT_MS;
      delete process.env.FIND_ROLE_COMPANY_DEADLINE_MS;
    });

    const hangsUntilAborted = (signal: AbortSignal) =>
      new Promise((_, reject) =>
        signal.addEventListener('abort', () => reject(new Error('aborted'))),
      );

    it('should replace a failed attempt at once', async () => {
      const request = jest
        .fn()
        .mockRejectedValueOnce(
          new Error('Bright Data SERP failed: HTTP 502 (upstream)'),
        )
        .mockResolvedValueOnce({ organic: [] });

      await build(request).request('Acme CEO');

      expect(request).toHaveBeenCalledTimes(2);
    });

    it('should never start more attempts than retries allow, and fail when all fail', async () => {
      const request = jest
        .fn()
        .mockImplementation(
          async (_url: string, options: { signal: AbortSignal }) => {
            await new Promise((resolve) => setTimeout(resolve, 20));
            throw new Error('Bright Data SERP failed: HTTP 502 (upstream)');
          },
        );

      await expect(
        build(request).request('Acme CEO', { retries: 1 }),
      ).rejects.toThrow('HTTP 502');
      expect(request).toHaveBeenCalledTimes(2);
    });

    it('should give every attempt its own timeout and abort signal', async () => {
      process.env.FIND_ROLE_SERP_ATTEMPT_TIMEOUT_MS = '1234';

      const request = jest.fn().mockResolvedValue({ organic: [] });

      await build(request).request('Acme CEO');

      expect(request).toHaveBeenCalledWith(
        expect.stringContaining('Acme+CEO'),
        expect.objectContaining({
          timeoutMs: 1234,
          signal: expect.any(AbortSignal),
        }),
      );
    });

    it('should not start a second attempt for an error a retry cannot fix', async () => {
      const request = jest
        .fn()
        .mockRejectedValue(
          new Error('Bright Data SERP failed: HTTP 401 Unauthorized'),
        );

      await expect(build(request).request('Acme CEO')).rejects.toThrow('401');
      expect(request).toHaveBeenCalledTimes(1);
    });

    it('should stop when the caller aborts', async () => {
      const request = jest
        .fn()
        .mockImplementation(
          async (_url: string, options: { signal: AbortSignal }) =>
            hangsUntilAborted(options.signal),
        );
      const controller = new AbortController();
      const pending = build(request).request('Acme CEO', {
        signal: controller.signal,
      });

      controller.abort();

      await expect(pending).rejects.toThrow('aborted');
    });

    it('should read a company with the queries that answered once the deadline passes', async () => {
      process.env.FIND_ROLE_COMPANY_DEADLINE_MS = '60';

      const request = jest
        .fn()
        .mockImplementation(
          async (url: string, options: { signal: AbortSignal }) => {
            // Only the plain "<company> CEO" query answers; the LinkedIn ones hang
            return decodeURIComponent(url).includes('site:linkedin.com')
              ? hangsUntilAborted(options.signal)
              : {
                  organic: [{ title: 'About', link: 'https://acme.com/about' }],
                };
          },
        );

      const result = await build(request).searchCompany({
        variants: ['Acme'],
        titles: ['ceo'],
        roles: ['CEO'],
      });

      expect(result.results.map((item) => item.url)).toEqual([
        'https://acme.com/about',
      ]);
      // The roles-as-typed LinkedIn query is skipped: "ceo" is already in the
      // title list, so it would ask Google the same question twice
      expect(result.errors).toEqual([
        '1 of 2 Google queries had not answered when the deadline passed',
      ]);
    });
  });

  it('should run the designation-first AI Overview pass through its own zone', async () => {
    process.env.FIND_ROLE_AI_OVERVIEW = 'true';

    const baseRequest = jest.fn().mockResolvedValue({
      organic: [{ title: 'About', link: 'https://acme.com/about' }],
    });
    const overviewRequest = jest.fn().mockResolvedValue({
      organic: [
        {
          title: 'Veeramani M P - Head of Procurement at Acme | LinkedIn',
          link: 'https://in.linkedin.com/in/veeramani',
        },
      ],
      ai_overview: {
        texts: [
          { snippet: 'Veeramani M P is Head of Procurement at Acme' },
          {
            type: 'list',
            list: [{ snippet: 'Suresh N is Purchase Lead at Acme' }],
          },
        ],
      },
    });

    const result = await build(baseRequest, overviewRequest).searchCompany({
      variants: ['Acme'],
      titles: ['procurement head'],
      roles: ['Procurement Head', 'Purchase Head'],
      location: 'India',
    });

    // The overview's own organic result is merged with the base results
    expect(result.results.map((item) => item.url)).toEqual([
      'https://acme.com/about',
      'https://in.linkedin.com/in/veeramani',
    ]);
    expect(result.aiOverviewTexts).toEqual([
      'Veeramani M P is Head of Procurement at Acme\nSuresh N is Purchase Lead at Acme',
    ]);

    // The base search never asks for the overview; it stays on the normal zone
    const baseUrls = baseRequest.mock.calls.map(([url]) => new URL(url).search);
    expect(baseUrls.every((url) => !url.includes('brd_ai_overview'))).toBe(
      true,
    );

    const zoneCalls = overviewRequest.mock.calls.map(([url, zone]) => ({
      query: new URL(url).searchParams.get('q'),
      search: new URL(url).search,
      zone,
    }));

    expect(zoneCalls.map((call) => call.query)).toEqual([
      "Who is Acme's Head of Procurement",
      "Who is Acme's Purchase Head",
    ]);
    expect(zoneCalls.every((call) => call.zone === 'serp_ai_overview')).toBe(
      true,
    );
    expect(
      zoneCalls.every(
        (call) =>
          call.search.includes('brd_ai_overview=2') &&
          call.search.includes('brd_json=1') &&
          call.search.includes('gl=in'),
      ),
    ).toBe(true);
  });

  it('should retry a missed AI Overview after the zone cooldown', async () => {
    process.env.FIND_ROLE_AI_OVERVIEW = 'true';
    // The real cooldown is Bright Data's 15s; the wait itself is what is tested
    process.env.FIND_ROLE_AI_OVERVIEW_RETRY_MS = '5';

    const baseRequest = jest.fn().mockResolvedValue({
      organic: [{ title: 'About', link: 'https://acme.com/about' }],
    });
    // An empty page first, the overview on the third try
    const overviewRequest = jest
      .fn()
      .mockRejectedValueOnce(new Error('empty page'))
      .mockRejectedValueOnce(new Error('empty page'))
      .mockResolvedValue({
        organic: [],
        ai_overview: { texts: [{ snippet: 'Kuldeep Sharma is at Acme' }] },
      });

    const result = await build(baseRequest, overviewRequest).searchCompany({
      variants: ['Acme'],
      titles: ['procurement head'],
      roles: ['Procurement Head'],
    });

    expect(result.aiOverviewTexts).toEqual(['Kuldeep Sharma is at Acme']);
    // More calls than queries: the pass retried after the cooldown instead of
    // writing the query off on the first empty page
    expect(overviewRequest.mock.calls.length).toBeGreaterThan(2);
  });
});

describe('resolveSerpCountry', () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
  });

  it('should search Google India when the request names no place', () => {
    delete process.env.FIND_ROLE_SERP_COUNTRY;
    delete process.env.FIND_ROLE_SERP_DEFAULT_COUNTRY;

    expect(resolveSerpCountry()).toBe('in');
  });

  it('should read the country out of a city and country', () => {
    delete process.env.FIND_ROLE_SERP_COUNTRY;

    expect(resolveSerpCountry('Dubai, UAE')).toBe('ae');
  });

  it('should leave the market open when the default is none', () => {
    delete process.env.FIND_ROLE_SERP_COUNTRY;
    process.env.FIND_ROLE_SERP_DEFAULT_COUNTRY = 'none';

    expect(resolveSerpCountry()).toBeUndefined();
  });
});
