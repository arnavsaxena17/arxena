import type { PeopleSearchStrategyResult } from 'src/engine/core-modules/candidate-search/utils/extract-strategies.util';
import type { OrgchartUnipileCompiledShard } from 'src/engine/core-modules/candidate-search/utils/compile-orgchart-unipile-shards.util';

const cloneStrategyParameters = (
  parameters: PeopleSearchStrategyResult['parameters'],
): Record<string, unknown> =>
  JSON.parse(JSON.stringify(parameters ?? {})) as Record<string, unknown>;

/**
 * Returns a strategy copy with the compiled shard's include/exclude applied.
 * Location exclude requires Sales Navigator / Recruiter-shaped params; classic
 * only gets include (remaining-with-exclude returns null so caller can skip).
 */
export const applyOrgchartUnipileShardToStrategy = (input: {
  strategy: PeopleSearchStrategyResult;
  shard: OrgchartUnipileCompiledShard;
  searchType: 'classic' | 'sales_navigator' | 'recruiter';
}): PeopleSearchStrategyResult | null => {
  const { strategy, shard, searchType } = input;

  if (
    searchType === 'classic' &&
    shard.remaining === true &&
    shard.excludeIds.length > 0
  ) {
    return null;
  }

  const parameters = cloneStrategyParameters(strategy.parameters);

  if (shard.facet === 'location') {
    if (searchType === 'classic') {
      if (shard.includeIds.length === 0) {
        return null;
      }
      parameters.location = shard.includeIds;
      if (shard.display.length > 0) {
        parameters.location_display = shard.display;
      }
    } else {
      parameters.location = {
        include: shard.includeIds.length > 0 ? shard.includeIds : null,
        exclude: shard.excludeIds.length > 0 ? shard.excludeIds : null,
      };
      if (shard.display.length > 0) {
        parameters.location_display = shard.display;
      }
    }
  } else if (shard.facet === 'role') {
    parameters.role = {
      include: shard.includeLabels.length > 0 ? shard.includeLabels : null,
      exclude: shard.excludeLabels.length > 0 ? shard.excludeLabels : null,
    };
  } else if (shard.facet === 'function') {
    parameters.function = {
      include: shard.includeIds.length > 0 ? shard.includeIds : null,
      exclude: shard.excludeIds.length > 0 ? shard.excludeIds : null,
    };
  } else if (shard.facet === 'seniority') {
    parameters.seniority = {
      include: shard.includeIds.length > 0 ? shard.includeIds : null,
      exclude: shard.excludeIds.length > 0 ? shard.excludeIds : null,
    };
  }

  return {
    ...strategy,
    id: `${strategy.id}__${shard.key}`,
    label: `${strategy.label || strategy.id} [${shard.key}]`,
    parameters: parameters as PeopleSearchStrategyResult['parameters'],
  };
};

export const expandStrategiesWithOrgchartUnipileShards = (input: {
  strategies: PeopleSearchStrategyResult[];
  shards: OrgchartUnipileCompiledShard[];
  searchType: 'classic' | 'sales_navigator' | 'recruiter';
}): PeopleSearchStrategyResult[] => {
  if (input.shards.length === 0) {
    return input.strategies;
  }

  const expanded: PeopleSearchStrategyResult[] = [];

  for (const strategy of input.strategies) {
    for (const shard of input.shards) {
      const applied = applyOrgchartUnipileShardToStrategy({
        strategy,
        shard,
        searchType: input.searchType,
      });
      if (applied) {
        expanded.push(applied);
      }
    }
  }

  return expanded.length > 0 ? expanded : input.strategies;
};
