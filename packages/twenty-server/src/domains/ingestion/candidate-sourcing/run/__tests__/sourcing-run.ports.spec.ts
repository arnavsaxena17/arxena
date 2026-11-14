import {
  createSourcingRunPorts,
  judgedRowsOf,
  outcomeOfTabRow,
  tallyTabRows,
  toPlannedQueries,
} from 'src/domains/ingestion/candidate-sourcing/run/sourcing-run.ports';
import { SourceAdapterRegistry } from 'src/domains/ingestion/candidate-sourcing/sources/adapter-registry';
import { type OutreachTabRow } from 'src/domains/engagement/outreach-command/services/outreach-tab.service';

const tabRow = (
  id: string,
  otherFields: Record<string, unknown> = {},
): OutreachTabRow => ({ id, source: 'ephemeral', name: id, otherFields });

const SCOPE = { workspaceId: 'workspace-1', projectId: 'project-1' };

describe('toPlannedQueries', () => {
  it('should carry each compiled query, labelled by its title', () => {
    expect(
      toPlannedQueries({
        search_query_set: [
          {
            keywords: 'treasury',
            job_title: 'CFO',
            company: ['Tata Steel', ' '],
            location: ['Mumbai'],
            years_of_experience: null,
          },
          {
            keywords: null,
            job_title: null,
            company: null,
            location: null,
            years_of_experience: null,
          },
        ],
      }),
    ).toEqual([
      {
        label: 'CFO',
        keywords: 'treasury',
        jobTitle: 'CFO',
        companies: ['Tata Steel'],
        locations: ['Mumbai'],
      },
      {
        label: 'Query 2',
        keywords: null,
        jobTitle: null,
        companies: [],
        locations: [],
      },
    ]);
  });
});

describe('tab outcomes', () => {
  it('should read the fitment column as a judge outcome', () => {
    expect(outcomeOfTabRow(tabRow('a', { fitmentOutcome: 'pass' }))).toBe(
      'qualified',
    );
    expect(outcomeOfTabRow(tabRow('b', { fitment_outcome: 'unknown' }))).toBe(
      'unknown',
    );
    expect(outcomeOfTabRow(tabRow('c', { fitmentOutcome: 'to_confirm' }))).toBe(
      'to_confirm',
    );
    expect(outcomeOfTabRow(tabRow('d'))).toBeUndefined();
  });

  it('should leave unjudged rows out of the tally', () => {
    expect(
      tallyTabRows([
        tabRow('a', { fitmentOutcome: 'pass' }),
        tabRow('b', { fitmentOutcome: 'fail' }),
        tabRow('c', { fitmentOutcome: 'unknown' }),
        tabRow('d'),
      ]),
    ).toEqual({ qualified: 1, unknown: 1, to_confirm: 0, fail: 1 });
  });

  it('should queue a profile only for an unknown row', () => {
    expect(
      judgedRowsOf([
        tabRow('a', { fitmentOutcome: 'unknown' }),
        tabRow('b', { fitmentOutcome: 'fail' }),
        tabRow('c'),
      ]),
    ).toEqual([
      { rowId: 'a', outcome: 'unknown', enrich: ['profile'] },
      { rowId: 'b', outcome: 'fail', enrich: [] },
    ]);
  });
});

describe('createSourcingRunPorts', () => {
  const create = (rows: OutreachTabRow[] = []) => {
    const dependencies = {
      compileQuerySet: jest.fn(async () => ({ search_query_set: [] })),
      registry: new SourceAdapterRegistry(),
      readPeople: jest.fn(async () => rows),
      scoreRows: jest.fn(async () => ({ costUsd: 0.01 })),
      fetchProfiles: jest.fn(async () => ({ fetched: 2 })),
    };

    return { dependencies, ports: createSourcingRunPorts(dependencies) };
  };

  it('should compile the brief as written, falling back to who is wanted', async () => {
    const { dependencies, ports } = create();

    await ports.compile({ who: 'CFOs', briefText: 'CFOs in Mumbai' });
    await ports.compile({ who: 'CFOs' });

    expect(dependencies.compileQuerySet.mock.calls).toEqual([
      ['CFOs in Mumbai'],
      ['CFOs'],
    ]);
  });

  it('should score first, then read what the tab now says', async () => {
    const { dependencies, ports } = create([
      tabRow('a', { fitmentOutcome: 'pass' }),
    ]);

    const judged = await ports.judge(SCOPE);

    expect(dependencies.scoreRows).toHaveBeenCalledWith(SCOPE);
    expect(judged).toEqual({
      rows: [{ rowId: 'a', outcome: 'qualified', enrich: [] }],
      costUsd: 0.01,
    });
  });

  it('should charge an enrichment for the profiles actually fetched', async () => {
    const { dependencies, ports } = create();

    const result = await ports.enrich(SCOPE, {
      level: 'profile',
      rowIds: ['a', 'b', 'c'],
      costUsd: 0.06,
    });

    expect(dependencies.fetchProfiles).toHaveBeenCalledWith(SCOPE, 3);
    expect(result).toEqual({ costUsd: 0.04 });
  });

  it('should say a source with no adapter cannot run', () => {
    const { ports } = create();

    expect(ports.rejects?.('index', { kind: 'facets', filters: {} })).toBe(
      'no adapter is registered for it yet',
    );
  });
});
