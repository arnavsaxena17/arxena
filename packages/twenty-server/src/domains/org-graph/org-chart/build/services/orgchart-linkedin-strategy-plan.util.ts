import { type Logger } from '@nestjs/common';
import { createHash } from 'crypto';

import {
  type LinkedInStrategySource,
  type SearchExecutionOptions,
} from 'src/domains/org-graph/org-chart/build/services/linkedin-strategy-source.service';
import { type OrgchartLinkedInQueryRouterService } from 'src/domains/org-graph/org-chart/build/services/orgchart-linkedin-query-router.service';
import { type LinkedinParameterResolver } from 'src/domains/discovery/transport/linkedin-search/utils/linkedin-parameter-resolver.util';
import { expandStrategiesWithOrgchartUnipileShards } from 'src/domains/org-graph/org-chart/build/utils/apply-orgchart-unipile-shard.util';
import { type PeopleSearchStrategyResult } from 'src/domains/org-graph/org-chart/build/utils/extract-strategies.util';
import { OrgChartLinkedInScopeRequiredError } from 'src/domains/org-graph/org-chart/errors/orgchart-linkedin-scope-required.error';
import { type OrgChartCacheService } from 'src/domains/org-graph/org-chart/services/orgchart-cache.service';
import { type OrgchartUnipileUnlimitedProgress } from 'src/domains/org-graph/org-chart/services/orgchart-incremental-build-cache.service';
import {
  computeOrgChartLinkedInMaxPages,
  computeOrgChartLinkedInSearchPlan,
  getOrgChartLinkedInMaxCandidates,
  getOrgChartUnipileUnlimitedMaxCandidatesPerShard,
  randomOrgChartUnipileUnlimitedRequestDelayMs,
} from 'src/domains/org-graph/org-chart/utils/orgchart-linkedin-scope.util';
import {
  normalizeCountry,
  normalizeFunctionRoot,
} from 'src/domains/org-graph/org-chart/utils/orgchart-normalization.util';

import {
  type OrgchartLinkedInSearchResult,
  type OrgchartProgressEmitter,
  type OrgchartUnlimitedPlanArgs,
} from 'src/domains/org-graph/org-chart/build/types/orgchart-linkedin-search.types';

// The search plan is the scope util's answer: one definition of it, not a copy
export type OrgchartSearchPlan = ReturnType<
  typeof computeOrgChartLinkedInSearchPlan
>;

// How many extracted strategies one request runs. Default 1, so a request
// never fans out unless it is asked to.
export const orgchartMaxStrategiesToRun = (): number => {
  const raw = process.env.ORGCHART_MAX_STRATEGIES;
  const parsed = raw !== undefined ? Number.parseInt(raw, 10) : NaN;

  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
};

// The strategy cap plus each strategy's keywords: the key of the
// function-grade answer. A different plan is a different cache entry.
export const buildFunctionGradeKeywordsHash = (
  strategies: Array<{
    id?: string;
    label?: string;
    parameters?: Record<string, unknown>;
  }>,
): string => {
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

  return createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
};

export type OrgchartStrategyPlanOutcome =
  // The same plan already answered this request
  | { outcome: 'cached'; result: OrgchartLinkedInSearchResult }
  // The user cancelled before anything was fetched
  | {
      outcome: 'cancelled';
      strategiesToRun: PeopleSearchStrategyResult[];
    }
  | {
      outcome: 'run';
      strategiesToRun: PeopleSearchStrategyResult[];
      searchPlan?: OrgchartSearchPlan;
      // Pages one strategy may fetch
      maxPages: number;
      linkedInExecutionOptions: SearchExecutionOptions;
      unlimitedProgress: OrgchartUnipileUnlimitedProgress | null;
      maxStrategiesToRun: number;
      keywordsHash: string;
      normalizedFunctionRoot: string;
      normalizedCountry: string;
      isFunctionGradeMode: boolean;
    };

