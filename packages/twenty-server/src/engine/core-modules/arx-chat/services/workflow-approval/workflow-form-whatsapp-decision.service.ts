import { Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';

import { mapFlowResponseToFormFields } from 'src/engine/core-modules/arx-chat/services/workflow-approval/workflow-form-flow-json.builder';
import { WorkflowFormDecisionPointerService } from 'src/engine/core-modules/arx-chat/services/workflow-approval/workflow-form-decision-pointer.service';
import {
  parseWorkflowFormQuickReplyPayload,
  verifyWorkflowFormDecisionPointer,
} from 'src/engine/core-modules/arx-chat/services/workflow-approval/workflow-form-decision-pointer.util';
import { WorkflowRunnerWorkspaceService } from 'src/modules/workflow/workflow-runner/workspace-services/workflow-runner.workspace-service';

@Injectable()
export class WorkflowFormWhatsappDecisionService {
  private readonly logger = new Logger(
    WorkflowFormWhatsappDecisionService.name,
  );

  constructor(
    private readonly workflowFormDecisionPointerService: WorkflowFormDecisionPointerService,
    private readonly moduleRef: ModuleRef,
  ) {}

  private getWorkflowRunner(): WorkflowRunnerWorkspaceService {
    return this.moduleRef.get(WorkflowRunnerWorkspaceService, {
      strict: false,
    });
  }

  // Parse quick-reply payloads: wfd:{pointer}:approve|reject
  async handleButtonPayload(payload: string): Promise<boolean> {
    const parsed = parseWorkflowFormQuickReplyPayload(payload);

    if (!parsed) {
      return false;
    }

    await this.applyDecision({
      pointer: parsed.pointer,
      decision: parsed.decision,
    });

    return true;
  }

  // Parse Flow nfm_reply.response_json — flow_token is our signed pointer
  async handleFlowResponseJson(responseJson: string): Promise<boolean> {
    let parsed: Record<string, unknown>;

    try {
      parsed = JSON.parse(responseJson) as Record<string, unknown>;
    } catch {
      this.logger.warn('Invalid Flow response_json');

      return false;
    }

    const pointer =
      typeof parsed.flow_token === 'string' ? parsed.flow_token : null;

    if (!pointer) {
      return false;
    }

    const parts = verifyWorkflowFormDecisionPointer(pointer);

    if (!parts) {
      this.logger.warn(`Invalid flow_token pointer`);

      return false;
    }

    const { fields } =
      await this.workflowFormDecisionPointerService.getPendingFormFields(parts);

    const formResponse = mapFlowResponseToFormFields(parsed, fields);

    const booleanField = fields.find(
      (field) => field.type.toUpperCase() === 'BOOLEAN',
    );
    const booleanValue = booleanField
      ? formResponse[booleanField.name]
      : undefined;
    const decision =
      booleanValue === false || booleanValue === 'false' ? 'reject' : 'approve';

    await this.applyDecision({
      pointer,
      decision,
      response: formResponse,
    });

    return true;
  }

  async applyDecision(input: {
    pointer: string;
    decision?: 'approve' | 'reject';
    response?: Record<string, unknown>;
  }): Promise<{ status: string; idempotent?: boolean }> {
    const parts = verifyWorkflowFormDecisionPointer(input.pointer);

    if (!parts) {
      throw new Error('Invalid decision pointer');
    }

    const { fields, stepStatus } =
      await this.workflowFormDecisionPointerService.getPendingFormFields(parts);

    if (
      !this.workflowFormDecisionPointerService.isStepStillPending(stepStatus)
    ) {
      return { status: 'idempotent', idempotent: true };
    }

    const claimed =
      await this.workflowFormDecisionPointerService.tryMarkPointerUsed(
        input.pointer,
      );

    if (!claimed) {
      return { status: 'idempotent', idempotent: true };
    }

    let formResponse: Record<string, unknown> = {
      ...(input.response ?? {}),
    };

    if (Object.keys(formResponse).length === 0) {
      const booleanField = fields.find(
        (field) => field.type.toUpperCase() === 'BOOLEAN',
      )?.name;

      if (!booleanField) {
        throw new Error('No boolean field to map decision onto');
      }

      formResponse = {
        [booleanField]: input.decision === 'approve',
      };
    }

    await this.getWorkflowRunner().submitFormStep({
      workspaceId: parts.workspaceId,
      workflowRunId: parts.workflowRunId,
      stepId: parts.stepId,
      response: formResponse,
    });

    this.logger.log(
      `Workflow form decided via WhatsApp for run ${parts.workflowRunId} step ${parts.stepId}`,
    );

    return { status: 'ok' };
  }
}
