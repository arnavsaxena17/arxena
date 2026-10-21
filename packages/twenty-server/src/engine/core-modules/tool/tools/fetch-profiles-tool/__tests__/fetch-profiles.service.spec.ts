import { FetchProfilesService } from 'src/engine/core-modules/tool/tools/fetch-profiles-tool/fetch-profiles.service';
import { type OutreachWorkingSetRow } from 'src/engine/core-modules/outreach-command/services/outreach-working-set.service';

const row = (
  id: string,
  linkedinUrl: string | undefined,
  otherFields: Record<string, unknown> = {},
): OutreachWorkingSetRow => ({
  id,
  source: 'ephemeral',
  name: `Person ${id}`,
  linkedinUrl,
  otherFields,
});

const brightRecord = (url: string) => ({
  input_url: url,
  experience: [{ title: 'CEO', company: 'Acme' }],
});

const build = ({
  rows,
  scrape = jest.fn(async (urls: string[]) => urls.map(brightRecord)),
  harvest = jest.fn(async () => null),
  search = undefined as jest.Mock | undefined,
}: {
  rows: OutreachWorkingSetRow[];
  search?: jest.Mock;
  scrape?: jest.Mock;
  harvest?: jest.Mock;
}) => {
  const writeOtherFields = jest.fn(async () => ({
    ephemeralUpdated: 0,
    crmUpdated: 0,
  }));
  const service = new FetchProfilesService(
    { getAll: jest.fn(async () => rows), writeOtherFields } as never,
    { isConfigured: () => search !== undefined, search } as never,
    { isConfigured: () => true, scrapeProfilesByUrl: scrape } as never,
    { fetchProfileByUrl: harvest } as never,
  );

  return { service, scrape, harvest, writeOtherFields };
};

const input = { workspaceId: 'w', projectId: 'p' };

