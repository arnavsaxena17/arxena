import { Injectable, Logger } from '@nestjs/common';

import { resolveInput } from 'twenty-shared/utils';

import { type WorkflowAction } from 'src/modules/workflow/workflow-executor/interfaces/workflow-action.interface';

import { ApprovalNotifierService } from 'src/engine/core-modules/arx-chat/services/workflow-approval/approval-notifier.service';
import { WorkflowFormDecisionPointerService } from 'src/engine/core-modules/arx-chat/services/workflow-approval/workflow-form-decision-pointer.service';
import { resolveWorkflowFormRegistryEntry } from 'src/engine/core-modules/arx-chat/services/workflow-approval/workflow-form-template.registry';
import { resolveNotifyOnPendingRecipients } from 'src/modules/workflow/workflow-executor/workflow-actions/form/utils/resolve-notify-on-pending-recipients.util';
import {
  WorkflowStepExecutorException,
  WorkflowStepExecutorExceptionCode,
} from 'src/modules/workflow/workflow-executor/exceptions/workflow-step-executor.exception';
import { type WorkflowActionInput } from 'src/modules/workflow/workflow-executor/types/workflow-action-input';
import { type WorkflowActionOutput } from 'src/modules/workflow/workflow-executor/types/workflow-action-output.type';
import { findStepOrThrow } from 'src/modules/workflow/workflow-executor/utils/find-step-or-throw.util';
import { isWorkflowFormAction } from 'src/modules/workflow/workflow-executor/workflow-actions/form/guards/is-workflow-form-action.guard';
import { type WorkflowFormActionSettings } from 'src/modules/workflow/workflow-executor/workflow-actions/form/types/workflow-form-action-settings.type';

@Injectable()
export class FormWorkflowAction implements WorkflowAction {
  private readonly logger = new Logger(FormWorkflowAction.name);

  constructor(
    private readonly workflowFormDecisionPointerService: WorkflowFormDecisionPointerService,
    private readonly approvalNotifierService: ApprovalNotifierService,
  ) {}

  async execute({
    currentStepId,
    steps,
    context,
    runInfo,
  }: WorkflowActionInput): Promise<WorkflowActionOutput> {
    const step = findStepOrThrow({
      stepId: currentStepId,
      steps,
    });

    if (!isWorkflowFormAction(step)) {
      throw new WorkflowStepExecutorException(
        'Step is not a form action',
        WorkflowStepExecutorExceptionCode.INVALID_STEP_TYPE,
      );
    }

    const settings = step.settings as WorkflowFormActionSettings & {
      notifyOnPending?: {
        channels: string[];
        contextTemplate: string;
        detailsTemplate?: string;
        whatsappOfficialRegistryName?: string;
        recipients?: {
          WHATSAPP_OFFICIAL?: string;
          WHATSAPP_UNIPILE?: string;
          unipileAccountId?: string;
        };
      };
    };

    if (settings.notifyOnPending) {
      try {
        const contextResolved = String(
          resolveInput(settings.notifyOnPending.contextTemplate, context) ??
            '',
        );
        const detailsResolved = settings.notifyOnPending.detailsTemplate
          ? String(
              resolveInput(settings.notifyOnPending.detailsTemplate, context) ??
                '',
            )
          : '';
        const formSnapshot = (settings.input ?? []).map((field) => ({
          ...field,
          // Prefill WhatsApp / hosted form with resolved sample values
          value:
            field.value !== undefined && field.value !== null
              ? resolveInput(field.value, context)
              : field.value,
        }));
        const fieldSummary = formSnapshot
          .map((field) => `${field.label || field.name} (${field.type})`)
          .join(', ');
        const registryEntry = resolveWorkflowFormRegistryEntry(
          formSnapshot,
          settings.notifyOnPending.whatsappOfficialRegistryName,
        );

        // Signed pointer embeds workspace/run/step — survives Redis flush via WhatsApp round-trip
        const decisionPointer =
          this.workflowFormDecisionPointerService.createPointer({
            workspaceId: runInfo.workspaceId,
            workflowRunId: runInfo.workflowRunId,
            stepId: currentStepId,
          });

        const notifyResult = await this.approvalNotifierService.notify({
          channels: settings.notifyOnPending.channels,
          contextText: contextResolved || 'Workflow form pending',
          detailsText: detailsResolved || fieldSummary || 'See form fields',
          token: decisionPointer,
          formFields: formSnapshot,
          forcedRegistryName:
            settings.notifyOnPending.whatsappOfficialRegistryName,
          recipients: resolveNotifyOnPendingRecipients(
            settings.notifyOnPending.recipients,
            context,
          ),
          fieldSummary,
        });

        this.logger.log(
          `Form notifyOnPending ${registryEntry.name}: ${JSON.stringify(notifyResult.results)}`,
        );
      } catch (error) {
        this.logger.error(
          'Failed to notify on pending form; run still parks',
          error,
        );
      }
    }

    return {
      pendingEvent: true,
    };
  }
}
