import { LinkedinProfileResolverService } from 'src/engine/core-modules/tool/tools/find-people-by-company-tool/linkedin-profile-resolver.service';

const brightDataDocument = (data: Record<string, unknown>) => ({
  brightId: `bright-${String(data.name)}`,
  data,
});

type Search = jest.Mock<
  Promise<{
    documents: ReturnType<typeof brightDataDocument>[];
    matched: number;
  }>,
  [{ query: unknown }]
>;

// The resolver sends structured ludicrous queries; the tests key their answers
// by the human-readable form of the same filter. One search can name several
// companies (an or of company filters), so a query has one key per company.
const queryKeys = (query: unknown): string[] => {
  if (typeof query === 'string') {
    return [query];
  }

  const and = (query as { and?: Array<Record<string, unknown>> })?.and ?? [];
  const name =
    (and[0] as { text?: { name?: { value?: string } } })?.text?.name?.value ??
    (query as { text?: { name?: { value?: string } } })?.text?.name?.value ??
    '';
  const companyPart = and[1] as
    | {
        text?: Record<string, unknown>;
        or?: Array<{ text?: Record<string, unknown> }>;
      }
    | undefined;
  const companyFilters =
    companyPart?.or?.map((filter) => filter.text) ??
    (companyPart?.text !== undefined ? [companyPart.text] : []);

  const valueOf = (filter: unknown): string | undefined => {
    if (typeof filter === 'string') {
      return filter;
    }

    if (filter !== null && typeof filter === 'object') {
      return (filter as { value?: string }).value;
    }

    return undefined;
  };

  if (companyFilters.length === 0) {
    return [name];
  }

  return companyFilters.map((filter) => {
    const current = valueOf(filter?.current_company_name);
    const past = valueOf(filter?.past_company_names);

    if (current !== undefined) {
      return `${name} ${current}`;
    }

    return `${name} ${past} past`;
  });
};

const build = ({
  byQuery = {},
  organic = [],
  googleFails = false,
}: {
  // Bright Data answers by exact query; any other query returns nothing
  byQuery?: Record<string, ReturnType<typeof brightDataDocument>[]>;
  organic?: Array<{ title: string; link: string; description?: string }>;
  googleFails?: boolean;
}) => {
  const search: Search = jest.fn(async ({ query }) => {
    const documents = queryKeys(query).flatMap((key) => byQuery[key] ?? []);

    return { documents, matched: documents.length };
  });
  const request = googleFails
    ? jest.fn().mockRejectedValue(new Error('HTTP 502'))
    : jest.fn().mockResolvedValue({ organic });
  const resolver = new LinkedinProfileResolverService(
    { search } as never,
    { request } as never,
  );

  return { resolver, search, request };
};

