import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';

import { OrgChartPublishedAdminService } from '../org-chart-published-admin.service';
import { type OrgPublishedSlugMapping } from '../../utils/org-chart-published-slug.util';

describe('OrgChartPublishedAdminService slug aliases', () => {
  const createService = () => {
    const slugMappings = new Map<string, OrgPublishedSlugMapping>();

    const orgChartPublishedSlugService = {
      getPublishedSlugMapping: jest.fn(async (publishSlug: string) => {
        return slugMappings.get(publishSlug.trim()) ?? null;
      }),
      savePublishedSlugMapping: jest.fn(
        async (input: {
          publishSlug: string;
          mapping: OrgPublishedSlugMapping;
        }) => {
          slugMappings.set(input.publishSlug.trim(), input.mapping);
        },
      ),
      deletePublishedSlugMapping: jest.fn(async (publishSlug: string) => {
        slugMappings.delete(publishSlug.trim());
      }),
      listPublishedSlugs: jest.fn(async () => [...slugMappings.keys()].sort()),
    };

    const orgChartService = {
      getOrgChartFromS3WithAliasLookup: jest.fn(async (companyId: string) => ({
        company_id: companyId,
        job_company_id: companyId,
        job_company_name: 'Locus',
        count_org: 42,
      })),
    };

    const orgChartS3Service = {
      saveOrgChart: jest.fn(),
      buildRelativeFolderPathFromPersistedKey: jest.fn(
        (companyId: string) => `org-charts/${companyId}`,
      ),
    };

    const orgChartLinkedInBuildService = {
      rebuildOrgChartUsingSavedPeople: jest.fn(),
    };

    const service = new OrgChartPublishedAdminService(
      orgChartPublishedSlugService as never,
      orgChartService as never,
      orgChartS3Service as never,
      orgChartLinkedInBuildService as never,
    );

    slugMappings.set('locus', {
      companyId: 'locus-sh',
      companyName: 'Locus',
      workspaceId: 'workspace-1',
      publishedAt: '2026-07-11T00:00:00.000Z',
      expiresAt: null,
    });
    slugMappings.set('locus-sh', {
      companyId: 'locus-sh',
      companyName: 'Locus',
      workspaceId: 'workspace-1',
      publishedAt: '2026-07-11T00:00:00.000Z',
      expiresAt: null,
    });

    return {
      service,
      slugMappings,
      orgChartPublishedSlugService,
    };
  };

  it('addPublishedOrgChartAlias creates a new slug for the same company', async () => {
    const { service, slugMappings, orgChartPublishedSlugService } =
      createService();

    const row = await service.addPublishedOrgChartAlias({
      sourcePublishSlug: 'locus',
      newPublishSlug: 'locus-logistics',
    });

    expect(row.publishSlug).toBe('locus-logistics');
    expect(row.companyId).toBe('locus-sh');
    expect(slugMappings.has('locus-logistics')).toBe(true);
    expect(orgChartPublishedSlugService.savePublishedSlugMapping).toHaveBeenCalledWith(
      expect.objectContaining({
        publishSlug: 'locus-logistics',
        mapping: expect.objectContaining({ companyId: 'locus-sh' }),
      }),
    );
  });

  it('addPublishedOrgChartAlias is idempotent when alias already exists', async () => {
    const { service } = createService();

    const row = await service.addPublishedOrgChartAlias({
      sourcePublishSlug: 'locus',
      newPublishSlug: 'locus-sh',
    });

    expect(row.publishSlug).toBe('locus-sh');
    expect(row.companyId).toBe('locus-sh');
  });

  it('addPublishedOrgChartAlias rejects slug used by another company', async () => {
    const { service, slugMappings } = createService();

    slugMappings.set('dista', {
      companyId: '51628472',
      companyName: 'Dista',
      workspaceId: 'workspace-1',
      publishedAt: '2026-07-11T00:00:00.000Z',
      expiresAt: null,
    });

    await expect(
      service.addPublishedOrgChartAlias({
        sourcePublishSlug: 'locus',
        newPublishSlug: 'dista',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('renamePublishedOrgChartSlug moves mapping to the new slug', async () => {
    const { service, slugMappings, orgChartPublishedSlugService } =
      createService();

    const row = await service.renamePublishedOrgChartSlug({
      publishSlug: 'locus',
      newPublishSlug: 'locus-brand',
    });

    expect(row.publishSlug).toBe('locus-brand');
    expect(slugMappings.has('locus')).toBe(false);
    expect(slugMappings.has('locus-brand')).toBe(true);
    expect(orgChartPublishedSlugService.deletePublishedSlugMapping).toHaveBeenCalledWith(
      'locus',
    );
  });

  it('renamePublishedOrgChartSlug rejects invalid slug', async () => {
    const { service } = createService();

    await expect(
      service.renamePublishedOrgChartSlug({
        publishSlug: 'locus',
        newPublishSlug: 'Bad Slug!',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('deletePublishedOrgChartSlug removes mapping only', async () => {
    const { service, slugMappings, orgChartPublishedSlugService } =
      createService();

    await expect(service.deletePublishedOrgChartSlug('locus')).resolves.toBe(true);
    expect(slugMappings.has('locus')).toBe(false);
    expect(slugMappings.has('locus-sh')).toBe(true);
    expect(orgChartPublishedSlugService.deletePublishedSlugMapping).toHaveBeenCalledWith(
      'locus',
    );
  });

  it('deletePublishedOrgChartSlug throws when slug is missing', async () => {
    const { service } = createService();

    await expect(service.deletePublishedOrgChartSlug('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
