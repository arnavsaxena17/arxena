import { Injectable, Logger } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';

import { isAccountRateLimitDeferredError } from 'src/engine/core-modules/account-rate-limit/account-rate-limit-deferred.error';
import { FileService } from 'src/engine/core-modules/file/services/file.service';
import {
  SendLinkedinMessageToolInputZodSchema,
  type SendLinkedinMessageToolInput,
} from 'src/engine/core-modules/tool/tools/unipile-messaging-tool/types/send-linkedin-message-tool-input.type';
import { extractLinkedinProfileId } from 'src/engine/core-modules/gtm-command/utils/extract-linkedin-profile-id.util';
import { loadUnipileChatAttachments } from 'src/engine/core-modules/tool/tools/unipile-messaging-tool/utils/load-unipile-chat-attachments.util';
import {
  createLinkedinUnipileMessagingServiceForTools,
  getUnipileToolErrorMessage,
} from 'src/engine/core-modules/tool/tools/unipile-messaging-tool/utils/unipile-messaging-tool.util';
import { type ToolExecutionContext } from 'src/engine/core-modules/tool/types/tool-execution-context.type';
import { type ToolInput } from 'src/engine/core-modules/tool/types/tool-input.type';
import { type ToolOutput } from 'src/engine/core-modules/tool/types/tool-output.type';
import { type Tool } from 'src/engine/core-modules/tool/types/tool.type';

@Injectable()
export class SendLinkedinMessageTool implements Tool {
  private readonly logger = new Logger(SendLinkedinMessageTool.name);

  constructor(private readonly fileService: FileService) {}

  description =
    'Send a LinkedIn direct message via Unipile. Requires a Unipile LinkedIn account ID and recipient profile. Supports PDF, image, or video attachments up to 15MB.';
  inputSchema = SendLinkedinMessageToolInputZodSchema;

  async execute(
    parameters: ToolInput,
    context: ToolExecutionContext,
  ): Promise<ToolOutput> {
    const input = parameters as SendLinkedinMessageToolInput;
    const unipileAccountId = input.unipileAccountId?.trim() ?? '';
    const linkedinProfileId =
      extractLinkedinProfileId(input.linkedinProfileId) ||
      extractLinkedinProfileId(input.linkedinUrl);
    const body = input.body ?? '';

    if (!isNonEmptyString(unipileAccountId)) {
      return {
        success: false,
        message: 'Failed to send LinkedIn message',
        error: 'Unipile account ID is required',
      };
    }

    if (!isNonEmptyString(linkedinProfileId)) {
      return {
        success: false,
        message: 'Failed to send LinkedIn message',
        error: 'LinkedIn profile ID is required',
      };
    }

    try {
      const attachments = await loadUnipileChatAttachments({
        files: input.files,
        workspaceId: context.workspaceId,
        fileService: this.fileService,
      });
      const messagingService = createLinkedinUnipileMessagingServiceForTools();
      const result = await messagingService.sendMessage(
        unipileAccountId,
        [linkedinProfileId],
        body,
        attachments,
      );

      this.logger.log(
        `LinkedIn message sent via Unipile account ${unipileAccountId}`,
      );

      return {
        success: true,
        message: 'LinkedIn message sent successfully',
        result: {
          unipileAccountId,
          linkedinProfileId,
          body,
          attachmentCount: attachments.length,
          response: result,
        },
      };
    } catch (error) {
      if (isAccountRateLimitDeferredError(error)) {
        throw error;
      }
      this.logger.error(
        `Failed to send LinkedIn message: ${getUnipileToolErrorMessage(error)}`,
      );

      return {
        success: false,
        message: 'Failed to send LinkedIn message',
        error: getUnipileToolErrorMessage(error),
      };
    }
  }
}
