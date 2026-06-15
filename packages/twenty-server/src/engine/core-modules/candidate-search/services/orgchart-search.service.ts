import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { CandidateAvatarStorageService } from 'src/engine/core-modules/candidate-avatar/services/candidate-avatar-storage.service';
import { OrgChartIntentService } from 'src/engine/core-modules/candidate-search/services/org-chart-intent.service';
import type { TransformedCandidateForTable } from 'src/engine/core-modules/candidate-sourcing/services/data-sources/linkedin-search-transformer.service';
import { OrgChartProgressRedisService } from 'src/engine/core-modules/candidate-sourcing/services/orgchart-progress-redis.service';
import { OrgChartLinkedInScopeRequiredError } from 'src/engine/core-modules/org-chart/errors/orgchart-linkedin-scope-required.error';
import { OrgChartProfileDataSourceMapperService } from 'src/engine/core-modules/org-chart/services/org-chart-profile-data-source-mapper.service';
import { OrgChartCacheService } from 'src/engine/core-modules/org-chart/services/orgchart-cache.service';
import { OrgchartCancelRegistryService } from 'src/engine/core-modules/org-chart/services/orgchart-cancel-registry.service';
import { PythonOrgChartService } from 'src/engine/core-modules/org-chart/services/python-org-chart.service';
import type { OrgChartLinkedinCandidateSource } from 'src/engine/core-modules/org-chart/types/orgchart-linkedin-candidate-source.type';
import { mergeOrgChartCompanyTenureOntoOrgChartData } from 'src/engine/core-modules/org-chart/utils/merge-orgchart-company-tenure.util';
import {
  applyApolloOnlyNodeLockState,
  assignApolloPublicSlugToAllPersonSlots,
  backfillUnmappedLinkedInSlotsWithApolloSlug,
  mergeContactAvailabilityOntoOrgChartData,
  mergeContactAvailabilityOntoOrgChartDataByPersonId,
  mergeProfileSourceSlugsOntoOrgChartData,
  normalizeOrgChartLinkedinUrlKey,
  ORGCHART_DATA_SOURCE_SLUG_APOLLO,
  readProviderContactHintsFromSearchRow,
  type OrgChartNodeContactAvailability,
} from 'src/engine/core-modules/org-chart/utils/merge-orgchart-profile-source-slugs.util';
import { hasMeaningfulOrgChartFunctionRootFilter } from 'src/engine/core-modules/org-chart/utils/orgchart-filter.util';
import {
  computeOrgChartLinkedInMaxPages,
  computeOrgChartLinkedInSearchPlan,
  getOrgChartLinkedInMaxCandidates,
  hasOrgChartLinkedInSubsetScopeFilter,
} from 'src/engine/core-modules/org-chart/utils/orgchart-linkedin-scope.util';
import { filterOrgChartCandidatesByNodeStdLabels } from 'src/engine/core-modules/org-chart/utils/orgchart-node-scope-filter.util';
import {
  normalizeCountry,
  normalizeFunctionRoot,
} from 'src/engine/core-modules/org-chart/utils/orgchart-normalization.util';
import { OrgChartData } from 'twenty-shared';
import {
  applyAsOfSnapshotToCandidates,
  applyEntireCompanyExperienceTitlesToCandidates,
  companyTenureFromDerivedExperience,
} from '../../org-chart/utils/orgchart-asof-snapshot.util';
import { extractLinkedinProfileUrlFromOrgChartCandidateRow } from '../../org-chart/utils/orgchart-candidate-linkedin-url.util';
import { WorkspaceQueryService } from '../../workspace-modifications/workspace-modifications.service';
import type { PeopleSearchStrategyResult } from '../utils/extract-strategies.util';
import { LinkedinParameterResolver } from '../utils/linkedin-parameter-resolver.util';
import { mergeFilters } from '../utils/org-chart-filters-merge.util';
import { constructSearchParamKey } from '../utils/search-parameter.utils';
import { buildTitleTaxonomyResolvedIntent } from '../utils/title-taxonomy-resolved-intent.util';
import { CandidateSearchBaseService } from './candidate-search-base.service';
import {
  OrgchartLinkedInQueryRouterService,
  type OrgchartQueryGeneratorPreference,
} from './orgchart-linkedin-query-router.service';
import { SearchExecutionService } from './search-execution.service';

type OrgChartCandidateInput = TransformedCandidateForTable | Record<string, unknown>;

type StandardizedOrgChartPerson = {
  full_name: string;
  job_title: string;
  job_company_linkedin_url: string;
  job_company_id: string;
  job_company_name: string;
  industry: string;
  country: string;
  job_company_website: string;
  linkedin_url: string;
  facebook_url: string;
  twitter_url: string;
  gender: string;
  location_country: string;
  location_region: string;
  location_locality: string;
  location_metro: string;
  location_name: string;
  inferred_salary: string;
  inferred_years_experience: string;
  emails: string;
  phone_numbers: string;
  profile_picture_url: string;
  id: string;
};

type SearchExecutionResult = {
  itemCount: number;
  searchResults: unknown;
  transformedCandidates?: unknown[];
  searchMetadata?: unknown;
  validationResults?: unknown[];
  overallValidation?: unknown;
  error?: { message: string; code?: string; details?: string };
};

@Injectable()
export class OrgChartSearchService {
  private readonly logger = new Logger(OrgChartSearchService.name);

  constructor(
    private readonly orgChartProgressRedisService: OrgChartProgressRedisService,
    private readonly searchExecutionService: SearchExecutionService,
    private readonly linkedinParameterResolver: LinkedinParameterResolver,
    private readonly candidateSearchBaseService: CandidateSearchBaseService,
    private readonly orgchartLinkedInQueryRouterService: OrgchartLinkedInQueryRouterService,
    private readonly pythonOrgChartService: PythonOrgChartService,
    private readonly orgchartCancelRegistry: OrgchartCancelRegistryService,
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly orgChartCacheService: OrgChartCacheService,
    private readonly orgChartIntentService: OrgChartIntentService,
    private readonly orgChartProfileDataSourceMapperService: OrgChartProfileDataSourceMapperService,
    private readonly candidateAvatarStorageService: CandidateAvatarStorageService,
  ) {}

