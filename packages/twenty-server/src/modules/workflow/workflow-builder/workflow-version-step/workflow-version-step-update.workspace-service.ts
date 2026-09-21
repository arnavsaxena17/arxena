import { Injectable, Logger } from '@nestjs/common';

import { isDefined } from 'twenty-shared/utils';
import { WorkflowActionType } from 'twenty-shared/workflow';

import {
  REFRESH_PENDING_HITL_AFTER_PROMPT_CHANGE_DELAY_MS,
  REFRESH_PENDING_HITL_AFTER_PROMPT_CHANGE_JOB_NAME,
  type RefreshPendingHitlAfterPromptChangeJobData,
} from 'src/engine/core-modules/outreach-command/jobs/refresh-pending-hitl-after-prompt-change.job';
import { InjectMessageQueue } from 'src/engine/core-modules/message-queue/decorators/message-queue.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { MessageQueueService } from 'src/engine/core-modules/message-queue/services/message-queue.service';
import { WorkflowActionDTO } from 'src/engine/core-modules/workflow/dtos/workflow-action.dto';
import {
  WorkflowVersionStepException,
  WorkflowVersionStepExceptionCode,
} from 'src/modules/workflow/common/exceptions/workflow-version-step.exception';
import { assertWorkflowStepIsContentOnlyUpdate } from 'src/modules/workflow/common/utils/assert-workflow-step-is-content-only-update.util';
import { isPublishedWorkflowVersionStatus } from 'src/modules/workflow/common/utils/assert-workflow-version-allows-content-update.util';
import { WorkflowSchemaWorkspaceService } from 'src/modules/workflow/workflow-builder/workflow-schema/workflow-schema.workspace-service';
import { WorkflowVersionStepHelpersWorkspaceService } from 'src/modules/workflow/workflow-builder/workflow-version-step/workflow-version-step-helpers.workspace-service';
import { WorkflowVersionStepOperationsWorkspaceService } from 'src/modules/workflow/workflow-builder/workflow-version-step/workflow-version-step-operations.workspace-service';
import { type WorkflowAction } from 'src/modules/workflow/workflow-executor/workflow-actions/types/workflow-action.type';

@Injectable()
export class WorkflowVersionStepUpdateWorkspaceService {
  private readonly logger = new Logger(
    WorkflowVersionStepUpdateWorkspaceService.name,
  );

  constructor(
    private readonly workflowSchemaWorkspaceService: WorkflowSchemaWorkspaceService,
    private readonly workflowVersionStepOperationsWorkspaceService: WorkflowVersionStepOperationsWorkspaceService,
    private readonly workflowVersionStepHelpersWorkspaceService: WorkflowVersionStepHelpersWorkspaceService,
    @InjectMessageQueue(MessageQueue.workflowQueue)
    private readonly workflowQueue: MessageQueueService,
  ) {}

