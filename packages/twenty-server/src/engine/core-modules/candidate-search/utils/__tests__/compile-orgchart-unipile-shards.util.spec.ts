import { compileOrgchartUnipileShards } from 'src/engine/core-modules/candidate-search/utils/compile-orgchart-unipile-shards.util';
import type { OrgchartUnipileShardPlanLlmOutput } from 'src/engine/core-modules/candidate-search/schemas/orgchart-unipile-shard-plan.schema';

describe('compileOrgchartUnipileShards', () => {
  it('builds include shards and remaining excludes all include ids', () => {
    const plan: OrgchartUnipileShardPlanLlmOutput = {
      intentSummary: 'India metros',
      primaryDimension: 'city',
      rationale: 'Dense India workforce',
      shards: [
        {
          key: 'mumbai',
          priority: 1,
          includeLabels: ['Mumbai'],
          remaining: false,
        },
        {
          key: 'bengaluru',
          priority: 2,
          includeLabels: ['Bengaluru'],
          remaining: false,
        },
        {
          key: 'remaining',
          priority: 3,
          includeLabels: [],
          remaining: true,
        },
      ],
    };

    const resolvedByLabel = new Map([
      ['mumbai', { id: '106164952', title: 'Mumbai Area' }],
      ['bengaluru', { id: '90000084', title: 'Bengaluru Area' }],
    ]);

    const { shards, droppedLabels } = compileOrgchartUnipileShards({
      plan,
      resolvedByLabel,
    });

    expect(droppedLabels).toEqual([]);
    expect(shards).toHaveLength(3);
    expect(shards[0]).toMatchObject({
      key: 'mumbai',
      remaining: false,
      includeIds: ['106164952'],
      excludeIds: [],
      facet: 'location',
    });
    expect(shards[2]).toMatchObject({
      key: 'remaining',
      remaining: true,
      includeIds: [],
      excludeIds: ['106164952', '90000084'],
    });
  });

  it('drops unresolved location labels', () => {
    const plan: OrgchartUnipileShardPlanLlmOutput = {
      intentSummary: 'x',
      primaryDimension: 'city',
      rationale: 'x',
      shards: [
        {
          key: 'unknown_city',
          priority: 1,
          includeLabels: ['NotARealCity'],
          remaining: false,
        },
        {
          key: 'remaining',
          priority: 2,
          includeLabels: [],
          remaining: true,
        },
      ],
    };

    const { shards, droppedLabels } = compileOrgchartUnipileShards({
      plan,
      resolvedByLabel: new Map([['notarealcity', null]]),
    });

    expect(droppedLabels).toEqual(['NotARealCity']);
    expect(shards).toHaveLength(0);
  });
});
