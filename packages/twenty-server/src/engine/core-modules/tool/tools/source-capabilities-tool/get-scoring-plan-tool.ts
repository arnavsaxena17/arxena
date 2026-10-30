import { Injectable } from '@nestjs/common';

import { z } from 'zod';

import { OutreachTabService } from 'src/engine/core-modules/outreach-command/services/outreach-tab.service';
import { SourcingLedgerService } from 'src/engine/core-modules/outreach-command/services/sourcing-ledger.service';
import {
  planScoring,
  STEP_COSTS_USD,
  type ScoringCriterion,
} from 'src/engine/core-modules/tool/tools/source-capabilities-tool/enrichment-plan.util';
import {
  readCompanyCoverage,
  readPersonCoverage,
  type RowCoverage,
} from 'src/engine/core-modules/tool/tools/source-capabilities-tool/row-coverage.util';
import { type SourcingBrief } from 'src/engine/core-modules/outreach-command/utils/sourcing-ledger.util';
import { type ToolExecutionContext } from 'src/engine/core-modules/tool/types/tool-execution-context.type';
import { type ToolInput } from 'src/engine/core-modules/tool/types/tool-input.type';
import { type ToolOutput } from 'src/engine/core-modules/tool/types/tool-output.type';
import { type Tool } from 'src/engine/core-modules/tool/types/tool.type';

const MAX_ROWS = 500;

export const GetScoringPlanInputZodSchema = z.object({
  projectId: z
    .string()
    .optional()
    .describe('Project id; defaults to the project the user is looking at'),
  tab: z
    .enum(['people', 'companies'])
    .default('people')
    .describe('Which tab the rows are on'),
  criteria: z
    .array(
      z.object({
        description: z.string().min(1).max(200),
        mustHave: z.boolean(),
      }),
    )
    .max(12)
    .optional()
    .describe(
      "The rubric to score against. Omit to use the brief's must-have criteria.",
    ),
  budgetUsd: z
    .number()
    .min(0)
    .max(1000)
    .optional()
    .describe('Spend allowed for enrichment on this tab; defaults to $5'),
});

// Reads the tab and says, per row, whether the row can already be scored or
// needs one more step. The model uses it to choose what to run; it does not
// decide per row from the prompt.
@Injectable()
export class GetScoringPlanTool implements Tool {
  description = `What it would take to score the rows on a tab against the rubric, from the fields each row actually holds. Costs nothing. Per row it works out the evidence level (search snapshot, full profile, company web) and which rubric criteria are already answered, partly answered, or blind. It returns the counts by level, the enrichment steps worth running with the number of rows each would touch and its estimated cost, the must-haves no picked source can settle (report those unknown, never fail them silently), and a three-row sample. Call it before fetch_profiles or an AI column: run only the steps it names, on the rows it counts. profile = a full profile settles role, tenure, location, skills; company_web = one web column settles employer revenue, size, industry.`;
  inputSchema = GetScoringPlanInputZodSchema;

  constructor(
    private readonly outreachTabService: OutreachTabService,
    private readonly sourcingLedgerService?: SourcingLedgerService,
  ) {}

