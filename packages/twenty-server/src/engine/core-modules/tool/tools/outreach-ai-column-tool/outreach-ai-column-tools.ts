import { Injectable } from '@nestjs/common';

import { type z } from 'zod';

import {
  estimateRunCostUsd,
  getAiColumnAutoRunMaxUsd,
  needsCostApproval,
} from 'src/engine/core-modules/outreach-command/utils/ai-column-cost-limit.util';
import { OutreachAiColumnService } from 'src/engine/core-modules/outreach-command/services/outreach-ai-column.service';
import { OutreachAiColumnRunService } from 'src/engine/core-modules/outreach-command/services/outreach-ai-column-run.service';
import {
  matchesTableFilter,
  OutreachTableViewService,
  readCellText,
} from 'src/engine/core-modules/outreach-command/services/outreach-table-view.service';
import {
  type OutreachWorkingSetRow,
  OutreachWorkingSetService,
} from 'src/engine/core-modules/outreach-command/services/outreach-working-set.service';
import {
  AiColumnRunIdInputZodSchema,
  ApplyOutreachTableViewInputZodSchema,
  GetAiColumnRunStatusInputZodSchema,
  GenerateOutreachTableViewInputZodSchema,
  GetOutreachWorkingSetInputZodSchema,
  PreviewOutreachAiColumnInputZodSchema,
  RunOutreachAiColumnInputZodSchema,
} from 'src/engine/core-modules/tool/tools/outreach-ai-column-tool/outreach-ai-column-tool.schema';
import { type ToolExecutionContext } from 'src/engine/core-modules/tool/types/tool-execution-context.type';
import { type ToolInput } from 'src/engine/core-modules/tool/types/tool-input.type';
import { type ToolOutput } from 'src/engine/core-modules/tool/types/tool-output.type';
import { type Tool } from 'src/engine/core-modules/tool/types/tool.type';

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const MAX_SUMMARY_VALUES = 30;

const readRowValue = (row: OutreachWorkingSetRow, key: string): unknown => {
  const otherValue = row.otherFields[key];

  if (otherValue !== undefined) {
    return otherValue;
  }

  return (row as unknown as Record<string, unknown>)[key];
};

const quantile = (sorted: number[], fraction: number): number =>
  sorted[Math.min(sorted.length - 1, Math.floor(fraction * sorted.length))];

// Counts and distributions over every row, so the agent never has to page
// through the working set just to tally it.
export const summarizeWorkingSetRows = (
  rows: OutreachWorkingSetRow[],
  keys: string[],
): Record<string, unknown> =>
  Object.fromEntries(
    keys.map((key) => {
      const values = rows
        .map((row) => readRowValue(row, key))
        .filter(
          (value) =>
            value !== undefined && value !== null && `${value}`.trim() !== '',
        );
      const numbers = values
        .map((value) =>
          typeof value === 'number'
            ? value
            : typeof value === 'string'
              ? Number(value)
              : Number.NaN,
        )
        .filter((value) => Number.isFinite(value));

      if (values.length > 0 && numbers.length === values.length) {
        const sorted = [...numbers].sort((a, b) => a - b);

        return [
          key,
          {
            filled: sorted.length,
            empty: rows.length - sorted.length,
            min: sorted[0],
            p25: quantile(sorted, 0.25),
            median: quantile(sorted, 0.5),
            p75: quantile(sorted, 0.75),
            max: sorted[sorted.length - 1],
          },
        ];
      }

      const counts = new Map<string, number>();

      for (const value of values) {
        counts.set(`${value}`, (counts.get(`${value}`) ?? 0) + 1);
      }

      const ordered = [...counts.entries()].sort((a, b) => b[1] - a[1]);

      return [
        key,
        {
          filled: values.length,
          empty: rows.length - values.length,
          distinctValues: ordered.length,
          counts: Object.fromEntries(ordered.slice(0, MAX_SUMMARY_VALUES)),
        },
      ];
    }),
  );

