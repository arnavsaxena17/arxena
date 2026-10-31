import { FindPeopleSerpSourcesService } from 'src/engine/core-modules/tool/tools/find-people-by-company-tool/find-people-serp-sources.service';

const THEORG_COMPANY = {
  companyName: 'Acme Corporation',
  slug: 'acme',
  url: 'https://theorg.com/org/acme',
  people: [
    {
      id: 1,
      name: 'Asha Rao',
      role: 'Chief Executive Officer',
      linkedInUrl: 'https://www.linkedin.com/in/asha-rao',
      profileUrl: 'https://theorg.com/org/acme/org-chart/asha-rao',
    },
    {
      id: 2,
      name: 'Bilal Khan',
      role: 'Head of Manufacturing',
      linkedInUrl: null,
      profileUrl: null,
    },
    { id: 3, name: '   ', role: 'Nobody', linkedInUrl: null, profileUrl: null },
  ],
};

const OFFICIALBOARD_COMPANY = {
  companyName: 'Acme Corporation',
  slug: 'acme',
  url: 'https://www.theofficialboard.com/org-chart/acme',
  candidates: [
    { id: 'c1', name: 'Carla Diaz', isMasked: false, displayTitle: 'CFO' },
    { id: 'c2', name: null, isMasked: true, displayTitle: 'Masked' },
  ],
};

const build = ({
  theOrg = {},
  officialBoard = {},
}: {
  theOrg?: Record<string, unknown>;
  officialBoard?: Record<string, unknown>;
} = {}) =>
  new FindPeopleSerpSourcesService(
    {
      fetchCompanyDetailsResolvingSlug: jest
        .fn()
        .mockResolvedValue(THEORG_COMPANY),
      ...theOrg,
    } as never,
    {
      fetchCompanyDetailsResolvingSlug: jest
        .fn()
        .mockResolvedValue(OFFICIALBOARD_COMPANY),
      ...officialBoard,
    } as never,
  );

