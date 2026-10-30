import { Injectable, Optional } from '@nestjs/common';

import { randomUUID } from 'crypto';

import { isDefined } from 'twenty-shared/utils';
import { z } from 'zod';

import { SourcingBudgetService } from 'src/engine/core-modules/outreach-command/services/sourcing-budget.service';
import { SourcingLedgerService } from 'src/engine/core-modules/outreach-command/services/sourcing-ledger.service';
import { OutreachTabService } from 'src/engine/core-modules/outreach-command/services/outreach-tab.service';
import {
  computePairFunnel,
  computeSourcingFrontier,
  computeSourcingFunnel,
  mergeSourcingBrief,
  normalizeSourcingBriefDraft,
  type SourcingBrief,
  type SourcingLedgerEvent,
} from 'src/engine/core-modules/outreach-command/utils/sourcing-ledger.util';
import { SOURCING_SOURCES } from 'src/engine/workspace-manager/twenty-standard-application/utils/skill-metadata/sourcing-sources.constant';
import { type ToolExecutionContext } from 'src/engine/core-modules/tool/types/tool-execution-context.type';
import { type ToolInput } from 'src/engine/core-modules/tool/types/tool-input.type';
import { type ToolOutput } from 'src/engine/core-modules/tool/types/tool-output.type';
import { type Tool } from 'src/engine/core-modules/tool/types/tool.type';

const MAX_SEARCHES = 15;
const MAX_EVENTS = 20;

const SOURCE_KEYS = SOURCING_SOURCES.map((source) => source.key) as [
  string,
  ...string[],
];

const BriefZodSchema = z.object({
  briefText: z
    .string()
    .max(4000)
    .optional()
    .describe('The brief as the user wrote it, when prose is clearer'),
  requestType: z
    .enum([
      'population',
      'named_role',
      'company_list',
      'scored_list',
      'look_alike',
      'expand',
    ])
    .describe(
      'The kind of request, as the sourcing requirements section names them',
    ),
  target: z
    .number()
    .int()
    .min(1)
    .max(100000)
    .nullable()
    .describe('How many the user asked for; null if they did not say'),
  who: z
    .string()
    .min(1)
    .max(300)
    .describe("Who or what is wanted, in the user's words"),
  criteria: z
    .array(
      z.object({
        description: z.string().min(1).max(200),
        mustHave: z.boolean(),
      }),
    )
    .max(8),
  geography: z.string().max(200).optional(),
  exclusions: z.string().max(300).optional(),
  capsUsd: z
    .object({
      fetch: z.number().min(0).optional(),
      enrich: z.number().min(0).optional(),
      perPair: z
        .number()
        .min(0.005)
        .max(1)
        .optional()
        .describe('Spend cap for one company x role lookup across all sources'),
      run: z
        .number()
        .min(0.01)
        .max(100000)
        .optional()
        .describe(
          'Total spend cap for the whole run. Required for coverage "exhaustive"; the paid tools refuse once it is spent.',
        ),
    })
    .optional(),
  coverage: z
    .enum(['best_effort', 'exhaustive'])
    .optional()
    .describe(
      'best_effort stops at the target; exhaustive runs until every planned query ran and every company x role pair is terminal, or the run cap is hit',
    ),
  universe: z
    .object({
      kind: z.enum(['project', 'view', 'list', 'lens_set', 'other']).optional(),
      count: z.number().int().min(0).max(1000000).optional(),
      note: z.string().max(300).optional(),
    })
    .optional()
    .describe(
      'What "everything" means for an exhaustive run: the project list, a saved view, a frozen lens set, with its count',
    ),
  queries: z
    .array(
      z.object({
        source: z.enum(SOURCE_KEYS).optional(),
        query: z.string().min(1).max(300),
        slice: z.string().max(120).optional(),
        role: z.string().max(120).optional(),
        entity: z.enum(['company', 'people']).optional(),
      }),
    )
    .max(50)
    .optional()
    .describe(
      'Planned (source, query) pairs for an exhaustive population run. The ledger compares them with the searches that ran and returns the unattempted ones',
    ),
  destination: z.string().max(200).optional(),
  assumptions: z
    .array(z.string().max(200))
    .max(10)
    .describe('Defaults you chose and told the user about instead of asking'),
  persona: z.enum(['sales', 'exec_search']).optional(),
  targetType: z
    .enum(['decision_maker', 'incumbent', 'candidate_pool'])
    .optional(),
  roles: z.array(z.string().min(1)).max(10).optional(),
  ladder: z
    .object({
      maxRung: z.union([
        z.literal(1),
        z.literal(2),
        z.literal(3),
        z.literal(4),
      ]),
    })
    .optional()
    .describe(
      'Highest title rung a person may be found at: 1 the title as typed, 2 equivalent titles, 3 a related role or one level down, 4 the owner or MD of a small company. Default 4 for sales, 2 for exec search.',
    ),
  thresholds: z
    .object({
      minConfidence: z.enum(['high', 'medium', 'low']).optional(),
      freshnessDays: z.number().int().min(1).max(3650).optional(),
    })
    .optional(),
  sources: z
    .array(z.enum(SOURCE_KEYS))
    .min(1)
    .optional()
    .describe(
      'The data sources the user picked at the start. Search tools for any other source refuse while this brief stands.',
    ),
  confidential: z
    .boolean()
    .optional()
    .describe(
      'Client-confidential project: no workspace cache reads or writes',
    ),
});

