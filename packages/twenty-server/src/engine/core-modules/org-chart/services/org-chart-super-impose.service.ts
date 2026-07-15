import { Injectable, Logger } from '@nestjs/common';

import { hasOrgChartLinkedInSubsetScopeFilter } from 'src/engine/core-modules/org-chart/utils/orgchart-linkedin-scope.util';
import { getLinkedInUnipileSearchPageLimit } from 'twenty-shared';

import { LinkedinUnipileEstimateAccountService } from 'src/engine/core-modules/arx-chat/services/linkedin-unipile-estimate-account.service';
import { LinkedinUnipileSessionService } from 'src/engine/core-modules/arx-chat/services/linkedin-unipile-session.service';
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
  normalizeLinkedinCompanyUrl,
  resolveSuperImposeLinkedinCompanyParameterIds,
} from 'src/engine/core-modules/org-chart/utils/super-impose-input-resolver.util';

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
  leadershipOnly?: boolean;
  linkedinSearchKeywords?: string;
  candidateSource: 'harvest' | 'unipile';
  searchType?: 'classic' | 'sales_navigator' | 'recruiter';
  linkedinUnipileAccountId?: string;
  linkedinLocationId?: string;
  linkedinLocationName?: string;
  linkedinCompanyParameterId?: string;
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
    private readonly linkedinUnipileSessionService: LinkedinUnipileSessionService,
    private readonly linkedinUnipileEstimateAccountService: LinkedinUnipileEstimateAccountService,
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

    const targetCompany = args.inputs.targetCompany;
    if (targetCompany?.linkedinCompanyUrl?.trim()) {
      addCompany(
        buildResolvedCompanyFromUrl(
          targetCompany.linkedinCompanyUrl,
          'primary_chart',
          targetCompany.title,
        ),
      );
    } else if (args.primaryLinkedinCompanyUrl?.trim()) {
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
      leadershipOnly: context.leadershipOnly,
      candidateSource: context.candidateSource,
      searchType: context.searchType,
      primaryCompanyName: context.primaryCompanyName,
      apiToken: context.apiToken,
      linkedinUnipileAccountId: context.linkedinUnipileAccountId,
      linkedinLocationId: context.linkedinLocationId,
      linkedinLocationName: context.linkedinLocationName,
      linkedinCompanyParameterId: context.linkedinCompanyParameterId,
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
    let unipileLinkedInEstimate:
      | Awaited<
          ReturnType<OrgChartSearchService['estimateLinkedInOrgChartSearch']>
        >
      | undefined;

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
      const apiToken = plan.apiToken ?? '';
      if (!apiToken.trim()) {
        throw new Error('API token is required for Unipile super-impose estimate');
      }

      await this.linkedinUnipileEstimateAccountService.withEstimateLinkedinSession(
        apiToken,
        plan.linkedinUnipileAccountId,
        async (session) => {
      for (const salesNavUrl of plan.salesNavigatorSearchUrls) {
        const slug = salesNavUrl.slice(0, 40);
        try {
          const count = await this.estimateUnipileSalesNavUrlTotal(
            salesNavUrl,
            session.accountId,
          );
          perSource.push({ slug, sourceType: 'linkedin_search', count });
          estimatedTotalUpperBound += count;
        } catch (error) {
          this.logger.warn(
            `Unipile super-impose Sales Navigator estimate failed: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
          perSource.push({
            slug,
            sourceType: 'linkedin_search',
            count: 0,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
      if (
        plan.salesNavigatorSearchUrls.length === 0 &&
        plan.resolvedCompanies.length > 0 &&
        plan.candidateSource === 'unipile'
      ) {
        const companySearchNames = plan.companySearchNames;
        const primaryCompany = plan.resolvedCompanies[0];
        const searchLabel = companySearchNames.join(', ');
        try {
          const companyParameterIds =
            resolveSuperImposeLinkedinCompanyParameterIds(
              plan.resolvedCompanies,
              plan.linkedinCompanyParameterId,
            );
          const estimate =
            await this.orgChartSearchService.estimateLinkedInOrgChartSearch(
              `Employees at ${searchLabel}`,
              `Employees at ${searchLabel}`,
              plan.searchType,
              apiToken,
              {
                mode: plan.mode,
                companyName:
                  primaryCompany.companyName ?? primaryCompany.slug ?? searchLabel,
                companyNames: companySearchNames,
                companyId: primaryCompany.slug,
                country: plan.country,
                functionRoot: plan.functionRoot,
                linkedinUnipileAccountId: session.accountId,
                linkedinLocationId: plan.linkedinLocationId,
                linkedinLocationName: plan.linkedinLocationName,
                linkedinCompanyParameterId: plan.linkedinCompanyParameterId,
                linkedinCompanyParameterIds:
                  companyParameterIds.length > 0
                    ? companyParameterIds
                    : undefined,
                linkedinKeywords: plan.mergedSearchClause,
                leadershipOnly: plan.leadershipOnly,
              },
            );
          unipileLinkedInEstimate = estimate;
          perSource.push({
            slug: plan.resolvedCompanies.map((company) => company.slug).join('+'),
            sourceType: 'company_page',
            count: estimate.estimatedTotalUpperBound,
          });
          estimatedTotalUpperBound = estimate.estimatedTotalUpperBound;
        } catch (error) {
          this.logger.warn(
            `Unipile super-impose estimate failed: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
          perSource.push({
            slug: plan.resolvedCompanies.map((company) => company.slug).join('+'),
            sourceType: 'company_page',
            count: 0,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      } else {
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
        },
      );
    }

    const threshold = this.getSuperImposeThreshold();
    const estimatedTotal = unipileLinkedInEstimate
      ? unipileLinkedInEstimate.estimatedTotal
      : Math.max(0, Math.round(estimatedTotalUpperBound * 0.9));
    const scopeRequired =
      unipileLinkedInEstimate?.scopeRequired === true ||
      (estimatedTotalUpperBound > threshold &&
        !hasOrgChartLinkedInSubsetScopeFilter(
          plan.country,
          plan.functionRoot,
          plan.linkedinLocationId,
          plan.leadershipOnly,
        ));

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

    return this.linkedinUnipileSessionService.withLinkedinSession(
      context.apiToken,
      context.linkedinUnipileAccountId,
      async (session) => {
        const aggregatedInSession: Array<Record<string, unknown>> = [];

    for (const salesNavUrl of plan.salesNavigatorSearchUrls) {
      await context.onProgress?.('Unipile: fetching Sales Navigator URL...');
      const snRows = await this.fetchUnipileSearchUrlCandidates({
        url: salesNavUrl,
        accountId: session.accountId,
        companyName: context.primaryCompanyName,
        maxProfiles: context.maxProfiles,
        fetchSource: 'linkedin_search',
        searchType: plan.searchType,
      });
      aggregatedInSession.push(...snRows);
    }

    if (plan.salesNavigatorSearchUrls.length === 0 && plan.companySearchNames.length > 0) {
      const primaryCompany = plan.resolvedCompanies[0];
      const searchLabel = plan.companySearchNames.join(', ');
      await context.onProgress?.(
        `Unipile: fetching employees for ${searchLabel}...`,
      );
      const companyParameterIds = resolveSuperImposeLinkedinCompanyParameterIds(
        plan.resolvedCompanies,
        plan.linkedinCompanyParameterId ?? context.linkedinCompanyParameterId,
      );
      const searchResult =
        await this.orgChartSearchService.runOrgchartLinkedInSearch(
          `Employees at ${searchLabel}`,
          `Employees at ${searchLabel}`,
          plan.searchType,
          context.apiToken,
          undefined,
          {
            mode: plan.mode,
            companyName:
              primaryCompany?.companyName ??
              primaryCompany?.slug ??
              searchLabel,
            companyNames: plan.companySearchNames,
            companyId: primaryCompany?.slug,
            country: context.country,
            functionRoot: context.functionRoot,
            linkedinCompanyUrl: primaryCompany?.linkedinUrl,
            linkedinUnipileAccountId: session.accountId,
            businessDivisionRawQuery: context.businessDivisionRawQuery,
            linkedinLocationId: plan.linkedinLocationId ?? context.linkedinLocationId,
            linkedinLocationName:
              plan.linkedinLocationName ?? context.linkedinLocationName,
            linkedinCompanyParameterId:
              plan.linkedinCompanyParameterId ?? context.linkedinCompanyParameterId,
            linkedinCompanyParameterIds:
              companyParameterIds.length > 0 ? companyParameterIds : undefined,
            linkedinKeywords: plan.mergedSearchClause,
            leadershipOnly: plan.leadershipOnly,
          },
        );
      const items = Array.isArray(searchResult.items)
        ? (searchResult.items as Array<Record<string, unknown>>)
        : [];
      aggregatedInSession.push(
        ...items.map((row) =>
          this.tagSuperImposeRow(
            row,
            'company_page',
            plan.resolvedCompanies.map((company) => company.slug).join('+'),
          ),
        ),
      );
    }

    return aggregatedInSession;
      },
    );
  }

  private async estimateUnipileSalesNavUrlTotal(
    url: string,
    accountId: string,
  ): Promise<number> {
    const response = await this.linkedInSearchService.searchFromUrl(
      url,
      accountId,
      { limit: 1 },
    );

    return response.paging?.total_count ?? response.items.length;
  }

  private async fetchUnipileSearchUrlCandidates(input: {
    url: string;
    accountId: string;
    companyName: string;
    maxProfiles?: number;
    fetchSource: SuperImposeFetchSource;
    searchType: 'classic' | 'sales_navigator' | 'recruiter';
  }): Promise<Array<Record<string, unknown>>> {
    const maxProfiles = Math.max(1, Math.min(2500, input.maxProfiles ?? 500));
    const pageLimit = getLinkedInUnipileSearchPageLimit(input.searchType);
    const out: Array<Record<string, unknown>> = [];
    let cursor: string | undefined;
    let page = 0;

    while (out.length < maxProfiles) {
      page += 1;
      const response = cursor
        ? await this.linkedInSearchService.searchWithCursor(cursor, input.accountId, {
            limit: pageLimit,
          })
        : await this.linkedInSearchService.searchFromUrl(input.url, input.accountId, {
            limit: pageLimit,
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
