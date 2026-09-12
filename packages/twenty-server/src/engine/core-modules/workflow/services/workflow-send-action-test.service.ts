import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { isNonEmptyString } from '@sniptt/guards';
import { isDefined, isValidUuid, resolveInput } from 'twenty-shared/utils';
import { extractVariablesFromInput } from 'twenty-shared/workflow';
import { IsNull, type Repository } from 'typeorm';

import { isUserAuthContext } from 'src/engine/core-modules/auth/guards/is-user-auth-context.guard';
import { getWorkspaceAuthContext } from 'src/engine/core-modules/auth/storage/workspace-auth-context.storage';
import { TestWorkflowSendActionDTO } from 'src/engine/core-modules/workflow/dtos/test-workflow-send-action.dto';
import {
  TestWorkflowSendActionChannel,
  type TestWorkflowSendActionInput,
} from 'src/engine/core-modules/workflow/dtos/test-workflow-send-action.input';
import { WorkflowAiAgentTestContextService } from 'src/engine/core-modules/workflow/services/workflow-ai-agent-test-context.service';
import { findWorkflowStepOrThrow } from 'src/engine/core-modules/workflow/utils/get-workflow-previous-steps.util';
import { SendEmailTool } from 'src/engine/core-modules/tool/tools/email-tool/send-email-tool';
import { type EmailToolInput } from 'src/engine/core-modules/tool/tools/email-tool/types/email-tool-input.type';
import { SendLinkedinMessageTool } from 'src/engine/core-modules/tool/tools/unipile-messaging-tool/send-linkedin-message-tool';
import { SendWhatsappMessageTool } from 'src/engine/core-modules/tool/tools/unipile-messaging-tool/send-whatsapp-message-tool';
import { UserWorkspaceEntity } from 'src/engine/core-modules/user-workspace/user-workspace.entity';
import { ConnectedAccountEntity } from 'src/engine/metadata-modules/connected-account/entities/connected-account.entity';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';
import { WorkflowCommonWorkspaceService } from 'src/modules/workflow/common/workspace-services/workflow-common.workspace-service';
import { type WorkflowAction } from 'src/modules/workflow/workflow-executor/workflow-actions/types/workflow-action.type';
import { WorkflowActionType } from 'twenty-shared/workflow';

type WorkspaceMemberUnipileFields = {
  id: string;
  linkedinUnipileAccountId: string | null;
  whatsappUnipileAccountId: string | null;
};

@Injectable()
export class WorkflowSendActionTestService {
  constructor(
    private readonly workflowCommonWorkspaceService: WorkflowCommonWorkspaceService,
    private readonly workflowAiAgentTestContextService: WorkflowAiAgentTestContextService,
    private readonly sendEmailTool: SendEmailTool,
    private readonly sendWhatsappMessageTool: SendWhatsappMessageTool,
    private readonly sendLinkedinMessageTool: SendLinkedinMessageTool,
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
    @InjectRepository(ConnectedAccountEntity)
    private readonly connectedAccountRepository: Repository<ConnectedAccountEntity>,
    @InjectRepository(UserWorkspaceEntity)
    private readonly userWorkspaceRepository: Repository<UserWorkspaceEntity>,
  ) {}

