import { Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';

import { isDefined } from 'twenty-shared/utils';
import { StepStatus } from 'twenty-shared/workflow';

import { InjectCacheStorage } from 'src/engine/core-modules/cache-storage/decorators/cache-storage.decorator';
import { CacheStorageService } from 'src/engine/core-modules/cache-storage/services/cache-storage.service';
import { CacheStorageNamespace } from 'src/engine/core-modules/cache-storage/types/cache-storage-namespace.enum';
import {
  createWorkflowFormDecisionPointer,
  verifyWorkflowFormDecisionPointer,
  type WorkflowFormDecisionPointerParts,
} from 'src/engine/core-modules/arx-chat/services/workflow-approval/workflow-form-decision-pointer.util';
import {
  WORKFLOW_FORM_NOTIFY_TEST_TTL_MS,
  type WorkflowFormNotifyTestSession,
} from 'src/engine/core-modules/arx-chat/services/workflow-approval/workflow-form-notify-test.types';
import { isWorkflowFormAction } from 'src/modules/workflow/workflow-executor/workflow-actions/form/guards/is-workflow-form-action.guard';
import { type FormFieldMetadata } from 'src/modules/workflow/workflow-executor/workflow-actions/form/types/workflow-form-action-settings.type';
import { WorkflowRunWorkspaceService } from 'src/modules/workflow/workflow-runner/workflow-run/workflow-run.workspace-service';

// Optional Redis single-use mark; pointer alone is enough after Redis flush
const USED_POINTER_TTL_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class WorkflowFormDecisionPointerService {
  private readonly logger = new Logger(WorkflowFormDecisionPointerService.name);

  constructor(
    @InjectCacheStorage(CacheStorageNamespace.ModuleWorkflow)
    private readonly cacheStorageService: CacheStorageService,
    private readonly moduleRef: ModuleRef,
  ) {}

  private getWorkflowRunService(): WorkflowRunWorkspaceService {
    return this.moduleRef.get(WorkflowRunWorkspaceService, { strict: false });
  }

  createPointer(parts: WorkflowFormDecisionPointerParts): string {
    return createWorkflowFormDecisionPointer(parts);
  }

  verifyPointer(pointer: string): WorkflowFormDecisionPointerParts | null {
    return verifyWorkflowFormDecisionPointer(pointer);
  }

  private usedCacheKey(pointer: string): string {
    return `form-decision-used:${pointer}`;
  }

  private formNotifyTestCacheKey(testId: string): string {
    return `form-notify-test:${testId}`;
  }

  async saveFormNotifyTestSession(
    session: WorkflowFormNotifyTestSession,
  ): Promise<void> {
    await this.cacheStorageService.set(
      this.formNotifyTestCacheKey(session.testId),
      session,
      WORKFLOW_FORM_NOTIFY_TEST_TTL_MS,
    );
  }

  async getFormNotifyTestSession(
    testId: string,
  ): Promise<WorkflowFormNotifyTestSession | undefined> {
    try {
      return await this.cacheStorageService.get<WorkflowFormNotifyTestSession>(
        this.formNotifyTestCacheKey(testId),
      );
    } catch {
      return undefined;
    }
  }

  async tryCompleteFormNotifyTestSession(input: {
    parts: WorkflowFormDecisionPointerParts;
    response: Record<string, unknown>;
  }): Promise<boolean> {
    const session = await this.getFormNotifyTestSession(
      input.parts.workflowRunId,
    );

    if (
      !session ||
      session.workspaceId !== input.parts.workspaceId ||
      session.stepId !== input.parts.stepId
    ) {
      return false;
    }

    if (session.status === 'captured') {
      return true;
    }

    await this.saveFormNotifyTestSession({
      ...session,
      status: 'captured',
      capturedResponse: input.response,
      capturedAt: new Date().toISOString(),
    });

    this.logger.log(
      `Form notify test ${session.testId} captured WhatsApp / form response`,
    );

    return true;
  }

  async tryMarkPointerUsed(pointer: string): Promise<boolean> {
    try {
      return await this.cacheStorageService.setIfAbsent(
        this.usedCacheKey(pointer),
        { usedAt: new Date().toISOString() },
        USED_POINTER_TTL_MS,
      );
    } catch (error) {
      // Redis optional — signed pointer + PENDING step status still gates resume
      this.logger.warn(
        `Could not mark decision pointer used in Redis: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      return true;
    }
  }

  async isPointerMarkedUsed(pointer: string): Promise<boolean> {
    try {
      const value = await this.cacheStorageService.get<{ usedAt?: string }>(
        this.usedCacheKey(pointer),
      );

      return isDefined(value);
    } catch {
      return false;
    }
  }

  async getPendingFormFields(
    parts: WorkflowFormDecisionPointerParts,
  ): Promise<{
    fields: FormFieldMetadata[];
    stepStatus: string | undefined;
    contextText: string;
  }> {
    const testSession = await this.getFormNotifyTestSession(
      parts.workflowRunId,
    );

    if (
      isDefined(testSession) &&
      testSession.workspaceId === parts.workspaceId &&
      testSession.stepId === parts.stepId
    ) {
      return {
        fields: testSession.fields,
        stepStatus:
          testSession.status === 'captured'
            ? StepStatus.SUCCESS
            : StepStatus.PENDING,
        contextText: testSession.contextText,
      };
    }

    const workflowRun = await this.getWorkflowRunService().getWorkflowRunOrFail(
      {
        workspaceId: parts.workspaceId,
        workflowRunId: parts.workflowRunId,
      },
    );

    const step = workflowRun.state?.flow?.steps?.find(
      (workflowStep) => workflowStep.id === parts.stepId,
    );

    if (!isDefined(step) || !isWorkflowFormAction(step)) {
      throw new Error('Form step not found on workflow run');
    }

    const stepInfo = workflowRun.state?.stepInfos?.[parts.stepId];
    const fields = Array.isArray(step.settings?.input)
      ? (step.settings.input as FormFieldMetadata[])
      : [];

    return {
      fields,
      stepStatus: stepInfo?.status,
      contextText: step.name || 'Workflow form',
    };
  }

  isStepStillPending(stepStatus: string | undefined): boolean {
    return stepStatus === StepStatus.PENDING;
  }
}
