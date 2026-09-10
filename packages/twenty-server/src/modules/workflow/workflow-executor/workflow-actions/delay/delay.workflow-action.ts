import { Injectable } from '@nestjs/common';

import { resolveInput } from 'twenty-shared/utils';

import { type WorkflowAction } from 'src/modules/workflow/workflow-executor/interfaces/workflow-action.interface';

import { InjectMessageQueue } from 'src/engine/core-modules/message-queue/decorators/message-queue.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { MessageQueueService } from 'src/engine/core-modules/message-queue/services/message-queue.service';
import {
  WorkflowStepExecutorException,
  WorkflowStepExecutorExceptionCode,
} from 'src/modules/workflow/workflow-executor/exceptions/workflow-step-executor.exception';
import { type WorkflowActionInput } from 'src/modules/workflow/workflow-executor/types/workflow-action-input';
import { type WorkflowActionOutput } from 'src/modules/workflow/workflow-executor/types/workflow-action-output.type';
import { findStepOrThrow } from 'src/modules/workflow/workflow-executor/utils/find-step-or-throw.util';
import { isWorkflowDelayAction } from 'src/modules/workflow/workflow-executor/workflow-actions/delay/guards/is-workflow-delay-action.guard';
import { type WorkflowDelayActionInput } from 'src/modules/workflow/workflow-executor/workflow-actions/delay/types/workflow-delay-action-input.type';
import { convertWorkflowDelayDurationToMs } from 'src/modules/workflow/workflow-executor/workflow-actions/delay/utils/convert-workflow-delay-duration-to-ms.util';
import { pickRandomWorkflowDelayDurationMs } from 'src/modules/workflow/workflow-executor/workflow-actions/delay/utils/pick-random-workflow-delay-duration-ms.util';
import { scheduleResumeDelayedWorkflowJob } from 'src/modules/workflow/workflow-executor/workflow-actions/delay/utils/resume-delayed-workflow-job-scheduler.util';

@Injectable()
export class DelayWorkflowAction implements WorkflowAction {
  constructor(
    @InjectMessageQueue(MessageQueue.delayedJobsQueue)
    private readonly messageQueueService: MessageQueueService,
  ) {}

  async execute({
    currentStepId,
    steps,
    runInfo,
    context,
  }: WorkflowActionInput): Promise<WorkflowActionOutput> {
    const step = findStepOrThrow({
      stepId: currentStepId,
      steps,
    });

    if (!isWorkflowDelayAction(step)) {
      throw new WorkflowStepExecutorException(
        'Step is not a delay action',
        WorkflowStepExecutorExceptionCode.INVALID_STEP_TYPE,
      );
    }

    const workflowActionInput = resolveInput(
      step.settings.input,
      context,
    ) as WorkflowDelayActionInput;

    let delayInMs: number;

    if (workflowActionInput.delayType === 'SCHEDULED_DATE') {
      if (!workflowActionInput.scheduledDateTime) {
        throw new WorkflowStepExecutorException(
          'Scheduled date time is required for scheduled date delay',
          WorkflowStepExecutorExceptionCode.INVALID_STEP_INPUT,
        );
      }

      const scheduledDate = new Date(workflowActionInput.scheduledDateTime);
      const now = new Date();

      delayInMs = scheduledDate.getTime() - now.getTime();

      if (delayInMs < 0) {
        throw new WorkflowStepExecutorException(
          'Scheduled date cannot be in the past',
          WorkflowStepExecutorExceptionCode.INVALID_STEP_INPUT,
        );
      }
    } else if (workflowActionInput.delayType === 'DURATION') {
      if (!workflowActionInput.duration) {
        throw new WorkflowStepExecutorException(
          'Duration is required for duration delay',
          WorkflowStepExecutorExceptionCode.INVALID_STEP_INPUT,
        );
      }

      delayInMs = convertWorkflowDelayDurationToMs(
        workflowActionInput.duration,
      );
    } else if (workflowActionInput.delayType === 'RANDOM_DURATION') {
      if (
        !workflowActionInput.minDuration ||
        !workflowActionInput.maxDuration
      ) {
        throw new WorkflowStepExecutorException(
          'Minimum and maximum durations are required for random duration delay',
          WorkflowStepExecutorExceptionCode.INVALID_STEP_INPUT,
        );
      }

      try {
        delayInMs = pickRandomWorkflowDelayDurationMs({
          minDuration: workflowActionInput.minDuration,
          maxDuration: workflowActionInput.maxDuration,
        });
      } catch (error) {
        throw new WorkflowStepExecutorException(
          error instanceof Error
            ? error.message
            : 'Invalid random duration delay range',
          WorkflowStepExecutorExceptionCode.INVALID_STEP_INPUT,
        );
      }
    } else {
      throw new WorkflowStepExecutorException(
        'Invalid delay type',
        WorkflowStepExecutorExceptionCode.INVALID_STEP_INPUT,
      );
    }

    await scheduleResumeDelayedWorkflowJob({
      delayedQueue: this.messageQueueService,
      data: {
        workspaceId: runInfo.workspaceId,
        workflowRunId: runInfo.workflowRunId,
        stepId: currentStepId,
      },
      delay: delayInMs,
    });

    const scheduledAt = new Date(Date.now() + delayInMs).toISOString();

    return {
      pendingEvent: true,
      waitMs: delayInMs,
      scheduledAt,
      pendingReason: 'outreach_sequence_delay',
    };
  }
}
