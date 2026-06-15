import { Injectable, Logger } from '@nestjs/common';

import { WorkspaceMemberProfileUnipileService } from 'src/engine/core-modules/arx-chat/services/workspace-member-profile-unipile.service';
import { OrgChartSearchService } from 'src/engine/core-modules/candidate-search/services/orgchart-search.service';
import { DataSourceTransformerFactoryService } from 'src/engine/core-modules/candidate-sourcing/services/data-source-transformer-factory.service';
import { LinkedInSearchService } from 'src/engine/core-modules/linkedin-search/services/linkedin-search.service';
import { HarvestLinkedinTransformerService } from 'src/engine/core-modules/org-chart/services/harvest-linkedin-transformer.service';
import { HarvestLinkedinService } from 'src/engine/core-modules/org-chart/services/harvest-linkedin.service';
import { OrgChartService } from 'src/engine/core-modules/org-chart/services/org-chart.service';
import { SuperImposeQueryBuilderService } from 'src/engine/core-modules/org-chart/services/super-impose-query-builder.service';
import type {
  SuperImposeEstimatePerSource,
  SuperImposeEstimateResult,
  SuperImposeFetchSource,
  SuperImposeInputs,
  SuperImposeQueryPlan,
  SuperImposeResolvedCompany,
} from 'src/engine/core-modules/org-chart/types/super-impose.types';
import {
  buildResolvedCompanyFromUrl,
  isValidLinkedinCompanyPageUrl,
  isValidSalesNavigatorPeopleSearchUrl,
  normalizeLinkedinCompanyUrl
} from 'src/engine/core-modules/org-chart/utils/super-impose-input-resolver.util';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';

export type ResolveSuperImposeInputsArgs = {
  inputs: SuperImposeInputs;
  primaryCompanyId?: string;
  primaryCompanyName?: string;
  primaryLinkedinCompanyUrl?: string;
  apiToken?: string;
};

export type SuperImposeFetchContext = {
  apiToken: string;
  primaryCompanyName: string;
  companyId?: string;
  country?: string;
  functionRoot?: string;
  businessDivisionRawQuery?: string;
  linkedinSearchKeywords?: string;
  candidateSource: 'harvest' | 'unipile';
  searchType?: 'classic' | 'sales_navigator' | 'recruiter';
  linkedinUnipileAccountId?: string;
  maxProfiles?: number;
  onProgress?: (message: string) => void | Promise<void>;
};

@Injectable()
export class OrgChartSuperImposeService {
  private readonly logger = new Logger(OrgChartSuperImposeService.name);

  constructor(
    private readonly orgChartService: OrgChartService,
    private readonly superImposeQueryBuilderService: SuperImposeQueryBuilderService,
    private readonly harvestLinkedinService: HarvestLinkedinService,
    private readonly harvestLinkedinTransformer: HarvestLinkedinTransformerService,
    private readonly linkedInSearchService: LinkedInSearchService,
    private readonly orgChartSearchService: OrgChartSearchService,
    private readonly workspaceMemberProfileUnipileService: WorkspaceMemberProfileUnipileService,
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly dataSourceTransformerFactory: DataSourceTransformerFactoryService,
  ) {}

