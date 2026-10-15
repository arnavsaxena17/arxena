import { isDefined } from 'twenty-shared/utils';

import { FindRoleAtCompaniesTool } from 'src/engine/core-modules/tool/tools/find-role-at-companies-tool/find-role-at-companies-tool';
import { parseLinkedinSerpResult } from 'src/engine/core-modules/tool/tools/find-role-at-companies-tool/parse-linkedin-serp-result.util';
import { FindRoleGoogleSearchService } from 'src/engine/core-modules/tool/tools/find-role-at-companies-tool/find-role-google-search.service';

// the request-rate limiter would stall tests that run on fake timers
process.env.FIND_ROLE_SERP_REQUESTS_PER_MINUTE = '0';

type ExtractedPersonFixture = Partial<{
  name: string;
  jobTitle: string;
  companyName: string;
  location: string;
  isCurrentRole: boolean;
  evidence: string;
  linkedinUrl: string;
  linkedinUrlDerivedFromPost: boolean;
  sourceUrl: string;
}> & { name: string };

const person = (fixture: ExtractedPersonFixture) => ({
  jobTitle: '',
  companyName: '',
  location: '',
  isCurrentRole: true,
  evidence: '',
  linkedinUrl: '',
  linkedinUrlDerivedFromPost: false,
  sourceUrl: '',
  ...fixture,
});

const buildBrightDataDocument = (data: Record<string, unknown>) => ({
  brightId: `bright-${String(data.name)}`,
  data,
});

const buildTool = ({
  brightDataDocuments,
  organic,
  upsertSucceeds = true,
  enrichedDocuments = [],
  extractedPeople,
  resolution = null,
  resolutionErrors = [],
  judge,
  projectRows = [],
  tableView = null,
}: {
  // Rows the project's Companies tab holds, for fromProject
  projectRows?: Array<{
    id: string;
    name: string;
    otherFields?: Record<string, unknown>;
  }>;
  tableView?: { filters: unknown[] } | null;
  resolutionErrors?: string[];
  // Rules on candidates by name; left out, the judge gives no verdicts and the
  // tool falls back to matching names as text. 'unavailable' makes it fail.
  judge?:
    | 'unavailable'
    | ((candidate: { name: string }) => {
        company: 'same' | 'related' | 'different' | 'unknown';
        companyNote?: string;
        role: 'exact' | 'related' | 'none';
        roleNote?: string;
      });
  // Left out, the fake model reads each LinkedIn result's title; 'unavailable'
  // makes the model fail so the tool falls back to reading titles by pattern
  extractedPeople?: ExtractedPersonFixture[] | 'unavailable';
  resolution?: {
    linkedinUrl: string;
    title: string;
    companyName: string;
    via: 'bright_data' | 'google';
  } | null;
  enrichedDocuments?: ReturnType<typeof buildBrightDataDocument>[];
  brightDataDocuments: ReturnType<typeof buildBrightDataDocument>[];
  organic: Array<{ title: string; link: string; description?: string }>;
  upsertSucceeds?: boolean;
}) => {
  const searchNaturalLanguage = jest.fn().mockResolvedValue({
    result: { documents: brightDataDocuments, spentUsd: 0.004 },
  });
  const requestSerpGoogleJson = jest.fn().mockResolvedValue({ organic });
  const search = jest.fn().mockResolvedValue({ documents: enrichedDocuments });
  const upsert = jest.fn().mockResolvedValue({
    success: upsertSucceeds,
    message: '',
    error: upsertSucceeds ? undefined : 'write failed',
  });
  // Stands in for the Python job-title taxonomy: CEO, MD and founder titles
  // share one function and grade, everything else is its own function
  const titleClass = (title: string) => {
    const lowered = title.toLowerCase();

    if (/ceo|chief executive|managing director|\bmd\b|founder/.test(lowered)) {
      return { functionId: 'ceo', functionRoot: 'ceo', grade: 'leadership' };
    }

    return lowered.trim() === ''
      ? null
      : { functionId: 'other', functionRoot: 'other', grade: 'leadership' };
  };
  const taxonomy = {
    resolveRoles: jest.fn(async (roles: string[]) => ({
      searchTitles: [
        ...roles.map((role) => role.toLowerCase()),
        'chief executive',
      ],
      requestedClasses: roles
        .map((role) => titleClass(role))
        .filter((value) => value !== null),
      taxonomyAvailable: true,
    })),
    classifyTitles: jest.fn(async (titles: string[]) => {
      return new Map(
        titles.map((title) => [title.trim().toLowerCase(), titleClass(title)]),
      );
    }),
  };
  const extract =
    extractedPeople === 'unavailable'
      ? jest.fn().mockRejectedValue(new Error('model unavailable'))
      : isDefined(extractedPeople)
        ? jest.fn().mockResolvedValue(extractedPeople.map(person))
        : jest.fn().mockImplementation(
            async ({
              results,
            }: {
              results: Array<{
                title: string;
                url: string;
                snippet?: string;
              }>;
            }) =>
              results.flatMap((result) => {
                const parsed = parseLinkedinSerpResult(result);

                return parsed === null
                  ? []
                  : [
                      person({
                        name: parsed.name,
                        jobTitle: parsed.title,
                        companyName: parsed.companyName,
                        evidence: `${result.title} ${parsed.snippet}`,
                        linkedinUrl: parsed.linkedinUrl,
                        sourceUrl: result.url,
                      }),
                    ];
              }),
          );
  const resolve = jest.fn().mockResolvedValue({
    profiles: isDefined(resolution)
      ? [
          {
            evidence: '',
            sameNameProfileCount: null,
            derivedFromPost: false,
            ...resolution,
          },
        ]
      : [],
    spentUsd: 0.002,
    errors: resolutionErrors,
  });
  const findDuplicatesMock = jest
    .fn()
    .mockResolvedValue(new Map<string, string>());
  const judgeCandidates = jest
    .fn()
    .mockImplementation(
      async ({
        candidates,
      }: {
        candidates: Array<{ id: string; name: string }>;
      }) => {
        if (judge === 'unavailable') {
          throw new Error('judge unavailable');
        }

        return new Map(
          isDefined(judge)
            ? candidates.map((candidate) => [
                candidate.id,
                { companyNote: '', roleNote: '', ...judge(candidate) },
              ])
            : [],
        );
      },
    );
  const writeOtherFields = jest
    .fn()
    .mockResolvedValue({ ephemeralUpdated: 1, crmUpdated: 0 });
  const getAll = jest.fn().mockResolvedValue(
    projectRows.map((row) => ({ otherFields: {}, ...row })),
  );
  const getTableView = jest.fn().mockResolvedValue(tableView);
  const tool = new FindRoleAtCompaniesTool(
    { searchNaturalLanguage } as never,
    new FindRoleGoogleSearchService({
      isConfigured: () => true,
      requestSerpGoogleJson,
    } as never),
    { search } as never,
    { extract } as never,
    {
      judge: judgeCandidates,
      findDuplicates: findDuplicatesMock,
    } as never,
    { resolve } as never,
    { execute: upsert } as never,
    taxonomy as never,
    { writeOtherFields, getAll } as never,
    { get: getTableView } as never,
  );

  return {
    tool,
    searchNaturalLanguage,
    requestSerpGoogleJson,
    search,
    extract,
    resolve,
    judge: judgeCandidates,
    findDuplicates: findDuplicatesMock,
    upsert,
    taxonomy,
    writeOtherFields,
  };
};

