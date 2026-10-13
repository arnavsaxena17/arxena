import { BrightDataLudicrousPlannerService } from 'src/engine/core-modules/bright-data/services/ludicrous/bright-data-ludicrous-planner.service';
import { type BrightDataLudicrousPlanLlmOutput } from 'src/engine/core-modules/bright-data/ludicrous/schemas/bright-data-ludicrous-plan-llm.schema';

const buildGenerated = (
  filter: Partial<BrightDataLudicrousPlanLlmOutput['shards'][number]['filter']>,
): BrightDataLudicrousPlanLlmOutput =>
  ({
    shards: [
      {
        key: 'ceo_in',
        rationale: 'ceo',
        priority: 1,
        filter: {
          titles: ['ceo'],
          excludeTitleWords: [],
          booleanTitleExpression: '',
          companyNames: ['acme'],
          skills: [],
          countryCodes: ['IN'],
          cities: [],
          industries: [],
          organizationTypes: [],
          fundingStages: [],
          sizeBuckets: [],
          foundedFrom: null,
          foundedTo: null,
          specialtiesAny: [],
          ...filter,
        },
      },
    ],
  }) as unknown as BrightDataLudicrousPlanLlmOutput;

const buildService = (expandTitles: jest.Mock) =>
  new BrightDataLudicrousPlannerService(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    undefined,
    undefined,
    { expandTitles } as never,
  ) as unknown as {
    addTaxonomyTitles: (
      entity: 'people' | 'company',
      generated: BrightDataLudicrousPlanLlmOutput,
    ) => Promise<void>;
  };

describe('BrightDataLudicrousPlannerService taxonomy titles', () => {
  it('should add the taxonomy titles to a people shard', async () => {
    const expandTitles = jest.fn(async () => ({
      titles: ['ceo', 'chief executive', 'managing director'],
      added: ['chief executive', 'managing director'],
      taxonomyAvailable: true,
    }));
    const generated = buildGenerated({});

    await buildService(expandTitles).addTaxonomyTitles('people', generated);

    expect(generated.shards[0].filter.titles).toEqual([
      'ceo',
      'chief executive',
      'managing director',
    ]);
  });

  it('should leave a user-written boolean title string alone', async () => {
    const expandTitles = jest.fn();
    const generated = buildGenerated({
      titles: [],
      booleanTitleExpression: '(VP OR Head) AND Sales',
    });

    await buildService(expandTitles).addTaxonomyTitles('people', generated);

    expect(expandTitles).not.toHaveBeenCalled();
  });

  it('should not touch company searches', async () => {
    const expandTitles = jest.fn();

    await buildService(expandTitles).addTaxonomyTitles(
      'company',
      buildGenerated({}),
    );

    expect(expandTitles).not.toHaveBeenCalled();
  });

  it('should keep the model titles when the taxonomy fails', async () => {
    const generated = buildGenerated({});

    await buildService(
      jest.fn().mockRejectedValue(new Error('taxonomy down')),
    ).addTaxonomyTitles('people', generated);

    expect(generated.shards[0].filter.titles).toEqual(['ceo']);
  });
});
