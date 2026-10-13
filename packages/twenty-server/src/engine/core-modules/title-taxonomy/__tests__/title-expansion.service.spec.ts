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
  overrides: Partial<Record<'classifyTitles' | 'getManualBooleanQueries', jest.Mock>> = {},
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
    ...overrides,
  };

  return {
    remote,
    service: new TitleExpansionService(remote as never),
  };
};

describe('TitleExpansionService', () => {
  it('should add the curated titles of the roles function after the roles as typed', async () => {
    const { service } = buildService();

    const resolved = await service.resolveRoles(['MD', 'CEO']);

    expect(resolved.taxonomyAvailable).toBe(true);
    expect(resolved.searchTitles.slice(0, 2)).toEqual(['md', 'ceo']);
    expect(resolved.searchTitles).toEqual(
      expect.arrayContaining(['chief executive', 'managing director', 'founder']),
    );
    expect(resolved.requestedClasses).toHaveLength(1);
  });

  it('should ask for the curated queries once per function and grade', async () => {
    const { service, remote } = buildService();

    await service.resolveRoles(['MD', 'CEO']);
    await service.resolveRoles(['MD', 'CEO']);

    expect(remote.getManualBooleanQueries).toHaveBeenCalledTimes(1);
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

    expect(resolved).toEqual({
      searchTitles: ['md', 'ceo'],
      requestedClasses: [],
      taxonomyAvailable: false,
    });
    expect(await service.classifyTitles(['Managing Director'])).toBeNull();
  });
});