const context = { workspaceId: 'workspace-id' };

describe('FindRoleAtCompaniesTool', () => {
  it('should merge a person found by both sources and write them once', async () => {
    const { tool, upsert } = buildTool({
      brightDataDocuments: [
        buildBrightDataDocument({
          name: 'Amruta Kawre',
          current_title: 'Managing Director',
          current_company_name: 'Monginis Foods Pvt. Ltd.',
          url: 'https://in.linkedin.com/in/amruta-kawre',
        }),
      ],
      organic: [
        {
          title: 'Amruta Kawre - Managing Director - Monginis | LinkedIn',
          link: 'https://www.linkedin.com/in/amruta-kawre/',
        },
      ],
    });

    const output = await tool.execute(
      {
        companies: [{ name: 'Monginis' }],
        roles: ['MD'],
        projectId: 'project-id',
      },
      context,
    );
    const company = (output.result as { companies: Array<Record<string, any>> })
      .companies[0];

    expect(company.status).toBe('matched');
    expect(company.people).toHaveLength(1);
    expect(company.people[0].sources).toEqual(['bright_data', 'google']);
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(upsert.mock.calls[0][0].people).toHaveLength(1);
  });

  it('should link found people to the company row and record Found on it', async () => {
    const { tool, upsert, writeOtherFields } = buildTool({
      brightDataDocuments: [
        buildBrightDataDocument({
          name: 'Amruta Kawre',
          current_title: 'Managing Director',
          current_company_name: 'Monginis Foods Pvt. Ltd.',
          url: 'https://in.linkedin.com/in/amruta-kawre',
        }),
      ],
      organic: [],
    });

    await tool.execute(
      {
        companies: [{ id: 'company-row-1', name: 'Monginis' }],
        roles: ['MD'],
        projectId: 'project-id',
      },
      context,
    );

    const writtenPerson = upsert.mock.calls[0][0].people[0];

    expect(writtenPerson.companyId).toBe('company-row-1');
    expect(writtenPerson.otherFields.sourceCompanyId).toBe('company-row-1');
    expect(writeOtherFields).toHaveBeenCalledTimes(1);
    expect(
      writeOtherFields.mock.calls[0][0].valuesByRowId.get('company-row-1')
        .peopleFound,
    ).toBe('Found');
  });

  it('should record Not found on the company row when nobody is found', async () => {
    const { tool, upsert, writeOtherFields } = buildTool({
      brightDataDocuments: [],
      organic: [],
    });

    await tool.execute(
      {
        companies: [{ id: 'company-row-2', name: 'Ghost Co' }],
        roles: ['MD'],
        projectId: 'project-id',
      },
      context,
    );

    expect(upsert).not.toHaveBeenCalled();
    expect(
      writeOtherFields.mock.calls[0][0].valuesByRowId.get('company-row-2')
        .peopleFound,
    ).toMatch(/Not found|Lookup failed/);
  });

  it('should reject a person from a different company and say why', async () => {
    const { tool } = buildTool({
      brightDataDocuments: [
        buildBrightDataDocument({
          name: 'Sachin Kesharwani',
          current_title: 'Co-Founder',
          current_company_name: 'HAPPY FACES',
          url: 'https://www.linkedin.com/in/sachin-kesharwani',
        }),
      ],
      organic: [],
    });

    const output = await tool.execute(
      { companies: [{ name: 'FACES CANADA' }], roles: ['founder'] },
      context,
    );
    const company = (output.result as { companies: Array<Record<string, any>> })
      .companies[0];

    expect(company.status).toBe('no_match');
    expect(company.rejected).toEqual([
      expect.objectContaining({
        name: 'Sachin Kesharwani',
        reason: 'company_mismatch',
      }),
    ]);
  });

  it('should report a deputy as a related role only', async () => {
    const { tool } = buildTool({
      brightDataDocuments: [
        buildBrightDataDocument({
          name: 'Keerthi D',
          current_title: 'Deputy CEO',
          current_company_name: 'Hatsun Agro Product Ltd',
          url: 'https://www.linkedin.com/in/keerthi-d-785b21186',
        }),
      ],
      organic: [],
    });

    const output = await tool.execute(
      {
        companies: [
          { name: 'Arun Ice Cream', alternateNames: ['Hatsun Agro Product'] },
        ],
        roles: ['CEO'],
      },
      context,
    );
    const company = (output.result as { companies: Array<Record<string, any>> })
      .companies[0];

    expect(company.status).toBe('related_role_only');
    expect(company.people[0].roleMatch).toBe('related');
  });

  it('should still answer from Google when Bright Data fails', async () => {
    const { tool, searchNaturalLanguage } = buildTool({
      brightDataDocuments: [],
      organic: [
        {
          title: 'Sanjay Goyal - CEO - Baskin Robbins India | LinkedIn',
          link: 'https://www.linkedin.com/in/sanjay-goyal-aaa675196',
        },
      ],
    });

    searchNaturalLanguage.mockRejectedValue(new Error('planner timed out'));

    const output = await tool.execute(
      { companies: [{ name: 'Baskin Robbins India' }], roles: ['CEO'] },
      context,
    );
    const company = (output.result as { companies: Array<Record<string, any>> })
      .companies[0];

    expect(company.status).toBe('matched');
    expect(company.sourceErrors).toEqual(['bright_data: planner timed out']);
  });

  it('should report a failed write without losing the results', async () => {
    const { tool } = buildTool({
      brightDataDocuments: [],
      organic: [
        {
          title: 'Sanjay Goyal - CEO - Baskin Robbins India | LinkedIn',
          link: 'https://www.linkedin.com/in/sanjay-goyal-aaa675196',
        },
      ],
      upsertSucceeds: false,
    });

    const output = await tool.execute(
      {
        companies: [{ name: 'Baskin Robbins India' }],
        roles: ['CEO'],
        projectId: 'project-id',
      },
      context,
    );

    expect(output.success).toBe(true);
    expect((output.result as { writeError?: string }).writeError).toBe(
      'write failed',
    );
  });
});

