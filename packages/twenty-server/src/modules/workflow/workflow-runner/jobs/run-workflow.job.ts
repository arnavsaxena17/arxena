import { Logger, Scope } from '@nestjs/common';

import { isDefined } from 'twenty-shared';

import { EnvironmentService } from 'src/engine/core-modules/environment/environment.service';
import { Process } from 'src/engine/core-modules/message-queue/decorators/process.decorator';
import { Processor } from 'src/engine/core-modules/message-queue/decorators/processor.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { ThrottlerService } from 'src/engine/core-modules/throttler/throttler.service';
import { WorkflowRunStatus } from 'src/modules/workflow/common/standard-objects/workflow-run.workspace-entity';
import { WorkflowCommonWorkspaceService } from 'src/modules/workflow/common/workspace-services/workflow-common.workspace-service';
import { WorkflowExecutorWorkspaceService } from 'src/modules/workflow/workflow-executor/workspace-services/workflow-executor.workspace-service';
import { normalizeFlowToGraph } from 'src/modules/workflow/workflow-executor/utils/normalize-flow-to-graph.util';
import { RUN_WORKFLOW_JOB_NAME } from 'src/modules/workflow/workflow-runner/constants/run-workflow-job-name';
import {
  WorkflowRunException,
  WorkflowRunExceptionCode,
} from 'src/modules/workflow/workflow-runner/exceptions/workflow-run.exception';
import { type RunWorkflowJobData } from 'src/modules/workflow/workflow-runner/types/run-workflow-job-data.type';
import { WorkflowRunWorkspaceService } from 'src/modules/workflow/workflow-runner/workflow-run/workflow-run.workspace-service';

@Processor({ queueName: MessageQueue.workflowQueue, scope: Scope.REQUEST })
export class RunWorkflowJob {
  private readonly logger = new Logger(RunWorkflowJob.name);

  constructor(
    private readonly workflowCommonWorkspaceService: WorkflowCommonWorkspaceService,
    private readonly workflowExecutorWorkspaceService: WorkflowExecutorWorkspaceService,
    private readonly workflowRunWorkspaceService: WorkflowRunWorkspaceService,
    private readonly throttlerService: ThrottlerService,
    private readonly environmentService: EnvironmentService,
  ) {}

  @Process(RUN_WORKFLOW_JOB_NAME)
  async handle({
    workspaceId,
    workflowVersionId,
    workflowRunId,
    payload,
    lastExecutedStepId,
    stepIdsToRetry,
  }: RunWorkflowJobData): Promise<void> {
    try {
      if (isDefined(stepIdsToRetry)) {
        await this.retryWorkflowExecution({
          workspaceId,
          workflowRunId,
          stepIdsToRetry,
        });
      } else if (isDefined(lastExecutedStepId)) {
        await this.resumeWorkflowExecution({
          workspaceId,
          workflowRunId,
          lastExecutedStepId,
        });
      } else {
        await this.startWorkflowExecution({
          workspaceId,
          workflowRunId,
          workflowVersionId,
          payload: payload ?? {},
        });
      }
    } catch (error) {
      await this.workflowRunWorkspaceService.endWorkflowRun({
        workspaceId,
        workflowRunId,
        status: WorkflowRunStatus.FAILED,
        error: error instanceof Error ? error.message : String(error),
        isSystemError: true,
      });

      throw error;
    }
  }

  private async startWorkflowExecution({
    workspaceId,
    workflowRunId,
    workflowVersionId,
    payload,
  }: {
    workspaceId: string;
    workflowRunId: string;
    workflowVersionId?: string;
    payload: object;
  }): Promise<void> {
    if (!isDefined(workflowVersionId)) {
      throw new WorkflowRunException(
        'Workflow version id is required to start a workflow run',
        WorkflowRunExceptionCode.WORKFLOW_RUN_INVALID,
      );
    }

    const workflowVersion =
      await this.workflowCommonWorkspaceService.getWorkflowVersionOrFail(
        workflowVersionId,
      );

    if (!workflowVersion.trigger || !workflowVersion.steps) {
      throw new WorkflowRunException(
        'Workflow version has no trigger or steps',
        WorkflowRunExceptionCode.WORKFLOW_RUN_INVALID,
      );
    }

    const { trigger, steps } = normalizeFlowToGraph({
      trigger: workflowVersion.trigger,
      steps: workflowVersion.steps,
    });

    await this.workflowRunWorkspaceService.startWorkflowRun({
      workflowRunId,
      trigger,
      steps,
      triggerPayload: payload,
    });

    await this.throttleExecution(workflowVersion.workflowId);

    const stepIds = trigger.nextStepIds ?? [];

    await this.workflowExecutorWorkspaceService.executeFromSteps({
      stepIds,
      workflowRunId,
      workspaceId,
    });
  }

