import type { LinkedinUnipileOwnerProfileCache } from '@/orgchart/states/linkedinUnipileOwnerProfileCacheState';
import { applyInferredOrgChartLinkedinSearchType } from '@/unipile/utils/applyInferredOrgChartLinkedinSearchType';
import type { LinkedInSearchType } from 'twenty-shared/types';

describe('applyInferredOrgChartLinkedinSearchType', () => {
  it('updates search type and owner profile cache when payload is complete', () => {
    const setOrgChartLinkedInSearchType = jest.fn(
      (updater: LinkedInSearchType | ((current: LinkedInSearchType) => LinkedInSearchType)) => {
        if (typeof updater === 'function') {
          return updater('classic');
        }
        return updater;
      },
    );
    const setOwnerProfileCache = jest.fn(
      (
        updater:
          | LinkedinUnipileOwnerProfileCache
          | null
          | ((
              current: LinkedinUnipileOwnerProfileCache | null,
            ) => LinkedinUnipileOwnerProfileCache | null),
      ) => {
        if (typeof updater === 'function') {
          return updater(null);
        }
        return updater;
      },
    );

    const applied = applyInferredOrgChartLinkedinSearchType({
      payload: {
        accountId: 'acc-1',
        inferredSearchType: 'recruiter',
        salesNavigatorAvailable: false,
        recruiterAvailable: true,
      },
      setOrgChartLinkedInSearchType,
      setOwnerProfileCache,
    });

    expect(applied).toBe(true);
    expect(setOrgChartLinkedInSearchType).toHaveBeenCalledWith(
      expect.any(Function),
    );
    expect(setOwnerProfileCache).toHaveBeenCalledWith(expect.any(Function));
    expect(setOrgChartLinkedInSearchType.mock.results[0].value).toBe(
      'recruiter',
    );
    expect(setOwnerProfileCache.mock.results[0].value).toEqual(
      expect.objectContaining({
        accountId: 'acc-1',
        inferredSearchType: 'recruiter',
        recruiterAvailable: true,
      }),
    );
  });

  it('does not update state when cache and search type already match', () => {
    const setOrgChartLinkedInSearchType = jest.fn(
      (updater: LinkedInSearchType | ((current: LinkedInSearchType) => LinkedInSearchType)) => {
        if (typeof updater === 'function') {
          return updater('recruiter');
        }
        return updater;
      },
    );
    const setOwnerProfileCache = jest.fn(
      (
        updater:
          | LinkedinUnipileOwnerProfileCache
          | null
          | ((
              current: LinkedinUnipileOwnerProfileCache | null,
            ) => LinkedinUnipileOwnerProfileCache | null),
      ) => {
        const currentCache = {
          accountId: 'acc-1',
          inferredSearchType: 'recruiter' as const,
          salesNavigatorAvailable: false,
          recruiterAvailable: true,
          fetchedAt: 1000,
        };
        if (typeof updater === 'function') {
          return updater(currentCache);
        }
        return updater;
      },
    );

    const applied = applyInferredOrgChartLinkedinSearchType({
      payload: {
        accountId: 'acc-1',
        inferredSearchType: 'recruiter',
        salesNavigatorAvailable: false,
        recruiterAvailable: true,
      },
      setOrgChartLinkedInSearchType,
      setOwnerProfileCache,
    });

    expect(applied).toBe(false);
    expect(setOrgChartLinkedInSearchType).toHaveBeenCalledTimes(1);
    expect(setOwnerProfileCache).toHaveBeenCalledTimes(1);
  });

  it('returns false when account id or inferred search type is missing', () => {
    const setOrgChartLinkedInSearchType = jest.fn();
    const setOwnerProfileCache = jest.fn();

    const applied = applyInferredOrgChartLinkedinSearchType({
      payload: {
        accountId: 'acc-1',
      },
      setOrgChartLinkedInSearchType,
      setOwnerProfileCache,
    });

    expect(applied).toBe(false);
    expect(setOrgChartLinkedInSearchType).not.toHaveBeenCalled();
    expect(setOwnerProfileCache).not.toHaveBeenCalled();
  });
});
