import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';

import { isNonEmptyString } from '@sniptt/guards';
import { z } from 'zod';

import {
  ArxenaToolProvider,
  type ArxenaToolExecutionContext,
} from 'src/engine/core-modules/arxena-tools/providers/arxena-tool.provider';
import {
  createSourcingRunPorts,
  outcomeOfTabRow,
} from 'src/domains/ingestion/candidate-sourcing/run/sourcing-run.ports';
import {
  SourcingRunService,
  readRunState,
} from 'src/domains/ingestion/candidate-sourcing/run/sourcing-run.service';
import {
  type RunState,
  type RunView,
} from 'src/domains/ingestion/candidate-sourcing/run/sourcing-run.types';
import { readRowProfile } from 'src/domains/ingestion/candidate-sourcing/services/profile-fetch/profile-row-fields.util';
import { SourceAdapterRegistry } from 'src/domains/ingestion/candidate-sourcing/sources/adapter-registry';
import {
  createHarvestAdapter,
  createIndexAdapter,
  type RunSearchTool,
} from 'src/domains/ingestion/candidate-sourcing/sources/tool-adapters';
import { LinkedinQueryGenerationService } from 'src/domains/discovery/query/linkedin-query-generation/services/linkedin-query-generation.service';
import { OutreachAiColumnRunService } from 'src/domains/engagement/outreach-command/services/outreach-ai-column-run.service';
import { OutreachTabService } from 'src/domains/engagement/outreach-command/services/outreach-tab.service';
import { SourcingLedgerService } from 'src/domains/engagement/outreach-command/services/sourcing-ledger.service';
import { type SourcingBrief } from 'src/domains/engagement/outreach-command/utils/sourcing-ledger.util';
import { FetchProfilesService } from 'src/engine/core-modules/tool/tools/fetch-profiles-tool/fetch-profiles.service';
import { type ToolExecutionContext } from 'src/engine/core-modules/tool/types/tool-execution-context.type';
import { type ToolInput } from 'src/engine/core-modules/tool/types/tool-input.type';
import { type ToolOutput } from 'src/engine/core-modules/tool/types/tool-output.type';
import { type Tool } from 'src/engine/core-modules/tool/types/tool.type';

// How long one judge step waits for the fitment column to finish
const SCORING_WAIT_MS = 240_000;

type RunScope = Pick<RunState, 'workspaceId' | 'projectId'>;