@Injectable()
export class GetOutreachWorkingSetTool implements Tool {
  description = `Read a small page of the project's working set: the ephemeral Find list (People / Companies tabs) merged with the CRM people attached to the project. Use it for "these / the list / each" requests instead of find_many_* or a new search. Returns total, aiColumns (the AI columns that already exist on these rows: key, label, type, filled — reuse them instead of adding a new column), rows (id, source, name, title, companyName, otherFields…) and nextCursor. Keep limit at 10. To count or to choose a cut-off, pass summarize with column keys: it returns value counts (yes/no and label columns) or min, quartiles and max (number columns) over ALL rows, optionally only the rows of the applied view (onlyViewMatches), so never page through rows to tally them.`;

  inputSchema = GetOutreachWorkingSetInputZodSchema;

  constructor(
    private readonly outreachWorkingSetService: OutreachWorkingSetService,
    private readonly outreachTableViewService: OutreachTableViewService,
  ) {}

  async execute(
    parameters: ToolInput,
    context: ToolExecutionContext,
  ): Promise<ToolOutput> {
    const parsed = GetOutreachWorkingSetInputZodSchema.safeParse(parameters);

    if (!parsed.success) {
      return {
        success: false,
        message: 'Invalid get_outreach_working_set input',
        error: parsed.error.message,
      };
    }

    const { summarize, onlyViewMatches, ...pageInput } = parsed.data;
    const page = await this.outreachWorkingSetService.getPage({
      workspaceId: context.workspaceId,
      ...pageInput,
    });

    if (page.total === 0 && parsed.data.subject === 'company') {
      return {
        success: false,
        message:
          'This project has no companies (no CRM companies tagged to it, no ephemeral list). If the user is on the People tab, call again with subject "person": questions about their companies are person columns about the employer.',
        error: 'empty_companies_tab',
      };
    }

    let summaries: Record<string, unknown> | undefined;
    let summarizedRows: number | undefined;

    if (summarize !== undefined && summarize.length > 0) {
      const allRows = await this.outreachWorkingSetService.getAll({
        workspaceId: context.workspaceId,
        projectId: parsed.data.projectId,
        subject: parsed.data.subject,
      });
      const view =
        onlyViewMatches === true
          ? await this.outreachTableViewService.get({
              workspaceId: context.workspaceId,
              projectId: parsed.data.projectId,
              tab: parsed.data.subject === 'person' ? 'people' : 'companies',
            })
          : null;
      const rows =
        view === null
          ? allRows
          : allRows.filter((row) =>
              view.filters.every((filter) =>
                matchesTableFilter(readCellText(row, filter.columnId), filter),
              ),
            );

      summaries = summarizeWorkingSetRows(rows, summarize);
      summarizedRows = rows.length;
    }

    return {
      success: true,
      message: `Returned ${page.rows.length} of ${page.total} ${parsed.data.subject} row(s).`,
      result:
        summaries === undefined ? page : { ...page, summarizedRows, summaries },
    };
  }
}

@Injectable()
export class PreviewOutreachAiColumnTool implements Tool {
  description = `Preview an AI column (filter or enrichment) on up to 10 rows of the project working set. Pass the user's request as description: the server designs the typed columns (boolean, integer, number, enum, text) with the AI filtering design call, picks the model (jev for decisions from row fields, web search for outside facts) and returns the design so you can show the types. Nothing is saved. Returns the rows with their values, a previewId, token usage and an estimated cost for the full run. Then call run_ai_column without asking when needsApproval is false (the estimated full-run cost is at or under autoRunLimitUsd, or the engine reports no cost). When needsApproval is true, ask the user once and pass approvedCostUsd to run_ai_column. Load the ai-filter-enrich skill first.

For sourcing a list pass fitment instead of description: { stage, criteria: [{ key, description, mustHave, weight }] }. The model answers pass, fail or unknown per criterion; the columns fitmentOutcome, fitmentScore and fitmentReason are computed in code against the server's fitment threshold (a request may raise it with minimumScore, never lower it). stage "snapshot" for rows a search just returned (unknown means profile fetch, not fail); stage "profile" once the full profile is on the row. To rescore at the profile stage run again with rerunAll true.`;

