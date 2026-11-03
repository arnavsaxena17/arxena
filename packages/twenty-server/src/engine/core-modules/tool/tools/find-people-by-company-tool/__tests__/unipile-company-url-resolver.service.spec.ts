import { UnipileLinkedinAccountUnusableError } from 'src/engine/core-modules/arx-chat/errors/unipile-linkedin-account-unusable.error';

import { UnipileCompanyUrlResolverService } from '../unipile-company-url-resolver.service';

type CacheLike = {
  getOrFetch: jest.Mock;
};

const buildResolver = ({
  accountIds = ['acct-1'],
  search = jest.fn(),
  cache,
}: {
  accountIds?: string[];
  search?: jest.Mock;
  cache?: CacheLike;
}) => {
  let pickIndex = 0;
  const accountResolver = {
    isUnipileConfigured: () => true,
    resolve: jest.fn(async () => {
      const accountId = accountIds[Math.min(pickIndex, accountIds.length - 1)];

      pickIndex += 1;

      return { accountId, product: 'sales_navigator', via: 'pool' };
    }),
  };

  const linkedInSearchService = { getCompanyParameters: search };

  const resolver = new UnipileCompanyUrlResolverService(
    linkedInSearchService as never,
    accountResolver as never,
    cache as never,
  );

  return { resolver, accountResolver, search };
};

const listOf = (items: Array<{ id: string; title: string }>) =>
  Promise.resolve({ items });