// Builds a run for one tool call. The ports search, score and fetch as the
// calling user, so they are made from that call's context.
@Injectable()
export class SourcingRunFactory {
  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly sourcingLedgerService: SourcingLedgerService,
    private readonly outreachTabService: OutreachTabService,
    private readonly fetchProfilesService: FetchProfilesService,
    private readonly outreachAiColumnRunService: OutreachAiColumnRunService,
  ) {}

  readState(scope: RunScope, runId: string): Promise<RunState> {
    return readRunState(
      this.sourcingLedgerService,
      scope.workspaceId,
      scope.projectId,
      runId,
    );
  }

  async latestBrief(scope: RunScope): Promise<SourcingBrief | undefined> {
    const events = await this.sourcingLedgerService.read(
      scope.workspaceId,
      scope.projectId,
    );

    for (let index = events.length - 1; index >= 0; index -= 1) {
      const event = events[index];

      if (event.kind === 'brief') {
        return event;
      }
    }

    return undefined;
  }

  create(
    context: ToolExecutionContext,
    projectId: string,
    scoring: RunState['scoring'],
  ): SourcingRunService {
    const registry = new SourceAdapterRegistry();
    const runTool = this.searchToolRunner(context, projectId);

    registry.register('index', createIndexAdapter(runTool));
    registry.register('harvest', createHarvestAdapter(runTool));

    return new SourcingRunService(
      this.sourcingLedgerService,
      createSourcingRunPorts({
        // Resolved when first used: the query generator and the tool provider
        // live in modules that import this one
        compileQuerySet: async (requirement) =>
          (
            await this.moduleRef
              .get(LinkedinQueryGenerationService, { strict: false })
              .generateSearchQuerySet(requirement)
          ).final_query_set,
        registry,
        readPeople: (scope) => this.readPeople(scope),
        scoreRows: (scope) => this.scoreRows(scope, context, scoring),
        fetchProfiles: async (scope, rowLimit) => {
          const result = await this.fetchProfilesService.fetch({
            workspaceId: scope.workspaceId,
            projectId: scope.projectId,
            outcomes: ['unknown'],
            rowLimit,
          });

          return {
            fetched: result.fetched.brightData + result.fetched.harvest,
          };
        },
      }),
    );
  }

  private readPeople(scope: RunScope) {
    return this.outreachTabService.getAll({
      workspaceId: scope.workspaceId,
      projectId: scope.projectId,
      tab: 'people',
    });
  }

  // A search tool run against the run's project: the provider writes the rows
  // to the tab and answers with counts
  private searchToolRunner(
    context: ToolExecutionContext,
    projectId: string,
  ): RunSearchTool {
    return async (toolName, args) => {
      const output = await this.moduleRef
        .get(ArxenaToolProvider, { strict: false })
        .executeStaticTool(toolName, { ...args, projectId }, {
          workspaceId: context.workspaceId,
          userId: context.userId,
          userWorkspaceId: context.userWorkspaceId,
          projectId,
        } as ArxenaToolExecutionContext);

      if (!output.success) {
        throw new Error(output.error ?? output.message);
      }

      return (output.result ?? {}) as Record<string, unknown>;
    };
  }

  // JUDGE with the fitment column the agent previewed: rows with no outcome
  // at the snapshot stage, then rows still unknown that now have a profile
  private async scoreRows(
    scope: RunScope,
    context: ToolExecutionContext,
    scoring: RunState['scoring'],
  ): Promise<{ costUsd: number }> {
    if (scoring === undefined) {
      throw new Error(
        'This run has no scoring preview. Start it with scoringPreviewId from preview_ai_column (fitment).',
      );
    }

    const rows = await this.readPeople(scope);
    let costUsd = 0;

    if (rows.some((row) => outcomeOfTabRow(row) === undefined)) {
      costUsd += await this.runColumn(scope, context, {
        previewId: scoring.previewId,
        rowScope: 'unfilled',
      });
    }

    if (scoring.profilePreviewId !== undefined) {
      const rowIds = (await this.readPeople(scope))
        .filter(
          (row) =>
            outcomeOfTabRow(row) === 'unknown' &&
            readRowProfile(row.otherFields) !== undefined,
        )
        .map((row) => row.id);

      if (rowIds.length > 0) {
        costUsd += await this.runColumn(scope, context, {
          previewId: scoring.profilePreviewId,
          rowIds,
          rerunAll: true,
        });
      }
    }

    return { costUsd };
  }

  private async runColumn(
    scope: RunScope,
    context: ToolExecutionContext,
    selection: {
      previewId: string;
      rowScope?: 'unfilled';
      rowIds?: string[];
      rerunAll?: boolean;
    },
  ): Promise<number> {
    const started = await this.outreachAiColumnRunService.startRun({
      workspaceId: scope.workspaceId,
      projectId: scope.projectId,
      tab: 'people',
      threadId: context.threadId,
      ...selection,
    });
    const run = await this.outreachAiColumnRunService.waitForRun(
      started.runId,
      SCORING_WAIT_MS,
    );

    if (run.status !== 'completed') {
      throw new Error(
        `Scoring did not finish (${run.status}${run.error ? `: ${run.error}` : ''}). Call sourcing_next again once it has.`,
      );
    }

    return run.usage?.estimatedCostUsd ?? 0;
  }
}

const nextStepOf = (view: RunView): string =>
  view.done
    ? `The run is over (${view.phase}${view.whyStopped ? `: ${view.whyStopped}` : ''}). Report ${view.qualified} qualified and ${view.toConfirm} to confirm against the target, the spend, and why it stopped.`
    : 'Call sourcing_next with this runId. Do not search, score or fetch profiles yourself: the run does it.';

const projectIdOf = (
  input: { projectId?: string },
  context: ToolExecutionContext,
): string | undefined => {
  const projectId = input.projectId ?? context.projectId;

  return isNonEmptyString(projectId) ? projectId.trim() : undefined;
};

const failure = (message: string, error: unknown): ToolOutput => ({
  success: false,
  message,
  error: error instanceof Error ? error.message : String(error),
});

const StartInputZodSchema = z.object({
  projectId: z
    .string()
    .optional()
    .describe(
      'The project whose tab receives the rows. Defaults to the open project.',
    ),
  budgetUsd: z
    .number()
    .min(0)
    .max(1000)
    .describe('The most this run may spend, in USD. The user approves it.'),
  scoringPreviewId: z
    .string()
    .describe(
      'previewId from preview_ai_column with fitment at stage "snapshot": the rubric every fetched row is judged against.',
    ),
  profileScoringPreviewId: z
    .string()
    .optional()
    .describe(
      'previewId from preview_ai_column with fitment at stage "profile". When given, rows still unknown are judged again once their profile is fetched.',
    ),
  searchType: z
    .enum(['classic', 'sales_navigator', 'recruiter'])
    .optional()
    .describe(
      'The LinkedIn product the connected account searches, when a LinkedIn source is picked.',
    ),
});