describe('FindRoleAtCompaniesTool taxonomy use', () => {
  it('should search with the titles the taxonomy supplies', async () => {
    const { tool, searchNaturalLanguage, requestSerpGoogleJson } = buildTool({
      brightDataDocuments: [],
      organic: [],
    });

    await tool.execute(
      { companies: [{ name: 'Acme' }], roles: ['MD'] },
      { workspaceId: 'workspace-id' },
    );

    expect(searchNaturalLanguage.mock.calls[0][0].rawQuery).toContain(
      'md, chief executive of Acme',
    );
    expect(
      requestSerpGoogleJson.mock.calls.some(([url]) =>
        decodeURIComponent(url.replace(/\+/g, ' ')).includes(
          '"chief executive"',
        ),
      ),
    ).toBe(true);
  });

  it('should accept a Managing Director when the taxonomy says it is the requested function', async () => {
    const { tool } = buildTool({
      brightDataDocuments: [
        buildBrightDataDocument({
          name: 'Sanjay Goyal',
          current_title: 'Managing Director',
          current_company_name:
            'Graviss Foods Pvt Ltd – Baskin Robbins – India',
          url: 'https://www.linkedin.com/in/sanjay-goyal-aaa675196',
        }),
      ],
      organic: [],
    });

    const output = await tool.execute(
      { companies: [{ name: 'Baskin Robbins India' }], roles: ['CEO'] },
      { workspaceId: 'workspace-id' },
    );
    const company = (output.result as { companies: Array<Record<string, any>> })
      .companies[0];

    expect(company.status).toBe('matched');
    expect(company.people[0].title).toBe('Managing Director');
  });
});