export const GetSourcingLedgerInputZodSchema = z.object({
  projectId: z
    .string()
    .optional()
    .describe(
      'Project id. Defaults to the project the user is looking at (browsing context); pass it only to read another project',
    ),
  target: z
    .number()
    .int()
    .min(1)
    .max(100000)
    .optional()
    .describe('How many people the user asked for: adds the shortfall'),
  roles: z
    .array(z.string().min(1).max(200))
    .max(10)
    .optional()
    .describe(
      'The role set to measure coverage for. Defaults to the brief roles. Pass it when reading a second role run, so the coverage line is not mixed with an earlier one.',
    ),
  brief: z
    .union([z.string().min(1).max(4000), BriefZodSchema.partial()])
    .optional()
    .describe(
      'Write the brief once the requirements are settled (before the first search): what was asked, the criteria, the caps, the sources the user picked, the coverage intent and the defaults you chose. Pass an object with these keys: requestType ("population"|"named_role"|"company_list"|"scored_list"|"look_alike"|"expand"), target, who, criteria [{description, mustHave}], geography, exclusions, capsUsd {fetch, enrich, perPair, run}, coverage ("best_effort"|"exhaustive"), universe {kind, count, note}, queries [{source, query, slice, role, entity}], destination, assumptions, persona ("sales"|"exec_search"), targetType ("decision_maker"|"incumbent"|"candidate_pool"), roles string[], ladder {maxRung 1-4}, thresholds {minConfidence, freshnessDays}, sources (keys: internal-index, bright-data, serp, harvest, linkedin, apollo, exa, wikidata, naukri), confidential. A plain string is accepted as the brief text. A later brief is merged over the latest one, so pass only what changed. The final report quotes it.',
    ),
  newRun: z
    .boolean()
    .optional()
    .describe(
      'Start a new budget window for this project and reset the run spend. Use it only when the user starts a new exhaustive run; raising a cap mid-run must not reset what was already spent.',
    ),
  stoppedBecause: z
    .string()
    .max(300)
    .optional()
    .describe(
      'Pass this when you stop short of the target: one sentence on why (a source hit its cap, the last round added too few, the budget ran out). It is written to the ledger and returned with the table.',
    ),
});

@Injectable()
export class GetSourcingLedgerTool implements Tool {
  description = `The sourcing run so far, as one small table built from data and not from memory: every search recorded for the project (source, query, rows returned, in-query duplicates, rows new to the tab, rows already there, spend), every scoring run and profile fetch, and the funnel now (rows, with a LinkedIn URL, with a profile, pass / unknown / fail, qualified = passed on the full profile, awaiting a profile). For a company x role run it returns the pairs for the requested roles: counts by final state (found, none_found, ambiguous, unresolvable, excluded), by rung and by source, cost, top reasons, and the coverage line. For an exhaustive run it also returns the frontier: each planned query, whether it ran, and the unattempted ones; and the run budget (cap, spent, remaining). Pass target to get the shortfall, roles to measure one role set, and brief once when the requirements are settled, including coverage "exhaustive", universe, queries and capsUsd.run. Call it before deciding whether to search again and when you stop short: pass stoppedBecause then, and write the final report from this result. Pass newRun to start a new budget window for a new exhaustive run; raising a cap mid-run keeps the spend. Searches appear once they run.`;

  inputSchema = GetSourcingLedgerInputZodSchema;

  constructor(
    private readonly sourcingLedgerService: SourcingLedgerService,
    private readonly outreachTabService: OutreachTabService,
    // Optional so the tool still reads where no budget store is wired (tests)
    @Optional()
    private readonly sourcingBudgetService?: SourcingBudgetService,
  ) {}

