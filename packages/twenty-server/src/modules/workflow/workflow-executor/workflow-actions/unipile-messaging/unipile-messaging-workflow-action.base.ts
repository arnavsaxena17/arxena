import { isNonEmptyString } from '@sniptt/guards';
import { isDefined, isValidUuid, resolveInput } from 'twenty-shared/utils';

import { isAccountRateLimitDeferredError } from 'src/engine/core-modules/account-rate-limit/account-rate-limit-deferred.error';
import { type ToolInput } from 'src/engine/core-modules/tool/types/tool-input.type';
import { GtmUnipilePacingService } from 'src/engine/core-modules/gtm-command/services/gtm-unipile-pacing.service';
import {
  GtmOutreachMessagePersistService,
  type GtmOutreachTranscriptChannel,
} from 'src/engine/core-modules/gtm-command/services/gtm-outreach-message-persist.service';
import { type GtmThrottleChannel } from 'src/engine/core-modules/gtm-command/utils/gtm-outreach-throttle.util';
import { MessageQueueService } from 'src/engine/core-modules/message-queue/services/message-queue.service';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';
import {
  WorkflowStepExecutorException,
  WorkflowStepExecutorExceptionCode,
} from 'src/modules/workflow/workflow-executor/exceptions/workflow-step-executor.exception';
import { type WorkflowActionInput } from 'src/modules/workflow/workflow-executor/types/workflow-action-input';
import { type WorkflowActionOutput } from 'src/modules/workflow/workflow-executor/types/workflow-action-output.type';
import { findStepOrThrow } from 'src/modules/workflow/workflow-executor/utils/find-step-or-throw.util';
import { deferWorkflowForAccountRateLimit } from 'src/modules/workflow/workflow-executor/utils/defer-workflow-for-account-rate-limit.util';
import { ToolBackedWorkflowAction } from 'src/modules/workflow/workflow-executor/workflow-actions/tool-backed/tool-backed.workflow-action';
import { type WorkflowAction } from 'src/modules/workflow/workflow-executor/workflow-actions/types/workflow-action.type';
import { type UnipileMessagingAccountType } from 'src/modules/workflow/workflow-executor/workflow-actions/unipile-messaging/types/unipile-messaging-account-type.type';
import { WorkflowRunStepLogWorkspaceService } from 'src/modules/workflow/workflow-runner/workflow-run/workflow-run-step-log.workspace-service';

const extractProviderMessageId = (result: unknown): string | undefined => {
  if (!isDefined(result) || typeof result !== 'object') {
    return undefined;
  }

  const record = result as Record<string, unknown>;
  const nested =
    record.response && typeof record.response === 'object'
      ? (record.response as Record<string, unknown>)
      : undefined;
  const candidates = [
    record.id,
    record.message_id,
    record.messageId,
    nested?.id,
    nested?.message_id,
    nested?.messageId,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && isNonEmptyString(candidate)) {
      return candidate;
    }
  }

  return undefined;
};

type WorkspaceMemberProfileUnipileFields = {
  id: string;
  workspaceMemberId: string;
  linkedinUnipileAccountId: string | null;
  whatsappUnipileAccountId: string | null;
};

type UnipileMessagingActionInputWithMember = ToolInput & {
  workspaceMemberId?: string;
  linkedinProfileId?: string;
  linkedinUrl?: string;
  skipPacing?: boolean;
  unipileAccountId?: string;
  candidateId?: string;
  phone?: string;
  body?: string;
  message?: string;
};

export abstract class UnipileMessagingWorkflowActionBase<
  TInput extends UnipileMessagingActionInputWithMember,