describe('FindRoleAtCompaniesTool Google enrichment', () => {
  const organic = [
    {
      title:
        'Sanjay Purohit - Group CEO, Sapphire Foods Partner ... | LinkedIn',
      link: 'https://in.linkedin.com/in/sanjaypurohit',
    },
  ];

  it('should look Google profiles up in Bright Data instant mode and verify on the real company', async () => {
    const { tool, search } = buildTool({
      brightDataDocuments: [],
      organic,
      enrichedDocuments: [
        buildBrightDataDocument({
          name: 'Sanjay Purohit',
          current_title: 'Group CEO',
          current_company_name: 'Sapphire Foods India Limited',
          url: 'https://linkedin.com/in/sanjaypurohit',
        }),
      ],
    });

    const output = await tool.execute(
      { companies: [{ name: 'Sapphire Foods India Limited' }], roles: ['CEO'] },
      context,
    );
    const company = (output.result as { companies: Array<Record<string, any>> })
      .companies[0];

    expect(search).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: 'people',
        mode: 'instant',
        query: 'linkedin.com/in/sanjaypurohit',
      }),
    );
    expect(company.status).toBe('matched');
    expect(company.people[0].title).toBe('Group CEO');
    expect(company.people[0].companyOnProfile).toBe(
      'Sapphire Foods India Limited',
    );
  });

  it('should reject a Google hit whose real profile shows another company', async () => {
    const { tool } = buildTool({
      brightDataDocuments: [],
      organic: [
        {
          title: 'Jane Roe - CEO - Acme | LinkedIn',
          link: 'https://www.linkedin.com/in/jane-roe',
        },
      ],
      enrichedDocuments: [
        buildBrightDataDocument({
          name: 'Jane Roe',
          current_title: 'CEO',
          current_company_name: 'Globex',
          url: 'https://linkedin.com/in/jane-roe',
        }),
      ],
    });

    const output = await tool.execute(
      { companies: [{ name: 'Acme' }], roles: ['CEO'] },
      context,
    );
    const company = (output.result as { companies: Array<Record<string, any>> })
      .companies[0];

    expect(company.status).toBe('no_match');
    expect(company.rejected[0]).toEqual(
      expect.objectContaining({ name: 'Jane Roe', reason: 'company_mismatch' }),
    );
  });

  it('should keep the Google result when Bright Data does not know the profile', async () => {
    const { tool } = buildTool({
      brightDataDocuments: [],
      organic: [
        {
          title: 'Sanjay Goyal - CEO - Baskin Robbins India | LinkedIn',
          link: 'https://www.linkedin.com/in/sanjay-goyal-aaa675196',
        },
      ],
      enrichedDocuments: [],
    });

    const output = await tool.execute(
      { companies: [{ name: 'Baskin Robbins India' }], roles: ['CEO'] },
      context,
    );
    const company = (output.result as { companies: Array<Record<string, any>> })
      .companies[0];

    expect(company.status).toBe('matched');
  });

  it('should not pay for a profile the people search already returned', async () => {
    const { tool, search } = buildTool({
      brightDataDocuments: [
        buildBrightDataDocument({
          name: 'Sanjay Purohit',
          current_title: 'Group CEO',
          current_company_name: 'Sapphire Foods India Limited',
          url: 'https://linkedin.com/in/sanjaypurohit',
        }),
      ],
      organic,
    });

    await tool.execute(
      { companies: [{ name: 'Sapphire Foods India Limited' }], roles: ['CEO'] },
      context,
    );

    expect(search).not.toHaveBeenCalled();
  });

  it('should report an enrichment failure and still answer from Google', async () => {
    const { tool, search } = buildTool({ brightDataDocuments: [], organic });

    search.mockRejectedValue(new Error('instant down'));

    const output = await tool.execute(
      { companies: [{ name: 'Sapphire Foods India Limited' }], roles: ['CEO'] },
      context,
    );
    const company = (output.result as { companies: Array<Record<string, any>> })
      .companies[0];

    // The failed lookup is swallowed per batch; the SERP text still verifies
    expect(company.status).toBe('matched');
  });

  it('should skip the lookup when Bright Data is not a requested source', async () => {
    const { tool, search } = buildTool({ brightDataDocuments: [], organic });

    await tool.execute(
      {
        companies: [{ name: 'Sapphire Foods India Limited' }],
        roles: ['CEO'],
        sources: ['google'],
      },
      context,
    );

    expect(search).not.toHaveBeenCalled();
  });
});

describe('FindRoleAtCompaniesTool concurrency and retries', () => {
  // The suite runs on fake timers; these tests wait on real delays
  const savedConcurrency = process.env.FIND_ROLE_COMPANY_CONCURRENCY;

  beforeEach(() => {
    jest.useRealTimers();
    // the developer's .env may set a lower limit than the default under test
    delete process.env.FIND_ROLE_COMPANY_CONCURRENCY;
  });

  afterEach(() => {
    if (savedConcurrency === undefined) {
      delete process.env.FIND_ROLE_COMPANY_CONCURRENCY;
    } else {
      process.env.FIND_ROLE_COMPANY_CONCURRENCY = savedConcurrency;
    }
    jest.useFakeTimers();
  });

  it('should start every company before the first one finishes by default', async () => {
    const { tool, searchNaturalLanguage } = buildTool({
      brightDataDocuments: [],
      organic: [],
    });
    let running = 0;
    let peak = 0;

    searchNaturalLanguage.mockImplementation(async () => {
      running += 1;
      peak = Math.max(peak, running);
      await new Promise((resolve) => setTimeout(resolve, 20));
      running -= 1;

      return { result: { documents: [], spentUsd: 0 } };
    });

    await tool.execute(
      {
        companies: Array.from({ length: 50 }, (_, index) => ({
          name: `Company ${index}`,
        })),
        roles: ['CEO'],
      },
      context,
    );

    expect(peak).toBe(50);
  });

  it('should honour FIND_ROLE_COMPANY_CONCURRENCY', async () => {
    process.env.FIND_ROLE_COMPANY_CONCURRENCY = '3';

    const { tool, searchNaturalLanguage } = buildTool({
      brightDataDocuments: [],
      organic: [],
    });
    let running = 0;
    let peak = 0;

    searchNaturalLanguage.mockImplementation(async () => {
      running += 1;
      peak = Math.max(peak, running);
      await new Promise((resolve) => setTimeout(resolve, 10));
      running -= 1;

      return { result: { documents: [], spentUsd: 0 } };
    });

    await tool.execute(
      {
        companies: Array.from({ length: 9 }, (_, index) => ({
          name: `Company ${index}`,
        })),
        roles: ['CEO'],
      },
      context,
    );

    expect(peak).toBe(3);
  });

  const baskinResult = {
    organic: [
      {
        title: 'Sanjay Goyal - CEO - Baskin Robbins India | LinkedIn',
        link: 'https://www.linkedin.com/in/sanjay-goyal-aaa675196',
      },
    ],
  };

  it('should retry a rate-limited SERP request instead of reporting no match', async () => {
    const { tool, requestSerpGoogleJson } = buildTool({
      brightDataDocuments: [],
      organic: [],
    });
    const failedOnce = new Set<string>();

    requestSerpGoogleJson.mockImplementation(async (url: string) => {
      if (!failedOnce.has(url)) {
        failedOnce.add(url);

        throw new Error('Bright Data SERP failed: HTTP 502 (upstream)');
      }

      return baskinResult;
    });

    const output = await tool.execute(
      { companies: [{ name: 'Baskin Robbins India' }], roles: ['CEO'] },
      context,
    );
    const company = (output.result as { companies: Array<Record<string, any>> })
      .companies[0];

    expect(company.status).toBe('matched');
    expect(company.sourceErrors).toEqual([]);
  });

  it('should not retry a SERP failure that is not transient', async () => {
    const { tool, requestSerpGoogleJson } = buildTool({
      brightDataDocuments: [],
      organic: [],
    });

    requestSerpGoogleJson.mockRejectedValue(
      new Error('Bright Data SERP failed: HTTP 401 Unauthorized'),
    );

    const output = await tool.execute(
      { companies: [{ name: 'Acme' }], roles: ['CEO'] },
      context,
    );
    const company = (output.result as { companies: Array<Record<string, any>> })
      .companies[0];
    const distinctQueries = new Set(
      requestSerpGoogleJson.mock.calls.map(([url]) => url),
    );

    // One attempt per query, no retries
    expect(requestSerpGoogleJson).toHaveBeenCalledTimes(distinctQueries.size);
    expect(company.sourceErrors).toEqual([
      'google: Bright Data SERP failed: HTTP 401 Unauthorized',
    ]);
  });
});

