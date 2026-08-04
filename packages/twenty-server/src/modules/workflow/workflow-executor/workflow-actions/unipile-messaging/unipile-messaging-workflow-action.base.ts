import { isNonEmptyString } from '@sniptt/guards';
import { isDefined, isValidUuid } from 'twenty-shared/utils';

import { type ToolInput } from 'src/engine/core-modules/tool/types/tool-input.type';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';
import {
  WorkflowStepExecutorException,
  WorkflowStepExecutorExceptionCode,
} from 'src/modules/workflow/workflow-executor/exceptions/workflow-step-executor.exception';
import { ToolBackedWorkflowAction } from 'src/modules/workflow/workflow-executor/workflow-actions/tool-backed/tool-backed.workflow-action';
import { type UnipileMessagingAccountType } from 'src/modules/workflow/workflow-executor/workflow-actions/unipile-messaging/types/unipile-messaging-account-type.type';
import { WorkflowRunStepLogWorkspaceService } from 'src/modules/workflow/workflow-runner/workflow-run/workflow-run-step-log.workspace-service';

type WorkspaceMemberProfileUnipileFields = {
  id: string;
  workspaceMemberId: string;
  linkedinUnipileAccountId: string | null;
  whatsappUnipileAccountId: string | null;
};

type UnipileMessagingActionInputWithMember = ToolInput & {
  workspaceMemberId: string;
  unipileAccountId?: string;
};

export abstract class UnipileMessagingWorkflowActionBase<
  TInput extends UnipileMessagingActionInputWithMember,
> extends ToolBackedWorkflowAction<TInput> {
  protected constructor(
    loggerName: string,
    workflowRunStepLogService: WorkflowRunStepLogWorkspaceService,
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
  ) {
    super(loggerName, workflowRunStepLogService);
  }

  protected abstract getAccountType(): UnipileMessagingAccountType;

  protected override async postprocessInput(
    resolvedInput: TInput,
    workspaceId: string,
  ): Promise<TInput> {
    const workspaceMemberId = resolvedInput.workspaceMemberId?.trim() ?? '';

    if (!isNonEmptyString(workspaceMemberId)) {
      throw new WorkflowStepExecutorException(
        'Workspace member is required to resolve the Unipile account',
        WorkflowStepExecutorExceptionCode.INVALID_STEP_INPUT,
      );
    }

    if (!isValidUuid(workspaceMemberId)) {
      throw new WorkflowStepExecutorException(
        `Invalid workspace member id '${workspaceMemberId}'`,
        WorkflowStepExecutorExceptionCode.INVALID_STEP_INPUT,
      );
    }

    const unipileAccountId = await this.resolveUnipileAccountId({
      workspaceMemberId,
      workspaceId,
      accountType: this.getAccountType(),
    });

    return {
      ...resolvedInput,
      unipileAccountId,
    };
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
