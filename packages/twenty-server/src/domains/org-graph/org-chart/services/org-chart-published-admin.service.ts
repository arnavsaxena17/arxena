import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { OrgChartData } from 'twenty-shared';

import { AdminPublishedOrgChart } from 'src/engine/core-modules/admin-panel/dtos/admin-published-org-chart.output';
import { UpdateAdminPublishedOrgChartInput } from 'src/engine/core-modules/admin-panel/dtos/update-admin-published-org-chart.input';

import { applyOrgChartCompanyMetadata } from '../utils/apply-org-chart-company-metadata.util';
import {
  validatePublishSlug,
  type OrgPublishedSlugMapping,
} from '../utils/org-chart-published-slug.util';
import { OrgChartService } from './org-chart.service';
import { OrgChartLinkedInBuildService } from './org-chart-linkedin-build.service';
import { OrgChartPublishedSlugService } from './org-chart-published-slug.service';
import { OrgChartS3Service } from './orgchart-s3.service';

@Injectable()
export class OrgChartPublishedAdminService {
  private readonly logger = new Logger(OrgChartPublishedAdminService.name);

  constructor(
    private readonly orgChartPublishedSlugService: OrgChartPublishedSlugService,
    private readonly orgChartService: OrgChartService,
    private readonly orgChartS3Service: OrgChartS3Service,
    private readonly orgChartLinkedInBuildService: OrgChartLinkedInBuildService,
  ) {}

  async listPublishedOrgCharts(): Promise<AdminPublishedOrgChart[]> {
    const publishSlugs =
      await this.orgChartPublishedSlugService.listPublishedSlugs();

    this.logger.log(
      `Listing ${publishSlugs.length} published org chart slug(s) for admin panel`,
    );

    const rows = await Promise.all(
      publishSlugs.map((publishSlug) => this.buildPublishedOrgChartRow(publishSlug)),
    );

    return rows.filter((row): row is AdminPublishedOrgChart => row !== null);
  }

  async updatePublishedOrgChart(
    input: UpdateAdminPublishedOrgChartInput,
  ): Promise<AdminPublishedOrgChart> {
    const publishSlug = input.publishSlug.trim();

    if (!publishSlug) {
      throw new NotFoundException('Published org chart not found');
    }

    const mapping = await this.getPublishedSlugMapping(publishSlug);

    if (!mapping?.companyId?.trim()) {
      throw new NotFoundException('Published org chart not found');
    }

    const persistedCompanyId = mapping.companyId.trim();
    const orgChart =
      await this.orgChartService.getOrgChartFromS3WithAliasLookup(
        persistedCompanyId,
      );

    if (!orgChart) {
      throw new NotFoundException(
        `No orgchart.json found in S3 for companyId=${persistedCompanyId}`,
      );
    }

    const updatedOrgChart = this.applyEditableFieldsToOrgChart(orgChart, input);

    await this.orgChartS3Service.saveOrgChart(
      persistedCompanyId,
      updatedOrgChart,
    );

    const nextCompanyName = this.readOptionalString(input.companyName);
    const mappingNeedsUpdate =
      nextCompanyName !== undefined &&
      nextCompanyName !== (mapping.companyName?.trim() ?? '');

    if (mappingNeedsUpdate) {
      const nextMapping: OrgPublishedSlugMapping = {
        ...mapping,
        companyName: nextCompanyName || undefined,
      };

      await this.orgChartPublishedSlugService.savePublishedSlugMapping({
        publishSlug,
        mapping: nextMapping,
        expiresAt: nextMapping.expiresAt ?? null,
      });
      this.logger.log(
        `Updated published slug mapping companyName for publishSlug=${publishSlug}`,
      );
    }

    this.logger.log(
      `Updated orgchart.json metadata in S3 for publishSlug=${publishSlug} companyId=${persistedCompanyId}`,
    );

    const row = await this.buildPublishedOrgChartRow(publishSlug);

    if (!row) {
      throw new NotFoundException('Published org chart not found after update');
    }

    return row;
  }

