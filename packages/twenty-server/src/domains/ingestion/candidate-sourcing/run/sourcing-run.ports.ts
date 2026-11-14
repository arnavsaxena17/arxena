import { SOURCING_ENRICH_COST_USD } from 'src/domains/ingestion/candidate-sourcing/run/enrich.util';
import { type JudgeOutcome } from 'src/domains/ingestion/candidate-sourcing/run/judge.util';
import {
  type JudgedRow,
  type PlannedQuery,
  type RunState,
  type RunTally,
  type SourcingRunPorts,
} from 'src/domains/ingestion/candidate-sourcing/run/sourcing-run.types';
import { readRowProfile } from 'src/domains/ingestion/candidate-sourcing/services/profile-fetch/profile-row-fields.util';
import { roundUsd } from 'src/domains/ingestion/candidate-sourcing/sources/adapter';
import { type SourceAdapterRegistry } from 'src/domains/ingestion/candidate-sourcing/sources/adapter-registry';
import { type SearchQuerySet } from 'src/domains/discovery/query/linkedin-query-generation/types/linkedin-query-generation.types';
import { type OutreachTabRow } from 'src/domains/engagement/outreach-command/services/outreach-tab.service';

// The loop's ports, made from what the app already has: the query compiler,
// the search tools, the project tab, the fitment column and profile fetch.

type RunScope = Pick<RunState, 'workspaceId' | 'projectId'>;

export const toPlannedQueries = (querySet: SearchQuerySet): PlannedQuery[] =>
  querySet.search_query_set.map((query, index) => {
    const jobTitle = query.job_title?.trim() || null;
    const keywords = query.keywords?.trim() || null;

    return {
      label: jobTitle ?? keywords ?? `Query ${index + 1}`,
      keywords,
      jobTitle,
      companies: (query.company ?? []).filter((name) => name.trim() !== ''),
      locations: (query.location ?? []).filter((name) => name.trim() !== ''),
    };
  });

// The tab stores the fitment column's words (pass / unknown / fail). A row
// with none has not been judged yet.
export const outcomeOfTabRow = (
  row: Pick<OutreachTabRow, 'otherFields'>,
): JudgeOutcome | undefined => {
  const value =
    row.otherFields.fitmentOutcome ?? row.otherFields.fitment_outcome;

  switch (value) {
    case 'pass':
    case 'qualified':
      return 'qualified';
    case 'to_confirm':
      return 'to_confirm';
    case 'unknown':
      return 'unknown';
    case 'fail':
      return 'fail';
    default:
      return undefined;
  }
};

export const tallyTabRows = (
  rows: Array<Pick<OutreachTabRow, 'otherFields'>>,
): RunTally => {
  const tally: RunTally = { qualified: 0, unknown: 0, to_confirm: 0, fail: 0 };

  for (const row of rows) {
    const outcome = outcomeOfTabRow(row);

    if (outcome !== undefined) {
      tally[outcome] += 1;
    }
  }

  return tally;
};

// An unknown row with no profile can still be settled by buying one. With a
// profile already on the row there is nothing left to buy for it.
export const judgedRowsOf = (
  rows: Array<Pick<OutreachTabRow, 'id' | 'otherFields'>>,
): JudgedRow[] =>
  rows.flatMap((row): JudgedRow[] => {
    const outcome = outcomeOfTabRow(row);

    if (outcome === undefined) {
      return [];
    }

    return [
      {
        rowId: row.id,
        outcome,
        enrich:
          outcome === 'unknown' && readRowProfile(row.otherFields) === undefined
            ? ['profile']
            : [],
      },
    ];
  });

export type SourcingRunPortDependencies = {
  // The brief as a query set: one parse, then the Python compiler
  compileQuerySet: (requirement: string) => Promise<SearchQuerySet>;
  registry: SourceAdapterRegistry;
  readPeople: (scope: RunScope) => Promise<OutreachTabRow[]>;
  // Runs the project's fitment column on the rows that have no outcome, or
  // whose evidence changed since they were judged
  scoreRows: (scope: RunScope) => Promise<{ costUsd: number }>;
  // Fetches full profiles for up to rowLimit rows still unknown
  fetchProfiles: (
    scope: RunScope,
    rowLimit: number,
  ) => Promise<{ fetched: number }>;
};

export const createSourcingRunPorts = (
  dependencies: SourcingRunPortDependencies,
): SourcingRunPorts => ({
  compile: async (brief) =>
    toPlannedQueries(
      await dependencies.compileQuerySet(brief.briefText ?? brief.who),
    ),
  search: (candidate, request) =>
    dependencies.registry.search(candidate, request),
  rejects: (source, spec) => dependencies.registry.rejects(source, spec),
  judge: async (scope) => {
    const { costUsd } = await dependencies.scoreRows(scope);

    return {
      rows: judgedRowsOf(await dependencies.readPeople(scope)),
      costUsd,
    };
  },
  tally: async (scope) => tallyTabRows(await dependencies.readPeople(scope)),
  enrich: async (scope, step) => {
    // judgedRowsOf only ever queues a profile; a company web column is not
    // something this port can buy yet
    if (step.level !== 'profile') {
      return { costUsd: 0 };
    }

    const { fetched } = await dependencies.fetchProfiles(
      scope,
      step.rowIds.length,
    );

    return { costUsd: roundUsd(fetched * SOURCING_ENRICH_COST_USD.profile) };
  },
});