  async execute(
    parameters: ToolInput,
    context: ToolExecutionContext,
  ): Promise<ToolOutput> {
    const parsed = GetScoringPlanInputZodSchema.safeParse(parameters);

    if (!parsed.success) {
      return {
        success: false,
        message: 'Invalid get_scoring_plan input',
        error: parsed.error.message,
      };
    }

    const projectId = parsed.data.projectId ?? context.projectId;

    if (projectId === undefined || projectId.length === 0) {
      return {
        success: false,
        message: 'No project in context',
        error:
          'Pass projectId (the id in the browsing context, the project the user is looking at).',
      };
    }

    const { tab, budgetUsd } = parsed.data;
    const criteria: ScoringCriterion[] =
      parsed.data.criteria !== undefined
        ? parsed.data.criteria.map((criterion, index) => ({
            key: `c${index}`,
            description: criterion.description,
            mustHave: criterion.mustHave,
          }))
        : ((await this.briefCriteria(projectId, context.workspaceId)) ?? []);

    if (criteria.length === 0) {
      return {
        success: false,
        message: 'No rubric to score against',
        error:
          'Pass criteria ([{ description, mustHave }]) or record the brief first with get_sourcing_ledger.',
      };
    }

    try {
      const page = await this.outreachTabService.getAll({
        workspaceId: context.workspaceId,
        projectId,
        tab,
      });
      const rows = page.slice(0, MAX_ROWS);
      const truncated = page.length > MAX_ROWS;
      const byLevel = { snapshot: 0, profile: 0, company_web: 0 };
      const stepRows = new Map<
        string,
        { step: string; rows: number; settles: Set<string>; costUsd: number }
      >();
      const unsettleable = new Map<string, { rows: number; reason: string }>();
      const sample: Array<{
        name: string;
        level: string;
        steps: string[];
        unsettleable: string[];
      }> = [];

      for (const row of rows) {
        const coverage: RowCoverage =
          tab === 'people'
            ? readPersonCoverage(row)
            : readCompanyCoverage(row);
        const plan = planScoring({
          coverage,
          criteria,
          budgetUsd: budgetUsd ?? 5,
        });

        byLevel[coverage.level] += 1;

        for (const step of plan.steps) {
          const entry = stepRows.get(step.step) ?? {
            step: step.step,
            rows: 0,
            settles: new Set<string>(),
            costUsd: 0,
          };

          entry.rows += 1;
          entry.costUsd += STEP_COSTS_USD[step.step as keyof typeof STEP_COSTS_USD] ?? 0;
          for (const dimension of step.settles) {
            entry.settles.add(dimension);
          }
          stepRows.set(step.step, entry);
        }

        for (const entry of plan.unsettleable) {
          const current = unsettleable.get(entry.key) ?? {
            rows: 0,
            reason: entry.reason,
          };

          unsettleable.set(entry.key, { ...current, rows: current.rows + 1 });
        }

        if (sample.length < 3) {
          sample.push({
            name: row.name,
            level: coverage.level,
            steps: plan.steps.map((step) => step.step),
            unsettleable: plan.unsettleable.map((entry) => entry.key),
          });
        }
      }

      const criteriaByKey = new Map(
        criteria.map((criterion, index) => [`c${index}`, criterion.description]),
      );

      return {
        success: true,
        message: `${rows.length}${truncated ? ` of ${page.length}` : ''} row(s): ${byLevel.profile} already at profile, ${byLevel.snapshot} at snapshot, ${byLevel.company_web} with company revenue. ${stepRows.size} step(s) worth running.`,
        result: {
          rows: rows.length,
          ...(truncated && { totalRows: page.length }),
          byLevel,
          steps: [...stepRows.values()].map((entry) => ({
            step: entry.step,
            rows: entry.rows,
            settles: [...entry.settles],
            estimatedCostUsd: Number(entry.costUsd.toFixed(3)),
            why: `${entry.rows} row(s) need ${entry.step} for ${[...entry.settles].join(', ')}`,
          })),
          unsettleable: [...unsettleable.entries()].map(([key, entry]) => ({
            criterion: criteriaByKey.get(key) ?? key,
            rows: entry.rows,
            reason: entry.reason,
          })),
          sample,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: 'get_scoring_plan failed',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async briefCriteria(
    projectId: string,
    workspaceId: string,
  ): Promise<ScoringCriterion[] | undefined> {
    const events =
      (await this.sourcingLedgerService
        ?.read(workspaceId, projectId)
        .catch(() => [])) ?? [];
    const briefEvent = [...events]
      .reverse()
      .find((event) => event.kind === 'brief');

    if (briefEvent === undefined || briefEvent.kind !== 'brief') {
      return undefined;
    }

    const brief = briefEvent as SourcingBrief;

    if (brief.criteria.length === 0) {
      return undefined;
    }

    return brief.criteria.map((criterion, index) => ({
      key: `c${index}`,
      description: criterion.description,
      mustHave: criterion.mustHave,
    }));
  }
}