  async addPublishedOrgChartAlias(input: {
    sourcePublishSlug: string;
    newPublishSlug: string;
  }): Promise<AdminPublishedOrgChart> {
    const sourcePublishSlug = input.sourcePublishSlug.trim();
    const newPublishSlug = this.parsePublishSlug(input.newPublishSlug);

    if (!sourcePublishSlug) {
      throw new NotFoundException('Source published org chart not found');
    }

    if (sourcePublishSlug === newPublishSlug) {
      throw new BadRequestException(
        'New publish slug must differ from the source slug',
      );
    }

    const mapping = await this.getPublishedSlugMapping(sourcePublishSlug);

    if (!mapping?.companyId?.trim()) {
      throw new NotFoundException('Source published org chart not found');
    }

    const companyId = mapping.companyId.trim();
    const existingNewSlugMapping =
      await this.getPublishedSlugMapping(newPublishSlug);

    if (existingNewSlugMapping?.companyId?.trim() === companyId) {
      this.logger.log(
        `Publish slug alias already exists publishSlug=${newPublishSlug} companyId=${companyId}`,
      );

      const existingRow = await this.buildPublishedOrgChartRow(newPublishSlug);

      if (!existingRow) {
        throw new NotFoundException('Published org chart not found');
      }

      return existingRow;
    }

    await this.assertPublishSlugAvailableForCompany(newPublishSlug, companyId);

    await this.orgChartPublishedSlugService.savePublishedSlugMapping({
      publishSlug: newPublishSlug,
      mapping: {
        ...mapping,
        companyId,
      },
      expiresAt: mapping.expiresAt ?? null,
    });

    this.logger.log(
      `Added publish slug alias publishSlug=${newPublishSlug} sourcePublishSlug=${sourcePublishSlug} companyId=${companyId}`,
    );

    const row = await this.buildPublishedOrgChartRow(newPublishSlug);

    if (!row) {
      throw new NotFoundException('Published org chart not found after alias create');
    }

    return row;
  }

  async renamePublishedOrgChartSlug(input: {
    publishSlug: string;
    newPublishSlug: string;
  }): Promise<AdminPublishedOrgChart> {
    const publishSlug = input.publishSlug.trim();
    const newPublishSlug = this.parsePublishSlug(input.newPublishSlug);

    if (!publishSlug) {
      throw new NotFoundException('Published org chart not found');
    }

    if (publishSlug === newPublishSlug) {
      const unchangedRow = await this.buildPublishedOrgChartRow(publishSlug);

      if (!unchangedRow) {
        throw new NotFoundException('Published org chart not found');
      }

      return unchangedRow;
    }

    const mapping = await this.getPublishedSlugMapping(publishSlug);

    if (!mapping?.companyId?.trim()) {
      throw new NotFoundException('Published org chart not found');
    }

    const companyId = mapping.companyId.trim();

    await this.assertPublishSlugAvailableForCompany(newPublishSlug, companyId);

    await this.orgChartPublishedSlugService.savePublishedSlugMapping({
      publishSlug: newPublishSlug,
      mapping: {
        ...mapping,
        companyId,
      },
      expiresAt: mapping.expiresAt ?? null,
    });
    await this.orgChartPublishedSlugService.deletePublishedSlugMapping(
      publishSlug,
    );

    this.logger.log(
      `Renamed publish slug ${publishSlug} -> ${newPublishSlug} companyId=${companyId}`,
    );

    const row = await this.buildPublishedOrgChartRow(newPublishSlug);

    if (!row) {
      throw new NotFoundException('Published org chart not found after rename');
    }

    return row;
  }

  async deletePublishedOrgChartSlug(publishSlug: string): Promise<boolean> {
    const trimmedPublishSlug = publishSlug.trim();

    if (!trimmedPublishSlug) {
      throw new NotFoundException('Published org chart not found');
    }

    const mapping = await this.getPublishedSlugMapping(trimmedPublishSlug);

    if (!mapping?.companyId?.trim()) {
      throw new NotFoundException('Published org chart not found');
    }

    await this.orgChartPublishedSlugService.deletePublishedSlugMapping(
      trimmedPublishSlug,
    );

    this.logger.log(
      `Deleted publish slug mapping publishSlug=${trimmedPublishSlug} companyId=${mapping.companyId.trim()}`,
    );

    return true;
  }

  async rebuildPublishedOrgChart(input: {
    publishSlug: string;
    apiToken: string;
  }): Promise<AdminPublishedOrgChart> {
    const publishSlug = input.publishSlug.trim();

    if (!publishSlug) {
      throw new NotFoundException('Published org chart not found');
    }

    const mapping = await this.getPublishedSlugMapping(publishSlug);

    if (!mapping?.companyId?.trim()) {
      throw new NotFoundException('Published org chart not found');
    }

    const companyId = mapping.companyId.trim();
    const orgChart =
      await this.orgChartService.getOrgChartFromS3WithAliasLookup(companyId);
    const companyName =
      mapping.companyName?.trim() ||
      this.readOrgChartString(orgChart, 'job_company_name') ||
      companyId;

    this.logger.log(
      `Admin rebuild requested for publishSlug=${publishSlug} companyId=${companyId}`,
    );

    await this.orgChartLinkedInBuildService.rebuildOrgChartUsingSavedPeople({
      apiToken: input.apiToken,
      companyId,
      companyName,
      industry: this.readOrgChartString(orgChart, 'industry'),
      companyLinkedinUrl: this.readOrgChartString(
        orgChart,
        'job_company_linkedin_url',
      ),
    });

    const row = await this.buildPublishedOrgChartRow(publishSlug);

    if (!row) {
      throw new NotFoundException('Published org chart not found after rebuild');
    }

    this.logger.log(
      `Admin rebuild completed for publishSlug=${publishSlug} companyId=${companyId} countOrg=${row.countOrg ?? 'unknown'}`,
    );

    return row;
  }