  async updateWorkflowVersionStep({
    workspaceId,
    workflowVersionId,
    step,
  }: {
    workspaceId: string;
    workflowVersionId: string;
    step: WorkflowAction;
  }): Promise<WorkflowActionDTO> {
    const workflowVersion =
      await this.workflowVersionStepHelpersWorkspaceService.getValidatedWorkflowVersionForContentUpdate(
        {
          workflowVersionId,
          workspaceId,
        },
      );

    if (!isDefined(workflowVersion.steps)) {
      throw new WorkflowVersionStepException(
        "Can't update step from undefined steps",
        WorkflowVersionStepExceptionCode.INVALID_REQUEST,
      );
    }

    const existingStep = workflowVersion.steps.find(
      (existingStep) => existingStep.id === step.id,
    );

    if (!isDefined(existingStep)) {
      throw new WorkflowVersionStepException(
        'Step not found',
        WorkflowVersionStepExceptionCode.NOT_FOUND,
      );
    }

    if (isPublishedWorkflowVersionStatus(workflowVersion.status)) {
      assertWorkflowStepIsContentOnlyUpdate({
        existingStep,
        updatedStep: step,
      });
    }

    const shouldRefreshPendingHitl =
      isPublishedWorkflowVersionStatus(workflowVersion.status) &&
      existingStep.type === WorkflowActionType.AI_AGENT &&
      step.type === WorkflowActionType.AI_AGENT &&
      getAiAgentPrompt(existingStep) !== getAiAgentPrompt(step);

    const isStepTypeChanged = existingStep.type !== step.type;

    const { updatedStep, additionalCreatedSteps } = isStepTypeChanged
      ? await this.updateWorkflowVersionStepType({
          existingStep,
          newStep: step,
          workspaceId,
          workflowVersionId,
        })
      : {
          updatedStep: await this.updateWorkflowVersionStepSettings({
            newStep: step,
            workspaceId,
            workflowVersionId,
          }),
          additionalCreatedSteps: undefined,
        };

    const updatedSteps = workflowVersion.steps.map((existingStep) => {
      if (existingStep.id === step.id) {
        return updatedStep;
      } else {
        return existingStep;
      }
    });

    if (isDefined(additionalCreatedSteps)) {
      updatedSteps.push(...additionalCreatedSteps);
    }

    await this.workflowVersionStepHelpersWorkspaceService.updateWorkflowVersionStepsAndTrigger(
      {
        workspaceId,
        workflowVersionId: workflowVersion.id,
        steps: updatedSteps,
      },
    );

    if (shouldRefreshPendingHitl) {
      try {
        await this.workflowQueue.add<RefreshPendingHitlAfterPromptChangeJobData>(
          REFRESH_PENDING_HITL_AFTER_PROMPT_CHANGE_JOB_NAME,
          {
            workspaceId,
            workflowVersionId: workflowVersion.id,
            changedStepIds: [step.id],
          },
          {
            id: `refresh-pending-hitl-${workflowVersion.id}`,
            delay: REFRESH_PENDING_HITL_AFTER_PROMPT_CHANGE_DELAY_MS,
          },
        );
      } catch (error) {
        this.logger.warn(
          `Failed to enqueue pending HITL refresh for version ${workflowVersion.id}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    return updatedStep;
  }

  private async updateWorkflowVersionStepType({
    existingStep,
    newStep,
    workspaceId,
    workflowVersionId,
  }: {
    existingStep: WorkflowAction;
    newStep: WorkflowAction;
    workspaceId: string;
    workflowVersionId: string;
  }): Promise<{
    updatedStep: WorkflowAction;
    additionalCreatedSteps?: WorkflowAction[];
  }> {
    await this.workflowVersionStepOperationsWorkspaceService.runWorkflowVersionStepDeletionSideEffects(
      {
        step: existingStep,
        workspaceId,
      },
    );

    const { builtStep, additionalCreatedSteps } =
      await this.workflowVersionStepOperationsWorkspaceService.runStepCreationSideEffectsAndBuildStep(
        {
          type: newStep.type,
          workspaceId,
          position: newStep.position,
          workflowVersionId,
          defaultSettings: newStep.settings,
        },
      );

    const updatedStep =
      await this.workflowSchemaWorkspaceService.enrichOutputSchema({
        step: {
          ...builtStep,
          id: existingStep.id,
          nextStepIds: existingStep.nextStepIds,
          position: existingStep.position,
        },
        workspaceId,
        workflowVersionId,
      });

    return { updatedStep, additionalCreatedSteps };
  }

  private async updateWorkflowVersionStepSettings({
    newStep,
    workspaceId,
    workflowVersionId,
  }: {
    newStep: WorkflowAction;
    workspaceId: string;
    workflowVersionId: string;
  }): Promise<WorkflowAction> {
    return this.workflowSchemaWorkspaceService.enrichOutputSchema({
      step: newStep,
      workspaceId,
      workflowVersionId,
    });
  }
}

const getAiAgentPrompt = (step: WorkflowAction): string => {
  const input = step.settings?.input as { prompt?: unknown } | undefined;

  return typeof input?.prompt === 'string' ? input.prompt : '';
};
