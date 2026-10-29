import { Injectable } from '@nestjs/common';

import { z } from 'zod';

import { OutreachListService } from 'src/engine/core-modules/outreach-list/services/outreach-list.service';
import { SourcingLedgerService } from 'src/engine/core-modules/outreach-command/services/sourcing-ledger.service';
import { OutreachTabService } from 'src/engine/core-modules/outreach-command/services/outreach-tab.service';
import {
  computePairFunnel,
  computeSourcingFunnel,
  mergeSourcingBrief,
  type SourcingBrief,
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
    })
    .optional(),
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
  projectId: z.string().describe('Project id from the browsing context'),
  target: z
    .number()
    .int()
    .min(1)
    .max(100000)
    .optional()
    .describe('How many people the user asked for: adds the shortfall'),
  brief: BriefZodSchema.partial()
    .optional()
    .describe(
      'Write the brief once the requirements are settled (before the first search): what was asked, the criteria, the caps, the sources the user picked and the defaults you chose. A later brief is merged over the latest one, so pass only what changed. The final report quotes it.',
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
  description = `The sourcing run so far, as one small table built from data and not from memory: every search behind the project's lists (source, query, rows returned, duplicates, spend), every scoring run and profile fetch (counts and cost), and the funnel now (rows, with a LinkedIn URL, with a profile, pass / unknown / fail, qualified = passed on the full profile, awaiting a profile). For a company x role run it also returns the pairs: counts by final state (found, none_found, ambiguous, unresolvable, excluded), by rung and by source, cost, top reasons, and the coverage line to open the report with. Pass target to get the shortfall and what the pipeline can still add. Pass brief once, when the requirements are settled. Call it before deciding whether to search again, after you lose track of what ran, and when you stop short: pass stoppedBecause then, and write the final report from this result. Searches appear once their list is attached to the project.`;

  inputSchema = GetSourcingLedgerInputZodSchema;

  constructor(
    private readonly sourcingLedgerService: SourcingLedgerService,
    private readonly outreachTabService: OutreachTabService,
    private readonly outreachListService: OutreachListService,
  ) {}

  async execute(
    parameters: ToolInput,
    context: ToolExecutionContext,
  ): Promise<ToolOutput> {
    const parsed = GetSourcingLedgerInputZodSchema.safeParse(parameters);

    if (!parsed.success) {
      return {
        success: false,
        message: 'Invalid get_sourcing_ledger input',
        error: parsed.error.message,
      };
    }

    const { projectId, target, stoppedBecause, brief } = parsed.data;
    const { workspaceId } = context;

    try {
      const [rows, companyRows, lists] = await Promise.all([
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
        this.outreachListService.list(workspaceId),
      ]);
      const funnel = computeSourcingFunnel(rows);
      const pairFunnel = computePairFunnel(companyRows);

      if (brief !== undefined) {
        const previous = [
          ...(await this.sourcingLedgerService.read(workspaceId, projectId)),
        ]
          .reverse()
          .find((event) => event.kind === 'brief');
        const {
          kind: _kind,
          at: _at,
          ...previousBrief
        } = previous ?? {
          kind: 'brief',
          at: '',
        };

        await this.sourcingLedgerService.append(workspaceId, projectId, {
          kind: 'brief',
          at: new Date().toISOString(),
          ...mergeSourcingBrief(
            previous === undefined
              ? undefined
              : (previousBrief as SourcingBrief),
            brief as Partial<SourcingBrief>,
          ),
        });
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
      const latestBrief = [...events]
        .reverse()
        .find((event) => event.kind === 'brief');
      const projectLists = lists.filter((meta) =>
        meta.projectIds.includes(projectId),
      );
      const searches = projectLists.slice(0, MAX_SEARCHES).map((meta) => {
        const fetched = meta.fetched ?? meta.rowCount;
        const duplicates = meta.duplicates ?? 0;

        return {
          listId: meta.id,
          source: meta.sources.join('+'),
          entity: meta.entity,
          query: meta.query ?? meta.name,
          fetched,
          duplicates,
          duplicateShare:
            fetched > 0 ? Number((duplicates / fetched).toFixed(2)) : 0,
          rowsInList: meta.rowCount,
          spentUsd: Number(meta.spentUsd.toFixed(3)),
        };
      });
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

      return {
        success: true,
        message:
          (pairFunnel.pairs > 0 ? `${pairFunnel.coverageLine} ` : '') +
          (shortfall
            ? `${funnel.qualified} of ${shortfall.target} qualified; ${funnel.awaitingProfile} await a profile (about ${shortfall.expectedFromAwaitingProfile} more expected).`
            : `${funnel.qualified} qualified; ${funnel.awaitingProfile} await a profile.`),
        result: {
          ...(latestBrief ? { brief: latestBrief } : {}),
          funnel,
          ...(pairFunnel.pairs > 0 ? { pairs: pairFunnel } : {}),
          ...(shortfall ? { shortfall } : {}),
          searches,
          searchesNotShown: Math.max(0, projectLists.length - MAX_SEARCHES),
          searchSpendUsd: Number(
            projectLists
              .reduce((sum, meta) => sum + meta.spentUsd, 0)
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