> extends ToolBackedWorkflowAction<TInput> {
  protected constructor(
    loggerName: string,
    private readonly unipileStepLogService: WorkflowRunStepLogWorkspaceService,
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
    private readonly gtmUnipilePacingService: GtmUnipilePacingService,
    private readonly delayedQueue: MessageQueueService,
    private readonly gtmOutreachMessagePersistService?: GtmOutreachMessagePersistService,
  ) {
    super(loggerName, unipileStepLogService);
  }

  protected abstract getAccountType(): UnipileMessagingAccountType;

  protected getPacingChannel(): GtmThrottleChannel | null {
    return null;
  }

  protected getTranscriptChannel(): GtmOutreachTranscriptChannel | null {
    return null;
  }

  async execute({
    currentStepId,
    steps,
    context,
    runInfo,
  }: WorkflowActionInput): Promise<WorkflowActionOutput> {
    const step = findStepOrThrow({ stepId: currentStepId, steps });

    this.assertStep(step as WorkflowAction);

    const rawInput = step.settings.input as TInput;
    const preprocessed = await this.preprocessInput(rawInput, context);
    const resolvedInput = await this.postprocessInput(
      resolveInput(preprocessed, context) as TInput,
      runInfo.workspaceId,
    );

    const skipPacing = resolvedInput.skipPacing === true;
    const pacingChannel = this.getPacingChannel();
    let pacingProjectId: string | null = null;
    let pacingPatch: Parameters<
      GtmUnipilePacingService['stampSuccess']
    >[0]['patch'] = {};

    if (!skipPacing && pacingChannel) {
      const check = await this.gtmUnipilePacingService.check({
        workspaceId: runInfo.workspaceId,
        workspaceMemberId: resolvedInput.workspaceMemberId ?? '',
        channel: pacingChannel,
        linkedinProfileId: resolvedInput.linkedinProfileId,
      });

      pacingProjectId = check.projectId;
      pacingPatch = check.counterPatch;

      if (!check.allowed && check.delayMs > 0) {
        return deferWorkflowForAccountRateLimit({
          delayedQueue: this.delayedQueue,
          waitMs: check.delayMs,
          currentStepId,
          workspaceId: runInfo.workspaceId,
          workflowRunId: runInfo.workflowRunId,
          pendingReason: 'gtm_unipile_pacing',
        });
      }
    }

    const startedAt = Date.now();
    let toolOutput;
    try {
      toolOutput = await this.getTool().execute(resolvedInput, {
        workspaceId: runInfo.workspaceId,
      });
    } catch (error) {
      if (isAccountRateLimitDeferredError(error) && error.waitMs > 0) {
        return deferWorkflowForAccountRateLimit({
          delayedQueue: this.delayedQueue,
          waitMs: error.waitMs,
          currentStepId,
          workspaceId: runInfo.workspaceId,
          workflowRunId: runInfo.workflowRunId,
          method: error.method,
        });
      }

      throw error;
    }
    const durationMs = Date.now() - startedAt;

    if (toolOutput.success) {
      const transcriptChannel = this.getTranscriptChannel();

      if (isDefined(transcriptChannel) && isDefined(this.gtmOutreachMessagePersistService)) {
        try {
          await this.gtmOutreachMessagePersistService.appendOutbound({
            workspaceId: runInfo.workspaceId,
            channel: transcriptChannel,
            body: resolvedInput.body ?? resolvedInput.message ?? '',
            candidateId: resolvedInput.candidateId,
            linkedinProfileId: resolvedInput.linkedinProfileId,
            phone: resolvedInput.phone,
            externalMessageId: extractProviderMessageId(toolOutput.result),
          });
        } catch (error) {
          this.logger.warn(
            `Failed to persist outreach transcript: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      }
    }

    if (toolOutput.success && !skipPacing && pacingChannel) {
      await this.gtmUnipilePacingService.stampSuccess({
        workspaceId: runInfo.workspaceId,
        workspaceMemberId: resolvedInput.workspaceMemberId ?? '',
        projectId: pacingProjectId,
        channel: pacingChannel,
        patch: pacingPatch,
      });
    }

    try {
      await this.unipileStepLogService.setStepLog({
        workflowRunId: runInfo.workflowRunId,
        workspaceId: runInfo.workspaceId,
        stepId: currentStepId,
        stepLog: this.buildStepLog({
          input: resolvedInput,
          output: toolOutput,
          durationMs,
        }),
      });
    } catch (error) {
      this.logger.warn(
        `Failed to persist Unipile step log for workflowRun=${runInfo.workflowRunId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    return {
      result: toolOutput.result as object,
      error: toolOutput.error,
    };
  }

  protected override async postprocessInput(
    resolvedInput: TInput,
    workspaceId: string,
  ): Promise<TInput> {
    let workspaceMemberId = resolvedInput.workspaceMemberId?.trim() ?? '';

    if (!isNonEmptyString(workspaceMemberId) || !isValidUuid(workspaceMemberId)) {
      workspaceMemberId = await this.resolveDefaultWorkspaceMemberId({
        workspaceId,
        accountType: this.getAccountType(),
      });
    }

    if (!isNonEmptyString(workspaceMemberId)) {
      throw new WorkflowStepExecutorException(
        'Workspace member is required to resolve the Unipile account',
        WorkflowStepExecutorExceptionCode.INVALID_STEP_INPUT,
      );
    }

    const unipileAccountId = await this.resolveUnipileAccountId({
      workspaceMemberId,
      workspaceId,
      accountType: this.getAccountType(),
    });

    const linkedinProfileId = await this.gtmUnipilePacingService.resolveLinkedinProfileId(
      {
        workspaceId,
        linkedinProfileId: resolvedInput.linkedinProfileId,
        linkedinUrl: resolvedInput.linkedinUrl,
      },
    );

    return {
      ...resolvedInput,
      workspaceMemberId,
      unipileAccountId,
      ...(isNonEmptyString(linkedinProfileId) ? { linkedinProfileId } : {}),
    };
  }

  private async resolveDefaultWorkspaceMemberId({
    workspaceId,
    accountType,
  }: {
    workspaceId: string;
    accountType: UnipileMessagingAccountType;
  }): Promise<string> {
    const authContext = buildSystemAuthContext(workspaceId);

    return this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        const profileRepository =
          await this.globalWorkspaceOrmManager.getRepository<WorkspaceMemberProfileUnipileFields>(
            workspaceId,
            'workspaceMemberProfile',
            { shouldBypassPermissionChecks: true },
          );
        const profiles = await profileRepository.find({ take: 25 });
        const match = profiles.find((profile) =>
          accountType === 'linkedin'
            ? isNonEmptyString(profile.linkedinUnipileAccountId)
            : isNonEmptyString(profile.whatsappUnipileAccountId),
        );

        return match?.workspaceMemberId ?? '';
      },
      authContext,
    );
  }

  private async resolveUnipileAccountId({
    workspaceMemberId,
    workspaceId,
    accountType,
  }: {
    workspaceMemberId: string;
    workspaceId: string;
    accountType: UnipileMessagingAccountType;
  }): Promise<string> {
    const authContext = buildSystemAuthContext(workspaceId);

    return this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        const profileRepository =
          await this.globalWorkspaceOrmManager.getRepository<WorkspaceMemberProfileUnipileFields>(
            workspaceId,
            'workspaceMemberProfile',
            { shouldBypassPermissionChecks: true },
          );

        const profile = await profileRepository.findOne({
          where: { workspaceMemberId },
          select: {
            id: true,
            workspaceMemberId: true,
            linkedinUnipileAccountId: true,
            whatsappUnipileAccountId: true,
          },
        });

        if (!isDefined(profile)) {
          throw new WorkflowStepExecutorException(
            `No workspace member profile found for member '${workspaceMemberId}'`,
            WorkflowStepExecutorExceptionCode.INVALID_STEP_INPUT,
          );
        }

        const unipileAccountId =
          accountType === 'linkedin'
            ? (profile.linkedinUnipileAccountId?.trim() ?? '')
            : (profile.whatsappUnipileAccountId?.trim() ?? '');

        if (!isNonEmptyString(unipileAccountId)) {
          throw new WorkflowStepExecutorException(
            `No ${accountType} Unipile account configured for workspace member '${workspaceMemberId}'`,
            WorkflowStepExecutorExceptionCode.INVALID_STEP_INPUT,
          );
        }

        return unipileAccountId;
      },
      authContext,
    );
  }
}