describe('LinkedinProfileResolverService', () => {
  it('should find a profile by name and the company on its own results', async () => {
    const { resolver, search } = build({
      byQuery: {
        'Vikesh Shah 99 Pancakes': [
          brightDataDocument({
            name: 'Vikesh Shah',
            current_company_name: '99 Pancakes',
            url: 'https://www.linkedin.com/in/vikesh-shah-253a67204/',
          }),
        ],
      },
    });

    const { profiles, spentUsd } = await resolver.resolve({
      name: 'Vikesh Shah',
      companyNames: ['99 Pancakes'],
    });

    expect(search).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: 'people',
        mode: 'ludicrous',
        query: expect.objectContaining({ and: expect.any(Array) }),
      }),
    );
    expect(profiles[0]).toEqual(
      expect.objectContaining({
        linkedinUrl: 'https://www.linkedin.com/in/vikesh-shah-253a67204/',
        via: 'bright_data',
        sameNameProfileCount: null,
        companyRelation: 'current',
      }),
    );
    expect(spentUsd).toBeCloseTo(0.002);
  });

  it('should try every company name the person goes by in one search', async () => {
    const { resolver, search } = build({});

    await resolver.resolve({
      name: 'Smita Jatia',
      companyNames: ['Westlife Foodworld', 'Hardcastle Restaurants Pvt. Ltd.'],
      currentCompanyOnly: true,
    });

    expect(search).toHaveBeenCalledTimes(1);
    expect(queryKeys(search.mock.calls[0][0].query)).toEqual([
      'Smita Jatia Westlife Foodworld',
      'Smita Jatia Hardcastle Restaurants Pvt. Ltd.',
    ]);
  });

  it('should search one spelling of a company once', async () => {
    const { resolver, search } = build({});

    await resolver.resolve({
      name: 'Aseem Gupta',
      companyNames: ['Jubilant FoodWorks Ltd.', 'Jubilant Foodworks'],
      currentCompanyOnly: true,
    });

    expect(queryKeys(search.mock.calls[0][0].query)).toEqual([
      'Aseem Gupta Jubilant FoodWorks Ltd.',
    ]);
  });

  it('should stop the Google name lookup at the first query that finds the person', async () => {
    const { resolver, request } = build({
      organic: [
        {
          title:
            'Aseem Gupta - Head of Procurement - Jubilant FoodWorks | LinkedIn',
          link: 'https://in.linkedin.com/in/aseem-gupta',
        },
      ],
    });

    const { profiles } = await resolver.resolve({
      name: 'Aseem Gupta',
      companyNames: ['Jubilant FoodWorks'],
      title: 'Head of Procurement',
      currentCompanyOnly: true,
      googleOnlyWhenBrightDataMisses: true,
    });

    expect(request).toHaveBeenCalledTimes(1);
    expect(profiles[0]?.linkedinUrl).toContain('aseem-gupta');
  });

  it('should fall back to the name alone when no name-and-company query finds anyone', async () => {
    // Bright Data matches every word, and the profile has no company filled in
    const { resolver, search } = build({
      byQuery: {
        'Smita Jatia': [
          brightDataDocument({
            name: 'Smita Jatia',
            url: 'https://linkedin.com/in/smita-jatia',
          }),
        ],
      },
    });

    const { profiles } = await resolver.resolve({
      name: 'Smita Jatia',
      companyNames: ['Westlife Foodworld'],
    });

    expect(
      search.mock.calls.map(([{ query }]) => queryKeys(query as never)).flat(),
    ).toContain('Smita Jatia');
    expect(profiles).toEqual([
      expect.objectContaining({
        linkedinUrl: 'https://linkedin.com/in/smita-jatia',
        companyName: '',
        // One profile with that name, so a namesake is unlikely
        sameNameProfileCount: 1,
        companyRelation: 'unknown',
      }),
    ]);
  });

  it('should not run the name-only query when a company query already found someone', async () => {
    const { resolver, search } = build({
      byQuery: {
        'Karan Tanna Ghost Kitchens India': [
          brightDataDocument({
            name: 'Karan Tanna',
            current_company_name: 'Ghost Kitchens India',
            url: 'https://in.linkedin.com/in/karan-tanna',
          }),
        ],
      },
    });

    await resolver.resolve({
      name: 'Karan Tanna',
      companyNames: ['Ghost Kitchens India'],
    });

    expect(
      search.mock.calls.map(([{ query }]) => queryKeys(query as never)).flat(),
    ).not.toContain('Karan Tanna');
  });

  it('should report how many profiles share the name, so a namesake can be told apart', async () => {
    const { resolver } = build({
      byQuery: {
        'Binita Shah': [
          brightDataDocument({
            name: 'Binita Shah',
            current_company_name: 'BNP Paribas CIB',
            url: 'https://in.linkedin.com/in/binita-shah-8b9150164',
          }),
        ],
      },
    });

    const { profiles } = await resolver.resolve({
      name: 'Binita Shah',
      companyNames: ['99 Pancakes'],
    });

    // The company is not used to refuse it: the caller judges the namesake
    expect(profiles[0]).toEqual(
      expect.objectContaining({ companyName: 'BNP Paribas CIB' }),
    );
  });

  it('should label a past-company hit as past, not current', async () => {
    const { resolver } = build({
      byQuery: {
        'Veeramani M P Akshayakalpa Organic past': [
          brightDataDocument({
            name: 'Veeramani M P',
            current_company_name: 'Somewhere Else',
            url: 'https://www.linkedin.com/in/veeramani-m-p-54675467',
          }),
        ],
      },
    });

    const { profiles } = await resolver.resolve({
      name: 'Veeramani M P',
      companyNames: ['Akshayakalpa Organic'],
    });

    expect(profiles[0]).toEqual(
      expect.objectContaining({
        linkedinUrl: 'https://www.linkedin.com/in/veeramani-m-p-54675467',
        companyRelation: 'past',
      }),
    );
  });

  it('should use the title as a third Google query when one is given', async () => {
    const { resolver, request } = build({});

    await resolver.resolve({
      name: 'Suresh N',
      companyNames: ['Akshayakalpa'],
      title: 'Purchase Lead',
    });

    expect(request.mock.calls.map(([query]) => query)).toEqual([
      'Suresh N Akshayakalpa',
      'Suresh N Akshayakalpa linkedin',
      'Suresh N Akshayakalpa Purchase Lead',
    ]);
  });

  it('should ask Google with the shortest name of the company, plain first', async () => {
    const { resolver, request } = build({});

    await resolver.resolve({
      name: 'Amit Jatia',
      companyNames: ['Hardcastle Restaurants Pvt. Ltd.', 'Hardcastle'],
    });

    expect(request.mock.calls.map(([query]) => query)).toEqual([
      'Amit Jatia Hardcastle',
      'Amit Jatia Hardcastle linkedin',
    ]);
    expect(request).toHaveBeenCalledWith(
      'Amit Jatia Hardcastle',
      expect.objectContaining({ retries: 4 }),
    );
  });

  it('should take a profile Google shows whatever company it names', async () => {
    const { resolver } = build({
      organic: [
        {
          title:
            'Amit Jatia - Chairperson at Westlife Foodworld Limited | LinkedIn',
          link: 'https://in.linkedin.com/in/amit-jatia-7933848',
          description: "Experience: McDonald's India",
        },
      ],
    });

    const { profiles } = await resolver.resolve({
      name: 'Amit Jatia',
      companyNames: ['Hardcastle'],
    });

    expect(profiles).toEqual([
      expect.objectContaining({
        linkedinUrl: 'https://in.linkedin.com/in/amit-jatia-7933848',
        via: 'google',
        companyName: 'Westlife Foodworld Limited',
        evidence: expect.stringContaining("McDonald's India"),
      }),
    ]);
  });

  it('should recover a profile from a post by the person, and flag it', async () => {
    const { resolver } = build({
      organic: [
        {
          title: 'Smita Jatia - ai #technology #socialmedia #mcdonalds',
          link: 'https://www.linkedin.com/posts/smita-jatia_ai-technology-socialmedia-ugcPost-123-g-KM',
        },
      ],
    });

    const { profiles } = await resolver.resolve({
      name: 'Smita Jatia',
      companyNames: ['Hardcastle'],
    });

    expect(profiles[0]).toEqual(
      expect.objectContaining({
        linkedinUrl: 'https://www.linkedin.com/in/smita-jatia',
        derivedFromPost: true,
      }),
    );
  });

  it('should not take the profile of someone who only wrote a post about them', async () => {
    const { resolver } = build({
      organic: [
        {
          title: 'More power to you Smita Jatia | Shraddha Yawalkar',
          link: 'https://www.linkedin.com/posts/shraddha-yawalkar-12ab_more-power-to-you-smita-jatia-123',
        },
      ],
    });

    const { profiles } = await resolver.resolve({
      name: 'Smita Jatia',
      companyNames: ['Hardcastle'],
    });

    expect(profiles).toEqual([]);
  });

  it('should list the same person once and keep what Bright Data knows', async () => {
    const { resolver } = build({
      byQuery: {
        'Smita Jatia': [
          brightDataDocument({
            name: 'Smita Jatia',
            url: 'https://linkedin.com/in/smita-jatia',
          }),
        ],
      },
      organic: [
        {
          title: 'Smita Jatia - ai #technology',
          link: 'https://www.linkedin.com/posts/smita-jatia_ai-123',
        },
      ],
    });

    const { profiles } = await resolver.resolve({
      name: 'Smita Jatia',
      companyNames: ['Hardcastle'],
    });

    expect(profiles).toHaveLength(1);
    expect(profiles[0].sameNameProfileCount).toBe(1);
  });

  it('should report why nothing was found when the lookups themselves failed', async () => {
    const { resolver, search } = build({ googleFails: true });

    search.mockRejectedValue(new Error('instant down'));

    const result = await resolver.resolve({
      name: 'Karan Tanna',
      companyNames: ['Ghost Kitchens India'],
    });

    expect(result.profiles).toEqual([]);
    expect(result.errors).toEqual([
      'Karan Tanna: bright_data instant down',
      'Karan Tanna: google HTTP 502',
    ]);
  });

  it('should not report an error when a profile was found despite a failed query', async () => {
    const { resolver } = build({
      byQuery: {
        'Karan Tanna Ghost Kitchens India': [
          brightDataDocument({
            name: 'Karan Tanna',
            url: 'https://in.linkedin.com/in/karan-tanna',
          }),
        ],
      },
      googleFails: true,
    });

    const result = await resolver.resolve({
      name: 'Karan Tanna',
      companyNames: ['Ghost Kitchens India'],
    });

    expect(result.profiles).toHaveLength(1);
    expect(result.errors).toEqual([]);
  });
});