  /**
   * Lightweight helper for org-chart integrations:
   * Given a natural-language requirement (built from company + mode),
   * execute a LinkedIn people search and return transformed candidates.
   */
  async runOrgchartLinkedInSearch(
    rawQuery: string,
    cleanedQuery: string,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    apiToken: string,
    sendEvent?: (event: string, data: unknown) => void,
    options?: {
      mode?: string;
      companyName?: string;
      companyNames?: string[];
      companyId?: string;
      requestId?: string;
      jobTitles?: string[];
      country?: string;
      functionRoot?: string;
      /** Canonical LinkedIn company URL for Python org-chart (e.g. https://www.linkedin.com/company/briskpe/) */
      linkedinCompanyUrl?: string;
      /** Unipile LinkedIn account id (same as linkedin-search ?account_id); profile/env resolved in getLinkedInAccountId */
      linkedinUnipileAccountId?: string;
      /** Natural-language business division query; triggers structured LLM + keyword strategy */
      businessDivisionRawQuery?: string;
      /** When true, run validated/scored multi-page search (LLM). Default false (fast path). */
      validateAndScoreLinkedInResults?: boolean;
      /** Prefer Python (default) deterministic query gen vs multi-agent LLM. */
      queryGenerator?: OrgchartQueryGeneratorPreference;
      /** Org-chart node scope (current_node / selected_nodes): filter results to this standardized function. */
      stdFunction?: string;
      /** Org-chart node scope: filter results to this standardized grade. */
      stdGrade?: string;
      /** `selected_nodes` only: each selected org-chart node’s std labels; results must match any scope (OR). */
      selectedNodeStdScopes?: Array<{ stdFunction?: string; stdGrade?: string }>;
    },
  ): Promise<{
    items: unknown[];
    itemCount: number;
    isCached?: boolean;
    cacheSource?: 'none' | 'function_grade';
    orgChart?: OrgChartData;
    functionGradeCacheMeta?: {
      strategyCap: number;
      keywordsHash: string;
      functionRoot: string;
      country: string;
    };
    /** Merged filters after business-division LLM (for org-chart build) */
    effectiveCountry?: string;
    effectiveFunctionRoot?: string;
    strategyResults: Array<{
      strategy: PeopleSearchStrategyResult;
      result: SearchExecutionResult | null;
    }>;
  }> {
    const searchCategory: 'people' = 'people';
    const searchParamKey = constructSearchParamKey(searchType, searchCategory);
    const parameterKey = searchParamKey;

    const requirement = cleanedQuery || rawQuery;

    const mode = options?.mode;
    const primaryCompanyName = options?.companyName?.trim() || '';
    const companyNames =
      options?.companyNames?.map((name) => name.trim()).filter(Boolean) ?? [];
    const primaryCompanyId = options?.companyId?.trim() || '';
    const requestId = options?.requestId;
    const rawCountryFromOptions = options?.country?.trim() || '';
    const rawFunctionFromOptions = options?.functionRoot?.trim() || '';
    let country =
      rawCountryFromOptions.toLowerCase() === 'global'
        ? ''
        : rawCountryFromOptions;
    let functionRoot = rawFunctionFromOptions;

    const businessDivisionRaw = options?.businessDivisionRawQuery?.trim();
    if (businessDivisionRaw && !primaryCompanyName) {
      throw new Error(
        'businessDivisionRawQuery requires companyName on the org chart request',
      );
    }

    let workspaceMemberId: string | undefined;
    try {
      const authContext =
        await this.workspaceQueryService.accessTokenService.validateToken(
          apiToken,
        );
      workspaceMemberId = authContext.workspaceMemberId;
    } catch {
      this.logger.warn(
        'Unable to resolve workspace member id for orgchart progress events',
      );
    }

    const emitProgress = async (
      event: string,
      data: Record<string, unknown>,
    ): Promise<boolean | void> => {
      if (requestId && (await this.orgchartCancelRegistry.isCancelled(requestId))) {
        return false;
      }
      sendEvent?.(event, data);

      if (!workspaceMemberId) {
        return;
      }

      void this.orgChartProgressRedisService.publish(workspaceMemberId, {
        event,
        requestId,
        mode,
        searchType,
        companyName: primaryCompanyName,
        data,
      });
    };

    const emitProgressSync = (
      event: string,
      data: Record<string, unknown>,
    ): boolean | void => {
      void emitProgress(event, data);
    };

    await emitProgress('status', {
      message: `Starting org chart search for ${primaryCompanyName || 'company'}...`,
    });
    let businessDivisionEffective:
      | { effectiveCountry?: string; effectiveFunctionRoot?: string }
      | undefined;
    let businessDivisionLinkedinKeywords: string | undefined;

    if (businessDivisionRaw && primaryCompanyName) {
      const bdContext = await this.resolveBusinessDivisionLinkedInContext({
        apiToken,
        businessDivisionRaw,
        primaryCompanyName,
        rawCountryFromOptions,
        rawFunctionFromOptions,
        requirement,
        queryGenerator: options?.queryGenerator,
        sendEvent,
        onBeforeParse: async () => {
          await emitProgress('status', {
            message: 'Parsing business division query...',
          });
        },
        enrichSendEvent: (event, data) => {
          void emitProgress(event, data);
        },
      });
      country = bdContext.country;
      functionRoot = bdContext.functionRoot;
      businessDivisionLinkedinKeywords = bdContext.businessDivisionLinkedinKeywords;
      businessDivisionEffective = bdContext.businessDivisionEffective;
    }

    const hasAdditionalFilters =
      !!country || hasMeaningfulOrgChartFunctionRootFilter(functionRoot);

    const hasSubsetScopeFilters = hasOrgChartLinkedInSubsetScopeFilter(
      country,
      functionRoot,
    );

    const isAllPeopleInCompanyMode =
      searchType === 'classic' &&
      !!primaryCompanyName &&
      mode === 'entire_company' &&
      !hasAdditionalFilters &&
      !businessDivisionRaw;

    if (
      mode === 'function_grade' &&
      searchType === 'classic' &&
      !!primaryCompanyName
    ) {
      const cachedCandidateList =
        await this.orgChartCacheService.getCachedCompanyCandidateList({
          companyName: primaryCompanyName,
          companyId: primaryCompanyId,
          mode: 'entire_company',
          searchType,
        });

      if (cachedCandidateList?.items && Array.isArray(cachedCandidateList.items)) {
        const filteredItems =
          this.filterOrgChartCandidatesByCountryAndFunctionRoot(
            cachedCandidateList.items,
            country,
            functionRoot,
          );

        this.logger.log(
          `OrgchartLinkedInSearch: reusing full-company candidate list cache for function-grade search (company="${primaryCompanyName}", functionRoot="${functionRoot}", country="${rawCountryFromOptions || 'global'}") with ${filteredItems.length} candidates after filters.`,
        );

        await emitProgress('complete', {
          message: `Loaded cached org chart people search with ${filteredItems.length} candidates (from full-company cache).`,
          itemCount: filteredItems.length,
          strategyCount: 0,
          isCached: true,
        });

        return {
          items: filteredItems,
          itemCount: filteredItems.length,
          isCached: true,
          cacheSource: 'function_grade',
          orgChart: undefined,
          functionGradeCacheMeta: undefined,
          strategyResults: [],
        };
      }
    }

    const routerOutcome =
      await this.orgchartLinkedInQueryRouterService.buildOrgchartLinkedInStrategies(
        {
          rawQuery,
          cleanedQuery,
          requirement,
          searchType,
          mode,
          primaryCompanyName,
          companyNames:
            companyNames.length > 0 ? companyNames : undefined,
          jobTitles: options?.jobTitles,
          country,
          functionRoot,
          stdFunction: options?.stdFunction,
          stdGrade: options?.stdGrade,
          selectedNodeStdScopes: options?.selectedNodeStdScopes,
          businessDivisionLinkedinKeywords,
          isAllPeopleInCompanyMode,
          apiToken,
          queryGenerator: options?.queryGenerator,
          sendEvent,
        },
      );
    const strategies = routerOutcome.strategies;
    const parsedJobDescription = routerOutcome.parsedJobDescription;
    console.log('Total number of strategies created ::', strategies.length)
    const shouldPreResolveOrgchartStrategies =
      (!!businessDivisionLinkedinKeywords && !!primaryCompanyName) ||
      isAllPeopleInCompanyMode ||
      strategies.length > 0;

    this.logStrategies(strategies);

    const strategyResults: Array<{
      strategy: PeopleSearchStrategyResult;
      result: SearchExecutionResult | null;
    }> = [];

    const configuredMaxStrategiesRaw = process.env.ORGCHART_MAX_STRATEGIES;
    const configuredMaxStrategiesParsed =
      configuredMaxStrategiesRaw !== undefined
        ? Number.parseInt(configuredMaxStrategiesRaw, 10)
        : NaN;
    const maxStrategiesToRun =
      Number.isFinite(configuredMaxStrategiesParsed) &&
      configuredMaxStrategiesParsed > 0
        ? configuredMaxStrategiesParsed
        : 1;
    const strategiesToRun =
      strategies.length > 0 ? strategies.slice(0, maxStrategiesToRun) : [];

    this.logger.log(
      `OrgchartLinkedInSearch: strategy execution cap=${maxStrategiesToRun}, extracted=${strategies.length}, executing=${strategiesToRun.length}`,
    );

    const isFunctionGradeMode = mode === 'function_grade';
    const normalizedFunctionRoot = normalizeFunctionRoot(functionRoot);
    const normalizedCountry = normalizeCountry(country);
    const keywordsHash = this.buildFunctionGradeKeywordsHash(strategiesToRun);

    if (isFunctionGradeMode && primaryCompanyName && normalizedFunctionRoot) {
      const cachedFunctionGrade =
        await this.orgChartCacheService.getCachedFunctionGradeSearch({
          companyName: primaryCompanyName,
          companyId: primaryCompanyId,
          functionRoot: normalizedFunctionRoot,
          country: normalizedCountry,
          searchType,
          strategyCap: maxStrategiesToRun,
          keywordsHash,
        });

      if (cachedFunctionGrade) {
        this.logger.log(
          `OrgchartLinkedInSearch: function-grade cache HIT for company="${primaryCompanyName}", functionRoot="${normalizedFunctionRoot}", country="${normalizedCountry}", strategyCap=${maxStrategiesToRun}`,
        );
        await emitProgress('complete', {
          message: `Loaded cached org chart people search with ${cachedFunctionGrade.itemCount} candidates.`,
          itemCount: cachedFunctionGrade.itemCount,
          strategyCount: strategiesToRun.length,
          isCached: true,
        });
        return {
          items: cachedFunctionGrade.items,
          itemCount: cachedFunctionGrade.itemCount,
          isCached: true,
          cacheSource: 'function_grade',
          orgChart: cachedFunctionGrade.orgChart,
          functionGradeCacheMeta: {
            strategyCap: maxStrategiesToRun,
            keywordsHash,
            functionRoot: normalizedFunctionRoot,
            country: normalizedCountry,
          },
          strategyResults: strategiesToRun.map((s) => ({
            strategy: s,
            result: null,
          })),
        };
      }
    }

    if (requestId && (await this.orgchartCancelRegistry.isCancelled(requestId))) {
      this.logger.log(
        `Orgchart search aborted by user before execution. requestId=${requestId}`,
      );
      return {
        items: [],
        itemCount: 0,
        strategyResults: strategiesToRun.map((s) => ({
          strategy: s,
          result: null,
        })),
      };
    }

    const linkedInExecutionOptions = {
      forceClassicPeopleJson: true as const,
      linkedInAccountId: options?.linkedinUnipileAccountId,
      throttlePages: true as const,
      maxCandidates: getOrgChartLinkedInMaxCandidates(),
    };

    if (shouldPreResolveOrgchartStrategies && strategiesToRun[0]) {
      try {
        const accountId =
          await this.candidateSearchBaseService.getLinkedInAccountId(
            apiToken,
            options?.linkedinUnipileAccountId,
          );
        for (const strategyToResolve of strategiesToRun) {
          strategyToResolve.parameters =
            await this.linkedinParameterResolver.resolveParameterIds(
              strategyToResolve.parameters,
              accountId,
              strategyToResolve.id,
            );
        }
      } catch (error) {
        this.logger.error(
          `Failed to parameterize orgchart LinkedIn search strategies`,
          error as Error,
        );
      }
    }

    let searchPlan:
      | ReturnType<typeof computeOrgChartLinkedInSearchPlan>
      | undefined;
    const probeStrategy = strategiesToRun[0];
    if (probeStrategy) {
      try {
        const probe = await this.searchExecutionService.probeStrategyFirstPageTotalCount(
          probeStrategy,
          searchType,
          searchCategory,
          parameterKey,
          apiToken,
          linkedInExecutionOptions,
        );
        if (probe) {
          searchPlan = computeOrgChartLinkedInSearchPlan({
            totalCountFromApi: probe.totalCount,
            strategiesToRun: strategiesToRun.length,
            searchType,
            country,
            functionRoot,
            maxCandidates: linkedInExecutionOptions.maxCandidates,
          });
          await emitProgress('searchPlan', {
            ...searchPlan,
            strategyId: probeStrategy.id,
            strategyLabel: probeStrategy.label,
          });
          if (searchPlan.scopeRequired) {
            throw new OrgChartLinkedInScopeRequiredError(
              `LinkedIn reports ~${searchPlan.estimatedTotalUpperBound.toLocaleString()} matches. Select a country or function to narrow the search (limit ${searchPlan.threshold}).`,
              {
                totalCount: searchPlan.estimatedTotalUpperBound,
                threshold: searchPlan.threshold,
                estimatedApiRequests: searchPlan.estimatedApiRequests,
              },
            );
          }
        }
      } catch (error) {
        if (error instanceof OrgChartLinkedInScopeRequiredError) {
          throw error;
        }
        this.logger.warn(
          `OrgchartLinkedInSearch: probe first page failed, continuing without pre-flight count: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    const maxPagesForSearch =
      searchPlan?.maxPages ??
      computeOrgChartLinkedInMaxPages(
        undefined,
        linkedInExecutionOptions.maxCandidates,
        searchType,
      );

    const validateAndScoreLinkedInResults =
      options?.validateAndScoreLinkedInResults === true;

    for (const strategy of strategiesToRun) {
      const preview = validateAndScoreLinkedInResults
        ? await this.searchExecutionService.executeMultiPageStrategySearch(
            parsedJobDescription,
            strategy,
            searchType,
            searchCategory,
            parameterKey,
            apiToken,
            requirement,
            emitProgressSync,
            {
              forceClassicPeopleJson: true,
              linkedInAccountId: options?.linkedinUnipileAccountId,
            },
          )
        : await this.searchExecutionService.executeMultiPageSearchWithoutValidation(
            parsedJobDescription,
            strategy,
            searchType,
            searchCategory,
            parameterKey,
            apiToken,
            maxPagesForSearch,
            emitProgressSync,
            linkedInExecutionOptions,
          );
      strategyResults.push({
        strategy,
        result: preview as SearchExecutionResult | null,
      });
    }

    const allCandidates = strategyResults.flatMap(
      (sr) => sr.result?.transformedCandidates || [],
    );

    let candidatesOut = hasSubsetScopeFilters
      ? this.filterOrgChartCandidatesByCountryAndFunctionRoot(
          allCandidates,
          country,
          functionRoot,
        )
      : businessDivisionRaw && primaryCompanyName
        ? this.filterOrgChartCandidatesByCountryAndFunctionRoot(
            allCandidates,
            country,
            functionRoot,
          )
        : allCandidates;

    candidatesOut = filterOrgChartCandidatesByNodeStdLabels(candidatesOut, mode, {
      stdFunction: options?.stdFunction,
      stdGrade: options?.stdGrade,
      selectedNodeStdScopes: options?.selectedNodeStdScopes,
    });

    this.logger.log(
      `OrgchartLinkedInSearch: collected ${candidatesOut.length} transformed candidates from ${strategyResults.length} strategy/strategies.`,
    );

    await emitProgress('complete', {
      message: `Completed org chart people search with ${candidatesOut.length} candidates.`,
      itemCount: candidatesOut.length,
      strategyCount: strategyResults.length,
    });

    if (
      isFunctionGradeMode &&
      primaryCompanyName &&
      normalizedFunctionRoot &&
      candidatesOut.length > 0
    ) {
      await this.orgChartCacheService.setCachedFunctionGradeSearch({
        companyName: primaryCompanyName,
        companyId: primaryCompanyId,
        functionRoot: normalizedFunctionRoot,
        country: normalizedCountry,
        searchType,
        strategyCap: maxStrategiesToRun,
        keywordsHash,
        items: candidatesOut,
        itemCount: candidatesOut.length,
      });
    }

    return {
      items: candidatesOut,
      itemCount: candidatesOut.length,
      isCached: false,
      cacheSource: 'none',
      functionGradeCacheMeta:
        isFunctionGradeMode && normalizedFunctionRoot
          ? {
              strategyCap: maxStrategiesToRun,
              keywordsHash,
              functionRoot: normalizedFunctionRoot,
              country: normalizedCountry,
            }
          : undefined,
      ...(businessDivisionEffective
        ? {
            effectiveCountry: businessDivisionEffective.effectiveCountry,
            effectiveFunctionRoot:
              businessDivisionEffective.effectiveFunctionRoot,
          }
        : {}),
      strategyResults,
    };
  }

  async estimateLinkedInOrgChartSearch(
    rawQuery: string,
    cleanedQuery: string,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    apiToken: string,
    options?: {
      mode?: string;
      companyName?: string;
      companyNames?: string[];
      companyId?: string;
      jobTitles?: string[];
      country?: string;
      functionRoot?: string;
      stdFunction?: string;
      stdGrade?: string;
      selectedNodeStdScopes?: Array<{ stdFunction?: string; stdGrade?: string }>;
      businessDivisionRawQuery?: string;
      queryGenerator?: 'python' | 'multi_agent';
      linkedinUnipileAccountId?: string;
    },
  ): Promise<{
    estimatedTotal: number;
    estimatedTotalUpperBound: number;
    estimatedApiRequests: number;
    threshold: number;
    thresholdExceeded: boolean;
    scopeRequired: boolean;
    strategiesExtracted: number;
    strategiesToRun: number;
  }> {
    const requirement = cleanedQuery || rawQuery;
    const mode = options?.mode;
    const primaryCompanyName = options?.companyName?.trim() || '';
    const companyNames =
      options?.companyNames?.map((name) => name.trim()).filter(Boolean) ?? [];
    const rawCountryFromOptions = options?.country?.trim() || '';
    const rawFunctionFromOptions = options?.functionRoot?.trim() || '';
    let country =
      rawCountryFromOptions.toLowerCase() === 'global'
        ? ''
        : rawCountryFromOptions;
    let functionRoot = rawFunctionFromOptions;
    const businessDivisionRaw = options?.businessDivisionRawQuery?.trim();

    let businessDivisionLinkedinKeywords: string | undefined;
    if (businessDivisionRaw && primaryCompanyName) {
      const bdContext = await this.resolveBusinessDivisionLinkedInContext({
        apiToken,
        businessDivisionRaw,
        primaryCompanyName,
        rawCountryFromOptions,
        rawFunctionFromOptions,
        requirement,
        queryGenerator: options?.queryGenerator,
      });
      country = bdContext.country;
      functionRoot = bdContext.functionRoot;
      businessDivisionLinkedinKeywords = bdContext.businessDivisionLinkedinKeywords;
    }

    const hasAdditionalFilters =
      !!country || hasMeaningfulOrgChartFunctionRootFilter(functionRoot);
    const isAllPeopleInCompanyMode =
      searchType === 'classic' &&
      !!primaryCompanyName &&
      mode === 'entire_company' &&
      !hasAdditionalFilters &&
      !businessDivisionRaw;

    const routerOutcome =
      await this.orgchartLinkedInQueryRouterService.buildOrgchartLinkedInStrategies(
        {
          rawQuery,
          cleanedQuery,
          requirement,
          searchType,
          mode,
          primaryCompanyName,
          companyNames:
            companyNames.length > 0 ? companyNames : undefined,
          jobTitles: options?.jobTitles,
          country,
          functionRoot,
          stdFunction: options?.stdFunction,
          stdGrade: options?.stdGrade,
          selectedNodeStdScopes: options?.selectedNodeStdScopes,
          businessDivisionLinkedinKeywords,
          isAllPeopleInCompanyMode,
          apiToken,
          queryGenerator: options?.queryGenerator,
        },
      );

    const strategies = routerOutcome.strategies;
    const searchCategory: 'people' = 'people';
    const parameterKey = constructSearchParamKey(searchType, searchCategory);
    const configuredMaxStrategiesRaw = process.env.ORGCHART_MAX_STRATEGIES;
    const configuredMaxStrategiesParsed =
      configuredMaxStrategiesRaw !== undefined
        ? Number.parseInt(configuredMaxStrategiesRaw, 10)
        : NaN;
    const maxStrategiesToRun =
      Number.isFinite(configuredMaxStrategiesParsed) &&
      configuredMaxStrategiesParsed > 0
        ? configuredMaxStrategiesParsed
        : 1;
    const strategiesToRun =
      strategies.length > 0 ? strategies.slice(0, maxStrategiesToRun) : [];
    const linkedInExecutionOptions = {
      forceClassicPeopleJson: true as const,
      linkedInAccountId: options?.linkedinUnipileAccountId,
    };
    const maxCandidates = getOrgChartLinkedInMaxCandidates();

    if (!strategiesToRun[0]) {
      return {
        estimatedTotal: 0,
        estimatedTotalUpperBound: 0,
        estimatedApiRequests: 0,
        threshold: maxCandidates,
        thresholdExceeded: false,
        scopeRequired: false,
        strategiesExtracted: strategies.length,
        strategiesToRun: 0,
      };
    }

    try {
      const accountId =
        await this.candidateSearchBaseService.getLinkedInAccountId(
          apiToken,
          options?.linkedinUnipileAccountId,
        );
      for (const strategyToResolve of strategiesToRun) {
        strategyToResolve.parameters =
          await this.linkedinParameterResolver.resolveParameterIds(
            strategyToResolve.parameters,
            accountId,
            strategyToResolve.id,
          );
      }
    } catch (error) {
      this.logger.warn(
        `estimateLinkedInOrgChartSearch: parameter resolution failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    const probe = await this.searchExecutionService.probeStrategyFirstPageTotalCount(
      strategiesToRun[0],
      searchType,
      searchCategory,
      parameterKey,
      apiToken,
      linkedInExecutionOptions,
    );
    const totalCount = probe?.totalCount ?? 0;
    const plan = computeOrgChartLinkedInSearchPlan({
      totalCountFromApi: totalCount,
      strategiesToRun: strategiesToRun.length,
      searchType,
      country,
      functionRoot,
      maxCandidates,
    });

    return {
      estimatedTotal: plan.estimatedTotal,
      estimatedTotalUpperBound: plan.estimatedTotalUpperBound,
      estimatedApiRequests: plan.estimatedApiRequests,
      threshold: plan.threshold,
      thresholdExceeded: plan.thresholdExceeded,
      scopeRequired: plan.scopeRequired,
      strategiesExtracted: strategies.length,
      strategiesToRun: strategiesToRun.length,
    };
  }

  async buildOrgChartFromLinkedInCompanyCandidates(
    candidates: OrgChartCandidateInput[],
    options: {
      companyName: string;
      companyId?: string;
      mode?: string;
      function?: string;
      /** When set, used as job_company_linkedin_url for the Python service (overrides /company/{companyId}) */
      companyLinkedinUrl?: string;
      /** Raw industry label forwarded to Python list_data.industry */
      industry?: string;
      /** Macro category override forwarded to Python list_data.industry_category */
      industryCategory?: string;
      /**
       * When a candidate row has no `source`, map profile provenance using this
       * chart-level channel (server-only; clients receive opaque `ds_*` slugs on nodes).
       */
      profileSourceFallback?: OrgChartLinkedinCandidateSource;
      /** Optional MonthYear snapshot filter in YYYY-MM. */
      asOfMonth?: string;
    },
  ): Promise<OrgChartData> {
    const { companyName, companyId, mode, function: fn } = options;
    const normalizedCompanyName = (companyName ?? '').trim();
    const normalizedCompanyId =
      (companyId ?? '').trim() ||
      (normalizedCompanyName
        ? normalizedCompanyName.replace(/\s+/g, '').toLowerCase()
        : '');

    const trimmedCanonical = options.companyLinkedinUrl?.trim();
    const companyLinkedinUrl =
      trimmedCanonical && trimmedCanonical.length > 0
        ? trimmedCanonical.replace(/\/+$/, '')
        : normalizedCompanyId !== ''
          ? `https://www.linkedin.com/company/${normalizedCompanyId}`
          : '';

    const urlToSlug = new Map<string, string>();
    const urlToContact = new Map<string, OrgChartNodeContactAvailability>();
    /** When `linkedin_url` is empty, merge hints onto nodes by `candidates[i].id`. */
    const personIdToContact = new Map<string, OrgChartNodeContactAvailability>();
    const { profileSourceFallback } = options;

    const asOfMonthTrimmed = options.asOfMonth?.trim() ?? '';
    const modeNorm = (mode ?? '').trim().toLowerCase();
    const isEntireCompany = modeNorm === 'entire_company';

    let candidatesForSnapshot = candidates as Array<Record<string, unknown>>;
    if (asOfMonthTrimmed) {
      candidatesForSnapshot = applyAsOfSnapshotToCandidates({
        candidates: candidatesForSnapshot,
        companyName: normalizedCompanyName,
        companyLinkedinUrl: companyLinkedinUrl || undefined,
        asOfMonth: asOfMonthTrimmed,
      });
    } else if (isEntireCompany) {
      candidatesForSnapshot = applyEntireCompanyExperienceTitlesToCandidates({
        candidates: candidatesForSnapshot,
        companyName: normalizedCompanyName,
        companyLinkedinUrl: companyLinkedinUrl || undefined,
      });
    }

    const tenureByUrl = new Map<string, 'current' | 'past'>();
    const tenureById = new Map<string, 'current' | 'past'>();
    for (const candidate of candidatesForSnapshot) {
      const raw = candidate as Record<string, unknown>;
      const tenure = companyTenureFromDerivedExperience({
        row: raw,
        companyName: normalizedCompanyName,
        companyLinkedinUrl: companyLinkedinUrl || undefined,
      });
      if (tenure === 'unknown') {
        continue;
      }
      const li = extractLinkedinProfileUrlFromOrgChartCandidateRow(raw).trim();
      if (li.length > 0) {
        tenureByUrl.set(normalizeOrgChartLinkedinUrlKey(li), tenure);
      }
      const rawPeopleId =
        typeof raw.peopleId === 'string' ? raw.peopleId.trim() : '';
      const rawTempId =
        typeof raw.tempId === 'string' ? raw.tempId.trim() : '';
      const rawRowId = typeof raw.id === 'string' ? raw.id.trim() : '';
      const idForTenure =
        rawPeopleId.length > 0
          ? rawPeopleId
          : rawTempId.length > 0
            ? rawTempId
            : rawRowId.length > 0
              ? rawRowId
              : '';
      if (idForTenure.length > 0) {
        tenureById.set(idForTenure, tenure);
      }
    }

    const people: StandardizedOrgChartPerson[] = candidatesForSnapshot.map(
      (candidate, index) => {
        const raw = candidate as Record<string, unknown>;

        const fullName =
          (typeof (raw as { fullName?: unknown }).fullName === 'string' &&
            (raw as { fullName: string }).fullName) ||
          (typeof (raw as { name?: unknown }).name === 'string' &&
            (raw as { name: string }).name) ||
          '';

        const rawJob =
          typeof (raw as { jobTitle?: unknown }).jobTitle === 'string'
            ? (raw as { jobTitle: string }).jobTitle?.trim()
            : '';
        const rawHeadline =
          typeof (raw as { headline?: unknown }).headline === 'string'
            ? (raw as { headline: string }).headline?.trim()
            : '';
        const rawJobTitleSnake =
          typeof (raw as { job_title?: unknown }).job_title === 'string'
            ? (raw as { job_title: string }).job_title?.trim()
            : '';
        const rawLinkedInHeadline =
          typeof (raw as { linkedin_headline?: unknown }).linkedin_headline ===
          'string'
            ? (raw as { linkedin_headline: string }).linkedin_headline?.trim()
            : '';
        const jobTitleStr =
          (rawJob && rawJob !== 'N/A' ? rawJob : '') ||
          rawHeadline ||
          rawJobTitleSnake ||
          rawLinkedInHeadline ||
          '';
        const jobTitle = typeof jobTitleStr === 'string' ? jobTitleStr : '';

        const jobCompanyName =
          (typeof (raw as { jobCompanyName?: unknown }).jobCompanyName ===
            'string' &&
            (raw as { jobCompanyName: string }).jobCompanyName) ||
          (typeof (raw as { company?: unknown }).company === 'string' &&
            (raw as { company: string }).company) ||
          normalizedCompanyName;

        const locationName =
          (typeof (raw as { locationName?: unknown }).locationName ===
            'string' &&
            (raw as { locationName: string }).locationName) ||
          (typeof (raw as { location?: unknown }).location === 'string' &&
            (raw as { location: string }).location) ||
          '';

        const industry =
          (typeof (raw as { industry?: unknown }).industry === 'string' &&
            (raw as { industry: string }).industry) ||
          '';

        const linkedinUrl = extractLinkedinProfileUrlFromOrgChartCandidateRow(raw);

        const locationCountry =
          (typeof (raw as { locationCountry?: unknown }).locationCountry ===
            'string' &&
            (raw as { locationCountry: string }).locationCountry) ||
          '';

        const locationRegion =
          (typeof (raw as { locationRegion?: unknown }).locationRegion ===
            'string' &&
            (raw as { locationRegion: string }).locationRegion) ||
          '';

        const locationLocality =
          (typeof (raw as { locationLocality?: unknown }).locationLocality ===
            'string' &&
            (raw as { locationLocality: string }).locationLocality) ||
          '';

        const rawPeopleId =
          typeof (raw as { peopleId?: unknown }).peopleId === 'string'
            ? (raw as { peopleId: string }).peopleId.trim()
            : '';
        const rawTempId =
          typeof (raw as { tempId?: unknown }).tempId === 'string'
            ? (raw as { tempId: string }).tempId.trim()
            : '';
        const rawRowId =
          typeof (raw as { id?: unknown }).id === 'string'
            ? (raw as { id: string }).id.trim()
            : '';
        const idValue =
          (rawPeopleId.length > 0 ? rawPeopleId : '') ||
          (rawTempId.length > 0 ? rawTempId : '') ||
          (rawRowId.length > 0 ? rawRowId : '') ||
          (linkedinUrl !== '' ? linkedinUrl : '') ||
          `${fullName || 'candidate'}-${jobCompanyName || 'company'}-${index}`;

        const profilePictureUrl =
          (typeof (raw as { profile_picture_url?: unknown })
            .profile_picture_url === 'string' &&
            (raw as { profile_picture_url: string }).profile_picture_url) ||
          (typeof (raw as { profile_picture_url_large?: unknown })
            .profile_picture_url_large === 'string' &&
            (raw as { profile_picture_url_large: string })
              .profile_picture_url_large) ||
          (typeof (raw as { profilePictureUrl?: unknown }).profilePictureUrl ===
            'string' &&
            (raw as { profilePictureUrl: string }).profilePictureUrl) ||
          (typeof (raw as { displayPicture?: unknown }).displayPicture ===
            'string' &&
            (raw as { displayPicture: string }).displayPicture) ||
          '';

        const publicSlug = this.orgChartProfileDataSourceMapperService.toPublicSlugFromRow(
          raw,
          profileSourceFallback,
        );
        if (publicSlug && linkedinUrl.trim().length > 0) {
          urlToSlug.set(
            normalizeOrgChartLinkedinUrlKey(linkedinUrl),
            publicSlug,
          );
        }

        const contactSlot = readProviderContactHintsFromSearchRow(
          raw,
          ORGCHART_DATA_SOURCE_SLUG_APOLLO,
        );
        if (
          linkedinUrl.trim().length > 0 &&
          (contactSlot.hasEmail !== undefined ||
            contactSlot.hasDirectPhone !== undefined ||
            contactSlot.hasOrgPhone !== undefined)
        ) {
          urlToContact.set(
            normalizeOrgChartLinkedinUrlKey(linkedinUrl),
            contactSlot,
          );
        }
        if (
          idValue.trim().length > 0 &&
          (contactSlot.hasEmail !== undefined ||
            contactSlot.hasDirectPhone !== undefined ||
            contactSlot.hasOrgPhone !== undefined)
        ) {
          personIdToContact.set(idValue.trim(), contactSlot);
        }

        return {
          full_name: fullName,
          job_title: jobTitle,
          job_company_linkedin_url: companyLinkedinUrl,
          job_company_id: normalizedCompanyId || jobCompanyName || '',
          job_company_name: jobCompanyName,
          industry,
          country: locationCountry || 'global',
          job_company_website: '',
          linkedin_url: linkedinUrl,
          facebook_url: '',
          twitter_url: '',
          gender: '',
          location_country: locationCountry,
          location_region: locationRegion,
          location_locality: locationLocality,
          location_metro: '',
          location_name: locationName,
          inferred_salary: '',
          inferred_years_experience: '',
          emails: '',
          phone_numbers: '',
          profile_picture_url: profilePictureUrl,
          id: idValue,
        };
      },
    );

    const peopleWithAvatars = await this.candidateAvatarStorageService.ingestBatch(
      people,
    );

    this.logger.log(
      `OrgchartLinkedInSearch: building org chart from ${peopleWithAvatars.length} candidates for company="${normalizedCompanyName}"`,
    );

    const jobNameSuffix = fn
      ? fn.replace(/\s+/g, '-').toLowerCase()
      : mode === 'leadership'
        ? 'leadership'
        : mode === 'entire_company'
          ? 'entire'
          : mode ?? 'chart';
    const jobName = `orgchart-${normalizedCompanyName.replace(/\s+/g, '-')}-${jobNameSuffix}`;

    const yugaNormalizedId = normalizedCompanyId.replace(/-/g, '_').toLowerCase();
    const isYugaLabsCompany =
      yugaNormalizedId === 'yuga_labs' ||
      normalizedCompanyName.toLowerCase().trim() === 'yuga labs';

    try {
      const built = await this.pythonOrgChartService.createOrgChartFromStandardizedPeople(
        {
          people: peopleWithAvatars,
          jobName,
          jobId: normalizedCompanyId || undefined,
          functionRoot: fn,
          industry: options.industry,
          industryCategory: options.industryCategory,
        },
      );
      const apolloPublicSlug =
        this.orgChartProfileDataSourceMapperService.toPublicSlugFromRow({
          source: 'apollo',
        });
      const isApolloChart =
        options.profileSourceFallback === 'm7kq' ||
        options.profileSourceFallback === 'apollo';
      const withDataSourceSlugs =
        isApolloChart && apolloPublicSlug !== undefined
          ? assignApolloPublicSlugToAllPersonSlots(built, apolloPublicSlug)
          : apolloPublicSlug !== undefined
            ? backfillUnmappedLinkedInSlotsWithApolloSlug(
                mergeProfileSourceSlugsOntoOrgChartData(built, urlToSlug),
                apolloPublicSlug,
              )
            : mergeProfileSourceSlugsOntoOrgChartData(built, urlToSlug);
      const withUrlContact = mergeContactAvailabilityOntoOrgChartData(
        withDataSourceSlugs,
        urlToContact,
      );
      const merged = mergeContactAvailabilityOntoOrgChartDataByPersonId(
        withUrlContact,
        personIdToContact,
      );
      const withTenure = mergeOrgChartCompanyTenureOntoOrgChartData(
        merged,
        tenureByUrl,
        tenureById,
      );
      return apolloPublicSlug
        ? applyApolloOnlyNodeLockState(withTenure, apolloPublicSlug)
        : withTenure;
    } catch (error) {
      if (!isYugaLabsCompany) {
        throw error;
      }
      const staticChart =
        await this.pythonOrgChartService.loadYugaLabsStaticAssistOrNull();
      if (!staticChart) {
        throw error;
      }
      this.logger.warn(
        `Yuga Labs org chart build failed; using static yuga_labs_all_org_chart_assist.json. ${error instanceof Error ? error.message : String(error)}`,
      );
      const apolloPublicSlug =
        this.orgChartProfileDataSourceMapperService.toPublicSlugFromRow({
          source: 'apollo',
        });
      const isApolloChart =
        options.profileSourceFallback === 'm7kq' ||
        options.profileSourceFallback === 'apollo';
      const withDataSourceSlugs =
        isApolloChart && apolloPublicSlug !== undefined
          ? assignApolloPublicSlugToAllPersonSlots(staticChart, apolloPublicSlug)
          : apolloPublicSlug !== undefined
            ? backfillUnmappedLinkedInSlotsWithApolloSlug(
                mergeProfileSourceSlugsOntoOrgChartData(
                  staticChart,
                  urlToSlug,
                ),
                apolloPublicSlug,
              )
            : mergeProfileSourceSlugsOntoOrgChartData(staticChart, urlToSlug);
      const withUrlContact = mergeContactAvailabilityOntoOrgChartData(
        withDataSourceSlugs,
        urlToContact,
      );
      const merged = mergeContactAvailabilityOntoOrgChartDataByPersonId(
        withUrlContact,
        personIdToContact,
      );
      const withTenure = mergeOrgChartCompanyTenureOntoOrgChartData(
        merged,
        tenureByUrl,
        tenureById,
      );
      return apolloPublicSlug
        ? applyApolloOnlyNodeLockState(withTenure, apolloPublicSlug)
        : withTenure;
    }
  }

  private filterOrgChartCandidatesByCountryAndFunctionRoot(
    items: unknown[],
    countryRaw?: string,
    functionRootRaw?: string,
  ): unknown[] {
    const normalizedCountryRaw =
      typeof countryRaw === 'string' ? countryRaw.trim() : '';
    const hasCountryFilter =
      normalizedCountryRaw.length > 0 &&
      normalizedCountryRaw.toLowerCase() !== 'global';

    const normalizedFunctionRootRaw =
      typeof functionRootRaw === 'string' ? functionRootRaw.trim() : '';
    const hasFunctionRootFilter =
      hasMeaningfulOrgChartFunctionRootFilter(normalizedFunctionRootRaw);

    if (!hasCountryFilter && !hasFunctionRootFilter) {
      return items;
    }

    return items.filter((item) => {
      const raw = item as Record<string, unknown>;

      if (hasCountryFilter) {
        const filterCountry = normalizedCountryRaw.toLowerCase();
        const possibleCountryValues = [
          (raw as { locationCountry?: unknown }).locationCountry,
          (raw as { location_country?: unknown }).location_country,
          raw.country,
        ].filter(
          (v): v is string => typeof v === 'string' && v.trim().length > 0,
        );

        const normalizedCountry =
          possibleCountryValues[0]?.trim().toLowerCase() ?? '';

        if (!normalizedCountry.includes(filterCountry)) {
          return false;
        }
      }

      if (hasFunctionRootFilter) {
        const filterFunctionRoot = normalizedFunctionRootRaw.toLowerCase();
        const possibleFunctionRootValues = [
          (raw as { std_function_root?: unknown }).std_function_root,
          (raw as { functionRoot?: unknown }).functionRoot,
          (raw as { function_root?: unknown }).function_root,
        ].filter(
          (v): v is string => typeof v === 'string' && v.trim().length > 0,
        );

        const normalizedFunctionRoot =
          possibleFunctionRootValues[0]?.trim().toLowerCase() ?? '';

        if (
          normalizedFunctionRoot === '' ||
          !normalizedFunctionRoot.includes(filterFunctionRoot)
        ) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Shared business-division path: Nest intent LLM → merge UI defaults → title-taxonomy
   * enrichment (function_root / role) AND'd onto division keywords. Used by full build
   * and estimate probe so both hit LinkedIn with the same combined query.
   */
  private async resolveBusinessDivisionLinkedInContext(args: {
    apiToken: string;
    businessDivisionRaw: string;
    primaryCompanyName: string;
    rawCountryFromOptions: string;
    rawFunctionFromOptions: string;
    requirement: string;
    queryGenerator?: OrgchartQueryGeneratorPreference;
    sendEvent?: (event: string, data: unknown) => void | boolean;
    onBeforeParse?: () => void | Promise<void>;
    enrichSendEvent?: (
      event: string,
      data: Record<string, unknown>,
    ) => boolean | void;
  }): Promise<{
    country: string;
    functionRoot: string;
    businessDivisionLinkedinKeywords: string;
    businessDivisionEffective: {
      effectiveCountry?: string;
      effectiveFunctionRoot?: string;
    };
  }> {
    await args.onBeforeParse?.();

    const workspaceId =
      await this.workspaceQueryService.getWorkspaceIdFromToken(args.apiToken);
    const { openAIclient: openaiClient } =
      await this.workspaceQueryService.initializeLLMClients(workspaceId);

    const parsed = await this.orgChartIntentService.resolveBusinessDivision(
      openaiClient,
      {
        companyName: args.primaryCompanyName,
        userRawText: args.businessDivisionRaw,
        defaultCountry: args.rawCountryFromOptions,
        defaultFunctionRoot: args.rawFunctionFromOptions,
      },
      args.sendEvent,
    );

    const merged = mergeFilters(
      parsed,
      args.rawCountryFromOptions,
      args.rawFunctionFromOptions,
    );

    if (!merged.businessDivisionKeywords) {
      throw new Error(
        'Business division intent did not produce business_division_keywords',
      );
    }

    const country =
      merged.effectiveCountryRaw === '' ||
      merged.effectiveCountryRaw.toLowerCase() === 'global'
        ? ''
        : merged.effectiveCountryRaw;
    const functionRoot = merged.effectiveFunctionRoot;

    const titleTaxonomyResolvedIntent = buildTitleTaxonomyResolvedIntent({
      companyName: args.primaryCompanyName,
      parsed,
      effectiveFunctionRoot: merged.effectiveFunctionRoot,
    });

    const businessDivisionLinkedinKeywords =
      await this.orgchartLinkedInQueryRouterService.enrichBusinessDivisionLinkedinKeywords(
        {
          queryGenerator: args.queryGenerator,
          businessDivisionRaw: args.businessDivisionRaw,
          primaryCompanyName: args.primaryCompanyName,
          baseBusinessDivisionKeywords: merged.businessDivisionKeywords,
          requirementForMultiAgent: args.requirement,
          titleTaxonomyResolvedIntent,
          sendEvent: args.enrichSendEvent,
        },
      );

    this.logger.log(
      `Business division LinkedIn keywords for "${args.primaryCompanyName}": ${businessDivisionLinkedinKeywords}`,
    );

    return {
      country,
      functionRoot,
      businessDivisionLinkedinKeywords,
      businessDivisionEffective: {
        effectiveCountry: country === '' ? 'global' : country,
        effectiveFunctionRoot: functionRoot || undefined,
      },
    };
  }

  private buildFunctionGradeKeywordsHash(
    strategies: Array<{
      id?: string;
      label?: string;
      parameters?: Record<string, unknown>;
    }>,
  ): string {
    const normalized = strategies.map((strategy) => {
      const rawKeywords = strategy.parameters?.keywords;
      const rawJobTitle = strategy.parameters?.job_title;
      const keywords =
        typeof rawKeywords === 'string' ? rawKeywords.trim().toLowerCase() : '';
      const jobTitle =
        typeof rawJobTitle === 'string' ? rawJobTitle.trim().toLowerCase() : '';
      return {
        id: strategy.id ?? '',
        label: strategy.label ?? '',
        keywords,
        jobTitle,
      };
    });

    return createHash('sha256')
      .update(JSON.stringify(normalized))
      .digest('hex');
  }

  private logStrategies(strategies: PeopleSearchStrategyResult[]): void {
    this.logger.log(
      `Strategies extracted: ${strategies.length} strategies found`,
    );
    strategies.forEach((strategy) => {
      this.logger.log(
        `[Strategy: ${strategy.id}] Strategy details: ${JSON.stringify({ id: strategy.id, label: strategy.label }, null, 2)}`,
      );
      this.logger.log(
        `[Strategy: ${strategy.id}] Strategy parameters: ${JSON.stringify(strategy.parameters, null, 2)}`,
      );
    });
  }
}
