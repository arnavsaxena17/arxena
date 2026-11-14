import { type Logger } from '@nestjs/common';

import {
  type LinkedInStrategySource,
  type SearchExecutionOptions,
} from 'src/domains/org-graph/org-chart/build/services/linkedin-strategy-source.service';
import { type ResultValidationService } from 'src/domains/evaluation/result-validation.service';
import { runStrategySearch } from 'src/domains/org-graph/org-chart/build/services/strategy-search.util';
import { type PeopleSearchStrategyResult } from 'src/domains/org-graph/org-chart/build/utils/extract-strategies.util';
import {
  type OrgChartIncrementalBuildCacheService,
  type OrgchartUnipileUnlimitedProgress,
} from 'src/domains/org-graph/org-chart/services/orgchart-incremental-build-cache.service';
import { type OrgChartS3Service } from 'src/domains/org-graph/org-chart/services/orgchart-s3.service';
import { ORGCHART_UNIPILE_UNLIMITED_OVERALL_MAX_CANDIDATES } from 'src/domains/org-graph/org-chart/utils/orgchart-linkedin-scope.util';

import {
  type OrgchartSearchExecutionResult,
  type OrgchartStrategyResult,
  type OrgchartSyncProgressEmitter,
} from 'src/domains/org-graph/org-chart/build/types/orgchart-linkedin-search.types';
import { type OrgchartSearchPlan } from 'src/domains/org-graph/org-chart/build/services/orgchart-linkedin-strategy-plan.util';
import { persistRawSnapshot } from 'src/domains/org-graph/org-chart/build/services/orgchart-unipile-raw-snapshot.util';

