import { type Logger } from '@nestjs/common';

import { type OrgchartUnipileShardPlannerService } from 'src/domains/org-graph/org-chart/build/services/orgchart-unipile-shard-planner.service';
import {
  type OrgChartIncrementalBuildCacheService,
  type OrgchartUnipileUnlimitedProgress,
} from 'src/domains/org-graph/org-chart/services/orgchart-incremental-build-cache.service';
import { getOrgChartUnipileUnlimitedMaxCandidatesPerShard } from 'src/domains/org-graph/org-chart/utils/orgchart-linkedin-scope.util';
import { type WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';

import { type OrgchartUnlimitedPlanArgs } from 'src/domains/org-graph/org-chart/build/types/orgchart-linkedin-search.types';

// UNLIMITED PLAN: a company too large for one LinkedIn search becomes the
// shards of a frozen plan. A resumed request reuses the plan it already has
// instead of buying another LLM plan.
export const planUnlimitedShardsOrResume = async (
  deps: {
    logger: Logger;
    orgchartUnipileShardPlannerService: Pick<
      OrgchartUnipileShardPlannerService,
      'planAndCompile'
    >;
    orgChartIncrementalBuildCache: Pick<
      OrgChartIncrementalBuildCacheService,
      'getUnlimitedUnipile' | 'setUnlimitedUnipile'
    >;
    workspaceQueryService: Pick<
      WorkspaceQueryService,
      'getWorkspaceIdFromToken'
    >;
  },
  args: OrgchartUnlimitedPlanArgs,
): Promise<OrgchartUnipileUnlimitedProgress | null> => {
  const requestId = args.requestId?.trim();

  if (requestId) {
    const existing =
      await deps.orgChartIncrementalBuildCache.getUnlimitedUnipile(requestId);

    if (existing?.compiledShards?.length) {
      deps.logger.log(
        `OrgchartLinkedInSearch unlimited: resuming frozen plan requestId=${requestId} shards=${existing.compiledShards.length} completed=${existing.completedStrategyIds.length}`,
      );

      return existing;
    }
  }

  const workspaceId = await deps.workspaceQueryService.getWorkspaceIdFromToken(
    args.apiToken,
  );

  if (!workspaceId) {
    deps.logger.warn(
      'OrgchartLinkedInSearch unlimited: no workspaceId; skipping shard plan',
    );

    return null;
  }

  await args.emitProgress('status', {
    message: 'Planning unlimited Unipile shards (LLM)…',
  });

  let planned = await deps.orgchartUnipileShardPlannerService.planAndCompile({
    workspaceId,
    companyName: args.companyName,
    linkedinCompanyUrl: args.linkedinCompanyUrl,
    country: args.country,
    industry: args.industry,
    totalCount: args.totalCount,
    linkedInAccountId: args.linkedInAccountId,
  });

  const maxPerShard = getOrgChartUnipileUnlimitedMaxCandidatesPerShard();
  const remaining = planned.compiledShards.find(
    (shard) => shard.remaining === true,
  );

  // One secondary plan when remaining may still exceed the per-search ceiling
  if (
    remaining &&
    args.totalCount > maxPerShard * Math.max(2, planned.compiledShards.length)
  ) {
    try {
      const secondary =
        await deps.orgchartUnipileShardPlannerService.planAndCompile({
          workspaceId,
          companyName: args.companyName,
          linkedinCompanyUrl: args.linkedinCompanyUrl,
          country: args.country,
          industry: args.industry,
          totalCount: Math.max(
            maxPerShard + 1,
            Math.floor(args.totalCount / planned.compiledShards.length),
          ),
          linkedInAccountId: args.linkedInAccountId,
          parentDimension: planned.plan.primaryDimension,
          parentExcludedLabels: remaining.excludeLabels,
        });
      const includeOnly = planned.compiledShards.filter(
        (shard) => shard.remaining !== true,
      );

      planned = {
        plan: {
          ...planned.plan,
          rationale: `${planned.plan.rationale} Secondary: ${secondary.plan.rationale}`,
          shards: [
            ...planned.plan.shards.filter((shard) => shard.remaining !== true),
            ...secondary.plan.shards,
          ],
        },
        compiledShards: [...includeOnly, ...secondary.compiledShards],
        droppedLabels: [...planned.droppedLabels, ...secondary.droppedLabels],
      };
    } catch (error) {
      deps.logger.warn(
        `OrgchartLinkedInSearch unlimited: secondary remaining plan failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  const progress: OrgchartUnipileUnlimitedProgress = {
    plan: planned.plan,
    compiledShards: planned.compiledShards,
    completedStrategyIds: [],
    collectedProfileKeys: [],
    profilesCollectedSoFar: 0,
    estimatedTotal: args.totalCount,
    updatedAt: new Date().toISOString(),
  };

  if (requestId) {
    await deps.orgChartIncrementalBuildCache.setUnlimitedUnipile(
      requestId,
      progress,
      { companyName: args.companyName },
    );
  }

  return progress;
};