describe('FindRoleAtCompaniesTool Google queries', () => {
  const decodedQueries = (calls: Array<[string]>) =>
    calls.map(([url]) =>
      decodeURIComponent(new URL(url).searchParams.get('q') ?? ''),
    );

  it('should run the plain query a person would type plus two LinkedIn queries', async () => {
    const { tool, requestSerpGoogleJson } = buildTool({
      brightDataDocuments: [],
      organic: [],
    });

    await tool.execute(
      { companies: [{ name: 'Acme' }], roles: ['MD'], country: 'India' },
      context,
    );

    const queries = decodedQueries(requestSerpGoogleJson.mock.calls);

    expect(queries).toHaveLength(3);
    expect(queries).toContain('Acme managing director');
    expect(queries).toContain(
      'site:linkedin.com/in "Acme" ("md" OR "chief executive") India',
    );
    expect(queries).toContain('site:linkedin.com/in "Acme" ("MD")');
  });

  it('should run one plain query per requested role', async () => {
    const { tool, requestSerpGoogleJson } = buildTool({
      brightDataDocuments: [],
      organic: [],
    });

    await tool.execute(
      { companies: [{ name: '99 Pancakes' }], roles: ['founder', 'CEO'] },
      context,
    );

    const queries = decodedQueries(requestSerpGoogleJson.mock.calls);

    expect(queries).toContain('99 Pancakes founder');
    expect(queries).toContain('99 Pancakes CEO');
  });

  it('should add a LinkedIn query for the second company name', async () => {
    const { tool, requestSerpGoogleJson } = buildTool({
      brightDataDocuments: [],
      organic: [],
    });

    await tool.execute(
      {
        companies: [{ name: 'Acme', alternateNames: ['Globex'] }],
        roles: ['MD'],
      },
      context,
    );

    expect(decodedQueries(requestSerpGoogleJson.mock.calls)).toContain(
      'site:linkedin.com/in "Globex" ("md" OR "chief executive")',
    );
  });

  it('should merge one profile found by several queries into a single candidate', async () => {
    const { tool } = buildTool({
      brightDataDocuments: [],
      organic: [
        {
          title: 'Sanjay Goyal - CEO - Baskin Robbins India | LinkedIn',
          link: 'https://www.linkedin.com/in/sanjay-goyal-aaa675196',
        },
      ],
    });

    const output = await tool.execute(
      { companies: [{ name: 'Baskin Robbins India' }], roles: ['CEO'] },
      context,
    );
    const company = (output.result as { companies: Array<Record<string, any>> })
      .companies[0];

    expect(company.people).toHaveLength(1);
  });

  it('should still answer when one query fails and report the failure', async () => {
    const { tool, requestSerpGoogleJson } = buildTool({
      brightDataDocuments: [],
      organic: [],
    });

    requestSerpGoogleJson.mockImplementation(async (url: string) => {
      const query = decodeURIComponent(
        new URL(url).searchParams.get('q') ?? '',
      );

      if (!query.startsWith('site:linkedin.com/in')) {
        throw new Error('Bright Data SERP failed: HTTP 400 Bad Request');
      }

      return {
        organic: [
          {
            title: 'Sanjay Goyal - CEO - Baskin Robbins India | LinkedIn',
            link: 'https://www.linkedin.com/in/sanjay-goyal-aaa675196',
          },
        ],
      };
    });

    const output = await tool.execute(
      { companies: [{ name: 'Baskin Robbins India' }], roles: ['CEO'] },
      context,
    );
    const company = (output.result as { companies: Array<Record<string, any>> })
      .companies[0];

    expect(company.status).toBe('matched');
    expect(company.sourceErrors).toEqual([
      'google: Bright Data SERP failed: HTTP 400 Bad Request',
    ]);
  });
});

