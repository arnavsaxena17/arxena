import { FindRoleGoogleSearchService } from 'src/engine/core-modules/tool/tools/find-role-at-companies-tool/find-role-google-search.service';

// the request-rate limiter would stall tests that run on fake timers
process.env.FIND_ROLE_SERP_REQUESTS_PER_MINUTE = '0';

const build = (requestSerpGoogleJson: jest.Mock) =>
  new FindRoleGoogleSearchService({
    isConfigured: () => true,
    requestSerpGoogleJson,
  } as never);

describe('FindRoleGoogleSearchService', () => {
  beforeEach(() => {
    jest.useRealTimers();
  });

  afterEach(() => {
    jest.useFakeTimers();
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
      delete process.env.FIND_ROLE_SERP_HEDGE_DELAY_MS;
      delete process.env.FIND_ROLE_SERP_ATTEMPT_TIMEOUT_MS;
      delete process.env.FIND_ROLE_COMPANY_DEADLINE_MS;
    });

    const hangsUntilAborted = (signal: AbortSignal) =>
      new Promise((_, reject) =>
        signal.addEventListener('abort', () => reject(new Error('aborted'))),
      );

    it('should start a backup beside a slow attempt and take the first answer', async () => {
      process.env.FIND_ROLE_SERP_HEDGE_DELAY_MS = '20';

      const signals: AbortSignal[] = [];
      const request = jest
        .fn()
        .mockImplementation(
          async (_url: string, options: { signal: AbortSignal }) => {
            signals.push(options.signal);

            if (signals.length === 1) {
              return hangsUntilAborted(options.signal);
            }

            return { organic: [{ title: 'Backup', link: 'https://a.com' }] };
          },
        );
      const serp = await build(request).request('Acme CEO');

      expect(serp.organic?.[0].title).toBe('Backup');
      expect(request).toHaveBeenCalledTimes(2);
      // The slow one is cut off once the other has answered
      expect(signals[0].aborted).toBe(true);
    });

    it('should replace a failed attempt at once, not after the backup delay', async () => {
      process.env.FIND_ROLE_SERP_HEDGE_DELAY_MS = '60000';

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
      process.env.FIND_ROLE_SERP_HEDGE_DELAY_MS = '5';

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

    it('should not start a backup for an error a second try cannot fix', async () => {
      process.env.FIND_ROLE_SERP_HEDGE_DELAY_MS = '5';

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
      process.env.FIND_ROLE_SERP_HEDGE_DELAY_MS = '0';

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
      expect(result.errors).toEqual([
        '2 of 3 Google queries had not answered when the deadline passed',
      ]);
    });
  });
});