  inputSchema = PreviewOutreachAiColumnInputZodSchema;

  constructor(
    private readonly outreachAiColumnService: OutreachAiColumnService,
  ) {}

  async execute(
    parameters: ToolInput,
    context: ToolExecutionContext,
  ): Promise<ToolOutput> {
    const parsed = PreviewOutreachAiColumnInputZodSchema.safeParse(parameters);

    if (!parsed.success) {
      return {
        success: false,
        message: 'Invalid preview_ai_column input',
        error: parsed.error.message,
      };
    }

    try {
      const preview = await this.outreachAiColumnService.preview({
        workspaceId: context.workspaceId,
        projectId: parsed.data.projectId,
        subject: parsed.data.subject,
        filter: parsed.data.filter,
        description: parsed.data.description,
        fitment: parsed.data.fitment,
        rowLimit: parsed.data.rowLimit,
      });

      return {
        success: true,
        message: `Previewed ${preview.rows.length} of ${preview.total} row(s). Ask the user before running for all.`,
        result: preview,
      };
    } catch (error) {
      return {
        success: false,
        message: 'preview_ai_column failed',
        error: errorMessage(error),
      };
    }
  }
}

@Injectable()
export class RunOutreachAiColumnTool implements Tool {
  description = `Run a previewed AI column as a background job on the AI filtering queue; writes each answer into the row's otherFields (ephemeral + CRM) in chunks with a progress bar. Call after the preview. No confirmation is needed while the estimate is within the auto-run limit; above it the call is refused (cost_approval_required) until approvedCostUsd carries what the user approved. Pass rowLimit to touch only the first N working-set rows (table order) — required for tests / "first N" / regenerate-N. Omit rowLimit ONLY when the user explicitly asked to run for all rows. Without rowLimit, every unfilled row is processed (rerunAll false still skips already-filled). Waits for the run (waitSeconds, default 150, max 240) and returns as soon as it is done; if it is still running, call get_ai_column_run_status ONCE with waitSeconds 120 and never check more often than once a minute: every check is a full model step. Same previewId again retries only missing/failed rows unless rerunAll is true.`;

  inputSchema = RunOutreachAiColumnInputZodSchema;

  constructor(
    private readonly outreachAiColumnRunService: OutreachAiColumnRunService,
    private readonly outreachAiColumnService: OutreachAiColumnService,
  ) {}

  async execute(
    parameters: ToolInput,
    context: ToolExecutionContext,
  ): Promise<ToolOutput> {
    const parsed = RunOutreachAiColumnInputZodSchema.safeParse(parameters);

    if (!parsed.success) {
      return {
        success: false,
        message: 'Invalid run_ai_column input',
        error: parsed.error.message,
      };
    }

    const blocked = await this.checkCostApproval(parsed.data);

    if (blocked !== null) {
      return blocked;
    }

    try {
      const started = await this.outreachAiColumnRunService.startRun({
        workspaceId: context.workspaceId,
        ...parsed.data,
      });
      const run = await this.outreachAiColumnRunService.waitForRun(
        started.runId,
        parsed.data.waitSeconds * 1000,
      );
      const summary = this.outreachAiColumnRunService.summarize(run);

      return {
        success: run.status !== 'failed',
        message: describeRun(summary),
        result: summary,
      };
    } catch (error) {
      return {
        success: false,
        message: 'run_ai_column failed',
        error: errorMessage(error),
      };
    }
  }

