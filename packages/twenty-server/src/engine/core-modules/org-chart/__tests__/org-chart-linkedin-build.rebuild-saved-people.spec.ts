import { HttpException } from '@nestjs/common';

import { OrgChartLinkedInBuildService } from 'src/engine/core-modules/org-chart/services/org-chart-linkedin-build.service';

describe('OrgChartLinkedInBuildService.rebuildOrgChartUsingSavedPeople', () => {
  it('rebuilds from saved people and clears old cache before Python build', async () => {
    const events: string[] = [];
    const savedItems = [{ id: 'p1', full_name: 'Jane Doe' }];
    const builtOrgChart = { type: 'fullcompany', orgchart: [] };

    const ctx = {
      orgChartCacheService: {
        getCachedCompanyCandidateList: jest.fn(async () => ({
          items: savedItems,
        })),
        invalidateEntireCompanyClassicCaches: jest.fn(async () => {
          events.push('cache-cleared');
        }),
        setCachedCompanyCandidateList: jest.fn(async () => undefined),
        setCachedCompanyOrgChart: jest.fn(async () => undefined),
      },
      orgChartS3Service: {
        persistedCompanyFolderKey: jest.fn(() => 'acme'),
        getCandidates: jest.fn(async () => []),
        deletePersistedCompanyFolder: jest.fn(async () => {
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
    expect(events).toEqual(['cache-cleared', 's3-cleared', 'python-build']);
  });

  it('throws not found when no saved people exist in Redis or S3', async () => {
    const ctx = {
      orgChartCacheService: {
        getCachedCompanyCandidateList: jest.fn(async () => undefined),
      },
      orgChartS3Service: {
        persistedCompanyFolderKey: jest.fn(() => 'acme'),
        getCandidates: jest.fn(async () => []),
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