describe('FetchProfilesService', () => {
  it('should take profiles from Business Search first and scrape only the ones it misses', async () => {
    const search = jest.fn(async ({ query }: { query: string }) => ({
      documents: query.endsWith('/asha')
        ? [
            {
              brightId: 'a',
              data: {
                url: 'https://br.linkedin.com/in/asha',
                followers: 10,
                connections: 5,
              },
            },
          ]
        : [],
    }));
    const { service, scrape } = build({
      rows: [
        row('1', 'https://www.linkedin.com/in/asha'),
        row('2', 'https://www.linkedin.com/in/ben'),
      ],
      search,
    });
    const result = await service.fetch(input);

    expect(search).toHaveBeenCalledTimes(2);
    expect(scrape).toHaveBeenCalledWith(['https://www.linkedin.com/in/ben']);
    expect(result.fetched).toEqual({ brightData: 2, harvest: 0 });
  });

  it('should fetch from Bright Data in one batch and store the profile with its source', async () => {
    const { service, scrape, writeOtherFields } = build({
      rows: [
        row('1', 'https://www.linkedin.com/in/asha'),
        row('2', 'https://www.linkedin.com/in/ben'),
      ],
    });
    const result = await service.fetch(input);

    expect(scrape).toHaveBeenCalledTimes(1);
    expect(result.fetched).toEqual({ brightData: 2, harvest: 0 });
    expect(result.remaining).toBe(0);

    const written = (
      writeOtherFields.mock.calls[0] as unknown as [
        { valuesByRowId: Map<string, { profile: { source: string } }> },
      ]
    )[0].valuesByRowId;

    expect(written.get('1')?.profile.source).toBe('bright_data');
  });

  it('should fall back to Harvest for the profiles Bright Data did not return', async () => {
    const { service, harvest } = build({
      rows: [
        row('1', 'https://www.linkedin.com/in/asha'),
        row('2', 'https://www.linkedin.com/in/ben'),
      ],
      scrape: jest.fn(async () => [
        brightRecord('https://www.linkedin.com/in/asha'),
      ]),
      harvest: jest.fn(async () => ({
        headline: 'Head of Ops',
        experience: [{ position: 'Head', companyName: 'Acme' }],
      })),
    });
    const result = await service.fetch(input);

    expect(harvest).toHaveBeenCalledTimes(1);
    expect(result.fetched).toEqual({ brightData: 1, harvest: 1 });
    expect(result.failed).toEqual([]);
  });

  it('should skip Harvest when sources is bright_data only', async () => {
    const { service, harvest } = build({
      rows: [
        row('1', 'https://www.linkedin.com/in/asha'),
        row('2', 'https://www.linkedin.com/in/ben'),
      ],
      scrape: jest.fn(async () => [
        brightRecord('https://www.linkedin.com/in/asha'),
      ]),
      harvest: jest.fn(async () => ({
        headline: 'Head of Ops',
        experience: [{ position: 'Head', companyName: 'Acme' }],
      })),
    });
    const result = await service.fetch({
      ...input,
      sources: ['bright_data'],
    });

    expect(harvest).not.toHaveBeenCalled();
    expect(result.fetched).toEqual({ brightData: 1, harvest: 0 });
    expect(result.failed.map((failure) => failure.id)).toEqual(['2']);
  });

  it('should report a person neither source could find', async () => {
    const { service } = build({
      rows: [row('1', 'https://www.linkedin.com/in/ghost')],
      scrape: jest.fn(async () => []),
    });
    const result = await service.fetch(input);

    expect(result.failed.map((failure) => failure.id)).toEqual(['1']);
    expect(result.remaining).toBe(0);
  });

  it('should treat a Bright Data record with nothing to judge as a miss', async () => {
    const { service, harvest } = build({
      rows: [row('1', 'https://www.linkedin.com/in/asha')],
      scrape: jest.fn(async () => [
        {
          input_url: 'https://www.linkedin.com/in/asha',
          avatar: 'https://example.com/a.jpg',
        },
      ]),
      harvest: jest.fn(async () => ({ headline: 'CEO' })),
    });
    const result = await service.fetch(input);

    expect(harvest).toHaveBeenCalled();
    expect(result.fetched.harvest).toBe(1);
  });

  it('should skip rows without a URL, with a profile already, or that failed the snapshot', async () => {
    const { service, scrape } = build({
      rows: [
        row('1', undefined),
        row('2', 'https://www.linkedin.com/in/b', {
          profile: { source: 'harvest', fetchedAt: 'x' },
        }),
        row('3', 'https://www.linkedin.com/in/c', { fitmentOutcome: 'fail' }),
        row('4', 'https://www.linkedin.com/in/d', {
          fitmentOutcome: 'unknown',
        }),
        row('5', 'https://www.linkedin.com/in/e'),
      ],
    });
    const result = await service.fetch(input);

    expect(result.skipped).toEqual({
      noLinkedinUrl: 1,
      alreadyFetched: 1,
      filteredByOutcome: 1,
    });
    expect(scrape.mock.calls[0][0]).toHaveLength(2);
  });

  it('should fetch again when refresh is set', async () => {
    const { service } = build({
      rows: [
        row('1', 'https://www.linkedin.com/in/a', {
          profile: { source: 'harvest', fetchedAt: 'x' },
        }),
      ],
    });

    expect((await service.fetch({ ...input, refresh: true })).requested).toBe(
      1,
    );
  });

  it('should respect the row limit and say how many are left', async () => {
    const rows = Array.from({ length: 5 }, (_, index) =>
      row(String(index), `https://www.linkedin.com/in/p${index}`),
    );
    const { service } = build({ rows });
    const result = await service.fetch({ ...input, rowLimit: 2 });

    expect(result.requested).toBe(2);
    expect(result.remaining).toBe(3);
  });

  it('should fetch one person once when two rows share a profile', async () => {
    const { service, scrape } = build({
      rows: [
        row('1', 'https://www.linkedin.com/in/asha/'),
        row('2', 'https://linkedin.com/in/asha'),
      ],
    });

    await service.fetch(input);

    expect(scrape.mock.calls[0][0]).toHaveLength(1);
  });

  it('should leave work for the next call when the time budget is spent', async () => {
    const { service, scrape } = build({
      rows: [row('1', 'https://www.linkedin.com/in/a')],
    });
    const result = await service.fetch({ ...input, timeBudgetMs: 0 });

    expect(scrape).not.toHaveBeenCalled();
    expect(result.timedOut).toBe(true);
    expect(result.remaining).toBe(1);
  });
});