// PLAN: the request as ranked strategies, then the shards of an unlimited
// plan when one search cannot hold the company. Free to run, and the probe is
// the only call that spends here. Nothing is fetched; that is runStrategies.
export const planStrategiesAndShards = async (
  deps: {
    logger: Logger;
    orgchartLinkedInQueryRouterService: Pick<
      OrgchartLinkedInQueryRouterService,
      'buildOrgchartLinkedInStrategies'
    >;
    linkedinParameterResolver: Pick<
      LinkedinParameterResolver,
      'resolveParameterIds'
    >;
    linkedInStrategySource: Pick<LinkedInStrategySource, 'probe'>;
    orgChartCacheService: Pick<
      OrgChartCacheService,
      'getCachedFunctionGradeSearch'
    >;
    planUnlimitedShards: (
      args: OrgchartUnlimitedPlanArgs,
    ) => Promise<OrgchartUnipileUnlimitedProgress | null>;
    // Asked between planning and spending, so a cancelled request buys nothing
    isCancelled?: () => Promise<boolean>;
  },
  input: {
    rawQuery: string;
    cleanedQuery: string;
    requirement: string;
    searchType: 'classic' | 'sales_navigator' | 'recruiter';
    searchCategory: 'people' | 'companies' | 'posts' | 'jobs';
    parameterKey: string;
    apiToken: string;
    mode?: string;
    primaryCompanyName: string;
    primaryCompanyId: string;
    companyNames: string[];
    jobTitles?: string[];
    country: string;
    functionRoot: string;
    stdFunction?: string;
    stdGrade?: string;
    selectedNodeStdScopes?: Array<{
      stdFunction?: string;
      stdGrade?: string;
    }>;
    businessDivisionLinkedinKeywords?: string;
    isAllPeopleInCompanyMode: boolean;
    linkedinCompanyParameterIds: string[];
    linkedinLocationId: string;
    linkedinLocationName: string;
    linkedinKeywords?: string;
    linkedinJobTitle?: string;
    leadershipOnly?: boolean;
    unlimited: boolean;
    linkedinCompanyUrl?: string;
    industry?: string;
    requestId?: string;
    linkedInAccountId: string;
    linkedInAccountIdSource?: string;
    emitProgress: OrgchartProgressEmitter;
    sendEvent?: (event: string, data: unknown) => void;
  },
): Promise<OrgchartStrategyPlanOutcome> => {
  const routerOutcome =
    await deps.orgchartLinkedInQueryRouterService.buildOrgchartLinkedInStrategies(
      {
        rawQuery: input.rawQuery,
        cleanedQuery: input.cleanedQuery,
        requirement: input.requirement,
        searchType: input.searchType,
        mode: input.mode,
        primaryCompanyName: input.primaryCompanyName,
        companyNames:
          input.companyNames.length > 0 ? input.companyNames : undefined,
        jobTitles: input.jobTitles,
        country: input.country,
        functionRoot: input.functionRoot,
        stdFunction: input.stdFunction,
        stdGrade: input.stdGrade,
        selectedNodeStdScopes: input.selectedNodeStdScopes,
        businessDivisionLinkedinKeywords:
          input.businessDivisionLinkedinKeywords,
        isAllPeopleInCompanyMode: input.isAllPeopleInCompanyMode,
        apiToken: input.apiToken,
        sendEvent: input.sendEvent,
        linkedinCompanyIds:
          input.linkedinCompanyParameterIds.length > 0
            ? input.linkedinCompanyParameterIds
            : undefined,
        linkedinLocationIds: input.linkedinLocationId
          ? [input.linkedinLocationId]
          : undefined,
        linkedinCompanyDisplay:
          input.linkedinCompanyParameterIds.length > 0
            ? input.linkedinCompanyParameterIds.map((id, index) => ({
                id,
                title:
                  input.companyNames[index] || input.primaryCompanyName || id,
              }))
            : undefined,
        linkedinLocationDisplay: input.linkedinLocationId
          ? [
              {
                id: input.linkedinLocationId,
                title: input.linkedinLocationName || input.linkedinLocationId,
              },
            ]
          : undefined,
        linkedinKeywords: input.linkedinKeywords,
        linkedinJobTitle: input.linkedinJobTitle,
      },
    );

  const strategies = routerOutcome.strategies;
  const shouldPreResolveOrgchartStrategies =
    (!!input.businessDivisionLinkedinKeywords && !!input.primaryCompanyName) ||
    input.isAllPeopleInCompanyMode ||
    strategies.length > 0;

  deps.logger.log(`Total number of strategies created: ${strategies.length}`);

  const maxStrategies = orgchartMaxStrategiesToRun();
  let strategiesToRun =
    strategies.length > 0 ? strategies.slice(0, maxStrategies) : [];

  deps.logger.log(
    `OrgchartLinkedInSearch: strategy execution cap=${maxStrategies}, extracted=${strategies.length}, executing=${strategiesToRun.length}`,
  );

  const isFunctionGradeMode = input.mode === 'function_grade';
  const normalizedFunctionRoot = normalizeFunctionRoot(input.functionRoot);
  const normalizedCountry = normalizeCountry(input.country);
  const keywordsHash = buildFunctionGradeKeywordsHash(strategiesToRun);

  if (
    isFunctionGradeMode &&
    input.primaryCompanyName &&
    normalizedFunctionRoot
  ) {
    const cachedFunctionGrade =
      await deps.orgChartCacheService.getCachedFunctionGradeSearch({
        companyName: input.primaryCompanyName,
        companyId: input.primaryCompanyId,
        functionRoot: normalizedFunctionRoot,
        country: normalizedCountry,
        searchType: input.searchType,
        strategyCap: maxStrategies,
        keywordsHash,
      });

    if (cachedFunctionGrade) {
      deps.logger.log(
        `OrgchartLinkedInSearch: function-grade cache HIT for company="${input.primaryCompanyName}", functionRoot="${normalizedFunctionRoot}", country="${normalizedCountry}", strategyCap=${maxStrategies}`,
      );
      await input.emitProgress('complete', {
        message: `Loaded cached org chart people search with ${cachedFunctionGrade.itemCount} candidates.`,
        itemCount: cachedFunctionGrade.itemCount,
        strategyCount: strategiesToRun.length,
        isCached: true,
      });

      return {
        outcome: 'cached',
        result: {
          items: cachedFunctionGrade.items,
          itemCount: cachedFunctionGrade.itemCount,
          isCached: true,
          cacheSource: 'function_grade',
          orgChart: cachedFunctionGrade.orgChart,
          functionGradeCacheMeta: {
            strategyCap: maxStrategies,
            keywordsHash,
            functionRoot: normalizedFunctionRoot,
            country: normalizedCountry,
          },
          strategyResults: strategiesToRun.map((strategy) => ({
            strategy,
            result: null,
          })),
        },
      };
    }
  }

  if (deps.isCancelled !== undefined && (await deps.isCancelled())) {
    deps.logger.log(
      `Orgchart search aborted by user before execution. requestId=${input.requestId ?? ''}`,
    );

    return { outcome: 'cancelled', strategiesToRun };
  }

  const unlimitedMaxPerShard =
    getOrgChartUnipileUnlimitedMaxCandidatesPerShard();
  const maxCandidates = input.unlimited
    ? unlimitedMaxPerShard
    : getOrgChartLinkedInMaxCandidates();
  const linkedInExecutionOptions: SearchExecutionOptions = {
    forceClassicPeopleJson: true,
    linkedInAccountId: input.linkedInAccountId,
    linkedInAccountIdSource: input.linkedInAccountIdSource,
    throttlePages: true,
    maxCandidates,
    ...(input.unlimited
      ? {
          pageDelayMs: randomOrgChartUnipileUnlimitedRequestDelayMs,
          throttleBeforeFirstPage: true,
        }
      : {}),
  };

  if (shouldPreResolveOrgchartStrategies && strategiesToRun[0]) {
    try {
      for (const strategyToResolve of strategiesToRun) {
        strategyToResolve.parameters =
          await deps.linkedinParameterResolver.resolveParameterIds(
            strategyToResolve.parameters,
            input.linkedInAccountId,
            strategyToResolve.id,
          );
      }
    } catch (error) {
      deps.logger.error(
        `Failed to parameterize orgchart LinkedIn search strategies`,
        error as Error,
      );
    }
  }

  let searchPlan: OrgchartSearchPlan | undefined;
  let unlimitedProgress: OrgchartUnipileUnlimitedProgress | null = null;
  const probeStrategy = strategiesToRun[0];

  if (probeStrategy) {
    try {
      const probe = await deps.linkedInStrategySource.probe(
        probeStrategy,
        input.searchType,
        input.searchCategory,
        input.parameterKey,
        input.apiToken,
        linkedInExecutionOptions,
      );

      if (probe) {
        searchPlan = computeOrgChartLinkedInSearchPlan({
          totalCountFromApi: probe.totalCount,
          strategiesToRun: strategiesToRun.length,
          searchType: input.searchType,
          country: input.country,
          functionRoot: input.functionRoot,
          linkedinLocationId: input.linkedinLocationId,
          leadershipOnly: input.leadershipOnly,
          maxCandidates,
        });

        await input.emitProgress('searchPlan', {
          ...searchPlan,
          unlimited: input.unlimited,
          strategyId: probeStrategy.id,
          strategyLabel: probeStrategy.label,
        });

        if (searchPlan.scopeRequired && !input.unlimited) {
          throw new OrgChartLinkedInScopeRequiredError(
            `LinkedIn reports ~${searchPlan.estimatedTotalUpperBound.toLocaleString()} matches. Select a country, function, or leadership filter to narrow the search (limit ${searchPlan.threshold}).`,
            {
              totalCount: searchPlan.estimatedTotalUpperBound,
              threshold: searchPlan.threshold,
              estimatedApiRequests: searchPlan.estimatedApiRequests,
            },
          );
        }

        if (input.unlimited && probe.totalCount > unlimitedMaxPerShard) {
          unlimitedProgress = await deps.planUnlimitedShards({
            requestId: input.requestId,
            apiToken: input.apiToken,
            companyName: input.primaryCompanyName,
            linkedinCompanyUrl: input.linkedinCompanyUrl,
            country: input.country,
            industry: input.industry,
            totalCount: probe.totalCount,
            linkedInAccountId: input.linkedInAccountId,
            emitProgress: input.emitProgress,
          });

          if (unlimitedProgress?.compiledShards.length) {
            // The whole company is the shards now: the probe strategy was
            // only a way to find out how large it is
            strategiesToRun = expandStrategiesWithOrgchartUnipileShards({
              strategies: [probeStrategy],
              shards: unlimitedProgress.compiledShards,
              searchType: input.searchType,
            });
            await input.emitProgress('unlimitedShardPlan', {
              message: `Unlimited mode: ${unlimitedProgress.compiledShards.length} shards (${unlimitedProgress.plan.primaryDimension})`,
              primaryDimension: unlimitedProgress.plan.primaryDimension,
              shardKeys: unlimitedProgress.compiledShards.map(
                (shard) => shard.key,
              ),
              intentSummary: unlimitedProgress.plan.intentSummary,
            });
          }
        }
      }
    } catch (error) {
      if (error instanceof OrgChartLinkedInScopeRequiredError) {
        throw error;
      }

      deps.logger.warn(
        `OrgchartLinkedInSearch: probe first page failed, continuing without pre-flight count: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  return {
    outcome: 'run',
    strategiesToRun,
    ...(searchPlan !== undefined && { searchPlan }),
    maxPages:
      searchPlan?.maxPages ??
      computeOrgChartLinkedInMaxPages(
        undefined,
        maxCandidates,
        input.searchType,
      ),
    linkedInExecutionOptions,
    unlimitedProgress,
    maxStrategiesToRun: maxStrategies,
    keywordsHash,
    normalizedFunctionRoot,
    normalizedCountry,
    isFunctionGradeMode,
  };
};