describe('FindRoleAtCompaniesTool model extraction', () => {
  const aboutPage = {
    title: 'About us',
    link: 'https://99pancakes.in/pages/about-us',
    description:
      "Vikesh Shah, founder of 99 Pancakes, started his first pancake outlet in Mumbai's Kala Ghoda area in 2017.",
  };
  const profilePage = {
    title: 'Vikesh Shah - 99 Pancakes | LinkedIn',
    link: 'https://in.linkedin.com/in/vikesh-shah-253a67204',
  };
  const vikesh = {
    name: 'Vikesh Shah',
    jobTitle: 'founder',
    companyName: '99 Pancakes',
    evidence: 'Vikesh Shah, founder of 99 Pancakes',
    linkedinUrl: 'https://in.linkedin.com/in/vikesh-shah-253a67204',
  };

  const run = async (
    options: Parameters<typeof buildTool>[0],
    roles = ['founder'],
  ) => {
    const built = buildTool(options);
    const output = await built.tool.execute(
      { companies: [{ name: '99 Pancakes' }], roles },
      context,
    );

    return {
      ...built,
      company: (output.result as { companies: Array<Record<string, any>> })
        .companies[0],
    };
  };

  it('should hand every Google result to the model and verify what it returns', async () => {
    const { company, extract } = await run({
      brightDataDocuments: [],
      organic: [aboutPage, profilePage],
      extractedPeople: [vikesh],
    });

    expect(extract).toHaveBeenCalledWith(
      expect.objectContaining({
        company: '99 Pancakes',
        roles: ['founder'],
        results: expect.arrayContaining([
          expect.objectContaining({ title: 'About us' }),
          expect.objectContaining({ url: profilePage.link }),
        ]),
      }),
    );
    expect(company.status).toBe('matched');
    expect(company.people[0]).toEqual(
      expect.objectContaining({
        name: 'Vikesh Shah',
        title: 'founder',
        linkedinUrl: vikesh.linkedinUrl,
      }),
    );
  });

  it('should take the role from the model even when the LinkedIn title has none', async () => {
    // The pattern fallback would read "99 Pancakes" as a title here; the model
    // is given the About page as well and answers founder
    const { company, resolve } = await run({
      brightDataDocuments: [],
      organic: [aboutPage, profilePage],
      extractedPeople: [vikesh],
    });

    expect(company.people).toHaveLength(1);
    expect(company.rejected).toEqual([]);
    expect(resolve).not.toHaveBeenCalled();
  });

  it('should enrich the profiles the model found, not every result', async () => {
    const { search } = await run({
      brightDataDocuments: [],
      organic: [aboutPage, profilePage],
      extractedPeople: [
        vikesh,
        {
          name: 'Deepak Taluja',
          jobTitle: 'Chief Executive Officer',
          companyName: 'VLCC',
          linkedinUrl: 'https://in.linkedin.com/in/deepak-taluja-56704436',
        },
      ],
    });

    expect(search).toHaveBeenCalledTimes(1);
    expect(search.mock.calls[0][0].query).toBe(
      'linkedin.com/in/vikesh-shah-253a67204',
    );
  });

  it('should look up the LinkedIn profile of a person the results name without one', async () => {
    const { company, resolve } = await run({
      brightDataDocuments: [],
      organic: [aboutPage],
      extractedPeople: [{ ...vikesh, linkedinUrl: '' }],
      resolution: {
        linkedinUrl: 'https://www.linkedin.com/in/vikesh-shah-253a67204/',
        title: '',
        companyName: '99 Pancakes',
        via: 'bright_data',
      },
    });

    expect(resolve).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Vikesh Shah' }),
    );
    expect(company.status).toBe('matched');
    expect(company.people[0]).toEqual(
      expect.objectContaining({
        linkedinUrl: 'https://www.linkedin.com/in/vikesh-shah-253a67204/',
        sources: ['web'],
      }),
    );
  });

  it('should still return a named person when no profile is found', async () => {
    const { company } = await run({
      brightDataDocuments: [],
      organic: [aboutPage],
      extractedPeople: [{ ...vikesh, linkedinUrl: '' }],
      resolution: null,
    });

    expect(company.status).toBe('matched');
    expect(company.people[0]).toEqual(
      expect.objectContaining({ name: 'Vikesh Shah', linkedinUrl: '' }),
    );
  });

  it('should prefer what the profile says over what the result said', async () => {
    const { company } = await run({
      brightDataDocuments: [],
      organic: [aboutPage],
      extractedPeople: [{ ...vikesh, linkedinUrl: '' }],
      resolution: {
        linkedinUrl: 'https://www.linkedin.com/in/vikesh-shah-253a67204/',
        title: 'Intern',
        companyName: '99 Pancakes',
        via: 'bright_data',
      },
    });

    expect(company.status).toBe('no_match');
    expect(company.rejected[0]).toEqual(
      expect.objectContaining({ name: 'Vikesh Shah', reason: 'role_mismatch' }),
    );
  });

  it('should say so when a name could not be looked up, instead of looking like there is no profile', async () => {
    const { company } = await run({
      brightDataDocuments: [],
      organic: [aboutPage],
      extractedPeople: [{ ...vikesh, linkedinUrl: '' }],
      resolution: null,
      resolutionErrors: [
        'Vikesh Shah: google Bright Data SERP failed: HTTP 502',
      ],
    });

    expect(company.people[0].linkedinUrl).toBe('');
    expect(company.sourceErrors).toEqual([
      'linkedin_lookup: Vikesh Shah: google Bright Data SERP failed: HTTP 502',
    ]);
  });

  it('should not look up a person with no stated role', async () => {
    const { resolve } = await run({
      brightDataDocuments: [],
      organic: [aboutPage],
      extractedPeople: [{ ...vikesh, linkedinUrl: '', jobTitle: '' }],
    });

    expect(resolve).not.toHaveBeenCalled();
  });

  it('should ignore a former holder of the role', async () => {
    const { company } = await run({
      brightDataDocuments: [],
      organic: [profilePage],
      extractedPeople: [{ ...vikesh, isCurrentRole: false }],
    });

    expect(company.status).toBe('no_match');
    expect(company.people).toEqual([]);
  });

  it('should fall back to reading LinkedIn titles and report that the model failed', async () => {
    const { company, extract } = await run({
      brightDataDocuments: [],
      organic: [
        {
          title: 'Vikesh Shah - Founder - 99 Pancakes | LinkedIn',
          link: 'https://in.linkedin.com/in/vikesh-shah-253a67204',
        },
      ],
      extractedPeople: 'unavailable',
    });

    expect(extract).toHaveBeenCalled();
    expect(company.status).toBe('matched');
    expect(company.people[0].title).toBe('Founder');
    expect(company.sourceErrors).toEqual([
      'google_extraction: model unavailable (read LinkedIn titles by pattern instead)',
    ]);
  });

  it('should read "Name - Company" as a company when falling back', async () => {
    const { company } = await run({
      brightDataDocuments: [],
      organic: [profilePage],
      extractedPeople: 'unavailable',
    });

    expect(company.rejected).toEqual([
      expect.objectContaining({
        name: 'Vikesh Shah',
        title: '',
        companyOnProfile: '99 Pancakes',
        reason: 'role_mismatch',
      }),
    ]);
  });
});

