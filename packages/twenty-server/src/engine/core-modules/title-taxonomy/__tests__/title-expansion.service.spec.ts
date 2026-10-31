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

const lattice = (...titles: string[]) => ({
  status: 'ok',
  titles,
  cells: [],
  count: titles.length,
});

const buildService = (
  overrides: Partial<
    Record<
      | 'classifyTitles'
      | 'getManualBooleanQueries'
      | 'getSimilarTitles'
      | 'getSimilarJobTitles'
      | 'getRankedKeywords'
      | 'getRoleQuery',
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
    getSimilarJobTitles: jest.fn(async () =>
      lattice(
        'managing director',
        'chief executive officer',
        'ceo',
        'co founder',
      ),
    ),
    getSimilarTitles: jest.fn(async () => [
      'managing director',
      'chief executive officer',
      'ceo',
      'co founder',
    ]),
    // No frequency ranking by default, so the curated order stands
    getRankedKeywords: jest.fn(async () => null),
    // Role-scope fallback when no manual std_function row exists
    getRoleQuery: jest.fn(async () => ({ boolean_query: '' })),
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

  it('should ask the calibrated lattice with the role, function and grade', async () => {
    const { service, remote } = buildService();

    await service.resolveRoles(['Chief Executive']);

    expect(remote.getSimilarJobTitles).toHaveBeenCalledWith({
      title: 'chief executive',
      functionId: 'ceo',
      grade: 'leadership',
      scope: 'function',
      bands: 'same',
      maxTitles: 12,
    });
    // The lattice answered, so the OR-word fragment list is not consulted
    expect(remote.getSimilarTitles).not.toHaveBeenCalled();
  });

  it('should keep an AND expression as a boolean filter and still take the whole titles', async () => {
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
      getSimilarJobTitles: jest.fn(async () =>
        lattice(
          'manufacturing director',
          'head of manufacturing',
          'head of production',
        ),
      ),
    });

    const resolved = await service.resolveRoles(['Head of Manufacturing']);

    expect(resolved.booleanTitleExpression).toContain(
      '(manufacturing OR production OR plant) AND',
    );
    expect(resolved.titleExpressions).toHaveLength(1);
    // "VP Manufacturing" is in the boolean filter; the titles are the ones the
    // lattice actually files under manufacturing, at this role's level.
    expect(resolved.searchTitles).toEqual([
      'head of manufacturing',
      'manufacturing director',
      'head of production',
    ]);
  });

  it('should fall back to the function OR words when the lattice has no artifact', async () => {
    const { service, remote } = buildService({
      classifyTitles: jest.fn(async (titles: string[]) =>
        titles.map((title) => ({
          ...classification(title, 'manufacturing'),
          function: { id: 'manufacturing' },
          function_root: { id: 'engineering' },
        })),
      ),
      getSimilarJobTitles: jest.fn(async () => ({
        ...lattice(),
        reason: 'index_unavailable',
      })),
      getSimilarTitles: jest.fn(async () => [
        'manufacturing',
        'production manager',
        'plant',
      ]),
    });

    const resolved = await service.resolveRoles(['Head of Manufacturing']);

    expect(remote.getSimilarTitles).toHaveBeenCalledWith({
      functionId: 'manufacturing',
      functionRoot: 'engineering',
    });
    expect(resolved.searchTitles).toEqual([
      'head of manufacturing',
      'manufacturing',
      'production manager',
      'plant',
    ]);
  });

  it('should interleave the titles of several roles so none is starved', async () => {
    const { service } = buildService({
      classifyTitles: jest.fn(async (titles: string[]) =>
        titles.map((title) =>
          classification(
            title,
            title === 'vp manufacturing' ? 'manufacturing' : 'sales',
          ),
        ),
      ),
      getSimilarJobTitles: jest.fn(async ({ title }: { title: string }) =>
        title === 'vp manufacturing'
          ? lattice('head of manufacturing', 'plant director', 'works manager')
          : lattice('head of sales', 'sales director', 'revenue leader'),
      ),
    });

    const resolved = await service.resolveRoles([
      'VP Manufacturing',
      'Head of Sales',
    ]);

    // The second role's first title is not pushed past the first role's whole
    // list, and a title that is also a typed role is not repeated
    expect(resolved.searchTitles).toEqual([
      'vp manufacturing',
      'head of sales',
      'head of manufacturing',
      'plant director',
      'sales director',
      'works manager',
      'revenue leader',
    ]);
  });

  it('should keep the roles as typed when the similar titles call fails', async () => {
    const { service } = buildService({
      getSimilarJobTitles: jest.fn(async () => null),
      getSimilarTitles: jest.fn(async () => null),
    });

    const resolved = await service.resolveRoles(['MD', 'CEO']);

    expect(resolved.taxonomyAvailable).toBe(true);
    expect(resolved.searchTitles).toEqual(['md', 'ceo']);
  });

  it('should use the role query, not the root family, for a single role', async () => {
    // A root is a container, not the role. "Head of Supply Chain" must not
    // fall back to the root query that names procurement and logistics.
    const { service, remote } = buildService({
      classifyTitles: jest.fn(async (titles: string[]) =>
        titles.map((title) => ({
          ...classification(title, 'supply chain'),
          function: { id: 'supply chain' },
          function_root: { id: 'supply chain' },
        })),
      ),
      getManualBooleanQueries: jest.fn(async () => ({ items: [] })),
      getRoleQuery: jest.fn(async () => ({
        boolean_query:
          '("Supply Chain" OR SCM OR CSCO) AND (head OR director OR VP)',
      })),
    });

    const resolved = await service.resolveRoles(['Head of Supply Chain']);

    expect(remote.getManualBooleanQueries).toHaveBeenCalledWith({
      kind: 'std_function',
      label: 'supply chain',
      stdGrade: 'leadership',
    });
    expect(remote.getManualBooleanQueries).not.toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'std_function_root' }),
    );
    expect(remote.getRoleQuery).toHaveBeenCalledWith({
      functionId: 'supply chain',
      grade: 'leadership',
      scope: 'role',
    });
    expect(resolved.scope).toBe('role');
    expect(resolved.booleanTitleExpression).toContain('Supply Chain');
    expect(resolved.booleanTitleExpression).not.toContain('logistics');
  });

  it('should use the root family only when scope is family', async () => {
    const { service, remote } = buildService({
      classifyTitles: jest.fn(async (titles: string[]) =>
        titles.map((title) => ({
          ...classification(title, 'supply chain'),
          function: { id: 'supply chain' },
          function_root: { id: 'supply chain' },
        })),
      ),
      getManualBooleanQueries: jest.fn(async ({ kind }: { kind: string }) =>
        kind === 'std_function_root'
          ? {
              items: [
                {
                  boolean_query:
                    '(("Supply Chain" OR procurement OR logistics OR SCM) AND (head OR director OR VP)) OR CSCO',
                },
              ],
            }
          : { items: [] },
      ),
    });

    const resolved = await service.resolveRoles(['Head of Supply Chain'], {
      scope: 'family',
    });

    expect(remote.getManualBooleanQueries).toHaveBeenCalledWith({
      kind: 'std_function_root',
      label: 'supply chain',
      stdGrade: 'leadership',
    });
    expect(resolved.scope).toBe('family');
    expect(resolved.booleanTitleExpression).toContain('logistics');
  });

  it('should prefer the function query over the root when both exist', async () => {
    const { service, remote } = buildService({
      classifyTitles: jest.fn(async (titles: string[]) =>
        titles.map((title) => ({
          ...classification(title, 'procurement'),
          function: { id: 'procurement' },
          function_root: { id: 'supply chain' },
        })),
      ),
      getManualBooleanQueries: jest.fn(async ({ kind }: { kind: string }) => ({
        items: [
          {
            boolean_query:
              kind === 'std_function'
                ? '(procurement OR purchasing OR sourcing) AND (head OR director)'
                : '("Supply Chain" OR procurement OR logistics OR SCM) AND (head OR director)',
          },
        ],
      })),
    });

    const resolved = await service.resolveRoles(['Procurement Head']);

    expect(resolved.booleanTitleExpression).toBe(
      '(procurement OR purchasing OR sourcing) AND (head OR director)',
    );
    expect(remote.getManualBooleanQueries).toHaveBeenCalledTimes(1);
  });

  it('should ask for the curated query once per class and the titles once per role', async () => {
    const { service, remote } = buildService();

    await service.resolveRoles(['MD', 'CEO']);
    await service.resolveRoles(['MD', 'CEO']);

    expect(remote.getManualBooleanQueries).toHaveBeenCalledTimes(1);
    // Two roles, so two lattices, cached across both calls
    expect(remote.getSimilarJobTitles).toHaveBeenCalledTimes(2);
    expect(remote.classifyTitles).toHaveBeenCalledTimes(1);
  });

  it('should keep a role the taxonomy cannot classify as typed', async () => {
    const { service, remote } = buildService();

    const resolved = await service.resolveRoles(['owner']);

    expect(resolved.searchTitles).toEqual(['owner']);
    expect(resolved.requestedClasses).toEqual([]);
    expect(resolved.taxonomyAvailable).toBe(true);
    expect(remote.getSimilarJobTitles).not.toHaveBeenCalled();
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

  it('should split a coordinated mention into one role per function', async () => {
    const { service, remote } = buildService({
      classifyTitles: jest.fn(async (titles: string[]) =>
        titles.map((title) => {
          const lowered = title.trim().toLowerCase();

          if (lowered === 'head of logistics') {
            return {
              ...classification(title, 'logistics'),
              function: { id: 'logistics' },
              function_root: { id: 'supply chain' },
            };
          }

          return {
            ...classification(title, 'supply chain'),
            function: { id: 'supply chain' },
            function_root: { id: 'supply chain' },
          };
        }),
      ),
      getManualBooleanQueries: jest.fn(
        async ({ kind, label }: { kind: string; label: string }) => {
          if (kind === 'std_function_root' && label === 'supply chain') {
            return {
              items: [
                {
                  boolean_query:
                    '("Supply Chain" OR procurement OR logistics OR SCM) AND (head OR director)',
                },
              ],
            };
          }

          if (kind === 'std_function' && label === 'logistics') {
            return {
              items: [
                {
                  boolean_query:
                    '(logistics OR freight OR transportation) AND (head OR director)',
                },
              ],
            };
          }

          return { items: [] };
        },
      ),
      getRoleQuery: jest.fn(async () => ({
        boolean_query:
          '("Supply Chain" OR SCM OR CSCO) AND (head OR director)',
      })),
    });

    const resolved = await service.resolveRoles([
      'Head of Supply Chain / Logistics',
    ]);

    expect(resolved.roles).toEqual([
      'Head of Supply Chain',
      'Head of Logistics',
    ]);
    expect(resolved.rolePlans).toHaveLength(2);
    expect(resolved.rolePlans[0].sourceMention).toBe(
      'Head of Supply Chain / Logistics',
    );
    expect(resolved.rolePlans[1].titleExpression).toContain(
      'logistics OR freight',
    );
    // Supply chain's own filter is role-scoped, not the root family
    expect(resolved.rolePlans[0].titleExpression).toContain('"Supply Chain"');
    // The split parts are what the search and the pair states use
    expect(resolved.searchTitles.slice(0, 2)).toEqual([
      'head of supply chain',
      'head of logistics',
    ]);
    expect(remote.classifyTitles).toHaveBeenCalledTimes(1);
  });

  it('should keep a compound mention whole when its parts are one function', async () => {
    const { service } = buildService({
      classifyTitles: jest.fn(async (titles: string[]) =>
        titles.map((title) => ({
          ...classification(title, 'environmental health and safety'),
          function: { id: 'environmental health and safety' },
          function_root: { id: 'environmental health and safety' },
        })),
      ),
    });

    const resolved = await service.resolveRoles([
      'Head of Environment, Health & Safety',
    ]);

    expect(resolved.roles).toEqual(['Head of Environment, Health & Safety']);
    expect(resolved.rolePlans).toHaveLength(1);
  });

  it('should cap a long curated query to the term budget', async () => {
    const longQuery = `(${Array.from(
      { length: 14 },
      (_, index) => `term${index}`,
    ).join(
      ' OR ',
    )}) AND (head OR director OR VP OR president OR chief OR SVP OR EVP OR AVP)`;

    const { service } = buildService({
      getManualBooleanQueries: jest.fn(async () => ({
        items: [{ boolean_query: longQuery }],
      })),
      getRankedKeywords: jest.fn(async () =>
        Array.from({ length: 14 }, (_, index) => ({
          term: `term${index}`,
          count: 14 - index,
        })),
      ),
    });

    const resolved = await service.resolveRoles(['Head of Manufacturing']);

    expect(resolved.titleExpressions).toHaveLength(1);
    // 14 function terms + 8 grade terms is over the 20-term budget
    expect(resolved.titleExpressions?.[0]).not.toContain('term13');
    expect(resolved.titleExpressions?.[0]).toContain('term0');
    expect(
      resolved.titleExpressions?.[0].split(/\s+OR\s+/).length,
    ).toBeLessThan(22);
  });
});
