import { Injectable, Logger } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';
import { PermissionFlagType } from 'twenty-shared/constants';
import {
  type AgentToolConfigs,
  type SendFilesChannel,
  type SendFilesToolConfig,
} from 'twenty-shared/ai';
import { isDefined } from 'twenty-shared/utils';

import { FeatureFlagService } from 'src/engine/core-modules/feature-flag/services/feature-flag.service';
import { FileService } from 'src/engine/core-modules/file/services/file.service';
import { OutreachSenderProfileService } from 'src/engine/core-modules/outreach-command/services/outreach-sender-profile.service';
import { normalizeOutreachSenderProfile } from 'src/engine/core-modules/outreach-command/utils/outreach-sender-profile.util';
import { SendEmailTool } from 'src/engine/core-modules/tool/tools/email-tool/send-email-tool';
import {
  SendFilesToolInputZodSchema,
  type SendFilesToolInput,
} from 'src/engine/core-modules/tool/tools/send-files-tool/send-files-tool.schema';
import { SendLinkedinMessageTool } from 'src/engine/core-modules/tool/tools/unipile-messaging-tool/send-linkedin-message-tool';
import { loadUnipileChatAttachments } from 'src/engine/core-modules/tool/tools/unipile-messaging-tool/utils/load-unipile-chat-attachments.util';
import {
  buildWhatsappAttendeeIdFromPhone,
  createWhatsappUnipileMessagingServiceForTools,
  getUnipileToolErrorMessage,
} from 'src/engine/core-modules/tool/tools/unipile-messaging-tool/utils/unipile-messaging-tool.util';
import { type ToolExecutionContext } from 'src/engine/core-modules/tool/types/tool-execution-context.type';
import { type ToolInput } from 'src/engine/core-modules/tool/types/tool-input.type';
import { type ToolOutput } from 'src/engine/core-modules/tool/types/tool-output.type';
import { type Tool } from 'src/engine/core-modules/tool/types/tool.type';
import { FeatureFlagKey } from 'twenty-shared/types';

const parseSendFilesConfig = (
  toolConfigs: AgentToolConfigs | null | undefined,
): SendFilesToolConfig => {
  const config = toolConfigs?.send_files;

  if (!isDefined(config) || typeof config !== 'object') {
    return { fileSource: 'configured_files', fileIds: [] };
  }

  return {
    fileSource:
      config.fileSource === 'sender_collateral'
        ? 'sender_collateral'
        : 'configured_files',
    fileIds: Array.isArray(config.fileIds)
      ? config.fileIds.filter(isNonEmptyString)
      : [],
    files: Array.isArray(config.files)
      ? config.files.filter(
          (file): file is { id: string; name: string; type?: string } =>
            typeof file === 'object' &&
            file !== null &&
            isNonEmptyString((file as { id?: string }).id),
        )
      : undefined,
    workspaceMemberId: isNonEmptyString(config.workspaceMemberId)
      ? config.workspaceMemberId
      : undefined,
    allowedChannels: Array.isArray(config.allowedChannels)
      ? config.allowedChannels.filter(
          (channel): channel is SendFilesChannel =>
            channel === 'linkedin' ||
            channel === 'email' ||
            channel === 'whatsapp',
        )
      : undefined,
  };
};

@Injectable()
export class SendFilesTool implements Tool {
  private readonly logger = new Logger(SendFilesTool.name);

  description =
    'Send configured uploaded file(s) (e.g. a presentation) to a prospect via LinkedIn, email, or WhatsApp. File bytes come from agent tool config or sender collateral — do not pass file ids. Requires SEND_FILES_TOOL permission.';
  inputSchema = SendFilesToolInputZodSchema;
  flag = PermissionFlagType.SEND_FILES_TOOL;

  constructor(
    private readonly fileService: FileService,
    private readonly sendLinkedinMessageTool: SendLinkedinMessageTool,
    private readonly sendEmailTool: SendEmailTool,
    private readonly outreachSenderProfileService: OutreachSenderProfileService,
    private readonly featureFlagService: FeatureFlagService,
  ) {}

  async execute(
    parameters: ToolInput,
    context: ToolExecutionContext,
  ): Promise<ToolOutput> {
    const input = parameters as SendFilesToolInput;
    const config = parseSendFilesConfig(context.toolConfigs);

    if (
      isDefined(config.allowedChannels) &&
      config.allowedChannels.length > 0 &&
      !config.allowedChannels.includes(input.channel)
    ) {
      return {
        success: false,
        message: 'Failed to send files',
        error: `Channel "${input.channel}" is not allowed for this agent`,
      };
    }

    const fileIds = await this.resolveFileIds(config, input, context);

    if (fileIds.length === 0) {
      return {
        success: false,
        message: 'Failed to send files',
        error:
          'No files configured. Upload collateral in Outreach setup or set configured file ids on the agent.',
      };
    }

    const files = fileIds;

    const text = input.text?.trim() ?? '';

    if (input.channel === 'linkedin') {
      return this.sendLinkedinMessageTool.execute(
        {
          unipileAccountId: input.unipileAccountId,
          linkedinProfileId: input.linkedinProfileId,
          linkedinUrl: input.linkedinUrl,
          candidateId: input.candidateId,
          body: text,
          files,
        },
        context,
      );
    }

    if (input.channel === 'email') {
      if (!isNonEmptyString(input.to?.trim())) {
        return {
          success: false,
          message: 'Failed to send files',
          error: 'Recipient email (to) is required for email channel',
        };
      }

      return this.sendEmailTool.execute(
        {
          recipients: { to: input.to.trim(), cc: '', bcc: '' },
          subject: input.subject?.trim() || 'Shared file',
          body: text || '<p>Please find the attached file.</p>',
          connectedAccountId: input.connectedAccountId,
          files,
        },
        context,
      );
    }

    return this.sendWhatsapp({
      input,
      files,
      text,
      workspaceId: context.workspaceId,
    });
  }

