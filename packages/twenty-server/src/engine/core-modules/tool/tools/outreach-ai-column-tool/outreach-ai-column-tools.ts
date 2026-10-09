import { Injectable } from '@nestjs/common';

import { OutreachAiColumnService } from 'src/engine/core-modules/outreach-command/services/outreach-ai-column.service';
import { OutreachAiColumnRunService } from 'src/engine/core-modules/outreach-command/services/outreach-ai-column-run.service';
import { OutreachTableViewService } from 'src/engine/core-modules/outreach-command/services/outreach-table-view.service';
import { OutreachWorkingSetService } from 'src/engine/core-modules/outreach-command/services/outreach-working-set.service';
import {
  AiColumnRunIdInputZodSchema,
  ApplyOutreachTableViewInputZodSchema,
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

@Injectable()
export class GetOutreachWorkingSetTool implements Tool {
  description = `Read a small page of the project's working set: the ephemeral Find list (People / Companies tabs) merged with the CRM people attached to the project. Use it for "these / the list / each" requests instead of find_many_* or a new search. Returns total, aiColumns (the AI columns that already exist on these rows: key, label, type, filled — reuse them instead of adding a new column), rows (id, source, name, title, companyName, otherFields…) and nextCursor. Keep limit at 10.`;

  inputSchema = GetOutreachWorkingSetInputZodSchema;

  constructor(
    private readonly outreachWorkingSetService: OutreachWorkingSetService,
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

    const page = await this.outreachWorkingSetService.getPage({
      workspaceId: context.workspaceId,
      ...parsed.data,
    });

    if (page.total === 0 && parsed.data.subject === 'company') {
      return {
        success: false,
        message:
          'This project has no companies (no CRM companies tagged to it, no ephemeral list). If the user is on the People tab, call again with subject "person": questions about their companies are person columns about the employer.',
        error: 'empty_companies_tab',
      };
    }

    return {
      success: true,
      message: `Returned ${page.rows.length} of ${page.total} ${parsed.data.subject} row(s).`,
      result: page,
    };
  }
}

@Injectable()
export class PreviewOutreachAiColumnTool implements Tool {
  description = `Preview an AI column (filter or enrichment) on up to 10 rows of the project working set. Pass the user's request as description: the server designs the typed columns (boolean, integer, number, enum, text) with the AI filtering design call, picks the model (jev for decisions from row fields, web search for outside facts) and returns the design so you can show the types. Nothing is saved. Returns the rows with their values, a previewId, token usage and an estimated cost for the full run. After this, ask the user whether to run it for all rows; only then call run_ai_column. Load the ai-filter-enrich skill first.`;

  inputSchema = PreviewOutreachAiColumnInputZodSchema;

  constructor(private readonly outreachAiColumnService: OutreachAiColumnService) {}

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

// How long run_ai_column waits for the background job before handing back
// control. Short columns finish inside it; long ones keep running.
const RUN_WAIT_MS = 45_000;

@Injectable()
export class RunOutreachAiColumnTool implements Tool {
  description = `Run a previewed AI column for every row of the project working set. It runs as a background job on the AI filtering queue and saves each answer as a new key in the row's otherFields (ephemeral list and CRM) in chunks, so values appear in the table as they land and a progress bar shows above it. Call only after the user confirmed the preview. Waits up to ~45 seconds: if the column is not finished it returns status "running" with progress; tell the user it continues in the background and use get_ai_column_run_status to check. Calling again with the same previewId only fills rows that are still missing (failed rows), unless rerunAll is true.`;

  inputSchema = RunOutreachAiColumnInputZodSchema;

  constructor(
    private readonly outreachAiColumnRunService: OutreachAiColumnRunService,
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

    try {
      const started = await this.outreachAiColumnRunService.startRun({
        workspaceId: context.workspaceId,
        ...parsed.data,
      });
      const run = await this.outreachAiColumnRunService.waitForRun(
        started.runId,
        RUN_WAIT_MS,
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

  return `Still running in the background: ${summary.done} of ${summary.total} row(s) done. Tell the user it continues and shows progress above the table; check with get_ai_column_run_status.`;
};

@Injectable()
export class GetOutreachAiColumnRunStatusTool implements Tool {
  description = `Check an AI column run started by run_ai_column: status, rows done / total, failed rows, tokens and cost so far.`;

  inputSchema = AiColumnRunIdInputZodSchema;

  constructor(
    private readonly outreachAiColumnRunService: OutreachAiColumnRunService,
  ) {}

  async execute(parameters: ToolInput): Promise<ToolOutput> {
    const parsed = AiColumnRunIdInputZodSchema.safeParse(parameters);

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

    const summary = this.outreachAiColumnRunService.summarize(run);

    return { success: true, message: describeRun(summary), result: summary };
  }
}

@Injectable()
export class CancelOutreachAiColumnRunTool implements Tool {
  description = `Cancel a running AI column. Rows already filled are kept; the run stops after the current chunk.`;

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
    const parsed = GenerateOutreachTableViewInputZodSchema.safeParse(parameters);

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