describe('UnipileCompanyUrlResolverService', () => {
  it('should build the company URL from the first strictly matching hit', async () => {
    const search = jest.fn(async () =>
      listOf([
        { id: '1035', title: 'Tata Group' },
        { id: '20967', title: 'Tata Steel' },
      ]),
    );
    const { resolver } = buildResolver({ search });

    await expect(
      resolver.resolveCompanyLinkedinUrl(['Tata Steel']),
    ).resolves.toEqual({
      linkedinUrl: 'https://www.linkedin.com/company/20967/',
      matchedName: 'Tata Steel',
      accountId: 'acct-1',
    });
  });

  // A parent or namesake that merely shares a word would resolve to a different
  // population, which is the failure this matcher exists to prevent
  it('should skip a namesake that does not open the wanted name', async () => {
    const search = jest.fn(async () =>
      listOf([
        { id: '1', title: 'Tata Motors' },
        { id: '2', title: 'Raymond James' },
      ]),
    );
    const { resolver } = buildResolver({ search });

    await expect(
      resolver.resolveCompanyLinkedinUrl(['Tata Steel']),
    ).resolves.toBeNull();
  });

  it('should try the next spelling when the first one has no hit', async () => {
    const search = jest.fn(async (_accountId: string, name: string) =>
      name === 'Monginis'
        ? listOf([{ id: '555', title: 'Monginis' }])
        : listOf([]),
    );
    const { resolver } = buildResolver({ search });

    const resolved = await resolver.resolveCompanyLinkedinUrl([
      'Monginis Foods Pvt. Ltd.',
      'Monginis',
    ]);

    expect(resolved?.linkedinUrl).toBe('https://www.linkedin.com/company/555/');
    expect(search).toHaveBeenCalledTimes(2);
  });

  it('should rotate onto another pooled account when the first is unusable', async () => {
    const search = jest.fn(async (accountId: string) => {
      if (accountId === 'acct-1') {
        throw new UnipileLinkedinAccountUnusableError('disconnected', {
          accountId,
        });
      }

      return listOf([{ id: '777', title: 'Jubilant FoodWorks' }]);
    });
    const { resolver } = buildResolver({
      accountIds: ['acct-1', 'acct-2'],
      search,
    });

    const resolved = await resolver.resolveCompanyLinkedinUrl([
      'Jubilant FoodWorks',
    ]);

    expect(resolved?.accountId).toBe('acct-2');
    expect(resolved?.linkedinUrl).toBe('https://www.linkedin.com/company/777/');
  });

  // LinkedIn's data does not differ between accounts, so a usable account that
  // found nothing is an answer, not a reason to spend another lookup
  it('should not rotate when a usable account simply has no match', async () => {
    const search = jest.fn(async () => listOf([]));
    const { resolver, accountResolver } = buildResolver({
      accountIds: ['acct-1', 'acct-2'],
      search,
    });

    await expect(
      resolver.resolveCompanyLinkedinUrl(['Nobody Ltd']),
    ).resolves.toBeNull();
    expect(accountResolver.resolve).toHaveBeenCalledTimes(1);
  });

  it('should stop when the pool keeps returning the account that failed', async () => {
    const search = jest.fn(async () => {
      throw new UnipileLinkedinAccountUnusableError('disconnected');
    });
    const { resolver, accountResolver } = buildResolver({ search });

    await expect(
      resolver.resolveCompanyLinkedinUrl(['Tata Steel']),
    ).resolves.toBeNull();
    // one attempt that failed, one that found the pool had nothing else to give
    expect(accountResolver.resolve).toHaveBeenCalledTimes(2);
  });

  it('should extract the numeric id from a URN', async () => {
    const search = jest.fn(async () =>
      listOf([{ id: 'urn:li:fsd_company:1035', title: 'Tata Steel' }]),
    );
    const { resolver } = buildResolver({ search });

    const resolved = await resolver.resolveCompanyLinkedinUrl(['Tata Steel']);

    expect(resolved?.linkedinUrl).toBe(
      'https://www.linkedin.com/company/1035/',
    );
  });

  it('should refuse an id that would build a URL pointing somewhere unintended', async () => {
    const search = jest.fn(async () =>
      listOf([{ id: 'https://evil.example/x', title: 'Tata Steel' }]),
    );
    const { resolver } = buildResolver({ search });

    await expect(
      resolver.resolveCompanyLinkedinUrl(['Tata Steel']),
    ).resolves.toBeNull();
  });

  it('should dedupe spellings and ignore blanks', async () => {
    const search = jest.fn(async () => listOf([]));
    const { resolver } = buildResolver({ search });

    await resolver.resolveCompanyLinkedinUrl([
      'Tata Steel',
      ' tata steel ',
      '',
      '   ',
    ]);

    expect(search).toHaveBeenCalledTimes(1);
  });

  it('should ask for nothing when Unipile is not wired', async () => {
    const resolver = new UnipileCompanyUrlResolverService(
      undefined,
      undefined,
      undefined,
    );

    expect(resolver.isAvailable()).toBe(false);
    await expect(
      resolver.resolveCompanyLinkedinUrl(['Tata Steel']),
    ).resolves.toBeNull();
  });

  it('should do nothing when the account resolver is not configured', async () => {
    const search = jest.fn();
    const resolver = new UnipileCompanyUrlResolverService(
      { getCompanyParameters: search } as never,
      {
        isUnipileConfigured: () => false,
        resolve: jest.fn(),
      } as never,
      undefined,
    );

    await expect(
      resolver.resolveCompanyLinkedinUrl(['Tata Steel']),
    ).resolves.toBeNull();
    expect(search).not.toHaveBeenCalled();
  });

  it('should sit behind the provider cache so a repeated name is not re-asked', async () => {
    const search = jest.fn(async () =>
      listOf([{ id: '1035', title: 'Tata Steel' }]),
    );
    const store = new Map<string, unknown>();
    const cache: CacheLike = {
      getOrFetch: jest.fn(
        async (
          prefix: string,
          parts: Record<string, string>,
          run: () => Promise<unknown>,
        ) => {
          const key = `${prefix}:${JSON.stringify(parts)}`;

          if (store.has(key)) {
            return store.get(key);
          }

          const value = await run();

          store.set(key, value);

          return value;
        },
      ),
    };
    const { resolver } = buildResolver({ search, cache });

    await resolver.resolveCompanyLinkedinUrl(['Tata Steel']);
    await resolver.resolveCompanyLinkedinUrl(['tata steel']);

    expect(search).toHaveBeenCalledTimes(1);
    expect(cache.getOrFetch).toHaveBeenCalledTimes(2);
  });
});