  private async resolveFileIds(
    config: SendFilesToolConfig,
    input: SendFilesToolInput,
    context: ToolExecutionContext,
  ): Promise<Array<{ id: string; name: string }>> {
    if (config.fileSource === 'configured_files') {
      if (Array.isArray(config.files) && config.files.length > 0) {
        return config.files
          .filter((file) => isNonEmptyString(file.id))
          .map((file) => ({
            id: file.id,
            name: file.name || file.id,
          }));
      }

      return (config.fileIds ?? []).map((fileId) => ({
        id: fileId,
        name: fileId,
      }));
    }

    const workspaceMemberId =
      input.workspaceMemberId?.trim() ||
      config.workspaceMemberId?.trim() ||
      undefined;

    if (isNonEmptyString(workspaceMemberId)) {
      const existing =
        await this.outreachSenderProfileService.getExistingSenderProfile({
          workspaceId: context.workspaceId,
          workspaceMemberId,
        });

      const profile = isDefined(existing.outreachSenderProfile)
        ? normalizeOutreachSenderProfile(existing.outreachSenderProfile)
        : null;

      return (profile?.collateralFiles ?? [])
        .filter((file) => isNonEmptyString(file.fileId))
        .map((file) => ({
          id: file.fileId,
          name: file.fileName || file.fileId,
        }));
    }

    // Fall back to operator/bootstrap seat when the agent does not pin a member.
    const profile =
      await this.outreachSenderProfileService.resolveOperatorSenderProfile({
        workspaceId: context.workspaceId,
        workspaceMemberId: null,
      });

    return (profile?.collateralFiles ?? [])
      .filter((file) => isNonEmptyString(file.fileId))
      .map((file) => ({
        id: file.fileId,
        name: file.fileName || file.fileId,
      }));
  }

  private async sendWhatsapp({
    input,
    files,
    text,
    workspaceId,
  }: {
    input: SendFilesToolInput;
    files: Array<{ id: string; name: string }>;
    text: string;
    workspaceId: string;
  }): Promise<ToolOutput> {
    const unipileAccountId =
      input.whatsappUnipileAccountId?.trim() || input.unipileAccountId?.trim();
    const phone = input.phone?.trim() ?? '';

    if (!isNonEmptyString(unipileAccountId)) {
      return {
        success: false,
        message: 'Failed to send files',
        error: 'Unipile WhatsApp account ID is required',
      };
    }

    if (!isNonEmptyString(phone)) {
      return {
        success: false,
        message: 'Failed to send files',
        error: 'Phone number is required for whatsapp channel',
      };
    }

    const isMockUnipileEnabled =
      await this.featureFlagService.isFeatureEnabled(
        FeatureFlagKey.IS_OUTREACH_MOCK_UNIPILE_ENABLED,
        workspaceId,
      );

    if (isMockUnipileEnabled) {
      this.logger.log(
        `IS_OUTREACH_MOCK_UNIPILE_ENABLED: skipping WhatsApp file send to ${phone}`,
      );

      return {
        success: true,
        message: 'Mock WhatsApp file send (IS_OUTREACH_MOCK_UNIPILE_ENABLED)',
        result: { phone, attachmentCount: files.length, mock: true },
      };
    }

    try {
      const attachments = await loadUnipileChatAttachments({
        files,
        workspaceId,
        fileService: this.fileService,
      });
      const messagingService = createWhatsappUnipileMessagingServiceForTools();
      const attendeeId = buildWhatsappAttendeeIdFromPhone(phone);

      // Unipile WhatsApp accepts multipart attachment buffers (same shape as LinkedIn)
      const result = await messagingService.sendMessage(
        unipileAccountId,
        [attendeeId],
        text || 'Please find the attached file.',
        attachments.map((attachment) => ({
          filename: attachment.filename,
          contentType: attachment.contentType,
          fileBuffer: attachment.fileBuffer,
        })),
      );

      return {
        success: true,
        message: 'WhatsApp file(s) sent successfully',
        result: {
          unipileAccountId,
          phone,
          attachmentCount: attachments.length,
          response: result,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to send files',
        error: getUnipileToolErrorMessage(error, 'WhatsApp send failed'),
      };
    }
  }
}