  async resolveInputs(
    args: ResolveSuperImposeInputsArgs,
  ): Promise<{
    resolvedCompanies: SuperImposeResolvedCompany[];
    salesNavigatorSearchUrls: string[];
    errors: string[];
  }> {
    const errors: string[] = [];
    const resolvedCompanies: SuperImposeResolvedCompany[] = [];
    const seenSlugs = new Set<string>();

    const addCompany = (company: SuperImposeResolvedCompany | null) => {
      if (!company || seenSlugs.has(company.slug)) {
        return;
      }
      seenSlugs.add(company.slug);
      resolvedCompanies.push(company);
    };

    if (args.primaryLinkedinCompanyUrl?.trim()) {
      addCompany(
        buildResolvedCompanyFromUrl(
          args.primaryLinkedinCompanyUrl,
          'primary_chart',
          args.primaryCompanyName,
        ),
      );
    } else if (args.primaryCompanyId?.trim()) {
      const url = normalizeLinkedinCompanyUrl(args.primaryCompanyId);
      if (url) {
        addCompany(
          buildResolvedCompanyFromUrl(url, 'primary_chart', args.primaryCompanyName),
        );
      }
    }

    for (const rawUrl of args.inputs.linkedinCompanyUrls ?? []) {
      if (!isValidLinkedinCompanyPageUrl(rawUrl)) {
        errors.push(`Invalid LinkedIn company URL: ${rawUrl}`);
        continue;
      }
      addCompany(buildResolvedCompanyFromUrl(rawUrl, 'linkedin_url'));
    }

    for (const websiteUrl of args.inputs.websiteUrls ?? []) {
      try {
        const domain = this.extractDomainFromWebsiteUrl(websiteUrl);
        if (!domain) {
          errors.push(`Invalid website URL: ${websiteUrl}`);
          continue;
        }
        const resolved = await this.orgChartService.resolveCompanyByDomain(domain);
        if (!resolved.found || !resolved.companyId) {
          errors.push(`Could not resolve website to company: ${websiteUrl}`);
          continue;
        }
        const linkedinUrl =
          normalizeLinkedinCompanyUrl(resolved.companyId) ??
          `https://www.linkedin.com/company/${resolved.companyId}/`;
        addCompany(
          buildResolvedCompanyFromUrl(
            linkedinUrl,
            'website_url',
            resolved.companyName,
          ),
        );
      } catch (error) {
        errors.push(
          `Failed to resolve ${websiteUrl}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    const salesNavigatorSearchUrls = (args.inputs.salesNavigatorSearchUrls ?? [])
      .map((url) => url.trim())
      .filter((url) => url.length > 0)
      .filter((url) => {
        if (!isValidSalesNavigatorPeopleSearchUrl(url)) {
          errors.push(`Invalid Sales Navigator URL: ${url}`);
          return false;
        }
        return true;
      });

    return {
      resolvedCompanies: resolvedCompanies,
      salesNavigatorSearchUrls,
      errors,
    };
  }

  async buildQueryPlanFromContext(
    context: SuperImposeFetchContext,
    resolvedCompanies: SuperImposeResolvedCompany[],
    salesNavigatorSearchUrls: string[],
  ): Promise<SuperImposeQueryPlan> {
    return this.superImposeQueryBuilderService.buildQueryPlan({
      resolvedCompanies,
      salesNavigatorSearchUrls,
      linkedinSearchKeywords: context.linkedinSearchKeywords,
      businessDivisionRawQuery: context.businessDivisionRawQuery,
      country: context.country,
      functionRoot: context.functionRoot,
      candidateSource: context.candidateSource,
      searchType: context.searchType,
      primaryCompanyName: context.primaryCompanyName,
      apiToken: context.apiToken,
    });
  }

  getSuperImposeThreshold(): number {
    const raw = Number(process.env.SUPER_IMPOSE_MAX_CANDIDATES ?? '500');
    return Number.isFinite(raw) && raw > 0 ? raw : 500;
  }

  async estimateFromPlan(
    plan: SuperImposeQueryPlan,
  ): Promise<SuperImposeEstimateResult> {
    const perSource: SuperImposeEstimatePerSource[] = [];
    let estimatedTotalUpperBound = 0;

    if (plan.candidateSource === 'harvest') {
      for (const batch of plan.harvestBatches) {
        const sourceType: SuperImposeFetchSource = batch.salesNavUrl
          ? 'linkedin_search'
          : 'company_page';
        const slug =
          batch.salesNavUrl?.slice(0, 40) ??
          batch.currentCompanies?.split(',')[0] ??
          'batch';
        try {
          const count =
            await this.harvestLinkedinService.estimateLeadSearchTotalElements(
              batch,
            );
          perSource.push({ slug, sourceType, count });
          estimatedTotalUpperBound += count;
        } catch (error) {
          perSource.push({
            slug,
            sourceType,
            count: 0,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    } else {
      for (const salesNavUrl of plan.salesNavigatorSearchUrls) {
        perSource.push({
          slug: 'sales-nav-url',
          sourceType: 'linkedin_search',
          count: 0,
          error: 'Unipile estimate requires account; use build to fetch',
        });
      }
      for (const company of plan.resolvedCompanies) {
        if (plan.salesNavigatorSearchUrls.length > 0) {
          continue;
        }
        perSource.push({
          slug: company.slug,
          sourceType: 'company_page',
          count: company.slug.length > 0 ? 50 : 0,
        });
        estimatedTotalUpperBound += 50;
      }
    }

    const estimatedTotal = Math.max(
      0,
      Math.round(estimatedTotalUpperBound * 0.9),
    );
    const threshold = this.getSuperImposeThreshold();
    const scopeRequired =
      estimatedTotalUpperBound > threshold && plan.mode === 'entire_company';

    return {
      estimatedTotal:
        estimatedTotalUpperBound > 0 ? estimatedTotal : estimatedTotalUpperBound,
      estimatedTotalUpperBound,
      perSource,
      threshold,
      thresholdExceeded: estimatedTotalUpperBound > threshold,
      scopeRequired,
    };
  }

  async fetchCandidatesForPlan(
    plan: SuperImposeQueryPlan,
    context: SuperImposeFetchContext,
  ): Promise<Array<Record<string, unknown>>> {
    const aggregated: Array<Record<string, unknown>> = [];

    if (plan.candidateSource === 'harvest') {
      for (const batch of plan.harvestBatches) {
        const fetchSource: SuperImposeFetchSource = batch.salesNavUrl
          ? 'linkedin_search'
          : 'company_page';
        await context.onProgress?.(
          batch.salesNavUrl
            ? 'Harvest: fetching Sales Navigator URL results...'
            : `Harvest: fetching company batch (${batch.currentCompanies?.split(',').length ?? 0} companies)...`,
        );
        const leads = await this.harvestLinkedinService.fetchAllLeadsFromQueryParams(
          {
            params: batch,
            maxProfiles: context.maxProfiles,
            onProgress: context.onProgress,
          },
        );
        const companyUrl =
          batch.currentCompanies?.split(',')[0] ??
          context.primaryCompanyName;
        const rows = this.harvestLinkedinTransformer.transformCurrentLeadsToCandidates(
          leads,
          context.primaryCompanyName,
          companyUrl,
        );
        aggregated.push(
          ...rows.map((row) =>
            this.tagSuperImposeRow(row, fetchSource, batch.currentCompanies),
          ),
        );
      }
      return aggregated;
    }

    const accountId = await this.resolveUnipileAccountId(context);

    for (const salesNavUrl of plan.salesNavigatorSearchUrls) {
      await context.onProgress?.('Unipile: fetching Sales Navigator URL...');
      const snRows = await this.fetchUnipileSearchUrlCandidates({
        url: salesNavUrl,
        accountId,
        companyName: context.primaryCompanyName,
        maxProfiles: context.maxProfiles,
        fetchSource: 'linkedin_search',
      });
      aggregated.push(...snRows);
    }

    if (plan.salesNavigatorSearchUrls.length === 0) {
      for (const company of plan.resolvedCompanies) {
        await context.onProgress?.(
          `Unipile: fetching employees for ${company.slug}...`,
        );
        const searchResult =
          await this.orgChartSearchService.runOrgchartLinkedInSearch(
            `Employees at ${company.companyName ?? company.slug}`,
            `Employees at ${company.companyName ?? company.slug}`,
            plan.searchType,
            context.apiToken,
            undefined,
            {
              mode: plan.mode,
              companyName: company.companyName ?? company.slug,
              companyId: company.slug,
              country: context.country,
              functionRoot: context.functionRoot,
              linkedinCompanyUrl: company.linkedinUrl,
              linkedinUnipileAccountId: context.linkedinUnipileAccountId,
              businessDivisionRawQuery: context.businessDivisionRawQuery,
            },
          );
        const items = Array.isArray(searchResult.items)
          ? (searchResult.items as Array<Record<string, unknown>>)
          : [];
        aggregated.push(
          ...items.map((row) =>
            this.tagSuperImposeRow(row, 'company_page', company.slug),
          ),
        );
      }
    }

    return aggregated;
  }

  private async fetchUnipileSearchUrlCandidates(input: {
    url: string;
    accountId: string;
    companyName: string;
    maxProfiles?: number;
    fetchSource: SuperImposeFetchSource;
  }): Promise<Array<Record<string, unknown>>> {
    const maxProfiles = Math.max(1, Math.min(2500, input.maxProfiles ?? 500));
    const out: Array<Record<string, unknown>> = [];
    let cursor: string | undefined;
    let page = 0;

    while (out.length < maxProfiles) {
      page += 1;
      const response = cursor
        ? await this.linkedInSearchService.searchWithCursor(cursor, input.accountId, {
            limit: 25,
          })
        : await this.linkedInSearchService.searchFromUrl(input.url, input.accountId, {
            limit: 25,
          });

      const items = Array.isArray(response.items) ? response.items : [];
      for (const item of items) {
        const transformed =
          await this.dataSourceTransformerFactory.transformCandidateData(
            item,
            'linkedin_sales_navigator',
            {
              jobId: 'super_impose',
              jobName: input.companyName,
              userId: 'super_impose',
              timestamp: new Date().toISOString(),
            },
          );
        if (transformed) {
          out.push(
            this.tagSuperImposeRow(
              transformed as unknown as Record<string, unknown>,
              input.fetchSource,
              undefined,
            ),
          );
        }
      }

      if (!response.cursor || items.length === 0) {
        break;
      }
      cursor = response.cursor;
      if (page >= 100) {
        break;
      }
    }

    return out.slice(0, maxProfiles);
  }

  private tagSuperImposeRow(
    row: Record<string, unknown>,
    fetchSource: SuperImposeFetchSource,
    sourceSlug?: string,
  ): Record<string, unknown> {
    return {
      ...row,
      super_impose_fetch_source: fetchSource,
      ...(sourceSlug ? { super_impose_source_slug: sourceSlug } : {}),
    };
  }

  private async resolveUnipileAccountId(
    context: SuperImposeFetchContext,
  ): Promise<string> {
    if (context.linkedinUnipileAccountId?.trim()) {
      return context.linkedinUnipileAccountId.trim();
    }

    const workspaceId =
      await this.workspaceQueryService.getWorkspaceIdFromToken(context.apiToken);
    const workspaceMemberId =
      await this.workspaceQueryService.getWorkspaceMemberIdFromToken(
        context.apiToken,
      );
    const accountId =
      await this.workspaceMemberProfileUnipileService.getWorkspaceMemberUnipileAccountId(
        workspaceMemberId ?? null,
        workspaceId,
        context.apiToken,
        'linkedin',
      );
    if (!accountId?.trim()) {
      throw new Error('LinkedIn Unipile account is not connected');
    }
    return accountId.trim();
  }

  private extractDomainFromWebsiteUrl(websiteUrl: string): string | null {
    try {
      const url = websiteUrl.includes('://')
        ? new URL(websiteUrl)
        : new URL(`https://${websiteUrl}`);
      return url.hostname.replace(/^www\./, '').toLowerCase() || null;
    } catch {
      return null;
    }
  }
}