describe('FindRoleAtCompaniesTool judged by a model', () => {
  const hardcastleResults = [
    {
      title:
        'Amit Jatia - Chairperson at Westlife Foodworld Limited | LinkedIn',
      link: 'https://in.linkedin.com/in/amit-jatia-7933848',
      description:
        "Chairperson at Westlife Foodworld Limited · Experience: McDonald's India",
    },
    {
      title: 'Smita Jatia, managing director, Hardcastle Restaurants Pvt Ltd',
      link: 'https://www.instagram.com/p/abc',
      description:
        'Smita Jatia, managing director, Hardcastle Restaurants Pvt Ltd, which operates the' +
        " McDonald's franchises in India's west and south zones",
    },
  ];
  const amit = {
    name: 'Amit Jatia',
    jobTitle: 'Chairperson',
    companyName: 'Westlife Foodworld Limited',
    evidence: 'Chairperson at Westlife Foodworld Limited',
    linkedinUrl: 'https://in.linkedin.com/in/amit-jatia-7933848',
  };
  const smita = {
    name: 'Smita Jatia',
    jobTitle: 'managing director',
    companyName: 'Hardcastle Restaurants Pvt Ltd',
    evidence: 'Smita Jatia, managing director, Hardcastle Restaurants Pvt Ltd',
  };
  const run = async (options: Parameters<typeof buildTool>[0]) => {
    const built = buildTool(options);
    const output = await built.tool.execute(
      {
        companies: [{ name: 'Hardcastle Restaurants Pvt. Ltd.' }],
        roles: ['MD', 'CEO'],
      },
      context,
    );

    return {
      ...built,
      company: (output.result as { companies: Array<Record<string, any>> })
        .companies[0],
    };
  };

  it('should accept a person at the operator or parent of the company, and say why', async () => {
    const { company } = await run({
      brightDataDocuments: [],
      organic: hardcastleResults,
      extractedPeople: [amit],
      judge: () => ({
        company: 'related',
        companyNote:
          "Westlife Foodworld is the master franchisee that operates Hardcastle's McDonald's outlets.",
        role: 'related',
        roleNote: 'Chairperson, not the managing director.',
      }),
    });

    // The string check would have rejected him: Westlife is not Hardcastle
    expect(company.status).toBe('related_role_only');
    expect(company.people[0]).toEqual(
      expect.objectContaining({
        name: 'Amit Jatia',
        linkedinUrl: 'https://in.linkedin.com/in/amit-jatia-7933848',
        companyRelation: 'related',
        note: expect.stringContaining('master franchisee'),
      }),
    );
  });

  it('should list someone at the company itself before someone at a linked company with the same role', async () => {
    const { company } = await run({
      brightDataDocuments: [],
      organic: hardcastleResults,
      extractedPeople: [
        {
          name: 'Akshay Jatia',
          jobTitle: 'CEO',
          companyName: 'Westlife Foodworld',
          evidence: 'CEO of Westlife Foodworld',
          linkedinUrl: 'https://in.linkedin.com/in/akshay-jatia',
        },
        {
          name: 'Priya Rao',
          jobTitle: 'CEO',
          companyName: 'Hardcastle Restaurants Pvt. Ltd.',
          evidence: 'CEO of Hardcastle Restaurants',
          linkedinUrl: 'https://in.linkedin.com/in/priya-rao',
        },
      ],
      judge: (candidate) => ({
        company: candidate.name === 'Priya Rao' ? 'same' : 'related',
        role: 'exact',
      }),
    });

    expect(
      company.people.map((person: { name: string }) => person.name),
    ).toEqual(['Priya Rao', 'Akshay Jatia']);
  });

  it('should reject a person the judge puts at an unrelated company, with its reason', async () => {
    const { company } = await run({
      brightDataDocuments: [],
      organic: hardcastleResults,
      extractedPeople: [amit],
      judge: () => ({
        company: 'different',
        companyNote: 'A namesake at an unrelated firm.',
        role: 'exact',
      }),
    });

    expect(company.status).toBe('no_match');
    expect(company.rejected).toEqual([
      expect.objectContaining({
        name: 'Amit Jatia',
        reason: 'company_mismatch',
        note: 'A namesake at an unrelated firm.',
      }),
    ]);
  });

  it("should take the judge's word on the role instead of matching words", async () => {
    const { company } = await run({
      brightDataDocuments: [],
      organic: hardcastleResults,
      extractedPeople: [
        {
          ...amit,
          jobTitle: 'Whole-time Director & Group CEO',
          companyName: 'Westlife Foodworld',
        },
      ],
      judge: () => ({ company: 'related', role: 'exact' }),
    });

    expect(company.status).toBe('matched');
    expect(company.people[0].roleMatch).toBe('exact');
  });

  it('should not spend on a lookup for a person at a company that does not match by name', async () => {
    const { resolve } = await run({
      brightDataDocuments: [],
      organic: hardcastleResults,
      extractedPeople: [{ ...smita, companyName: 'Westlife Foodworld' }],
      judge: () => ({ company: 'related', role: 'exact' }),
    });

    expect(resolve).not.toHaveBeenCalled();
  });

  it('should not spend on looking up a person the judge rules out', async () => {
    const { resolve, search } = await run({
      brightDataDocuments: [],
      organic: hardcastleResults,
      extractedPeople: [smita, { ...amit, linkedinUrl: '' }],
      judge: (candidate) =>
        candidate.name === 'Smita Jatia'
          ? { company: 'same', role: 'exact' }
          : { company: 'different', role: 'none' },
    });

    expect(resolve).toHaveBeenCalledTimes(1);
    expect(resolve).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Smita Jatia' }),
    );
    expect(search).not.toHaveBeenCalled();
  });

  it('should ask the model about two rows the name rules cannot settle', async () => {
    const { company, findDuplicates } = await run({
      brightDataDocuments: [],
      organic: hardcastleResults,
      extractedPeople: [
        { ...smita, name: 'Smita Jatia', linkedinUrl: '' },
        {
          ...smita,
          name: 'S. Jatia',
          linkedinUrl: 'https://in.linkedin.com/in/smitha-jatia',
        },
      ],
      judge: () => ({ company: 'same', role: 'exact' }),
    });

    expect(findDuplicates).toHaveBeenCalledTimes(1);
    expect(findDuplicates.mock.calls[0][0].people).toHaveLength(2);
    expect(company.people).toHaveLength(2);
  });

  it('should judge once, on what the profile says', async () => {
    const { judge, company } = await run({
      brightDataDocuments: [],
      organic: hardcastleResults,
      extractedPeople: [{ ...smita, linkedinUrl: '' }],
      resolution: {
        linkedinUrl: 'https://linkedin.com/in/smita-jatia',
        title: '',
        companyName: '',
        via: 'bright_data',
      },
      judge: () => ({ company: 'same', role: 'exact' }),
    });

    expect(judge).toHaveBeenCalledTimes(1);
    expect(company.status).toBe('matched');
    expect(company.people[0].linkedinUrl).toBe(
      'https://linkedin.com/in/smita-jatia',
    );
  });

  it('should fall back to matching names, and say so, when the judge fails', async () => {
    const { company } = await run({
      brightDataDocuments: [],
      organic: [
        {
          title:
            'Smita Jatia - Managing Director - Hardcastle Restaurants | LinkedIn',
          link: 'https://in.linkedin.com/in/smita-jatia',
        },
      ],
      judge: 'unavailable',
    });

    expect(company.status).toBe('matched');
    expect(company.sourceErrors).toEqual([
      'candidate_judge: judge unavailable (checked by name matching instead)',
    ]);
  });

  it('should flag a profile URL recovered from a post', async () => {
    const { company } = await run({
      brightDataDocuments: [],
      organic: hardcastleResults,
      extractedPeople: [
        {
          ...smita,
          linkedinUrl: 'https://www.linkedin.com/in/smita-jatia',
          linkedinUrlDerivedFromPost: true,
        },
      ],
      judge: () => ({ company: 'same', role: 'exact' }),
    });

    expect(company.people[0]).toEqual(
      expect.objectContaining({
        linkedinUrl: 'https://www.linkedin.com/in/smita-jatia',
        linkedinUrlDerivedFromPost: true,
      }),
    );
  });
});

