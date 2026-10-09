import { OutreachWarmOverlapService } from 'src/engine/core-modules/outreach-command/services/outreach-warm-overlap.service';

const prospectProfile = {
  education: [{ school: 'IIT Bombay' }],
  work_experience: [{ company: 'Initech', end: '' }],
};

const buildService = ({
  profilesByAccount,
  cache = new Map<string, unknown>(),
}: {
  profilesByAccount: Record<string, Record<string, unknown> | Error>;
  cache?: Map<string, unknown>;
}) => {
  const fetchLinkedinUserProfile = jest.fn(
    async (accountId: string) => {
      const profile = profilesByAccount[accountId];

      if (profile instanceof Error) {
        throw profile;
      }

      return { ...prospectProfile, ...profile };
    },
  );
  const repositories: Record<string, unknown> = {
    candidate: {
      findOne: async () => ({ id: 'c1', peopleId: 'person1' }),
    },
    person: {
      findOne: async () => ({ id: 'person1', linkedinProfileId: 'jane-doe' }),
    },
    workspaceMember: {
      find: async () => [
        {
          id: 'm1',
          linkedinUnipileAccountId: 'acc1',
          linkedinProfile: { education: [{ school: 'IIT Bombay' }] },
        },
        { id: 'm2', linkedinUnipileAccountId: 'acc2', linkedinProfile: null },
        { id: 'm3', linkedinUnipileAccountId: null, linkedinProfile: null },
      ],
    },
  };
  const service = new OutreachWarmOverlapService(
    {
      executeInWorkspaceContext: async (callback: () => Promise<unknown>) =>
        callback(),
      getRepository: async (_workspaceId: string, objectName: string) =>
        repositories[objectName],
    } as never,
    { fetchLinkedinUserProfile } as never,
    {
      getViewerScopedProfileFacts: async (account: string, slug: string) =>
        cache.get(`${account}:${slug}`) ?? null,
      saveViewerScopedProfileFacts: async (
        account: string,
        slug: string,
        facts: unknown,
      ) => {
        cache.set(`${account}:${slug}`, facts);
      },
    } as never,
  );

  return { service, fetchLinkedinUserProfile };
};

describe('OutreachWarmOverlapService', () => {
  it('should pick the seat with more mutuals and a shared school', async () => {
    const { service, fetchLinkedinUserProfile } = buildService({
      profilesByAccount: {
        acc1: { shared_connections_count: 12, network_distance: 'DISTANCE_2' },
        acc2: { shared_connections_count: 3, network_distance: 'DISTANCE_2' },
      },
    });

    const result = await service.scoreCandidate({
      workspaceId: 'w',
      candidateId: 'c1',
      memberIds: ['m1', 'm2', 'm3'],
      tieBreakLoad: {},
      recruiterId: null,
    });

    expect(result?.winnerMemberId).toBe('m1');
    expect(fetchLinkedinUserProfile).toHaveBeenCalledTimes(2);
    expect(fetchLinkedinUserProfile).toHaveBeenCalledWith('acc1', 'jane-doe', {
      notify: false,
      viewerScoped: true,
    });
  });

  it('should not score a seat that has no LinkedIn account of its own', async () => {
    const { service } = buildService({
      profilesByAccount: {
        acc1: { shared_connections_count: 1 },
        acc2: { shared_connections_count: 1 },
      },
    });

    const result = await service.scoreCandidate({
      workspaceId: 'w',
      candidateId: 'c1',
      memberIds: ['m1', 'm2', 'm3'],
      tieBreakLoad: {},
      recruiterId: null,
    });
    const noSeat = result?.scores.find((score) => score.memberId === 'm3');

    expect(noSeat?.error).toBe('no_linkedin_account');
  });

  it('should keep scoring the other seats when one fetch fails', async () => {
    const { service } = buildService({
      profilesByAccount: {
        acc1: new Error('boom'),
        acc2: { shared_connections_count: 4 },
      },
    });

    const result = await service.scoreCandidate({
      workspaceId: 'w',
      candidateId: 'c1',
      memberIds: ['m1', 'm2'],
      tieBreakLoad: {},
      recruiterId: null,
    });

    expect(result?.winnerMemberId).toBe('m2');
    expect(
      result?.scores.find((score) => score.memberId === 'm1')?.error,
    ).toBe('profile_fetch_failed');
  });

  it('should reuse the per-account cache instead of fetching again', async () => {
    const cache = new Map<string, unknown>();
    const { service, fetchLinkedinUserProfile } = buildService({
      profilesByAccount: {
        acc1: { shared_connections_count: 5 },
        acc2: { shared_connections_count: 2 },
      },
      cache,
    });
    const input = {
      workspaceId: 'w',
      candidateId: 'c1',
      memberIds: ['m1', 'm2'],
      tieBreakLoad: {},
      recruiterId: null,
    };

    await service.scoreCandidate(input);
    await service.scoreCandidate(input);

    expect(fetchLinkedinUserProfile).toHaveBeenCalledTimes(2);
    expect([...cache.keys()].sort()).toEqual([
      'acc1:jane-doe',
      'acc2:jane-doe',
    ]);
  });
});
