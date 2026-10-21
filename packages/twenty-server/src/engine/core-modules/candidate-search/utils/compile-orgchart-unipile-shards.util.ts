import type {
  OrgchartUnipileShardDimension,
  OrgchartUnipileShardPlanLlmOutput,
} from 'src/engine/core-modules/candidate-search/schemas/orgchart-unipile-shard-plan.schema';

export type OrgchartUnipileCompiledFacet =
  | 'location'
  | 'role'
  | 'function'
  | 'seniority';

export type OrgchartUnipileCompiledShard = {
  key: string;
  priority: number;
  remaining: boolean;
  facet: OrgchartUnipileCompiledFacet;
  includeIds: string[];
  excludeIds: string[];
  includeLabels: string[];
  excludeLabels: string[];
  display: Array<{ id: string; title: string }>;
};

export const mapOrgchartUnipileDimensionToFacet = (
  dimension: OrgchartUnipileShardDimension,
): OrgchartUnipileCompiledFacet => {
  if (dimension === 'titleFamily') {
    return 'role';
  }
  if (dimension === 'function') {
    return 'function';
  }
  if (dimension === 'seniority') {
    return 'seniority';
  }

  return 'location';
};

export type ResolveOrgchartUnipileLabelResult = {
  id: string;
  title: string;
} | null;

/**
 * Pure compile step after labels are resolved to IDs (location) or kept as
 * strings (role / function / seniority labels passed through as include ids).
 */
export const compileOrgchartUnipileShards = (input: {
  plan: OrgchartUnipileShardPlanLlmOutput;
  resolvedByLabel: Map<string, ResolveOrgchartUnipileLabelResult>;
}): {
  shards: OrgchartUnipileCompiledShard[];
  droppedLabels: string[];
} => {
  const facet = mapOrgchartUnipileDimensionToFacet(input.plan.primaryDimension);
  const droppedLabels: string[] = [];
  const includeShards: OrgchartUnipileCompiledShard[] = [];
  let remainingShard:
    | Omit<OrgchartUnipileCompiledShard, 'excludeIds' | 'excludeLabels'>
    | undefined;

  const sorted = [...input.plan.shards].sort(
    (left, right) => left.priority - right.priority,
  );

  for (const shard of sorted) {
    if (shard.remaining === true) {
      remainingShard = {
        key: shard.key.trim() || 'remaining',
        priority: shard.priority,
        remaining: true,
        facet,
        includeIds: [],
        includeLabels: [],
        display: [],
      };
      continue;
    }

    const includeIds: string[] = [];
    const includeLabels: string[] = [];
    const display: Array<{ id: string; title: string }> = [];

    for (const label of shard.includeLabels) {
      const trimmed = label.trim();
      if (!trimmed) {
        continue;
      }

      if (facet === 'location') {
        const resolved = input.resolvedByLabel.get(trimmed.toLowerCase());
        if (!resolved?.id) {
          droppedLabels.push(trimmed);
          continue;
        }
        includeIds.push(resolved.id);
        includeLabels.push(trimmed);
        display.push({ id: resolved.id, title: resolved.title });
        continue;
      }

      // role / function / seniority: use label as the filter value (resolver
      // may have mapped to an id string in resolvedByLabel when available)
      const resolved = input.resolvedByLabel.get(trimmed.toLowerCase());
      const value = resolved?.id?.trim() || trimmed;
      includeIds.push(value);
      includeLabels.push(trimmed);
      display.push({ id: value, title: resolved?.title ?? trimmed });
    }

    if (includeIds.length === 0) {
      continue;
    }

    includeShards.push({
      key: shard.key.trim() || `shard_${includeShards.length + 1}`,
      priority: shard.priority,
      remaining: false,
      facet,
      includeIds,
      excludeIds: [],
      includeLabels,
      excludeLabels: [],
      display,
    });
  }

  const allIncludeIds = includeShards.flatMap((shard) => shard.includeIds);
  const allIncludeLabels = includeShards.flatMap(
    (shard) => shard.includeLabels,
  );
  const allDisplay = includeShards.flatMap((shard) => shard.display);

  const shards: OrgchartUnipileCompiledShard[] = [...includeShards];

  if (remainingShard && allIncludeIds.length > 0) {
    shards.push({
      ...remainingShard,
      excludeIds: [...new Set(allIncludeIds)],
      excludeLabels: [...new Set(allIncludeLabels)],
      display: allDisplay,
    });
  }

  return { shards, droppedLabels };
};