  // Money is the one thing a run needs approval for: under the limit the agent
  // runs at once, over it the user is asked once and the amount is passed back.
  private async checkCostApproval(
    input: z.infer<typeof RunOutreachAiColumnInputZodSchema>,
  ): Promise<ToolOutput | null> {
    const preview = await this.outreachAiColumnService.getPreviewState(
      input.previewId,
    );

    if (!preview) {
      return null;
    }

    const estimatedCostUsd = estimateRunCostUsd({
      estimatedRunCostUsd: preview.estimatedRunCostUsd,
      estimatedPerRowUsd: preview.estimatedPerRowUsd,
      rowLimit: input.rowLimit,
    });

    if (
      !needsCostApproval({
        estimatedCostUsd,
        approvedCostUsd: input.approvedCostUsd,
      })
    ) {
      return null;
    }

    const limit = getAiColumnAutoRunMaxUsd();

    return {
      success: false,
      message: `This run is estimated at about $${(estimatedCostUsd ?? 0).toFixed(2)}, over the $${limit.toFixed(2)} that runs without asking. Ask the user once to approve it (up to that amount, or the enrichment cap they approved for the whole list build), then call run_ai_column again with approvedCostUsd set to the amount they approved.`,
      error: 'cost_approval_required',
      result: { estimatedCostUsd, autoRunLimitUsd: limit },
    };
  }
}

const describeRun = (summary: {
  status: string;
  answered: number;
  failed: number;
  done: number;
  total: number;
  error?: string;
}): string => {
  if (summary.status === 'completed') {
    return `Column filled for ${summary.answered} of ${summary.total} row(s); ${summary.failed} failed (not "no": call run_ai_column again with the same previewId to retry only those).`;
  }

  if (summary.status === 'failed') {
    return `Run stopped: ${summary.error ?? 'unknown error'} (${summary.answered} of ${summary.total} filled so far). Call run_ai_column again with the same previewId once fixed.`;
  }

  if (summary.status === 'cancelled') {
    return `Run cancelled at ${summary.done} of ${summary.total} row(s). Filled rows are kept.`;
  }

  return `Still running in the background: ${summary.done} of ${summary.total} row(s) done. It continues and shows progress above the table. Check once more with get_ai_column_run_status (waitSeconds 120); do not check more often than once a minute.`;
};

@Injectable()
export class GetOutreachAiColumnRunStatusTool implements Tool {
  description = `Check an AI column run started by run_ai_column: status, rows done / total, failed rows, tokens and cost so far. Waits for the run to finish (waitSeconds, default 120, max 240) and returns as soon as it is done, so one call replaces many polls. Never call it more than once a minute.`;

  inputSchema = GetAiColumnRunStatusInputZodSchema;

  constructor(
    private readonly outreachAiColumnRunService: OutreachAiColumnRunService,
  ) {}

  async execute(parameters: ToolInput): Promise<ToolOutput> {
    const parsed = GetAiColumnRunStatusInputZodSchema.safeParse(parameters);

    if (!parsed.success) {
      return {
        success: false,
        message: 'Invalid get_ai_column_run_status input',
        error: parsed.error.message,
      };
    }

    const run = await this.outreachAiColumnRunService.getRun(parsed.data.runId);

    if (!run) {
      return {
        success: false,
        message: 'Run not found or expired.',
        error: 'run_not_found',
      };
    }

    const waited =
      parsed.data.waitSeconds > 0
        ? await this.outreachAiColumnRunService
            .waitForRun(run.runId, parsed.data.waitSeconds * 1000)
            .catch(() => run)
        : run;
    const summary = this.outreachAiColumnRunService.summarize(waited);

    return { success: true, message: describeRun(summary), result: summary };
  }
}

@Injectable()
export class CancelOutreachAiColumnRunTool implements Tool {
  description = `Cancel a running AI column immediately. Rows already filled are kept; the project is unblocked for a new run.`;

  inputSchema = AiColumnRunIdInputZodSchema;

  constructor(
    private readonly outreachAiColumnRunService: OutreachAiColumnRunService,
  ) {}