describe('FindRoleAtCompaniesTool companies read from the project', () => {
  const rows = [
    { id: 'c1', name: 'Alpha' },
    { id: 'c2', name: 'Beta', otherFields: { peopleFound: 'Found' } },
    { id: 'c3', name: 'Gamma', otherFields: { peopleFound: 'Lookup failed' } },
  ];
  const lookedUp = (searchNaturalLanguage: jest.Mock): string[] =>
    searchNaturalLanguage.mock.calls.map(([call]) => call.rawQuery as string);

  it('should look up the project companies without them being passed', async () => {
    const { tool, searchNaturalLanguage } = buildTool({
      brightDataDocuments: [],
      organic: [],
      projectRows: rows,
    });

    const output = await tool.execute(
      { fromProject: true, projectId: 'project-id', roles: ['CEO'] },
      context,
    );

    expect(output.success).toBe(true);
    // Beta is already Found, so it is not paid for again
    expect(lookedUp(searchNaturalLanguage).join('|')).toMatch(/Alpha/);
    expect(lookedUp(searchNaturalLanguage).join('|')).toMatch(/Gamma/);
    expect(lookedUp(searchNaturalLanguage).join('|')).not.toMatch(/Beta/);
  });

  it('should look up only the failed companies when onlyFailed is set', async () => {
    const { tool, searchNaturalLanguage } = buildTool({
      brightDataDocuments: [],
      organic: [],
      projectRows: rows,
    });

    await tool.execute(
      {
        fromProject: true,
        onlyFailed: true,
        projectId: 'project-id',
        roles: ['CEO'],
      },
      context,
    );

    expect(lookedUp(searchNaturalLanguage).join('|')).toMatch(/Gamma/);
    expect(lookedUp(searchNaturalLanguage).join('|')).not.toMatch(/Alpha/);
  });

  it('should include Found companies when rerunFound is set', async () => {
    const { tool, searchNaturalLanguage } = buildTool({
      brightDataDocuments: [],
      organic: [],
      projectRows: rows,
    });

    await tool.execute(
      {
        fromProject: true,
        rerunFound: true,
        projectId: 'project-id',
        roles: ['CEO'],
      },
      context,
    );

    expect(lookedUp(searchNaturalLanguage).join('|')).toMatch(/Beta/);
  });

  it('should fail clearly when neither companies nor a project are given', async () => {
    const { tool } = buildTool({ brightDataDocuments: [], organic: [] });

    const output = await tool.execute({ roles: ['CEO'] }, context);

    expect(output.success).toBe(false);
    expect(output.error).toMatch(/fromProject/);
  });
});
