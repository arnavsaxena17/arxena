import { TitleExpansionService } from 'src/engine/core-modules/title-taxonomy/title-expansion.service';

const classification = (
  title: string,
  functionId: string | null,
  grade = 'leadership',
) => ({
  title,
  normalized_title: title.toLowerCase(),
  function_root: functionId ? { id: functionId } : null,
  function: functionId ? { id: functionId } : null,
  grade: { id: grade },
  function_matched: functionId !== null,
  grade_matched: true,
  confidence: 0.75,
});

const buildService = (
  overrides: Partial<
    Record<
      'classifyTitles' | 'getManualBooleanQueries' | 'getSimilarTitles',
      jest.Mock
    >
  > = {},
) => {
  const remote = {
    classifyTitles: jest.fn(async (titles: string[]) =>
      titles.map((title) =>
        classification(title, title === 'owner' ? null : 'ceo'),
      ),
    ),
    getManualBooleanQueries: jest.fn(async () => ({
      items: [
        {
          boolean_query:
            '(CEO OR "chief executive" OR "managing director" OR founder)',
        },
      ],
    })),
    getSimilarTitles: jest.fn(async () => [
      'managing director',
      'chief executive officer',
      'ceo',
      'co founder',
    ]),
    ...overrides,
  };

  return {
    remote,
    service: new TitleExpansionService(remote as never),
  };
};

describe('TitleExpansionService', () => {
  it('should add the taxonomy similar titles after the roles as typed', async () => {
    const { service } = buildService();

    const resolved = await service.resolveRoles(['MD', 'CEO']);

    expect(resolved.taxonomyAvailable).toBe(true);
    expect(resolved.searchTitles.slice(0, 2)).toEqual(['md', 'ceo']);
    expect(resolved.searchTitles).toEqual(
      expect.arrayContaining([
        'managing director',
        'chief executive officer',
        'co founder',
      ]),
    );
    expect(resolved.requestedClasses).toHaveLength(1);
  });

  it('should ask the taxonomy for the titles of the classified function, not the typed words', async () => {
    const { service, remote } = buildService();

    await service.resolveRoles(['Chief Executive']);

    expect(remote.getSimilarTitles).toHaveBeenCalledWith({
      functionId: 'ceo',
      functionRoot: 'ceo',
    });
  });

  it('should keep an AND expression as a boolean filter and still take the plain titles', async () => {
    const { service } = buildService({
      classifyTitles: jest.fn(async (titles: string[]) =>
        titles.map((title) => ({
          ...classification(title, 'manufacturing'),
          function: { id: 'manufacturing' },
          function_root: { id: 'engineering' },
        })),
      ),
      getManualBooleanQueries: jest.fn(async () => ({
        items: [
          {
            boolean_query:
              '(manufacturing OR production OR plant) AND (head OR director OR VP OR president)',
          },
        ],
      })),
      getSimilarTitles: jest.fn(async () => [
        'manufacturing',
        'production manager',
        'plant',
      ]),
    });

    const resolved = await service.resolveRoles(['Head of Manufacturing']);

    expect(resolved.booleanTitleExpression).toContain(
      '(manufacturing OR production OR plant) AND',
    );
    expect(resolved.titleExpressions).toHaveLength(1);
    // "VP Manufacturing" is in the boolean filter; the titles are the ones the
    // taxonomy actually files under manufacturing.
    expect(resolved.searchTitles).toEqual([
      'head of manufacturing',
      'manufacturing',
      'production manager',
      'plant',
    ]);
  });

  it('should keep the roles as typed when the similar titles call fails', async () => {
    const { service } = buildService({
      getSimilarTitles: jest.fn(async () => null),
    });

    const resolved = await service.resolveRoles(['MD', 'CEO']);

    expect(resolved.taxonomyAvailable).toBe(true);
    expect(resolved.searchTitles).toEqual(['md', 'ceo']);
  });

  it('should ask for the curated query and the similar titles once per function', async () => {
    const { service, remote } = buildService();

    await service.resolveRoles(['MD', 'CEO']);
    await service.resolveRoles(['MD', 'CEO']);

    expect(remote.getManualBooleanQueries).toHaveBeenCalledTimes(1);
    expect(remote.getSimilarTitles).toHaveBeenCalledTimes(1);
    expect(remote.classifyTitles).toHaveBeenCalledTimes(1);
  });

  it('should keep a role the taxonomy cannot classify as typed', async () => {
    const { service } = buildService();

    const resolved = await service.resolveRoles(['owner']);

    expect(resolved.searchTitles).toEqual(['owner']);
    expect(resolved.requestedClasses).toEqual([]);
    expect(resolved.taxonomyAvailable).toBe(true);
  });

  it('should fall back to the roles as typed when the service is down', async () => {
    const { service } = buildService({
      classifyTitles: jest.fn(async () => null),
    });

    const resolved = await service.resolveRoles(['MD', 'CEO']);

    expect(resolved).toMatchObject({
      searchTitles: ['md', 'ceo'],
      requestedClasses: [],
      taxonomyAvailable: false,
      titleExpressions: [],
      booleanTitleExpression: '',
    });
    expect(await service.classifyTitles(['Managing Director'])).toBeNull();
  });
});
