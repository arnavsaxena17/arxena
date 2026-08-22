import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';

import { resolveInput } from 'twenty-shared/utils';

import { ApprovalNotifierService } from 'src/engine/core-modules/arx-chat/services/workflow-approval/approval-notifier.service';
import { WorkflowFormDecisionPointerService } from 'src/engine/core-modules/arx-chat/services/workflow-approval/workflow-form-decision-pointer.service';
import {
  type WorkflowFormNotifyTestResult,
  type WorkflowFormNotifyTestSession,
} from 'src/engine/core-modules/arx-chat/services/workflow-approval/workflow-form-notify-test.types';
import {
  type FormFieldMetadata,
  type WorkflowFormNotifyOnPending,
} from 'src/modules/workflow/workflow-executor/workflow-actions/form/types/workflow-form-action-settings.type';

const convertFlatVariablesToNestedContext = (flatVariables: {
  [variablePath: string]: unknown;
}): Record<string, unknown> => {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(flatVariables)) {
    const parts = key.split('.');
    let current = result;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];

      if (!(part in current) || typeof current[part] !== 'object') {
        current[part] = {};
      }

      current = current[part] as Record<string, unknown>;
    }

    current[parts[parts.length - 1]] = value;
  }

  return result;
};

const isNotifyOnPending = (
  value: unknown,
): value is WorkflowFormNotifyOnPending => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as WorkflowFormNotifyOnPending;

  return (
    Array.isArray(candidate.channels) &&
    candidate.channels.length > 0 &&
    typeof candidate.contextTemplate === 'string'
  );
};

@Injectable()
export class WorkflowFormNotifyTestService {
  private readonly logger = new Logger(WorkflowFormNotifyTestService.name);

  constructor(
    private readonly workflowFormDecisionPointerService: WorkflowFormDecisionPointerService,
    private readonly approvalNotifierService: ApprovalNotifierService,
  ) {}

  async startTest(input: {
    workspaceId: string;
    stepId: string;
    fields: unknown;
    notifyOnPending: unknown;
    variableValues: Record<string, unknown>;
  }): Promise<WorkflowFormNotifyTestResult> {
    if (!isNotifyOnPending(input.notifyOnPending)) {
      return {
        testId: randomUUID(),
        status: 'failed',
        pointer: '',
        sendResults: [],
        error:
          'Notify on pending is not configured. Enable a WhatsApp channel first.',
      };
    }

    const fields = Array.isArray(input.fields)
      ? (input.fields as FormFieldMetadata[])
      : [];
    const nestedVariableContext = convertFlatVariablesToNestedContext(
      input.variableValues ?? {},
    );
    const notifyOnPending = input.notifyOnPending;
    const contextResolved = String(
      resolveInput(notifyOnPending.contextTemplate, nestedVariableContext) ??
        '',
    );
    const detailsResolved = notifyOnPending.detailsTemplate
      ? String(
          resolveInput(
            notifyOnPending.detailsTemplate,
            nestedVariableContext,
          ) ?? '',
        )
      : '';
    const formSnapshot = fields.map((field) => ({
      ...field,
      value:
        field.value !== undefined && field.value !== null
          ? resolveInput(field.value, nestedVariableContext)
          : field.value,
    }));
    const fieldSummary = formSnapshot
      .map((field) => `${field.label || field.name} (${field.type})`)
      .join(', ');
    const recipients = notifyOnPending.recipients ?? {};
    const resolvedRecipients = {
      WHATSAPP_OFFICIAL: recipients.WHATSAPP_OFFICIAL
        ? String(
            resolveInput(
              recipients.WHATSAPP_OFFICIAL,
              nestedVariableContext,
            ) ?? '',
          )
        : undefined,
      WHATSAPP_UNIPILE: recipients.WHATSAPP_UNIPILE
        ? String(
            resolveInput(recipients.WHATSAPP_UNIPILE, nestedVariableContext) ??
              '',
          )
        : undefined,
      unipileAccountId: recipients.unipileAccountId
        ? String(
            resolveInput(
              recipients.unipileAccountId,
              nestedVariableContext,
            ) ?? '',
          )
        : undefined,
    };

    const testId = randomUUID();
    const pointer = this.workflowFormDecisionPointerService.createPointer({
      workspaceId: input.workspaceId,
      workflowRunId: testId,
      stepId: input.stepId,
    });
    const fillUrl = this.approvalNotifierService.buildFillUrl(pointer);
    const contextText = contextResolved || 'Workflow form pending';

    let sendResults: WorkflowFormNotifyTestSession['sendResults'] = [];
    let error: string | undefined;

    try {
      const notifyResult = await this.approvalNotifierService.notify({
        channels: notifyOnPending.channels,
        contextText,
        detailsText: detailsResolved || fieldSummary || 'See form fields',
        token: pointer,
        formFields: formSnapshot,
        forcedRegistryName: notifyOnPending.whatsappOfficialRegistryName,
        recipients: resolvedRecipients,
        fieldSummary,
      });

      sendResults = notifyResult.results;
    } catch (notifyError) {
      error =
        notifyError instanceof Error
          ? notifyError.message
          : String(notifyError);
      this.logger.error('Form notify test send failed', notifyError);
    }

    const didSend = sendResults.some((result) =>
      result.status.toLowerCase().startsWith('sent'),
    );

    const session: WorkflowFormNotifyTestSession = {
      testId,
      workspaceId: input.workspaceId,
      stepId: input.stepId,
      status: 'waiting',
      fields: formSnapshot,
      contextText,
      pointer,
      fillUrl,
      sendResults,
      error:
        error ??
        (didSend ? undefined : 'No WhatsApp channel sent successfully'),
      createdAt: new Date().toISOString(),
    };

    try {
      await this.workflowFormDecisionPointerService.saveFormNotifyTestSession(
        session,
      );
    } catch (saveError) {
      this.logger.error(
        'Failed to persist form notify test session',
        saveError,
      );

      return {
        ...this.toDto(session),
        status: 'failed',
        error:
          session.error ??
          'WhatsApp may have been sent, but the test session could not be stored for webhook capture',
      };
    }

    return this.toDto(session);
  }

  async getTest(input: {
    workspaceId: string;
    testId: string;
  }): Promise<WorkflowFormNotifyTestResult> {
    const session =
      await this.workflowFormDecisionPointerService.getFormNotifyTestSession(
        input.testId,
      );

    if (!session || session.workspaceId !== input.workspaceId) {
      return {
        testId: input.testId,
        status: 'expired',
        pointer: '',
        sendResults: [],
        error: 'Test session expired or not found',
      };
    }

    return this.toDto(session);
  }

  private toDto(
    session: WorkflowFormNotifyTestSession,
  ): WorkflowFormNotifyTestResult {
    return {
      testId: session.testId,
      status: session.status,
      pointer: session.pointer,
      fillUrl: session.fillUrl,
      sendResults: session.sendResults,
      capturedResponse: session.capturedResponse,
      error: session.error,
    };
  }
}
