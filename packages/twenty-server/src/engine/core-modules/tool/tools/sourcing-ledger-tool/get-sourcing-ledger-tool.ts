import { Injectable } from '@nestjs/common';

import { z } from 'zod';

import { OutreachListService } from 'src/engine/core-modules/outreach-list/services/outreach-list.service';
import { SourcingLedgerService } from 'src/engine/core-modules/outreach-command/services/sourcing-ledger.service';
import { OutreachWorkingSetService } from 'src/engine/core-modules/outreach-command/services/outreach-working-set.service';
import { computeSourcingFunnel } from 'src/engine/core-modules/outreach-command/utils/sourcing-ledger.util';
import { type ToolExecutionContext } from 'src/engine/core-modules/tool/types/tool-execution-context.type';
import { type ToolInput } from 'src/engine/core-modules/tool/types/tool-input.type';
import { type ToolOutput } from 'src/engine/core-modules/tool/types/tool-output.type';
import { type Tool } from 'src/engine/core-modules/tool/types/tool.type';

const MAX_SEARCHES = 15;
const MAX_EVENTS = 20;

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
    })
    .optional(),
  destination: z.string().max(200).optional(),
  assumptions: z
    .array(z.string().max(200))
    .max(10)
    .describe('Defaults you chose and told the user about instead of asking'),
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
  brief: BriefZodSchema.optional().describe(
    'Write the brief once the requirements are settled (before the first search): what was asked, the criteria, the caps and the defaults you chose. The final report quotes it.',
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
  description = `The sourcing run so far, as one small table built from data and not from memory: every search behind the project's lists (source, query, rows returned, duplicates, spend), every scoring run and profile fetch (counts and cost), and the funnel now (rows, with a LinkedIn URL, with a profile, pass / unknown / fail, qualified = passed on the full profile, awaiting a profile). Pass target to get the shortfall and what the pipeline can still add. Pass brief once, when the requirements are settled. Call it before deciding whether to search again, after you lose track of what ran, and when you stop short: pass stoppedBecause then, and write the final report from this result. Searches appear once their list is attached to the project.`;

  inputSchema = GetSourcingLedgerInputZodSchema;

  constructor(
    private readonly sourcingLedgerService: SourcingLedgerService,
    private readonly outreachWorkingSetService: OutreachWorkingSetService,
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
      const [rows, lists] = await Promise.all([
        this.outreachWorkingSetService.getAll({
          workspaceId,
          projectId,
          subject: 'person',
        }),
        this.outreachListService.list(workspaceId),
      ]);
      const funnel = computeSourcingFunnel(rows);

      if (brief !== undefined) {
        await this.sourcingLedgerService.append(workspaceId, projectId, {
          kind: 'brief',
          at: new Date().toISOString(),
          ...brief,
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
        message: shortfall
          ? `${funnel.qualified} of ${shortfall.target} qualified; ${funnel.awaitingProfile} await a profile (about ${shortfall.expectedFromAwaitingProfile} more expected).`
          : `${funnel.qualified} qualified; ${funnel.awaitingProfile} await a profile.`,
        result: {
          ...(latestBrief ? { brief: latestBrief } : {}),
          funnel,
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
