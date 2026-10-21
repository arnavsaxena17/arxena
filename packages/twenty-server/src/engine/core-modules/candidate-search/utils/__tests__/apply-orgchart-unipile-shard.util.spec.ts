import {
  applyOrgchartUnipileShardToStrategy,
  expandStrategiesWithOrgchartUnipileShards,
} from 'src/engine/core-modules/candidate-search/utils/apply-orgchart-unipile-shard.util';
import type { OrgchartUnipileCompiledShard } from 'src/engine/core-modules/candidate-search/utils/compile-orgchart-unipile-shards.util';
import type { PeopleSearchStrategyResult } from 'src/engine/core-modules/candidate-search/utils/extract-strategies.util';

const baseStrategy = {
  id: 's1',
  label: 'Company',
  parameters: {
    company: { include: ['spinny'], exclude: null },
    keywords: null,
  },
} as unknown as PeopleSearchStrategyResult;

describe('applyOrgchartUnipileShardToStrategy', () => {
  it('applies location include/exclude for sales navigator', () => {
    const shard: OrgchartUnipileCompiledShard = {
      key: 'remaining',
      priority: 9,
      remaining: true,
      facet: 'location',
      includeIds: [],
      excludeIds: ['1', '2'],
      includeLabels: [],
      excludeLabels: ['Mumbai', 'Bengaluru'],
      display: [
        { id: '1', title: 'Mumbai' },
        { id: '2', title: 'Bengaluru' },
      ],
    };

    const applied = applyOrgchartUnipileShardToStrategy({
      strategy: baseStrategy,
      shard,
      searchType: 'sales_navigator',
    });

    expect(applied?.id).toBe('s1__remaining');
    expect(applied?.parameters).toMatchObject({
      location: { include: null, exclude: ['1', '2'] },
    });
  });

  it('skips classic remaining-with-exclude', () => {
    const shard: OrgchartUnipileCompiledShard = {
      key: 'remaining',
      priority: 9,
      remaining: true,
      facet: 'location',
      includeIds: [],
      excludeIds: ['1'],
      includeLabels: [],
      excludeLabels: ['Mumbai'],
      display: [],
    };

    expect(
      applyOrgchartUnipileShardToStrategy({
        strategy: baseStrategy,
        shard,
        searchType: 'classic',
      }),
    ).toBeNull();
  });

  it('expands one strategy into N shard strategies', () => {
    const shards: OrgchartUnipileCompiledShard[] = [
      {
        key: 'mumbai',
        priority: 1,
        remaining: false,
        facet: 'location',
        includeIds: ['106'],
        excludeIds: [],
        includeLabels: ['Mumbai'],
        excludeLabels: [],
        display: [{ id: '106', title: 'Mumbai' }],
      },
      {
        key: 'remaining',
        priority: 2,
        remaining: true,
        facet: 'location',
        includeIds: [],
        excludeIds: ['106'],
        includeLabels: [],
        excludeLabels: ['Mumbai'],
        display: [{ id: '106', title: 'Mumbai' }],
      },
    ];

    const expanded = expandStrategiesWithOrgchartUnipileShards({
      strategies: [baseStrategy],
      shards,
      searchType: 'sales_navigator',
    });

    expect(expanded).toHaveLength(2);
    expect(expanded.map((strategy) => strategy.id)).toEqual([
      's1__mumbai',
      's1__remaining',
    ]);
  });
});
