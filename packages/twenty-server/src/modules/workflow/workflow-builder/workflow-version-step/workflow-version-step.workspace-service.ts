import { Injectable } from '@nestjs/common';

import { isDefined } from 'twenty-shared/utils';

import { type CreateWorkflowVersionStepInput } from 'src/engine/core-modules/workflow/dtos/create-workflow-version-step.input';
import { WorkflowActionDTO } from 'src/engine/core-modules/workflow/dtos/workflow-action.dto';
import { type WorkflowVersionStepChangesDTO } from 'src/engine/core-modules/workflow/dtos/workflow-version-step-changes.dto';
import { type WorkflowVersionTriggerDTO } from 'src/engine/core-modules/workflow/dtos/workflow-version-trigger.dto';
import { assertWorkflowTriggerIsContentOnlyUpdate } from 'src/modules/workflow/common/utils/assert-workflow-step-is-content-only-update.util';
import { isPublishedWorkflowVersionStatus } from 'src/modules/workflow/common/utils/assert-workflow-version-allows-content-update.util';
import { WorkflowVersionStepCreationWorkspaceService } from 'src/modules/workflow/workflow-builder/workflow-version-step/workflow-version-step-creation.workspace-service';
import { WorkflowVersionStepDeletionWorkspaceService } from 'src/modules/workflow/workflow-builder/workflow-version-step/workflow-version-step-deletion.workspace-service';
import { WorkflowVersionStepHelpersWorkspaceService } from 'src/modules/workflow/workflow-builder/workflow-version-step/workflow-version-step-helpers.workspace-service';
import { WorkflowVersionStepUpdateWorkspaceService } from 'src/modules/workflow/workflow-builder/workflow-version-step/workflow-version-step-update.workspace-service';
import { type WorkflowAction } from 'src/modules/workflow/workflow-executor/workflow-actions/types/workflow-action.type';
import { type WorkflowTrigger } from 'src/modules/workflow/workflow-trigger/types/workflow-trigger.type';

@Injectable()
export class WorkflowVersionStepWorkspaceService {
  constructor(
    private readonly workflowVersionStepCreationWorkspaceService: WorkflowVersionStepCreationWorkspaceService,
    private readonly workflowVersionStepUpdateWorkspaceService: WorkflowVersionStepUpdateWorkspaceService,
    private readonly workflowVersionStepDeletionWorkspaceService: WorkflowVersionStepDeletionWorkspaceService,
    private readonly workflowVersionStepHelpersWorkspaceService: WorkflowVersionStepHelpersWorkspaceService,
  ) {}

  async createWorkflowVersionStep({
    workspaceId,
    input,
  }: {
    workspaceId: string;
    input: CreateWorkflowVersionStepInput;
  }): Promise<WorkflowVersionStepChangesDTO> {
    return this.workflowVersionStepCreationWorkspaceService.createWorkflowVersionStep(
      {
        workspaceId,
        input,
      },
    );
  }

  async updateWorkflowVersionStep({
    workspaceId,
    workflowVersionId,
    step,
  }: {
    workspaceId: string;
    workflowVersionId: string;
    step: WorkflowAction;
  }): Promise<WorkflowActionDTO> {
    return this.workflowVersionStepUpdateWorkspaceService.updateWorkflowVersionStep(
      {
        workspaceId,
        workflowVersionId,
        step,
      },
    );
  }

  async updateWorkflowVersionTrigger({
    workspaceId,
    workflowVersionId,
    trigger,
  }: {
    workspaceId: string;
    workflowVersionId: string;
    trigger: WorkflowTrigger;
  }): Promise<WorkflowVersionTriggerDTO> {
    const workflowVersion =
      await this.workflowVersionStepHelpersWorkspaceService.getValidatedWorkflowVersionForContentUpdate(
        {
          workflowVersionId,
          workspaceId,
        },
      );

    if (
      isPublishedWorkflowVersionStatus(workflowVersion.status) &&
      isDefined(workflowVersion.trigger)
    ) {
      assertWorkflowTriggerIsContentOnlyUpdate({
        existingTrigger: workflowVersion.trigger,
        updatedTrigger: trigger,
      });
    }

    await this.workflowVersionStepHelpersWorkspaceService.updateWorkflowVersionStepsAndTrigger(
      {
        workspaceId,
        workflowVersionId,
        trigger,
      },
    );

    return { trigger };
  }

  async deleteWorkflowVersionStep({
    workspaceId,
    workflowVersionId,
    stepIdToDelete,
  }: {
    workspaceId: string;
    workflowVersionId: string;
    stepIdToDelete: string;
  }): Promise<WorkflowVersionStepChangesDTO> {
    return this.workflowVersionStepDeletionWorkspaceService.deleteWorkflowVersionStep(
      {
        workspaceId,
        workflowVersionId,
        stepIdToDelete,
      },
    );
  }

  async duplicateWorkflowVersionStep({
    workspaceId,
    workflowVersionId,
    stepId,
  }: {
    workspaceId: string;
    workflowVersionId: string;
    stepId: string;
  }): Promise<WorkflowVersionStepChangesDTO> {
    return this.workflowVersionStepCreationWorkspaceService.duplicateWorkflowVersionStep(
      {
        workspaceId,
        workflowVersionId,
        stepId,
      },
    );
  }

  async createDraftStep({
    step,
    workspaceId,
  }: {
    step: WorkflowAction;
    workspaceId: string;
  }): Promise<WorkflowAction> {
    return this.workflowVersionStepCreationWorkspaceService.createDraftStep({
      step,
      workspaceId,
    });
  }
}