@Injectable()
export class SourcingStartTool implements Tool {
  description = `Start a sourcing run for the brief already written on this project (get_sourcing_ledger). Plans only: it compiles the brief into queries, pairs them with the sources the brief picked, and returns the candidates. Nothing is searched and nothing is spent. Sources it cannot run are listed in "unusable" with the reason: tell the user, do not work around them. Then call sourcing_next until done is true.`;

  inputSchema = StartInputZodSchema;

  constructor(private readonly sourcingRunFactory: SourcingRunFactory) {}

  async execute(
    parameters: ToolInput,
    context: ToolExecutionContext,
  ): Promise<ToolOutput> {
    const parsed = StartInputZodSchema.safeParse(parameters);

    if (!parsed.success) {
      return failure('Invalid sourcing_start input', parsed.error);
    }

    const projectId = projectIdOf(parsed.data, context);

    if (projectId === undefined) {
      return failure(
        'No project',
        'projectId is required. Open the project whose tab should receive the rows.',
      );
    }

    const scope = { workspaceId: context.workspaceId, projectId };

    try {
      const brief = await this.sourcingRunFactory.latestBrief(scope);

      if (brief === undefined) {
        return failure(
          'No brief',
          'Write the brief first with get_sourcing_ledger, including the sources the user picked.',
        );
      }

      const scoring = {
        previewId: parsed.data.scoringPreviewId,
        ...(parsed.data.profileScoringPreviewId !== undefined && {
          profilePreviewId: parsed.data.profileScoringPreviewId,
        }),
      };
      const view = await this.sourcingRunFactory
        .create(context, projectId, scoring)
        .start({
          ...scope,
          brief,
          budgetUsd: parsed.data.budgetUsd,
          scoring,
          ...(parsed.data.searchType !== undefined && {
            searchType: parsed.data.searchType,
          }),
        });

      return {
        success: true,
        message: `Planned ${view.candidates.length} candidate search(es); nothing spent`,
        result: { ...view, nextStep: nextStepOf(view) },
      };
    } catch (error) {
      return failure('sourcing_start failed', error);
    }
  }
}

const NextInputZodSchema = z.object({
  projectId: z
    .string()
    .optional()
    .describe('The project the run belongs to. Defaults to the open project.'),
  runId: z.string().describe('runId from sourcing_start'),
  cancel: z
    .boolean()
    .optional()
    .describe('true ends the run now instead of running another round'),
});

@Injectable()
export class SourcingNextTool implements Tool {
  description = `Run one round of a sourcing run: probe or fetch, judge the new rows, fetch profiles for the undecided, then either stop or pick what the next round fetches. The server decides every step and keeps to the budget; you only call this again while done is false. When done is true report qualified, toConfirm, spentUsd and whyStopped. If it returns an error, fix what the error names and call it again with the same runId: the run resumes where it stopped.`;

  inputSchema = NextInputZodSchema;

  constructor(private readonly sourcingRunFactory: SourcingRunFactory) {}

  async execute(
    parameters: ToolInput,
    context: ToolExecutionContext,
  ): Promise<ToolOutput> {
    const parsed = NextInputZodSchema.safeParse(parameters);

    if (!parsed.success) {
      return failure('Invalid sourcing_next input', parsed.error);
    }

    const projectId = projectIdOf(parsed.data, context);

    if (projectId === undefined) {
      return failure('No project', 'projectId is required.');
    }

    const scope = { workspaceId: context.workspaceId, projectId };

    try {
      const state = await this.sourcingRunFactory.readState(
        scope,
        parsed.data.runId,
      );
      const run = this.sourcingRunFactory.create(
        context,
        projectId,
        state.scoring,
      );
      const view =
        parsed.data.cancel === true
          ? await run.cancel({ ...scope, runId: parsed.data.runId })
          : await run.next({ ...scope, runId: parsed.data.runId });

      return {
        success: true,
        message: view.done
          ? `Run finished: ${view.qualified} qualified, ${view.toConfirm} to confirm, $${view.spentUsd} spent (${view.whyStopped ?? view.phase})`
          : `Round ${view.rounds} done: ${view.qualified} qualified, ${view.toConfirm} to confirm, $${view.spentUsd} of $${view.budgetUsd} spent`,
        result: { ...view, nextStep: nextStepOf(view) },
      };
    } catch (error) {
      return failure('sourcing_next failed', error);
    }
  }
}