  private async retryWorkflowExecution({
    workspaceId,
    workflowRunId,
    stepIdsToRetry,
  }: {
    workspaceId: string;
    workflowRunId: string;
    stepIdsToRetry: string[];
  }): Promise<void> {
    const workflowRun =
      await this.workflowRunWorkspaceService.getWorkflowRunOrFail({
        workflowRunId,
        workspaceId,
      });

    if (workflowRun.status !== WorkflowRunStatus.RUNNING) {
      return;
    }

    await this.workflowExecutorWorkspaceService.executeFromSteps({
      stepIds: stepIdsToRetry,
      workflowRunId,
      workspaceId,
    });
  }

  private async resumeWorkflowExecution({
    workspaceId,
    workflowRunId,
    lastExecutedStepId,
  }: {
    workspaceId: string;
    workflowRunId: string;
    lastExecutedStepId: string;
  }): Promise<void> {
    const workflowRun =
      await this.workflowRunWorkspaceService.getWorkflowRunOrFail({
        workflowRunId,
        workspaceId,
      });

    if (workflowRun.status !== WorkflowRunStatus.RUNNING) {
      return;
    }

    const lastExecutedStep = workflowRun.state?.flow?.steps?.find(
      (step) => step.id === lastExecutedStepId,
    );

    if (!lastExecutedStep) {
      throw new WorkflowRunException(
        'Last executed step not found',
        WorkflowRunExceptionCode.INVALID_INPUT,
      );
    }

    const lastExecutedStepOutput =
      workflowRun.state?.stepInfos[lastExecutedStepId];

    const { nextStepIdsToExecute, nextStepIdsToSkip, nextStepIdsToFailSafely } =
      await this.workflowExecutorWorkspaceService.getNextStepIdsToExecute({
        executedStep: lastExecutedStep,
        executedStepOutput: {
          result: lastExecutedStepOutput?.result as object | undefined,
          error: lastExecutedStepOutput?.error,
        },
      });

    const hasStepsToSkipOrFailSafely =
      isDefined(nextStepIdsToSkip) || isDefined(nextStepIdsToFailSafely);

    const hasStepsToExecute =
      isDefined(nextStepIdsToExecute) && nextStepIdsToExecute.length > 0;

    if (!hasStepsToSkipOrFailSafely && !hasStepsToExecute) {
      await this.workflowRunWorkspaceService.endWorkflowRun({
        workflowRunId,
        workspaceId,
        status: WorkflowRunStatus.COMPLETED,
      });

      return;
    }

    const steps = workflowRun.state?.flow?.steps ?? [];

    if (hasStepsToSkipOrFailSafely) {
      await this.workflowExecutorWorkspaceService.skipAndFailSafelyStepsThenContinue(
        {
          stepIdsToSkip: nextStepIdsToSkip ?? [],
          stepIdsToFailSafely: nextStepIdsToFailSafely ?? [],
          steps,
          workflowRunId,
          workspaceId,
          executedStepsCount: 0,
        },
      );
    }

    if (hasStepsToExecute) {
      await this.workflowExecutorWorkspaceService.executeFromSteps({
        stepIds: nextStepIdsToExecute ?? [],
        workflowRunId,
        workspaceId,
      });
    }
  }

  private async throttleExecution(workflowId: string) {
    try {
      await this.throttlerService.throttle(
        `${workflowId}-workflow-execution`,
        this.environmentService.get('WORKFLOW_EXEC_THROTTLE_LIMIT'),
        this.environmentService.get('WORKFLOW_EXEC_THROTTLE_TTL'),
      );
    } catch (error) {
      throw new WorkflowRunException(
        'Workflow execution rate limit exceeded',
        WorkflowRunExceptionCode.WORKFLOW_RUN_LIMIT_REACHED,
      );
    }
  }
}
