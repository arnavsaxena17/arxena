import { Injectable, Logger } from '@nestjs/common';
import { LinkedinUnipileEstimateAccountService } from 'src/engine/core-modules/arx-chat/services/linkedin-unipile-estimate-account.service';
import { LinkedinUnipileSessionService } from 'src/engine/core-modules/arx-chat/services/linkedin-unipile-session.service';
import { resolveEffectiveLinkedinSearchType } from 'src/engine/core-modules/arx-chat/utils/resolve-effective-linkedin-search-type.util';
import { OrgChartIntentService } from 'src/domains/org-graph/org-chart/services/org-chart-intent.service';
import { LinkedInStrategySource } from 'src/domains/org-graph/org-chart/build/services/linkedin-strategy-source.service';
import { OrgChartProgressRedisService } from 'src/domains/ingestion/candidate-sourcing/services/orgchart-progress-redis.service';
import { EnvironmentService } from 'src/engine/core-modules/environment/environment.service';
import { OrgChartCacheService } from 'src/domains/org-graph/org-chart/services/orgchart-cache.service';
import { OrgChartIncrementalBuildCacheService } from 'src/domains/org-graph/org-chart/services/orgchart-incremental-build-cache.service';
import { OrgchartCancelRegistryService } from 'src/domains/org-graph/org-chart/services/orgchart-cancel-registry.service';
import { OrgChartS3Service } from 'src/domains/org-graph/org-chart/services/orgchart-s3.service';
import { filterOrgChartCandidatesByCountryAndFunctionRoot } from 'src/domains/org-graph/org-chart/utils/orgchart-filter.util';
import {
  computeOrgChartLinkedInSearchPlan,
  getOrgChartLinkedInMaxCandidates,
} from 'src/domains/org-graph/org-chart/utils/orgchart-linkedin-scope.util';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
import { LinkedinParameterResolver } from 'src/domains/discovery/transport/linkedin-search/utils/linkedin-parameter-resolver.util';
import { constructSearchParamKey } from 'src/domains/discovery/query/utils/search-parameter.utils';
import {
  type OrgchartLinkedInRequestOptions,
  type OrgchartLinkedInRunOptions,
  type OrgchartLinkedInSearchResult,
  type OrgchartProgressEmitter,
} from 'src/domains/org-graph/org-chart/build/types/orgchart-linkedin-search.types';
import { dedupeAndReturnCandidates } from 'src/domains/org-graph/org-chart/build/services/orgchart-linkedin-candidates.util';
import {
  deriveOrgchartRequestFilters,
  normalizeOrgchartLinkedInRequest,
} from 'src/domains/org-graph/org-chart/build/services/orgchart-linkedin-request.util';
import {
  orgchartMaxStrategiesToRun,
  planStrategiesAndShards,
} from 'src/domains/org-graph/org-chart/build/services/orgchart-linkedin-strategy-plan.util';
import { OrgchartLinkedInQueryRouterService } from 'src/domains/org-graph/org-chart/build/services/orgchart-linkedin-query-router.service';
import { runStrategies } from 'src/domains/org-graph/org-chart/build/services/orgchart-linkedin-strategy-run.util';
import { resolveBusinessDivisionLinkedInContext } from 'src/domains/org-graph/org-chart/build/services/orgchart-business-division-context.util';
import { planUnlimitedShardsOrResume } from 'src/domains/org-graph/org-chart/build/services/orgchart-unipile-unlimited-plan.util';
import { ResultValidationService } from 'src/domains/evaluation/result-validation.service';
import { OrgchartUnipileShardPlannerService } from 'src/domains/org-graph/org-chart/build/services/orgchart-unipile-shard-planner.service';

// Finds a company's people on LinkedIn for an org chart. This class owns the
// request: normalisation, the two caches, the session and the progress
// events. The phases themselves are separate units, in the order they run:
//
//   planStrategiesAndShards -> runStrategies -> dedupeAndReturnCandidates
//
// with persistRawSnapshot saving the raw pages inside the run, and
// planUnlimitedShardsOrResume / resolveBusinessDivisionLinkedInContext as
// their own units because the estimate probe shares both.
@Injectable()
export class OrgChartLinkedInSearchService {
  private readonly logger = new Logger(OrgChartLinkedInSearchService.name);

