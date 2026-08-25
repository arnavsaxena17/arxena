import { Injectable, Logger } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';

import { isAccountRateLimitDeferredError } from 'src/engine/core-modules/account-rate-limit/account-rate-limit-deferred.error';
import {
  SendLinkedinConnectionRequestToolInputZodSchema,
  type SendLinkedinConnectionRequestToolInput,
} from 'src/engine/core-modules/tool/tools/unipile-messaging-tool/types/send-linkedin-connection-request-tool-input.type';
import { extractLinkedinProfileId } from 'src/engine/core-modules/gtm-command/utils/extract-linkedin-profile-id.util';
import {
  createLinkedinUnipileMessagingServiceForTools,
  getUnipileToolErrorMessage,
  truncateLinkedinConnectionRequestMessage,
} from 'src/engine/core-modules/tool/tools/unipile-messaging-tool/utils/unipile-messaging-tool.util';
import { type ToolExecutionContext } from 'src/engine/core-modules/tool/types/tool-execution-context.type';
import { type ToolInput } from 'src/engine/core-modules/tool/types/tool-input.type';
import { type ToolOutput } from 'src/engine/core-modules/tool/types/tool-output.type';
import { type Tool } from 'src/engine/core-modules/tool/types/tool.type';

@Injectable()
export class SendLinkedinConnectionRequestTool implements Tool {
  private readonly logger = new Logger(SendLinkedinConnectionRequestTool.name);

  description =
    'Send a LinkedIn connection request via Unipile. Requires a Unipile LinkedIn account ID and recipient profile.';
  inputSchema = SendLinkedinConnectionRequestToolInputZodSchema;

  async execute(
    parameters: ToolInput,
    _context: ToolExecutionContext,
  ): Promise<ToolOutput> {
    const input = parameters as SendLinkedinConnectionRequestToolInput;
    const unipileAccountId = input.unipileAccountId?.trim() ?? '';
    const linkedinProfileId =
      extractLinkedinProfileId(input.linkedinProfileId) ||
      extractLinkedinProfileId(input.linkedinUrl);
    const message = truncateLinkedinConnectionRequestMessage(
      input.message ?? '',
    );

    if (!isNonEmptyString(unipileAccountId)) {
      return {
        success: false,
        message: 'Failed to send LinkedIn connection request',
        error: 'Unipile account ID is required',
      };
    }

    if (!isNonEmptyString(linkedinProfileId)) {
      return {
        success: false,
        message: 'Failed to send LinkedIn connection request',
        error: 'LinkedIn profile ID is required',
      };
    }

    try {
      const messagingService = createLinkedinUnipileMessagingServiceForTools();
      const result = await messagingService.sendInvitation(
        unipileAccountId,
        linkedinProfileId,
        message,
      );

      this.logger.log(
        `LinkedIn connection request sent via Unipile account ${unipileAccountId}`,
      );

      return {
        success: true,
        message: 'LinkedIn connection request sent successfully',
        result: {
          unipileAccountId,
          linkedinProfileId,
          message,
          response: result,
        },
      };
    } catch (error) {
      if (isAccountRateLimitDeferredError(error)) {
        throw error;
      }
      this.logger.error(
        `Failed to send LinkedIn connection request: ${getUnipileToolErrorMessage(error)}`,
      );

      return {
        success: false,
        message: 'Failed to send LinkedIn connection request',
        error: getUnipileToolErrorMessage(error),
      };
    }
  }
}