  private async buildPublishedOrgChartRow(
    publishSlug: string,
  ): Promise<AdminPublishedOrgChart | null> {
    const mapping = await this.getPublishedSlugMapping(publishSlug);

    if (!mapping?.companyId?.trim()) {
      return null;
    }

    const companyId = mapping.companyId.trim();
    const orgChart =
      await this.orgChartService.getOrgChartFromS3WithAliasLookup(companyId);
    const hasOrgChartInS3 = orgChart !== null;

    return {
      publishSlug,
      companyId:
        this.readOrgChartString(orgChart, 'company_id') ??
        this.readOrgChartString(orgChart, 'job_company_id') ??
        companyId,
      companyName:
        mapping.companyName?.trim() ||
        this.readOrgChartString(orgChart, 'job_company_name'),
      companyLinkedinUrl: this.readOrgChartString(
        orgChart,
        'job_company_linkedin_url',
      ),
      companyWebsite: this.readOrgChartString(orgChart, 'job_company_website'),
      industry: this.readOrgChartString(orgChart, 'industry'),
      country: this.readOrgChartString(orgChart, 'country'),
      countOrg: this.readOrgChartNumber(orgChart, 'count_org'),
      publishedAt: mapping.publishedAt,
      workspaceId: mapping.workspaceId,
      hasOrgChartInS3,
      s3RelativePath: hasOrgChartInS3
        ? `${this.orgChartS3Service.buildRelativeFolderPathFromPersistedKey(companyId)}/orgchart.json`
        : undefined,
    };
  }

  private applyEditableFieldsToOrgChart(
    orgChart: OrgChartData,
    input: UpdateAdminPublishedOrgChartInput,
  ): OrgChartData {
    const companyName = this.readOptionalString(input.companyName);
    const companyId = this.readOptionalString(input.companyId);
    const industry = this.readOptionalString(input.industry);
    const country = this.readOptionalString(input.country);

    let nextOrgChart = applyOrgChartCompanyMetadata(orgChart, {
      website: this.readOptionalString(input.companyWebsite),
      linkedinCompanyUrl: this.readOptionalString(input.companyLinkedinUrl),
    });

    nextOrgChart = {
      ...nextOrgChart,
      ...(companyName !== undefined ? { job_company_name: companyName } : {}),
      ...(companyId !== undefined
        ? {
            company_id: companyId,
            job_company_id: companyId,
          }
        : {}),
      ...(industry !== undefined ? { industry } : {}),
      ...(country !== undefined ? { country } : {}),
    };

    return nextOrgChart;
  }

  private async getPublishedSlugMapping(
    publishSlug: string,
  ): Promise<OrgPublishedSlugMapping | null> {
    return this.orgChartPublishedSlugService.getPublishedSlugMapping(
      publishSlug,
    );
  }

  private parsePublishSlug(raw: string): string {
    const validation = validatePublishSlug(raw);

    if (!validation.ok) {
      throw new BadRequestException(validation.message);
    }

    return validation.slug;
  }

  private async assertPublishSlugAvailableForCompany(
    publishSlug: string,
    companyId: string,
  ): Promise<void> {
    const existingMapping = await this.getPublishedSlugMapping(publishSlug);
    const existingCompanyId = existingMapping?.companyId?.trim() ?? '';

    if (existingCompanyId && existingCompanyId !== companyId) {
      throw new ConflictException(
        'This publish slug is already used by another company',
      );
    }
  }

  private readOptionalString(value: string | null | undefined): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }

    const trimmed = value.trim();

    return trimmed.length > 0 ? trimmed : '';
  }

  private readOrgChartString(
    orgChart: OrgChartData | null,
    key: string,
  ): string | undefined {
    if (!orgChart) {
      return undefined;
    }

    const value = orgChart[key];

    if (typeof value !== 'string') {
      return undefined;
    }

    const trimmed = value.trim();

    return trimmed.length > 0 ? trimmed : undefined;
  }

  private readOrgChartNumber(
    orgChart: OrgChartData | null,
    key: string,
  ): number | undefined {
    if (!orgChart) {
      return undefined;
    }

    const value = orgChart[key];

    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return undefined;
    }

    return Math.floor(value);
  }
}