  async test({
    workspaceId,
    input,
  }: {
    workspaceId: string;
    input: TestWorkflowSendActionInput;
  }): Promise<TestWorkflowSendActionDTO> {
    const startedAtMs = Date.now();

    try {
      const workflowVersion =
        await this.workflowCommonWorkspaceService.getWorkflowVersionOrFail({
          workspaceId,
          workflowVersionId: input.workflowVersionId,
        });
      const steps = workflowVersion.steps;

      if (!isDefined(steps) || steps.length === 0) {
        throw new Error('Workflow version has no steps');
      }

      const step = findWorkflowStepOrThrow({
        steps,
        stepId: input.stepId,
      });

      this.assertStepMatchesChannel(step, input.channel);

      const preparedInput = this.applyTestOverrides({
        stepInput: { ...(step.settings.input as Record<string, unknown>) },
        body: input.body,
        subject: input.subject,
        connectedAccountId: input.connectedAccountId,
      });

      const context =
        await this.workflowAiAgentTestContextService.buildContextForCandidate({
          workspaceId,
          workflowVersionId: input.workflowVersionId,
          stepId: input.stepId,
          candidateId: input.candidateId,
          inputSource: preparedInput,
        });

      const resolvedInput = resolveInput(preparedInput, context) as Record<
        string,
        unknown
      >;

      const missingVariablePaths = extractVariablesFromInput(resolvedInput);

      if (missingVariablePaths.length > 0) {
        throw new Error(
          `Could not fill step chips from this candidate: ${missingVariablePaths.join(', ')}. Provide body/subject overrides for FORM/AI chips.`,
        );
      }

      const toolOutput = await this.executeChannel({
        workspaceId,
        channel: input.channel,
        candidateId: input.candidateId,
        resolvedInput,
      });

      const durationMs = Date.now() - startedAtMs;

      if (toolOutput.success !== true) {
        return {
          success: false,
          message: toolOutput.message ?? 'Send test failed',
          result: (toolOutput.result as object | undefined) ?? null,
          error: toolOutput.error ?? toolOutput.message ?? 'Send test failed',
          durationMs,
        };
      }

      return {
        success: true,
        message: toolOutput.message ?? 'Message sent successfully',
        result: (toolOutput.result as object | undefined) ?? null,
        error: undefined,
        durationMs,
      };
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error ? error.message : 'Send action test failed',
        result: null,
        error:
          error instanceof Error ? error.message : 'Send action test failed',
        durationMs: Date.now() - startedAtMs,
      };
    }
  }

  private assertStepMatchesChannel(
    step: WorkflowAction,
    channel: TestWorkflowSendActionChannel,
  ): void {
    const expectedType =
      channel === TestWorkflowSendActionChannel.EMAIL
        ? WorkflowActionType.SEND_EMAIL
        : channel === TestWorkflowSendActionChannel.WHATSAPP
          ? WorkflowActionType.SEND_WHATSAPP_MESSAGE
          : WorkflowActionType.SEND_LINKEDIN_MESSAGE;

    if (step.type !== expectedType) {
      throw new Error(
        `Step ${step.id} is ${step.type}, expected ${expectedType} for ${channel} test`,
      );
    }
  }

  private applyTestOverrides({
    stepInput,
    body,
    subject,
    connectedAccountId,
  }: {
    stepInput: Record<string, unknown>;
    body: string;
    subject?: string;
    connectedAccountId?: string;
  }): Record<string, unknown> {
    const nextInput = { ...stepInput, body };

    if (isNonEmptyString(subject)) {
      nextInput.subject = subject;
    }

    if (isNonEmptyString(connectedAccountId)) {
      nextInput.connectedAccountId = connectedAccountId;
    }

    return nextInput;
  }

  private async executeChannel({
    workspaceId,
    channel,
    candidateId,
    resolvedInput,
  }: {
    workspaceId: string;
    channel: TestWorkflowSendActionChannel;
    candidateId: string;
    resolvedInput: Record<string, unknown>;
  }) {
    const toolContext = { workspaceId };

    if (channel === TestWorkflowSendActionChannel.EMAIL) {
      const connectedAccountId = await this.resolveConnectedAccountId({
        workspaceId,
        connectedAccountId:
          typeof resolvedInput.connectedAccountId === 'string'
            ? resolvedInput.connectedAccountId
            : '',
      });

      const recipients =
        resolvedInput.recipients && typeof resolvedInput.recipients === 'object'
          ? (resolvedInput.recipients as EmailToolInput['recipients'])
          : { to: '', cc: '', bcc: '' };

      if (!isNonEmptyString(recipients?.to)) {
        throw new Error(
          'Resolved recipient email is empty. Pick a candidate with an email, or check the To field.',
        );
      }

      return this.sendEmailTool.execute(
        {
          ...(resolvedInput as EmailToolInput),
          connectedAccountId,
          recipients,
          body:
            typeof resolvedInput.body === 'string' ? resolvedInput.body : '',
          subject:
            typeof resolvedInput.subject === 'string'
              ? resolvedInput.subject
              : '',
        },
        toolContext,
      );
    }

    const workspaceMemberId =
      typeof resolvedInput.workspaceMemberId === 'string'
        ? resolvedInput.workspaceMemberId
        : '';

    if (
      !isNonEmptyString(workspaceMemberId) ||
      !isValidUuid(workspaceMemberId)
    ) {
      throw new Error(
        'Could not resolve workspace member for Unipile send. Ensure Load workspace member hydrates for this candidate.',
      );
    }

    const unipileAccountId = await this.resolveUnipileAccountId({
      workspaceId,
      workspaceMemberId,
      accountType:
        channel === TestWorkflowSendActionChannel.WHATSAPP
          ? 'whatsapp'
          : 'linkedin',
    });

    if (channel === TestWorkflowSendActionChannel.WHATSAPP) {
      const phone =
        typeof resolvedInput.phone === 'string' ? resolvedInput.phone : '';

      if (!isNonEmptyString(phone)) {
        throw new Error(
          'Resolved recipient phone is empty. Pick a candidate with a phone number.',
        );
      }

      return this.sendWhatsappMessageTool.execute(
        {
          unipileAccountId,
          phone,
          body:
            typeof resolvedInput.body === 'string' ? resolvedInput.body : '',
          candidateId:
            typeof resolvedInput.candidateId === 'string'
              ? resolvedInput.candidateId
              : candidateId,
        },
        toolContext,
      );
    }

    const linkedinProfileId =
      typeof resolvedInput.linkedinProfileId === 'string'
        ? resolvedInput.linkedinProfileId
        : '';
    const linkedinUrl =
      typeof resolvedInput.linkedinUrl === 'string'
        ? resolvedInput.linkedinUrl
        : '';

    if (
      !isNonEmptyString(linkedinProfileId) &&
      !isNonEmptyString(linkedinUrl)
    ) {
      throw new Error(
        'Resolved LinkedIn profile is empty. Pick a candidate with a LinkedIn profile id or URL.',
      );
    }

    return this.sendLinkedinMessageTool.execute(
      {
        unipileAccountId,
        linkedinProfileId,
        linkedinUrl,
        body: typeof resolvedInput.body === 'string' ? resolvedInput.body : '',
        files: Array.isArray(resolvedInput.files) ? resolvedInput.files : [],
        candidateId:
          typeof resolvedInput.candidateId === 'string'
            ? resolvedInput.candidateId
            : candidateId,
      },
      toolContext,
    );
  }

  private async resolveConnectedAccountId({
    workspaceId,
    connectedAccountId,
  }: {
    workspaceId: string;
    connectedAccountId: string;
  }): Promise<string> {
    if (
      isNonEmptyString(connectedAccountId) &&
      isValidUuid(connectedAccountId)
    ) {
      const authContext = getWorkspaceAuthContext();

      if (isUserAuthContext(authContext)) {
        const workspaceMemberRepository =
          await this.globalWorkspaceOrmManager.getRepository<{
            id: string;
            userId: string;
          }>(workspaceId, 'workspaceMember', {
            shouldBypassPermissionChecks: true,
          });
        const workspaceMember = await workspaceMemberRepository.findOne({
          where: { id: connectedAccountId },
        });

        if (isDefined(workspaceMember)) {
          const memberAccountId = await this.findFirstConnectedAccountIdForUser(
            {
              workspaceId,
              userId: workspaceMember.userId,
            },
          );

          if (isNonEmptyString(memberAccountId)) {
            return memberAccountId;
          }
        }
      }

      return connectedAccountId;
    }

    throw new Error(
      'Select a connected email account in Configuration before testing Send Email.',
    );
  }

  private async findFirstConnectedAccountIdForUser({
    workspaceId,
    userId,
  }: {
    workspaceId: string;
    userId: string;
  }): Promise<string | null> {
    const userWorkspace = await this.userWorkspaceRepository.findOne({
      where: { userId, workspaceId },
    });

    if (!isDefined(userWorkspace)) {
      return null;
    }

    const connectedAccount = await this.connectedAccountRepository.findOne({
      where: {
        userWorkspaceId: userWorkspace.id,
        workspaceId,
        archivedAt: IsNull(),
      },
      order: { createdAt: 'ASC' },
    });

    return connectedAccount?.id ?? null;
  }

  private async resolveUnipileAccountId({
    workspaceId,
    workspaceMemberId,
    accountType,
  }: {
    workspaceId: string;
    workspaceMemberId: string;
    accountType: 'whatsapp' | 'linkedin';
  }): Promise<string> {
    const authContext = buildSystemAuthContext(workspaceId);

    return this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        const profileRepository =
          await this.globalWorkspaceOrmManager.getRepository<WorkspaceMemberUnipileFields>(
            workspaceId,
            'workspaceMember',
            { shouldBypassPermissionChecks: true },
          );
        const profile = await profileRepository.findOne({
          where: { id: workspaceMemberId },
        });

        if (!isDefined(profile)) {
          throw new Error(
            `No workspace member found for member '${workspaceMemberId}'`,
          );
        }

        const unipileAccountId =
          accountType === 'linkedin'
            ? profile.linkedinUnipileAccountId
            : profile.whatsappUnipileAccountId;

        if (!isNonEmptyString(unipileAccountId)) {
          throw new Error(
            `No ${accountType} Unipile account configured for workspace member '${workspaceMemberId}'`,
          );
        }

        return unipileAccountId;
      },
      authContext,
    );
  }
}