  constructor(
    private readonly orgChartProgressRedisService: OrgChartProgressRedisService,
    private readonly orgChartS3Service: OrgChartS3Service,
    private readonly linkedInStrategySource: LinkedInStrategySource,
    private readonly resultValidationService: ResultValidationService,
    private readonly linkedinParameterResolver: LinkedinParameterResolver,
    private readonly orgchartLinkedInQueryRouterService: OrgchartLinkedInQueryRouterService,
    private readonly orgchartCancelRegistry: OrgchartCancelRegistryService,
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly orgChartCacheService: OrgChartCacheService,
    private readonly orgChartIntentService: OrgChartIntentService,
    private readonly linkedinUnipileSessionService: LinkedinUnipileSessionService,
    private readonly linkedinUnipileEstimateAccountService: LinkedinUnipileEstimateAccountService,
    private readonly environmentService: EnvironmentService,
    private readonly orgchartUnipileShardPlannerService: OrgchartUnipileShardPlannerService,
    private readonly orgChartIncrementalBuildCache: OrgChartIncrementalBuildCacheService,
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
    options?: OrgchartLinkedInRunOptions,
  ): Promise<OrgchartLinkedInSearchResult> {
    const searchCategory: 'people' = 'people';
    const parameterKey = constructSearchParamKey(searchType, searchCategory);
    const requirement = cleanedQuery || rawQuery;

    const request = normalizeOrgchartLinkedInRequest(options);
    const {
      mode,
      primaryCompanyName,
      primaryCompanyId,
      companyNames,
      rawCountryFromOptions,
      rawFunctionFromOptions,
      linkedinLocationId,
      linkedinLocationName,
      linkedinCompanyParameterIds,
      businessDivisionRaw,
    } = request;
    const requestId = options?.requestId;
    let country = request.country;
    let functionRoot = request.functionRoot;

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

    const emitProgress: OrgchartProgressEmitter = async (event, data) => {
      if (
        requestId &&
        (await this.orgchartCancelRegistry.isCancelled(requestId))
      ) {
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
      const bdContext = await resolveBusinessDivisionLinkedInContext(
        this.businessDivisionContextDeps(),
        {
          apiToken,
          businessDivisionRaw,
          primaryCompanyName,
          rawCountryFromOptions,
          rawFunctionFromOptions,
          requirement,
          sendEvent,
          onBeforeParse: async () => {
            await emitProgress('status', {
              message: 'Parsing business division query...',
            });
          },
          enrichSendEvent: (event, data) => {
            void emitProgress(event, data);
          },
        },
      );
      country = bdContext.country;
      functionRoot = bdContext.functionRoot;
      businessDivisionLinkedinKeywords =
        bdContext.businessDivisionLinkedinKeywords;
      businessDivisionEffective = bdContext.businessDivisionEffective;
    }

    // Derived after the business-division step, which can narrow either filter
    const { hasSubsetScopeFilters, isAllPeopleInCompanyMode } =
      deriveOrgchartRequestFilters(request, {
        searchType,
        country,
        functionRoot,
        leadershipOnly: options?.leadershipOnly,
      });

    // A function-grade request can be answered from the full-company list that
    // an entire-company run already stored, filtered to its function
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

      if (
        cachedCandidateList?.items &&
        Array.isArray(cachedCandidateList.items)
      ) {
        const filteredItems = filterOrgChartCandidatesByCountryAndFunctionRoot(
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

    return this.linkedinUnipileSessionService.withLinkedinSession(
      apiToken,
      options?.linkedinUnipileAccountId,
      async (linkedinSession) => {
        const effectiveSearchType = resolveEffectiveLinkedinSearchType(
          searchType,
          linkedinSession,
          this.environmentService.get('LINKEDIN_UNIPILE_INFER_SEARCH_TYPE'),
        );

        const plan = await planStrategiesAndShards(
          {
            logger: this.logger,
            orgchartLinkedInQueryRouterService:
              this.orgchartLinkedInQueryRouterService,
            linkedinParameterResolver: this.linkedinParameterResolver,
            linkedInStrategySource: this.linkedInStrategySource,
            orgChartCacheService: this.orgChartCacheService,
            planUnlimitedShards: (args) =>
              planUnlimitedShardsOrResume(
                {
                  logger: this.logger,
                  orgchartUnipileShardPlannerService:
                    this.orgchartUnipileShardPlannerService,
                  orgChartIncrementalBuildCache:
                    this.orgChartIncrementalBuildCache,
                  workspaceQueryService: this.workspaceQueryService,
                },
                args,
              ),
            ...(requestId !== undefined && {
              isCancelled: () =>
                this.orgchartCancelRegistry.isCancelled(requestId),
            }),
          },
          {
            rawQuery,
            cleanedQuery,
            requirement,
            searchType: effectiveSearchType,
            searchCategory,
            parameterKey,
            apiToken,
            mode,
            primaryCompanyName,
            primaryCompanyId,
            companyNames,
            jobTitles: options?.jobTitles,
            country,
            functionRoot,
            stdFunction: options?.stdFunction,
            stdGrade: options?.stdGrade,
            selectedNodeStdScopes: options?.selectedNodeStdScopes,
            businessDivisionLinkedinKeywords,
            isAllPeopleInCompanyMode,
            linkedinCompanyParameterIds,
            linkedinLocationId,
            linkedinLocationName,
            linkedinKeywords: options?.linkedinKeywords,
            linkedinJobTitle: options?.linkedinJobTitle,
            leadershipOnly: options?.leadershipOnly,
            unlimited: options?.unlimited === true,
            linkedinCompanyUrl: options?.linkedinCompanyUrl,
            industry: options?.industry,
            requestId,
            linkedInAccountId: linkedinSession.accountId,
            linkedInAccountIdSource: linkedinSession.accountIdSource,
            emitProgress,
            sendEvent,
          },
        );

        if (plan.outcome === 'cached') {
          return plan.result;
        }

        if (plan.outcome === 'cancelled') {
          return {
            items: [],
            itemCount: 0,
            strategyResults: plan.strategiesToRun.map((strategy) => ({
              strategy,
              result: null,
            })),
          };
        }

        const strategyResults = await runStrategies(
          {
            logger: this.logger,
            linkedInStrategySource: this.linkedInStrategySource,
            resultValidationService: this.resultValidationService,
            orgChartIncrementalBuildCache: this.orgChartIncrementalBuildCache,
            orgChartS3Service: this.orgChartS3Service,
          },
          {
            strategiesToRun: plan.strategiesToRun,
            ...(plan.searchPlan !== undefined && {
              searchPlan: plan.searchPlan,
            }),
            maxPages: plan.maxPages,
            linkedInExecutionOptions: plan.linkedInExecutionOptions,
            unlimitedProgress: plan.unlimitedProgress,
            unlimited: options?.unlimited === true,
            searchType: effectiveSearchType,
            searchCategory,
            parameterKey,
            apiToken,
            requirement,
            validateAndScoreLinkedInResults:
              options?.validateAndScoreLinkedInResults === true,
            requestId,
            primaryCompanyId,
            primaryCompanyName,
            mode,
            functionRoot,
            normalizedCountry: plan.normalizedCountry,
            linkedInAccountId: linkedinSession.accountId,
            emitProgressSync,
            emitProgress,
          },
        );

        const candidatesOut = dedupeAndReturnCandidates({
          strategyResults,
          hasSubsetScopeFilters,
          businessDivisionRequested:
            !!businessDivisionRaw && !!primaryCompanyName,
          country,
          functionRoot,
          mode,
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
          plan.isFunctionGradeMode &&
          primaryCompanyName &&
          plan.normalizedFunctionRoot &&
          candidatesOut.length > 0
        ) {
          await this.orgChartCacheService.setCachedFunctionGradeSearch({
            companyName: primaryCompanyName,
            companyId: primaryCompanyId,
            functionRoot: plan.normalizedFunctionRoot,
            country: plan.normalizedCountry,
            searchType: effectiveSearchType,
            strategyCap: plan.maxStrategiesToRun,
            keywordsHash: plan.keywordsHash,
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
            plan.isFunctionGradeMode && plan.normalizedFunctionRoot
              ? {
                  strategyCap: plan.maxStrategiesToRun,
                  keywordsHash: plan.keywordsHash,
                  functionRoot: plan.normalizedFunctionRoot,
                  country: plan.normalizedCountry,
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
      },
    );
  }

  async estimateLinkedInOrgChartSearch(
    rawQuery: string,
    cleanedQuery: string,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    apiToken: string,
    options?: OrgchartLinkedInRequestOptions,
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

    const request = normalizeOrgchartLinkedInRequest(options);
    const {
      mode,
      primaryCompanyName,
      companyNames,
      rawCountryFromOptions,
      rawFunctionFromOptions,
      linkedinLocationId,
      linkedinLocationName,
      linkedinCompanyParameterIds,
      businessDivisionRaw,
    } = request;
    let country = request.country;
    let functionRoot = request.functionRoot;

    let businessDivisionLinkedinKeywords: string | undefined;
    if (businessDivisionRaw && primaryCompanyName) {
      const bdContext = await resolveBusinessDivisionLinkedInContext(
        this.businessDivisionContextDeps(),
        {
          apiToken,
          businessDivisionRaw,
          primaryCompanyName,
          rawCountryFromOptions,
          rawFunctionFromOptions,
          requirement,
        },
      );
      country = bdContext.country;
      functionRoot = bdContext.functionRoot;
      businessDivisionLinkedinKeywords =
        bdContext.businessDivisionLinkedinKeywords;
    }

    // Same derivation as the run: a location or leadership filter narrows the
    // search here too, so the estimate cannot call a narrowed request "everyone"
    const { isAllPeopleInCompanyMode } = deriveOrgchartRequestFilters(request, {
      searchType,
      country,
      functionRoot,
      leadershipOnly: options?.leadershipOnly,
    });

    return this.linkedinUnipileEstimateAccountService.withEstimateLinkedinSession(
      apiToken,
      options?.linkedinUnipileAccountId,
      async (linkedinSession) => {
        const effectiveSearchType = resolveEffectiveLinkedinSearchType(
          searchType,
          linkedinSession,
          this.environmentService.get('LINKEDIN_UNIPILE_INFER_SEARCH_TYPE'),
        );

        const routerOutcome =
          await this.orgchartLinkedInQueryRouterService.buildOrgchartLinkedInStrategies(
            {
              rawQuery,
              cleanedQuery,
              requirement,
              searchType: effectiveSearchType,
              mode,
              primaryCompanyName,
              companyNames: companyNames.length > 0 ? companyNames : undefined,
              jobTitles: options?.jobTitles,
              country,
              functionRoot,
              stdFunction: options?.stdFunction,
              stdGrade: options?.stdGrade,
              selectedNodeStdScopes: options?.selectedNodeStdScopes,
              businessDivisionLinkedinKeywords,
              isAllPeopleInCompanyMode,
              apiToken,
              linkedinCompanyIds:
                linkedinCompanyParameterIds.length > 0
                  ? linkedinCompanyParameterIds
                  : undefined,
              linkedinLocationIds: linkedinLocationId
                ? [linkedinLocationId]
                : undefined,
              linkedinCompanyDisplay:
                linkedinCompanyParameterIds.length > 0
                  ? linkedinCompanyParameterIds.map((id, index) => ({
                      id,
                      title: companyNames[index] || primaryCompanyName || id,
                    }))
                  : undefined,
              linkedinLocationDisplay: linkedinLocationId
                ? [
                    {
                      id: linkedinLocationId,
                      title: linkedinLocationName || linkedinLocationId,
                    },
                  ]
                : undefined,
              linkedinKeywords: options?.linkedinKeywords,
              linkedinJobTitle: options?.linkedinJobTitle,
            },
          );

        const strategies = routerOutcome.strategies;
        const searchCategory: 'people' = 'people';
        const parameterKey = constructSearchParamKey(
          effectiveSearchType,
          searchCategory,
        );
        const maxStrategies = orgchartMaxStrategiesToRun();
        const strategiesToRun =
          strategies.length > 0 ? strategies.slice(0, maxStrategies) : [];
        const linkedInExecutionOptions = {
          forceClassicPeopleJson: true as const,
          linkedInAccountId: linkedinSession.accountId,
          linkedInAccountIdSource: linkedinSession.accountIdSource,
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
          for (const strategyToResolve of strategiesToRun) {
            strategyToResolve.parameters =
              await this.linkedinParameterResolver.resolveParameterIds(
                strategyToResolve.parameters,
                linkedinSession.accountId,
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

        const probe = await this.linkedInStrategySource.probe(
          strategiesToRun[0],
          effectiveSearchType,
          searchCategory,
          parameterKey,
          apiToken,
          linkedInExecutionOptions,
        );
        const totalCount = probe?.totalCount ?? 0;
        const plan = computeOrgChartLinkedInSearchPlan({
          totalCountFromApi: totalCount,
          strategiesToRun: strategiesToRun.length,
          searchType: effectiveSearchType,
          country,
          functionRoot,
          linkedinLocationId,
          leadershipOnly: options?.leadershipOnly,
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
      },
    );
  }

  private businessDivisionContextDeps() {
    return {
      logger: this.logger,
      workspaceQueryService: this.workspaceQueryService,
      orgChartIntentService: this.orgChartIntentService,
      orgchartLinkedInQueryRouterService:
        this.orgchartLinkedInQueryRouterService,
    };
  }
}
