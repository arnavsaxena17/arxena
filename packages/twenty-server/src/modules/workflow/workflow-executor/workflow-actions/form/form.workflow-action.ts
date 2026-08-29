import { Injectable, Logger } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';
import { resolveInput } from 'twenty-shared/utils';
import { type ObjectLiteral } from 'typeorm';

import { type WorkflowAction } from 'src/modules/workflow/workflow-executor/interfaces/workflow-action.interface';

import { ApprovalNotifierService } from 'src/engine/core-modules/arx-chat/services/workflow-approval/approval-notifier.service';
import { WorkflowFormDecisionPointerService } from 'src/engine/core-modules/arx-chat/services/workflow-approval/workflow-form-decision-pointer.service';
import { resolveWorkflowFormRegistryEntry } from 'src/engine/core-modules/arx-chat/services/workflow-approval/workflow-form-template.registry';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';
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
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
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

    const formSnapshot = (settings.input ?? []).map((field) => ({
      ...field,
      value:
        field.value !== undefined && field.value !== null
          ? resolveInput(field.value, context)
          : field.value,
    }));

    const autoApproved = await this.shouldAutoApproveForm({
      workspaceId: runInfo.workspaceId,
      context,
    });

    if (autoApproved) {
      const result: Record<string, unknown> = {};

      for (const field of formSnapshot) {
        if (field.name === 'approve' && field.value === undefined) {
          result[field.name] = true;
        } else {
          result[field.name] = field.value ?? null;
        }
      }

      this.logger.log(
        `Form auto-approved (project outreachSendMode=AUTO) for run ${runInfo.workflowRunId}`,
      );

      return { result };
    }

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

  private async shouldAutoApproveForm({
    workspaceId,
    context,
  }: {
    workspaceId: string;
    context: Record<string, unknown>;
  }): Promise<boolean> {
    try {
      const candidateId = this.extractCandidateId(context);

      if (!isNonEmptyString(candidateId)) {
        return false;
      }

      const authContext = buildSystemAuthContext(workspaceId);

      return this.globalWorkspaceOrmManager.executeInWorkspaceContext(
        async () => {
          const candidateRepository =
            await this.globalWorkspaceOrmManager.getRepository<
              ObjectLiteral & { id: string; projectsId?: string | null }
            >(workspaceId, 'candidate', {
              shouldBypassPermissionChecks: true,
            });
          const candidate = await candidateRepository.findOne({
            where: { id: candidateId },
          });

          if (!isNonEmptyString(candidate?.projectsId)) {
            return false;
          }

          const projectRepository =
            await this.globalWorkspaceOrmManager.getRepository<
              ObjectLiteral & {
                id: string;
                outreachSendMode?: string | null;
              }
            >(workspaceId, 'project', { shouldBypassPermissionChecks: true });
          const project = await projectRepository.findOne({
            where: { id: candidate.projectsId },
          });

          return (
            (project?.outreachSendMode ?? 'APPROVAL').toUpperCase() === 'AUTO'
          );
        },
        authContext,
      );
    } catch (error) {
      this.logger.warn(
        `Form AUTO check failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      return false;
    }
  }

  private extractCandidateId(context: Record<string, unknown>): string | null {
    const direct = context.candidateId;

    if (typeof direct === 'string' && isNonEmptyString(direct)) {
      return direct;
    }

    const candidate = context.candidate;

    if (
      candidate &&
      typeof candidate === 'object' &&
      typeof (candidate as { id?: unknown }).id === 'string'
    ) {
      return (candidate as { id: string }).id;
    }

    const trigger =
      (context.trigger as { candidateId?: unknown } | undefined) ??
      (context as { properties?: { after?: { id?: unknown } } }).properties
        ?.after;

    if (trigger && typeof trigger === 'object') {
      const id =
        (trigger as { candidateId?: unknown }).candidateId ??
        (trigger as { id?: unknown }).id;

      if (typeof id === 'string' && isNonEmptyString(id)) {
        return id;
      }
    }

    for (const value of Object.values(context)) {
      if (
        value &&
        typeof value === 'object' &&
        typeof (value as { candidateId?: unknown }).candidateId === 'string'
      ) {
        return (value as { candidateId: string }).candidateId;
      }
    }

    return null;
  }
}
