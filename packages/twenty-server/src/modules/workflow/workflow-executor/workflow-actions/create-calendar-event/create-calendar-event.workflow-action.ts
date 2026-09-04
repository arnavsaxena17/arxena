import { Injectable } from '@nestjs/common';

import { isDefined } from 'twenty-shared/utils';
import { type WorkflowRunStepLog } from 'twenty-shared/workflow';

import { CreateCalendarEventTool } from 'src/engine/core-modules/tool/tools/calendar-tool/create-calendar-event-tool';
import { type ToolOutput } from 'src/engine/core-modules/tool/types/tool-output.type';
import { type Tool } from 'src/engine/core-modules/tool/types/tool.type';
import { OutreachMessagePersistService } from 'src/engine/core-modules/outreach-command/services/outreach-message-persist.service';
import {
  WorkflowStepExecutorException,
  WorkflowStepExecutorExceptionCode,
} from 'src/modules/workflow/workflow-executor/exceptions/workflow-step-executor.exception';
import { type WorkflowActionInput } from 'src/modules/workflow/workflow-executor/types/workflow-action-input';
import { type WorkflowActionOutput } from 'src/modules/workflow/workflow-executor/types/workflow-action-output.type';
import { isWorkflowCreateCalendarEventAction } from 'src/modules/workflow/workflow-executor/workflow-actions/create-calendar-event/guards/is-workflow-create-calendar-event-action.guard';
import { type WorkflowCreateCalendarEventActionInput } from 'src/modules/workflow/workflow-executor/workflow-actions/create-calendar-event/types/workflow-create-calendar-event-action-input.type';
import { buildCreateCalendarEventStepLog } from 'src/modules/workflow/workflow-executor/workflow-actions/create-calendar-event/utils/build-create-calendar-event-step-log.util';
import { ToolBackedWorkflowAction } from 'src/modules/workflow/workflow-executor/workflow-actions/tool-backed/tool-backed.workflow-action';
import { type WorkflowAction } from 'src/modules/workflow/workflow-executor/workflow-actions/types/workflow-action.type';
import { WorkflowRunWorkspaceService } from 'src/modules/workflow/workflow-runner/workflow-run/workflow-run.workspace-service';
import { WorkflowRunStepLogWorkspaceService } from 'src/modules/workflow/workflow-runner/workflow-run/workflow-run-step-log.workspace-service';

@Injectable()
export class CreateCalendarEventWorkflowAction extends ToolBackedWorkflowAction<WorkflowCreateCalendarEventActionInput> {
  constructor(
    private readonly createCalendarEventTool: CreateCalendarEventTool,
    workflowRunStepLogService: WorkflowRunStepLogWorkspaceService,
    private readonly workflowRunWorkspaceService: WorkflowRunWorkspaceService,
    private readonly gtmOutreachMessagePersistService?: OutreachMessagePersistService,
  ) {
    super(CreateCalendarEventWorkflowAction.name, workflowRunStepLogService);
  }

  protected getTool(): Tool {
    return this.createCalendarEventTool;
  }

  protected assertStep(step: WorkflowAction): void {
    if (!isWorkflowCreateCalendarEventAction(step)) {
      throw new WorkflowStepExecutorException(
        'Step is not a create-calendar-event action',
        WorkflowStepExecutorExceptionCode.INVALID_STEP_TYPE,
      );
    }
  }

  protected buildStepLog({
    input,
    output,
    durationMs,
  }: {
    input: WorkflowCreateCalendarEventActionInput;
    output: ToolOutput;
    durationMs: number;
  }): WorkflowRunStepLog {
    return buildCreateCalendarEventStepLog({ input, output, durationMs });
  }

  override async execute(
    workflowActionInput: WorkflowActionInput,
  ): Promise<WorkflowActionOutput> {
    const output = await super.execute(workflowActionInput);

    if (
      output.error ||
      !isDefined(this.gtmOutreachMessagePersistService) ||
      !isDefined(output.result)
    ) {
      return output;
    }

    try {
      const workflowRun =
        await this.workflowRunWorkspaceService.getWorkflowRunOrFail({
          workflowRunId: workflowActionInput.runInfo.workflowRunId,
          workspaceId: workflowActionInput.runInfo.workspaceId,
        });
      const candidateId = workflowRun.candidateId;

      if (!isDefined(candidateId)) {
        return output;
      }

      await this.gtmOutreachMessagePersistService.materializeCandidateEvent({
        workspaceId: workflowActionInput.runInfo.workspaceId,
        event: 'meeting_booked',
        candidateId,
        workflowRunId: workflowActionInput.runInfo.workflowRunId,
      });
    } catch (error) {
      this.logger.warn(
        `Failed to materialize meeting_booked after calendar event for workflowRun=${workflowActionInput.runInfo.workflowRunId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    return output;
  }
}