describe('FindPeopleSerpSourcesService', () => {
  const originalFlags = {
    theorg: process.env.USE_THEORG_AS_SERP_SOURCE,
    officialboard: process.env.USE_THEOFFICIALBOARD_AS_SERP_SOURCE,
    timeout: process.env.FIND_ROLE_SERP_ORG_SOURCE_TIMEOUT_MS,
    mode: process.env.THEORG_SERP_MODE,
  };

  beforeEach(() => {
    delete process.env.USE_THEORG_AS_SERP_SOURCE;
    delete process.env.USE_THEOFFICIALBOARD_AS_SERP_SOURCE;
    delete process.env.FIND_ROLE_SERP_ORG_SOURCE_TIMEOUT_MS;
    delete process.env.THEORG_SERP_MODE;
  });

  afterAll(() => {
    for (const [name, value] of Object.entries({
      USE_THEORG_AS_SERP_SOURCE: originalFlags.theorg,
      USE_THEOFFICIALBOARD_AS_SERP_SOURCE: originalFlags.officialboard,
      FIND_ROLE_SERP_ORG_SOURCE_TIMEOUT_MS: originalFlags.timeout,
      THEORG_SERP_MODE: originalFlags.mode,
    })) {
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
  });

  it('should fetch nobody when both flags are off', async () => {
    const service = build();

    expect(service.isEnabled()).toBe(false);
    await expect(service.fetchPeople({ companyName: 'Acme' })).resolves.toEqual(
      { candidates: [], errors: [] },
    );
  });

  it('should read TheOrg people when its flag is on', async () => {
    process.env.USE_THEORG_AS_SERP_SOURCE = 'true';
    const service = build();

    const { candidates, errors } = await service.fetchPeople({
      companyName: 'Acme',
    });

    expect(errors).toEqual([]);
    expect(candidates).toHaveLength(2);
    expect(candidates[0]).toMatchObject({
      name: 'Asha Rao',
      title: 'Chief Executive Officer',
      // the name the user asked for, not the page's legal name
      companyName: 'Acme',
      linkedinUrl: 'https://www.linkedin.com/in/asha-rao',
      // counted under the SERP source, with the site kept for the evidence
      source: 'google',
      provider: 'theorg',
    });
    expect(candidates[0].evidenceText).toContain('theorg.com/org/acme');
  });

  it('should slugify the company name before asking TheOrg', async () => {
    process.env.USE_THEORG_AS_SERP_SOURCE = '1';
    const fetchCompanyDetailsResolvingSlug = jest
      .fn()
      .mockResolvedValue(THEORG_COMPANY);
    const service = build({
      theOrg: { fetchCompanyDetailsResolvingSlug },
    });

    await service.fetchPeople({ companyName: 'Acme & Sons Pvt. Ltd.' });

    expect(fetchCompanyDetailsResolvingSlug).toHaveBeenCalledWith(
      'acme-and-sons-pvt-ltd',
      expect.objectContaining({ persist: false }),
    );
  });

  it('should skip masked The Official Board people', async () => {
    process.env.USE_THEOFFICIALBOARD_AS_SERP_SOURCE = 'true';
    const service = build();

    const { candidates } = await service.fetchPeople({ companyName: 'Acme' });

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      name: 'Carla Diaz',
      title: 'CFO',
      linkedinUrl: '',
      provider: 'officialboard',
    });
  });

  it('should fetch both services at the same time', async () => {
    process.env.USE_THEORG_AS_SERP_SOURCE = 'true';
    process.env.USE_THEOFFICIALBOARD_AS_SERP_SOURCE = 'true';
    let theOrgStarted = false;
    let officialBoardStartedWhileTheOrgRunning = false;
    let releaseTheOrg: () => void = () => undefined;
    // TheOrg is held open until The Official Board has answered, so the test
    // fails if the second source is queued behind the first
    const theOrgGate = new Promise<void>((resolve) => {
      releaseTheOrg = resolve;
    });
    const theOrg = {
      fetchCompanyDetailsResolvingSlug: jest.fn(async () => {
        theOrgStarted = true;
        await theOrgGate;

        return THEORG_COMPANY;
      }),
    };
    const officialBoard = {
      fetchCompanyDetailsResolvingSlug: jest.fn(async () => {
        officialBoardStartedWhileTheOrgRunning = theOrgStarted;
        releaseTheOrg();

        return OFFICIALBOARD_COMPANY;
      }),
    };
    const service = build({ theOrg, officialBoard });

    const { candidates } = await service.fetchPeople({ companyName: 'Acme' });

    expect(officialBoardStartedWhileTheOrgRunning).toBe(true);
    expect(candidates.map((candidate) => candidate.provider)).toEqual([
      'theorg',
      'theorg',
      'officialboard',
    ]);
  });

  it('should keep the other source when one fails', async () => {
    process.env.USE_THEORG_AS_SERP_SOURCE = 'true';
    process.env.USE_THEOFFICIALBOARD_AS_SERP_SOURCE = 'true';
    const service = build({
      theOrg: {
        fetchCompanyDetailsResolvingSlug: jest
          .fn()
          .mockRejectedValue(new Error('theorg is down')),
      },
    });

    const { candidates, errors } = await service.fetchPeople({
      companyName: 'Acme',
    });

    expect(candidates).toHaveLength(1);
    expect(errors).toEqual(['theorg: theorg is down']);
  });

  it('should drop a source that passes its deadline and report it', async () => {
    process.env.USE_THEORG_AS_SERP_SOURCE = 'true';
    process.env.USE_THEOFFICIALBOARD_AS_SERP_SOURCE = 'true';
    process.env.FIND_ROLE_SERP_ORG_SOURCE_TIMEOUT_MS = '10';
    const service = build({
      theOrg: {
        fetchCompanyDetailsResolvingSlug: jest.fn(
          () => new Promise(() => undefined),
        ),
      },
    });

    const pending = service.fetchPeople({ companyName: 'Acme' });

    await jest.advanceTimersByTimeAsync(10);

    const { candidates, errors } = await pending;

    expect(candidates).toHaveLength(1);
    expect(errors).toEqual(['theorg: theorg timed out after 10ms']);
  });

  it('should retry the next name only when the page was not found', async () => {
    process.env.USE_THEORG_AS_SERP_SOURCE = 'true';
    const fetchCompanyDetailsResolvingSlug = jest
      .fn()
      .mockRejectedValueOnce(
        new Error('TheOrg could not resolve a company page'),
      )
      .mockResolvedValueOnce(THEORG_COMPANY);
    const service = build({
      theOrg: { fetchCompanyDetailsResolvingSlug },
    });

    const { candidates } = await service.fetchPeople({
      companyName: 'Acme Corp',
      alternateNames: ['Acme'],
    });

    expect(fetchCompanyDetailsResolvingSlug).toHaveBeenCalledTimes(2);
    expect(fetchCompanyDetailsResolvingSlug).toHaveBeenLastCalledWith(
      'acme',
      expect.anything(),
    );
    expect(candidates).toHaveLength(2);
  });
});
