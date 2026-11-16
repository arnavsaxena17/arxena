import { Injectable } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';
import { z } from 'zod';

import { SourcingRunService } from 'src/engine/core-modules/candidate-sourcing/run/sourcing-run.service';
import { SOURCING_SOURCES } from 'src/engine/workspace-manager/twenty-standard-application/utils/skill-metadata/sourcing-sources.constant';
import { type ToolExecutionContext } from 'src/engine/core-modules/tool/types/tool-execution-context.type';
import { type ToolInput } from 'src/engine/core-modules/tool/types/tool-input.type';
import { type ToolOutput } from 'src/engine/core-modules/tool/types/tool-output.type';
import { type Tool } from 'src/engine/core-modules/tool/types/tool.type';

const SOURCE_KEYS = SOURCING_SOURCES.map((source) => source.key) as [
  string,
  ...string[],
];

export const SourcingStartInputZodSchema = z.object({
  projectId: z
    .string()
    .optional()
    .describe('Project id. Defaults to the project the user is looking at'),
  request: z
    .string()
    .min(3)
    .max(4000)
    .describe("The people the user wants, in the user's words"),
  budgetUsd: z
    .number()
    .min(0)
    .max(500)
    .describe('The most the run may spend, in USD, as the user approved it'),
  target: z
    .number()
    .int()
    .min(1)
    .max(20000)
    .nullable()
    .optional()
    .describe('How many people the user asked for; null if they did not say'),
  coverage: z
    .enum(['best_effort', 'exhaustive'])
    .optional()
    .describe('exhaustive only when the user asked for everyone'),
  sources: z
    .array(z.enum(SOURCE_KEYS))
    .min(1)
    .optional()
    .describe('The data sources the user picked; defaults to the brief'),
});

export const SourcingNextInputZodSchema = z.object({
  projectId: z
    .string()
    .optional()
    .describe('Project id. Defaults to the project the user is looking at'),
  runId: z.string().min(1).describe('The runId sourcing_start returned'),
  answer: z
    .string()
    .max(200)
    .optional()
    .describe(
      "The value of the option the user chose for the run's question; cancel stops the run",
    ),
});

const missingProject: ToolOutput = {
  success: false,
  message:
    'Pass projectId (the project the user is looking at): the run writes its people to that project.',
  error: 'projectId is missing',
};

const nextStepOf = (view: {
  done: boolean;
  question?: { kind: string };
}): string =>
  view.done
    ? 'The run has ended. Report qualified and to confirm apart, the spend and why it stopped, from this result.'
    : view.question !== undefined
      ? 'Ask the user this question with ask_questions, using these options, then call sourcing_next with runId and the chosen value as answer.'
      : 'The run is working in the background. Tell the user it is running; call sourcing_next with runId only when they ask for progress.';

@Injectable()
export class SourcingStartTool implements Tool {
  description = `Start a people search run that the server drives: parses the request into must-haves, nice-to-haves and exclusions, plans which sources to search, and returns a question that confirms the plan and the budget. Nothing is spent before the user answers yes through sourcing_next. Use it instead of calling search tools one by one when the user wants a list of people matching a description. Returns runId, the plan and the question.`;

  inputSchema = SourcingStartInputZodSchema;

  constructor(private readonly sourcingRunService: SourcingRunService) {}

  async execute(
    parameters: ToolInput,
    context: ToolExecutionContext,
  ): Promise<ToolOutput> {
    const parsed = SourcingStartInputZodSchema.safeParse(parameters);

    if (!parsed.success) {
      return {
        success: false,
        message: 'Invalid sourcing_start input',
        error: parsed.error.message,
      };
    }

    const projectId = parsed.data.projectId ?? context.projectId;

    if (!isNonEmptyString(projectId)) {
      return missingProject;
    }

    if (!isNonEmptyString(context.roleId)) {
      return {
        success: false,
        message: 'sourcing_start needs the member role to run its rounds',
        error: 'roleId is missing',
      };
    }

    const view = await this.sourcingRunService.start({
      workspaceId: context.workspaceId,
      projectId,
      request: parsed.data.request,
      budgetUsd: parsed.data.budgetUsd,
      target: parsed.data.target,
      coverage: parsed.data.coverage,
      sources: parsed.data.sources,
      identity: {
        roleId: context.roleId,
        userId: context.userId,
        userWorkspaceId: context.userWorkspaceId,
        threadId: context.threadId,
        turnId: context.turnId,
      },
    });

    return {
      success: view.phase !== 'BLOCKED',
      message:
        view.phase === 'BLOCKED'
          ? 'No source the loop can search was picked; say so and offer the search tools instead.'
          : 'Run planned. Confirm it with the user before anything is spent.',
      result: { ...view, nextStep: nextStepOf(view) },
    };
  }
}

@Injectable()
export class SourcingNextTool implements Tool {
  description = `Answer a sourcing run's question or read its progress. Pass runId and, when the run asked something, answer with the value of the option the user chose (yes to start, a FIX option when the run fell short, cancel to stop). The run continues in the background between calls; the result has qualified, to confirm, spend, rounds and, once it ends, the report and why it stopped.`;

  inputSchema = SourcingNextInputZodSchema;

  constructor(private readonly sourcingRunService: SourcingRunService) {}

  async execute(
    parameters: ToolInput,
    context: ToolExecutionContext,
  ): Promise<ToolOutput> {
    const parsed = SourcingNextInputZodSchema.safeParse(parameters);

    if (!parsed.success) {
      return {
        success: false,
        message: 'Invalid sourcing_next input',
        error: parsed.error.message,
      };
    }

    const projectId = parsed.data.projectId ?? context.projectId;

    if (!isNonEmptyString(projectId)) {
      return missingProject;
    }

    const view = await this.sourcingRunService.next({
      workspaceId: context.workspaceId,
      projectId,
      runId: parsed.data.runId,
      answer: parsed.data.answer,
    });

    if (view === undefined) {
      return {
        success: false,
        message: `No sourcing run ${parsed.data.runId} on this project`,
        error: 'run_not_found',
      };
    }

    return {
      success: true,
      message: view.done ? 'Run ended' : `Run ${view.phase.toLowerCase()}`,
      result: { ...view, nextStep: nextStepOf(view) },
    };
  }
}
