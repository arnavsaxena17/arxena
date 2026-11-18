import { isNonEmptyString } from '@sniptt/guards';

import {
  type SourcingAdapterId,
  type SourcingCandidate,
} from 'src/engine/core-modules/candidate-sourcing/run/sourcing-run.types';
import {
  toSourcingSourceError,
  type SourcingSourceError,
} from 'src/engine/core-modules/candidate-sourcing/sources/adapter';
import { type SourcingSpec } from 'src/engine/core-modules/outreach-command/utils/sourcing-spec.util';
import { type ToolOutput } from 'src/engine/core-modules/tool/types/tool-output.type';

// Adapters that drive an existing tool. Each tool already writes its rows to
// the People tab, records the search in the ledger, asks the budget service
// and respects the source pick, so the loop adds none of that again: it
// compiles the spec into the tool's arguments and reads cost and paging back.
// The rows themselves are read from the tab.

export type SourcingToolCallPhase = 'probe' | 'fetch';

export type SourcingToolCall = {
  toolName: string;
  args: Record<string, unknown>;
};

export type SourcingToolReading = {
  costUsd: number;
  counts?: number;
  estimatedCostUsd?: number;
  hasMore: boolean;
  // A background run the tool started and the next round must read
  pendingRunId?: string;
  error?: SourcingSourceError;
  errorMessage?: string;
};

export type SourcingToolAdapter = {
  id: SourcingAdapterId;
  build: (input: {
    phase: SourcingToolCallPhase;
    candidate: SourcingCandidate;
    spec: SourcingSpec;
    projectId: string;
    budgetUsd: number;
    remainingTarget: number | null;
  }) => SourcingToolCall;
  read: (output: ToolOutput, call: SourcingToolCall) => SourcingToolReading;
};

// Bright Data's ludicrous fetch accepts 0.01 to 10 USD per query
const BRIGHT_DATA_MIN_FETCH_USD = 0.01;
const BRIGHT_DATA_MAX_FETCH_USD = 10;
// The people_by_company per pair cap stays inside the tool's own bounds
const PEOPLE_BY_COMPANY_MAX_PAIR_USD = 1;
const PEOPLE_BY_COMPANY_MIN_PAIR_USD = 0.005;

const resultOf = (output: ToolOutput): Record<string, unknown> =>
  typeof output.result === 'object' && output.result !== null
    ? (output.result as Record<string, unknown>)
    : {};

const firstNumber = (
  record: Record<string, unknown>,
  keys: string[],
): number | undefined => {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
  }

  return undefined;
};

const failed = (output: ToolOutput): SourcingToolReading => ({
  costUsd: 0,
  hasMore: false,
  error: toSourcingSourceError(output.error ?? output.message),
  errorMessage: String(output.error ?? output.message ?? 'failed'),
});

const wordsOf = (spec: SourcingSpec, field: string): string[] =>
  spec.hard
    .filter((constraint) => constraint.field === field)
    .map((constraint) => constraint.userWords);

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const brightDataPeopleAdapter: SourcingToolAdapter = {
  id: 'bright_data_people',
  // probe: the plan-and-sample estimate, which writes sampled rows. fetch:
  // the paid run of that estimate, within this round's share.
  build: ({ phase, candidate, projectId, budgetUsd, remainingTarget }) => ({
    toolName: 'search_bright_data_business',
    args:
      phase === 'probe'
        ? { entity: 'people', query: candidate.query, projectId }
        : {
            entity: 'people',
            query: candidate.query,
            projectId,
            execute: true,
            maxBudgetUsd: Number(
              clamp(
                budgetUsd,
                BRIGHT_DATA_MIN_FETCH_USD,
                BRIGHT_DATA_MAX_FETCH_USD,
              ).toFixed(2),
            ),
            ...(remainingTarget !== null &&
              remainingTarget > 0 && { targetCount: remainingTarget }),
          },
  }),
  read: (output, call) => {
    if (!output.success) {
      return failed(output);
    }

    const result = resultOf(output);
    const isEstimate = call.args.execute !== true;

    if (isEstimate) {
      return {
        costUsd: firstNumber(result, ['estimateCostUsd', 'costUsd']) ?? 0,
        counts: firstNumber(result, [
          'estimatedUniqueRecords',
          'totalFetchableRecords',
        ]),
        estimatedCostUsd: firstNumber(result, ['totalEstimatedCostUsd']),
        hasMore: true,
      };
    }

    const spentUsd = firstNumber(result, ['spentUsd', 'costUsd']) ?? 0;
    const budgetUsd = Number(call.args.maxBudgetUsd);

    return {
      costUsd: spentUsd,
      // A fetch that stopped short of its budget found the end of the slices
      hasMore: spentUsd >= budgetUsd * 0.95,
    };
  },
};

const peopleByCompanyAdapter: SourcingToolAdapter = {
  id: 'people_by_company',
  build: ({ candidate, spec, projectId, budgetUsd }) => {
    const companies = wordsOf(spec, 'company');
    const roles = [...wordsOf(spec, 'title'), ...wordsOf(spec, 'seniority')];
    const location = wordsOf(spec, 'location')[0];
    const pairs = Math.max(1, companies.length * Math.max(1, roles.length));

    return {
      toolName: 'find_people_by_company',
      args: isNonEmptyString(candidate.pendingRunId)
        ? { runId: candidate.pendingRunId, waitSeconds: 0 }
        : {
            companies: companies.map((name) => ({ name })),
            ...(roles.length > 0 && { roles }),
            ...(isNonEmptyString(location) && { location }),
            projectId,
            maxBudgetUsd: Number(
              clamp(
                budgetUsd / pairs,
                PEOPLE_BY_COMPANY_MIN_PAIR_USD,
                PEOPLE_BY_COMPANY_MAX_PAIR_USD,
              ).toFixed(3),
            ),
            // The loop asked the user once already; the tool's own pilot
            // would ask again
            skipPilot: true,
            waitSeconds: 0,
          },
    };
  },
  read: (output) => {
    if (!output.success) {
      return failed(output);
    }

    const result = resultOf(output);
    const status = result.status;
    const runId = result.runId;
    const isRunning =
      isNonEmptyString(runId) && (status === 'queued' || status === 'running');

    return {
      costUsd: firstNumber(result, ['spentUsd', 'costUsd']) ?? 0,
      // One cascade is the whole round: done once its run ends
      hasMore: false,
      ...(isRunning && { pendingRunId: runId }),
    };
  },
};

export const SOURCING_TOOL_ADAPTERS: Readonly<
  Record<SourcingAdapterId, SourcingToolAdapter>
> = {
  bright_data_people: brightDataPeopleAdapter,
  people_by_company: peopleByCompanyAdapter,
};
