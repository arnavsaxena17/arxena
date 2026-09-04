import { HttpException } from '@nestjs/common';

import { OrgChartLinkedInBuildService } from 'src/engine/core-modules/org-chart/services/org-chart-linkedin-build.service';

describe('OrgChartLinkedInBuildService.rebuildOrgChartUsingSavedPeople', () => {
  it('rebuilds from saved people and clears old cache before Python build', async () => {
    const events: string[] = [];
    const savedItems = [{ id: 'p1', full_name: 'Jane Doe' }];
    const builtOrgChart = { type: 'fullcompany', orgchart: [] };

    const ctx = {
      logger: { log: jest.fn() },
      orgChartCacheService: {
        getCachedCompanyCandidateList: jest.fn(async () => ({
          items: savedItems,
        })),
        invalidateEntireCompanyCaches: jest.fn(async () => {
          events.push('cache-cleared');
        }),
        setCachedCompanyCandidateList: jest.fn(async () => undefined),
        setCachedCompanyOrgChart: jest.fn(async () => undefined),
        setCachedFunctionGradeSearch: jest.fn(async () => undefined),
      },
      orgChartS3Service: {
        persistedCompanyFolderKey: jest.fn(() => 'acme'),
        getUnipileRawSearch: jest.fn(async () => null),
        getCandidates: jest.fn(async () => []),
        deleteDefaultOrgChartArtifacts: jest.fn(async () => {
          events.push('s3-cleared');
        }),
        saveOrgChart: jest.fn(async () => undefined),
        saveCandidates: jest.fn(async () => undefined),
      },
      orgChartSearchService: {
        buildOrgChartFromLinkedInCompanyCandidates: jest.fn(async () => {
          events.push('python-build');
          return builtOrgChart;
        }),
        transformUnipileRawItemsToOrgChartCandidates: jest.fn(),
      },
      buildOrgChartCreditMetadata: jest.fn(async () => ({
        orgChartS3RelativePath: 'org-charts/acme',
      })),
      orgChartRecordWorkspaceService: {
        tryPersistOrgChartRecord: jest.fn(async () => undefined),
      },
    } as unknown as OrgChartLinkedInBuildService;

    const result =
      await OrgChartLinkedInBuildService.prototype.rebuildOrgChartUsingSavedPeople.call(
        ctx,
        {
          apiToken: 'token',
          companyId: 'acme',
          companyName: 'Acme',
        },
      );

    expect(result.success).toBe(true);
    expect(result.itemCount).toBe(1);
    expect(result.candidateSource).toBe('saved_people');
    expect(result.mode).toBe('entire_company');
    expect(events).toEqual(['cache-cleared', 's3-cleared', 'python-build']);
    expect(
      (
        ctx.orgChartSearchService as {
          buildOrgChartFromLinkedInCompanyCandidates: jest.Mock;
        }
      ).buildOrgChartFromLinkedInCompanyCandidates,
    ).toHaveBeenCalledWith(
      savedItems,
      expect.objectContaining({
        mode: 'entire_company',
        function: undefined,
      }),
    );
  });

  it('prefers Unipile raw search and preserves functionRoot/country scope', async () => {
    const events: string[] = [];
    const rawItems = [{ id: 'ACwAA', name: 'Raw Person' }];
    const transformed = [{ id: 'ACwAA', full_name: 'Raw Person' }];
    const builtOrgChart = { type: 'technology', orgchart: [] };

    const ctx = {
      logger: { log: jest.fn() },
      orgChartCacheService: {
        getCachedCompanyCandidateList: jest.fn(async () => undefined),
        invalidateEntireCompanyCaches: jest.fn(async () => {
          events.push('cache-cleared');
        }),
        setCachedCompanyCandidateList: jest.fn(async () => undefined),
        setCachedCompanyOrgChart: jest.fn(async () => undefined),
        setCachedFunctionGradeSearch: jest.fn(async () => undefined),
      },
      orgChartS3Service: {
        persistedCompanyFolderKey: jest.fn(() => 'british-airways'),
        getUnipileRawSearch: jest.fn(async () => ({
          version: 1,
          savedAt: '2026-09-04T08:27:52.000Z',
          searchType: 'sales_navigator',
          mode: 'super_impose',
          functionRoot: 'technology',
          country: 'global',
          itemCount: 1,
          items: rawItems,
        })),
        getCandidates: jest.fn(async () => []),
        deleteDefaultOrgChartArtifacts: jest.fn(async () => {
          events.push('s3-cleared');
        }),
        saveOrgChart: jest.fn(async () => undefined),
        saveCandidates: jest.fn(async () => undefined),
      },
      orgChartSearchService: {
        transformUnipileRawItemsToOrgChartCandidates: jest.fn(() => {
          events.push('transform');
          return transformed;
        }),
        buildOrgChartFromLinkedInCompanyCandidates: jest.fn(async () => {
          events.push('python-build');
          return builtOrgChart;
        }),
      },
      buildOrgChartCreditMetadata: jest.fn(async () => ({
        orgChartS3RelativePath: 'org-charts/british_airways',
      })),
      orgChartRecordWorkspaceService: {
        tryPersistOrgChartRecord: jest.fn(async () => undefined),
      },
    } as unknown as OrgChartLinkedInBuildService;

    const result =
      await OrgChartLinkedInBuildService.prototype.rebuildOrgChartUsingSavedPeople.call(
        ctx,
        {
          apiToken: 'token',
          companyId: 'british-airways',
          companyName: 'british airways',
        },
      );

    expect(result.success).toBe(true);
    expect(result.itemCount).toBe(1);
    expect(result.candidateSource).toBe('unipile_raw');
    expect(result.functionRoot).toBe('technology');
    expect(result.country).toBe('global');
    expect(result.mode).toBe('super_impose');
    expect(events).toEqual([
      'transform',
      'cache-cleared',
      's3-cleared',
      'python-build',
    ]);
    expect(
      (
        ctx.orgChartSearchService as {
          transformUnipileRawItemsToOrgChartCandidates: jest.Mock;
        }
      ).transformUnipileRawItemsToOrgChartCandidates,
    ).toHaveBeenCalledWith(rawItems, 'sales_navigator');
    expect(
      (
        ctx.orgChartSearchService as {
          buildOrgChartFromLinkedInCompanyCandidates: jest.Mock;
        }
      ).buildOrgChartFromLinkedInCompanyCandidates,
    ).toHaveBeenCalledWith(
      transformed,
      expect.objectContaining({
        mode: 'super_impose',
        function: 'technology',
      }),
    );
    expect(
      (
        ctx.orgChartCacheService as {
          setCachedFunctionGradeSearch: jest.Mock;
        }
      ).setCachedFunctionGradeSearch,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        functionRoot: 'technology',
        country: 'global',
      }),
    );
    expect(
      (
        ctx.orgChartRecordWorkspaceService as {
          tryPersistOrgChartRecord: jest.Mock;
        }
      ).tryPersistOrgChartRecord,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        functionRoot: 'technology',
        country: 'global',
        mode: 'super_impose',
      }),
    );
  });

  it('allows explicit functionRoot override over Unipile raw metadata', async () => {
    const transformed = [{ id: '1', full_name: 'A' }];
    const ctx = {
      logger: { log: jest.fn() },
      orgChartCacheService: {
        getCachedCompanyCandidateList: jest.fn(async () => undefined),
        invalidateEntireCompanyCaches: jest.fn(async () => undefined),
        setCachedFunctionGradeSearch: jest.fn(async () => undefined),
      },
      orgChartS3Service: {
        persistedCompanyFolderKey: jest.fn(() => 'acme'),
        getUnipileRawSearch: jest.fn(async () => ({
          version: 1,
          savedAt: '2026-09-04T08:27:52.000Z',
          searchType: 'classic',
          functionRoot: 'technology',
          country: 'global',
          itemCount: 1,
          items: [{ id: 'raw' }],
        })),
        getCandidates: jest.fn(async () => []),
        deleteDefaultOrgChartArtifacts: jest.fn(async () => undefined),
        saveOrgChart: jest.fn(async () => undefined),
        saveCandidates: jest.fn(async () => undefined),
      },
      orgChartSearchService: {
        transformUnipileRawItemsToOrgChartCandidates: jest.fn(() => transformed),
        buildOrgChartFromLinkedInCompanyCandidates: jest.fn(async () => ({
          type: 'finance',
          orgchart: [],
        })),
      },
      buildOrgChartCreditMetadata: jest.fn(async () => ({
        orgChartS3RelativePath: 'org-charts/acme',
      })),
      orgChartRecordWorkspaceService: {
        tryPersistOrgChartRecord: jest.fn(async () => undefined),
      },
    } as unknown as OrgChartLinkedInBuildService;

    const result =
      await OrgChartLinkedInBuildService.prototype.rebuildOrgChartUsingSavedPeople.call(
        ctx,
        {
          apiToken: 'token',
          companyId: 'acme',
          companyName: 'Acme',
          functionRoot: 'finance',
        },
      );

    expect(result.functionRoot).toBe('finance');
    expect(
      (
        ctx.orgChartSearchService as {
          buildOrgChartFromLinkedInCompanyCandidates: jest.Mock;
        }
      ).buildOrgChartFromLinkedInCompanyCandidates,
    ).toHaveBeenCalledWith(
      transformed,
      expect.objectContaining({ function: 'finance' }),
    );
  });

  it('throws not found when no saved people or Unipile raw exist', async () => {
    const ctx = {
      logger: { log: jest.fn() },
      orgChartCacheService: {
        getCachedCompanyCandidateList: jest.fn(async () => undefined),
      },
      orgChartS3Service: {
        persistedCompanyFolderKey: jest.fn(() => 'acme'),
        getUnipileRawSearch: jest.fn(async () => null),
        getCandidates: jest.fn(async () => []),
      },
      orgChartSearchService: {
        transformUnipileRawItemsToOrgChartCandidates: jest.fn(),
      },
    } as unknown as OrgChartLinkedInBuildService;

    let caught: unknown;

    try {
      await OrgChartLinkedInBuildService.prototype.rebuildOrgChartUsingSavedPeople.call(
        ctx,
        {
          apiToken: 'token',
          companyId: 'acme',
          companyName: 'Acme',
        },
      );
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(HttpException);
    expect((caught as HttpException).getStatus()).toBe(404);
  });
});