  async execute(parameters: ToolInput): Promise<ToolOutput> {
    const parsed = AiColumnRunIdInputZodSchema.safeParse(parameters);

    if (!parsed.success) {
      return {
        success: false,
        message: 'Invalid cancel_ai_column_run input',
        error: parsed.error.message,
      };
    }

    const run = await this.outreachAiColumnRunService.cancelRun(
      parsed.data.runId,
    );

    if (!run) {
      return {
        success: false,
        message: 'Run not found or expired.',
        error: 'run_not_found',
      };
    }

    return {
      success: true,
      message: `Cancel requested (${run.status}). Filled rows are kept.`,
      result: this.outreachAiColumnRunService.summarize(run),
    };
  }
}

@Injectable()
export class GenerateOutreachTableViewTool implements Tool {
  description = `Propose table filters and a sort from the user's words, using the columns the table really has (including AI columns). It decides whether a filter and/or a sort is needed at all: a request to add a column or answer a question ("revenue of each", "how many employees") needs neither and returns needsFilter=false, needsSort=false. Nothing is applied. Returns the filters, the sort, a one-line summary and how many rows would match. Show it to the user, then call apply_table_view with it unchanged if it is wanted.`;

  inputSchema = GenerateOutreachTableViewInputZodSchema;

  constructor(
    private readonly outreachTableViewService: OutreachTableViewService,
  ) {}

  async execute(
    parameters: ToolInput,
    context: ToolExecutionContext,
  ): Promise<ToolOutput> {
    const parsed =
      GenerateOutreachTableViewInputZodSchema.safeParse(parameters);

    if (!parsed.success) {
      return {
        success: false,
        message: 'Invalid generate_table_view input',
        error: parsed.error.message,
      };
    }

    try {
      const view = await this.outreachTableViewService.generate({
        workspaceId: context.workspaceId,
        ...parsed.data,
      });

      return {
        success: true,
        message:
          view.needsFilter || view.needsSort
            ? `${view.summary} (${view.matchCount} of ${view.total} rows). Not applied yet.`
            : 'No filter or sort is needed for this request.',
        result: view,
      };
    } catch (error) {
      return {
        success: false,
        message: 'generate_table_view failed',
        error: errorMessage(error),
      };
    }
  }
}

@Injectable()
export class ApplyOutreachTableViewTool implements Tool {
  description = `Apply filters and a sort to the project's People or Companies table, as proposed by generate_table_view (pass them unchanged). Everyone viewing the project sees it immediately and it is kept for the project; a bar above the table lists the filters and sort with a Clear button. Pass clear=true to remove them.`;

  inputSchema = ApplyOutreachTableViewInputZodSchema;

  constructor(
    private readonly outreachTableViewService: OutreachTableViewService,
  ) {}

  async execute(
    parameters: ToolInput,
    context: ToolExecutionContext,
  ): Promise<ToolOutput> {
    const parsed = ApplyOutreachTableViewInputZodSchema.safeParse(parameters);

    if (!parsed.success) {
      return {
        success: false,
        message: 'Invalid apply_table_view input',
        error: parsed.error.message,
      };
    }

    try {
      const applied = await this.outreachTableViewService.apply({
        workspaceId: context.workspaceId,
        projectId: parsed.data.projectId,
        tab: parsed.data.tab,
        filters: parsed.data.clear === true ? [] : parsed.data.filters,
        sort: parsed.data.clear === true ? null : (parsed.data.sort ?? null),
        summary: parsed.data.summary,
      });

      return {
        success: true,
        message:
          applied.view.filters.length === 0 && applied.view.sort === null
            ? 'Filters and sort cleared.'
            : `Applied: ${applied.view.summary} (${applied.matchCount} of ${applied.total} rows).`,
        result: applied,
      };
    } catch (error) {
      return {
        success: false,
        message: 'apply_table_view failed',
        error: errorMessage(error),
      };
    }
  }
}