// RUN: each strategy through the one fetch round, in order, persisting the raw
// snapshot after each so a rebuild resumes where this run stopped. An
// unlimited run is the same loop over shards, with its own frozen progress so
// a resumed request skips the shards it already fetched.
export const runStrategies = async (
  deps: {
    logger: Logger;
    linkedInStrategySource: Pick<
      LinkedInStrategySource,
      'withSession' | 'prepare' | 'fetchPage'
    >;
    resultValidationService: Pick<
      ResultValidationService,
      'validateResultsAgainstQuery' | 'shouldContinuePagination'
    >;
    orgChartIncrementalBuildCache: Pick<
      OrgChartIncrementalBuildCacheService,
      'setUnlimitedUnipile' | 'clearUnlimitedUnipile'
    >;
    orgChartS3Service: Pick<
      OrgChartS3Service,
      'persistedCompanyFolderKey' | 'saveUnipileRawSearch'
    >;
  },
  input: {
    strategiesToRun: PeopleSearchStrategyResult[];
    searchPlan?: OrgchartSearchPlan;
    // Where an earlier request left off; null when this is the first run
    unlimitedProgress: OrgchartUnipileUnlimitedProgress | null;
    unlimited: boolean;
    // Pages one strategy may fetch, from the plan
    maxPages: number;
    // Built once by the plan: throttling, account and page ceiling
    linkedInExecutionOptions: SearchExecutionOptions;
    searchType: 'classic' | 'sales_navigator' | 'recruiter';
    searchCategory: 'people' | 'companies' | 'posts' | 'jobs';
    parameterKey: string;
    apiToken: string;
    requirement: string;
    validateAndScoreLinkedInResults: boolean;
    requestId?: string;
    primaryCompanyId: string;
    primaryCompanyName: string;
    mode?: string;
    functionRoot: string;
    normalizedCountry: string;
    linkedInAccountId: string;
    emitProgressSync: OrgchartSyncProgressEmitter;
    emitProgress: (
      event: string,
      data: Record<string, unknown>,
    ) => Promise<boolean | void>;
  },
): Promise<OrgchartStrategyResult[]> => {
  const strategyResults: OrgchartStrategyResult[] = [];
  const completedStrategyIds = new Set(
    input.unlimitedProgress?.completedStrategyIds ?? [],
  );
  const unlimitedShardsTotal =
    input.unlimitedProgress?.compiledShards.length ??
    (input.unlimited ? input.strategiesToRun.length : 0);
  const unlimitedEstimatedTotal =
    input.searchPlan?.estimatedTotalUpperBound ??
    input.searchPlan?.estimatedTotal ??
    undefined;
  let unlimitedProgress = input.unlimitedProgress;

  const profilesCollectedSoFar = (): number =>
    strategyResults.reduce(
      (sum, row) => sum + (row.result?.transformedCandidates?.length ?? 0),
      0,
    );

  const emitUnlimitedShardProgress = async (step: {
    phase: 'started' | 'completed';
    strategyId: string;
    currentShardKey: string;
  }): Promise<void> => {
    if (!input.unlimited || unlimitedShardsTotal <= 0) {
      return;
    }

    const collected = profilesCollectedSoFar();
    const shardsCompleted = completedStrategyIds.size;
    const remainingProfiles =
      typeof unlimitedEstimatedTotal === 'number'
        ? Math.max(0, unlimitedEstimatedTotal - collected)
        : undefined;

    if (input.requestId && unlimitedProgress) {
      unlimitedProgress = {
        ...unlimitedProgress,
        phase: step.phase,
        currentShardKey: step.currentShardKey,
        currentStrategyId:
          step.phase === 'started' ? step.strategyId : undefined,
        profilesCollectedSoFar: collected,
        estimatedTotal: unlimitedEstimatedTotal,
        completedStrategyIds: [...completedStrategyIds],
        updatedAt: new Date().toISOString(),
      };
      await deps.orgChartIncrementalBuildCache.setUnlimitedUnipile(
        input.requestId,
        unlimitedProgress,
      );
    }

    await input.emitProgress('unlimitedShardProgress', {
      message:
        step.phase === 'started'
          ? `Fetching shard ${shardsCompleted + 1}/${unlimitedShardsTotal} (${step.currentShardKey})…`
          : `Finished shard ${shardsCompleted}/${unlimitedShardsTotal} (${step.currentShardKey}). ~${collected.toLocaleString()} profiles so far${
              remainingProfiles !== undefined
                ? `, ~${remainingProfiles.toLocaleString()} remaining`
                : ''
            }.`,
      phase: step.phase,
      strategyId: step.strategyId,
      currentShardKey: step.currentShardKey,
      shardsCompleted,
      shardsTotal: unlimitedShardsTotal,
      profilesCollectedSoFar: collected,
      estimatedTotal: unlimitedEstimatedTotal,
      remainingProfiles,
      // Reuse pagination fields so existing FE progress UI can map shards
      page: Math.max(1, shardsCompleted + (step.phase === 'started' ? 1 : 0)),
      totalPages: unlimitedShardsTotal,
      totalCandidates: collected,
      remainingToFetch: remainingProfiles,
    });
  };

  for (const strategy of input.strategiesToRun) {
    if (completedStrategyIds.has(strategy.id)) {
      deps.logger.log(
        `OrgchartLinkedInSearch unlimited: skipping completed strategy ${strategy.id}`,
      );
      continue;
    }

    if (
      input.unlimited &&
      profilesCollectedSoFar() >=
        ORGCHART_UNIPILE_UNLIMITED_OVERALL_MAX_CANDIDATES
    ) {
      deps.logger.log(
        `OrgchartLinkedInSearch unlimited: reached overall max ${ORGCHART_UNIPILE_UNLIMITED_OVERALL_MAX_CANDIDATES}`,
      );
      break;
    }

    const currentShardKey = strategy.id.includes('__')
      ? strategy.id.slice(strategy.id.lastIndexOf('__') + 2)
      : strategy.id;

    if (input.requestId && unlimitedProgress) {
      unlimitedProgress = {
        ...unlimitedProgress,
        currentStrategyId: strategy.id,
        updatedAt: new Date().toISOString(),
      };
      await deps.orgChartIncrementalBuildCache.setUnlimitedUnipile(
        input.requestId,
        unlimitedProgress,
      );
    }

    await emitUnlimitedShardProgress({
      phase: 'started',
      strategyId: strategy.id,
      currentShardKey,
    });

    // A validated search streams and reviews each page against the request; a
    // fast search runs the plan's page count with the plan's throttling
    const preview = await runStrategySearch({
      source: deps.linkedInStrategySource,
      logger: deps.logger,
      strategy,
      searchType: input.searchType,
      searchCategory: input.searchCategory,
      parameterKey: input.parameterKey,
      apiToken: input.apiToken,
      sendEvent: input.emitProgressSync,
      ...(input.validateAndScoreLinkedInResults
        ? {
            executionOptions: {
              forceClassicPeopleJson: true,
              linkedInAccountId: input.linkedInAccountId,
            },
            stream: {
              ...(input.requirement
                ? {
                    review: {
                      userMessage: input.requirement,
                      resultValidationService: deps.resultValidationService,
                    },
                  }
                : {}),
            },
          }
        : {
            executionOptions: input.linkedInExecutionOptions,
            maxPages: input.maxPages,
          }),
    });

    strategyResults.push({
      strategy,
      result: preview as OrgchartSearchExecutionResult | null,
    });

    completedStrategyIds.add(strategy.id);

    if (input.requestId && unlimitedProgress) {
      unlimitedProgress = {
        ...unlimitedProgress,
        completedStrategyIds: [...completedStrategyIds],
        currentStrategyId: undefined,
        currentCursor: undefined,
        updatedAt: new Date().toISOString(),
      };
      await deps.orgChartIncrementalBuildCache.setUnlimitedUnipile(
        input.requestId,
        unlimitedProgress,
      );
    }

    await emitUnlimitedShardProgress({
      phase: 'completed',
      strategyId: strategy.id,
      currentShardKey,
    });

    // Persist raw Unipile pages even if transform/filter later drops everyone.
    await persistRawSnapshot(deps.orgChartS3Service, {
      strategyResults,
      searchType: input.searchType,
      companyId: input.primaryCompanyId,
      companyName: input.primaryCompanyName,
      mode: input.mode,
      functionRoot: input.functionRoot,
      country: input.normalizedCountry,
      requestId: input.requestId,
    });
  }

  if (input.requestId && input.unlimited && unlimitedProgress) {
    await deps.orgChartIncrementalBuildCache.clearUnlimitedUnipile(
      input.requestId,
    );
  }

  return strategyResults;
};