  async execute(
    parameters: ToolInput,
    context: ToolExecutionContext,
  ): Promise<ToolOutput> {
    const parsed = GetSourcingLedgerInputZodSchema.safeParse(parameters);

    if (!parsed.success) {
      return {
        success: false,
        message:
          'Invalid get_sourcing_ledger input. Fix only the fields listed in error and call again; the brief is an object (a plain string also works) with keys: requestType, target, who, criteria, geography, exclusions, capsUsd, coverage, universe, queries, destination, assumptions, persona, targetType, roles, ladder, thresholds, sources, confidential. Pass newRun to start a new budget window.',
        error: parsed.error.message,
      };
    }

    const projectId = parsed.data.projectId ?? context.projectId;
    const { target, stoppedBecause, brief, newRun } = parsed.data;
    const briefDraft = normalizeSourcingBriefDraft(brief);

    if (!projectId) {
      return {
        success: false,
        message:
          'Pass projectId (the id in the browsing context, the project the user is looking at).',
        error: 'projectId is missing',
      };
    }
    const { workspaceId } = context;

    try {
      const [rows, companyRows, ledgerEvents] = await Promise.all([
        this.outreachTabService.getAll({
          workspaceId,
          projectId,
          tab: 'people',
        }),
        this.outreachTabService.getAll({
          workspaceId,
          projectId,
          tab: 'companies',
        }),
        this.sourcingLedgerService.read(workspaceId, projectId),
      ]);
      const funnel = computeSourcingFunnel(rows);

      if (briefDraft !== undefined) {
        const previousEvent = [
          ...(await this.sourcingLedgerService.read(workspaceId, projectId)),
        ]
          .reverse()
          .find((event) => event.kind === 'brief');
        const previousBrief: SourcingBrief | undefined =
          previousEvent?.kind === 'brief' ? previousEvent : undefined;
        const merged = mergeSourcingBrief(previousBrief, briefDraft);
        const previousRunCap = previousBrief?.capsUsd?.run;
        const nextRunCap = merged.capsUsd?.run;

        // Only a new run gets a fresh budget window. Raising a cap mid-run
        // keeps the spend already recorded, so the new cap is still a ceiling
        const startsNewRun =
          newRun === true ||
          (nextRunCap !== undefined && previousRunCap === undefined) ||
          (nextRunCap !== undefined &&
            merged.coverage === 'exhaustive' &&
            previousBrief?.coverage !== 'exhaustive');

        if (
          nextRunCap !== undefined &&
          (startsNewRun || merged.budgetRunId === undefined)
        ) {
          merged.budgetRunId = randomUUID();
        }

        await this.sourcingLedgerService.append(workspaceId, projectId, {
          kind: 'brief',
          at: new Date().toISOString(),
          ...merged,
        });

        if (nextRunCap !== undefined) {
          await this.sourcingBudgetService?.configure({
            workspaceId,
            projectId,
            runCapUsd: nextRunCap,
            budgetRunId: merged.budgetRunId,
          });
        }
      }

      if (stoppedBecause !== undefined) {
        await this.sourcingLedgerService.append(workspaceId, projectId, {
          kind: 'stop',
          at: new Date().toISOString(),
          target: target ?? null,
          qualified: funnel.qualified,
          because: stoppedBecause,
        });
      }

      const events = await this.sourcingLedgerService.read(
        workspaceId,
        projectId,
      );
      const latestEvent = [...events]
        .reverse()
        .find((event) => event.kind === 'brief');
      const latestBrief =
        latestEvent?.kind === 'brief' ? latestEvent : undefined;
      const roleSet = parsed.data.roles ?? latestBrief?.roles;
      const pairFunnel = computePairFunnel(companyRows, { roles: roleSet });
      const searchEvents = ledgerEvents.filter(
        (event): event is Extract<SourcingLedgerEvent, { kind: 'search' }> =>
          event.kind === 'search',
      );
      const recentSearches = [...searchEvents].reverse().slice(0, MAX_SEARCHES);
      const searches = recentSearches.map((event) => {
        const runDuplicateShare =
          event.fetched > 0
            ? Number(
                ((event.fetched - event.newUnique) / event.fetched).toFixed(2),
              )
            : undefined;

        return {
          source: event.source,
          entity: event.entity,
          query: event.query,
          fetched: event.fetched,
          duplicates: event.duplicates,
          duplicateShare:
            event.fetched > 0
              ? Number((event.duplicates / event.fetched).toFixed(2))
              : 0,
          newUnique: event.newUnique,
          alreadyKnown: event.alreadyKnown,
          ...(runDuplicateShare !== undefined && { runDuplicateShare }),
          spentUsd: Number(event.spentUsd.toFixed(3)),
        };
      });
      const dedupe =
        searchEvents.length === 0
          ? undefined
          : (() => {
              const fetched = searchEvents.reduce(
                (sum, event) => sum + event.fetched,
                0,
              );
              const newUnique = searchEvents.reduce(
                (sum, event) => sum + event.newUnique,
                0,
              );
              const alreadyKnown = searchEvents.reduce(
                (sum, event) => sum + event.alreadyKnown,
                0,
              );

              return {
                fetched,
                newUnique,
                alreadyKnown,
                duplicateShare:
                  fetched > 0
                    ? Number(((fetched - newUnique) / fetched).toFixed(2))
                    : 0,
              };
            })();
      const hasQueryPlan = (latestBrief?.queries?.length ?? 0) > 0;
      // A company x role run is covered by its pairs, not by a query plan. The
      // frontier is only the proof for a population run (or for a project
      // with no company rows at all).
      // A brief with roles is a company x role run even before the first pair
      // exists; a population project can have company rows without pairs
      const hasPairCoverage =
        pairFunnel.pairs > 0 || (latestBrief?.roles?.length ?? 0) > 0;
      const frontier =
        hasQueryPlan ||
        (latestBrief?.coverage === 'exhaustive' && !hasPairCoverage)
          ? computeSourcingFrontier({
              coverage: latestBrief?.coverage,
              universe: latestBrief?.universe,
              queries: latestBrief?.queries,
              searches: searchEvents.map((event, index) => ({
                id: `search-${index}`,
                sources: [event.source],
                entity: event.entity,
                query: event.query,
                fetched: event.fetched,
                newUnique: event.newUnique,
                alreadyKnown: event.alreadyKnown,
                spentUsd: event.spentUsd,
              })),
            })
          : undefined;
      let budget = await this.sourcingBudgetService?.getStatus(
        workspaceId,
        projectId,
      );

      // A brief written before the budget store existed (or after a Redis
      // loss) still has its cap: restore the config so the report and the
      // tools see it
      if (
        budget?.runCapUsd === undefined &&
        latestBrief?.capsUsd?.run !== undefined &&
        isDefined(this.sourcingBudgetService)
      ) {
        await this.sourcingBudgetService.configure({
          workspaceId,
          projectId,
          runCapUsd: latestBrief.capsUsd.run,
          budgetRunId: latestBrief.budgetRunId ?? projectId,
        });
        budget = await this.sourcingBudgetService.getStatus(
          workspaceId,
          projectId,
        );
      }
      // Share of people with a profile who qualified: what an awaiting profile
      // is likely to be worth
      const withProfile =
        funnel.withProfile.brightData + funnel.withProfile.harvest;
      const profileYield = withProfile > 0 ? funnel.qualified / withProfile : 0;
      const shortfall =
        target === undefined
          ? undefined
          : {
              target,
              qualified: funnel.qualified,
              short: Math.max(0, target - funnel.qualified),
              expectedFromAwaitingProfile: Math.round(
                funnel.awaitingProfile * profileYield,
              ),
            };
      const coverageBasis = hasQueryPlan
        ? ('queries' as const)
        : hasPairCoverage
          ? ('pairs' as const)
          : ('none' as const);
      const messageParts = [
        companyRows.length > 0 ? pairFunnel.coverageLine : undefined,
        frontier?.coverageLine,
        budget?.runCapUsd !== undefined
          ? `Budget $${budget.spentUsd.toFixed(2)} of $${budget.runCapUsd.toFixed(2)} spent ($${(budget.remainingUsd ?? 0).toFixed(2)} left).`
          : undefined,
        shortfall
          ? `${funnel.qualified} of ${shortfall.target} qualified; ${funnel.awaitingProfile} await a profile (about ${shortfall.expectedFromAwaitingProfile} more expected).`
          : `${funnel.qualified} qualified; ${funnel.awaitingProfile} await a profile.`,
      ].filter((part): part is string => part !== undefined);

      return {
        success: true,
        message: messageParts.join(' '),
        result: {
          ...(latestBrief ? { brief: latestBrief } : {}),
          funnel,
          ...(companyRows.length > 0 ? { pairs: pairFunnel } : {}),
          ...(latestBrief?.coverage !== undefined || frontier !== undefined
            ? {
                coverage: {
                  mode: latestBrief?.coverage ?? 'best_effort',
                  // Which matrix proves this run: the planned queries or the
                  // company x role pairs
                  basis: coverageBasis,
                  ...(latestBrief?.universe !== undefined && {
                    universe: latestBrief.universe,
                  }),
                  ...(frontier !== undefined && { frontier }),
                },
              }
            : {}),
          ...(budget?.runCapUsd !== undefined ? { budget } : {}),
          ...(dedupe !== undefined ? { dedupe } : {}),
          ...(shortfall ? { shortfall } : {}),
          searches,
          searchesNotShown: Math.max(0, searchEvents.length - MAX_SEARCHES),
          searchSpendUsd: Number(
            searchEvents
              .reduce((sum, event) => sum + event.spentUsd, 0)
              .toFixed(3),
          ),
          events: events.slice(-MAX_EVENTS),
        },
      };
    } catch (error) {
      return {
        success: false,
        message: 'get_sourcing_ledger failed',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
