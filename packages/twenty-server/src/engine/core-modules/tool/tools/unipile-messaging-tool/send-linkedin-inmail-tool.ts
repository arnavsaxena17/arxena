import { Injectable, Logger } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';

import {
  SendLinkedinInmailToolInputZodSchema,
  type SendLinkedinInmailToolInput,
} from 'src/engine/core-modules/tool/tools/unipile-messaging-tool/types/send-linkedin-inmail-tool-input.type';
import {
  createLinkedinUnipileMessagingServiceForTools,
  getUnipileToolErrorMessage,
} from 'src/engine/core-modules/tool/tools/unipile-messaging-tool/utils/unipile-messaging-tool.util';
import { type ToolExecutionContext } from 'src/engine/core-modules/tool/types/tool-execution-context.type';
import { type ToolInput } from 'src/engine/core-modules/tool/types/tool-input.type';
import { type ToolOutput } from 'src/engine/core-modules/tool/types/tool-output.type';
import { type Tool } from 'src/engine/core-modules/tool/types/tool.type';

@Injectable()
export class SendLinkedinInmailTool implements Tool {
  private readonly logger = new Logger(SendLinkedinInmailTool.name);

  description =
    'Send a LinkedIn InMail via Unipile. Requires a Unipile LinkedIn account ID and recipient profile.';
  inputSchema = SendLinkedinInmailToolInputZodSchema;

  async execute(
    parameters: ToolInput,
    _context: ToolExecutionContext,
  ): Promise<ToolOutput> {
    const input = parameters as SendLinkedinInmailToolInput;
    const unipileAccountId = input.unipileAccountId?.trim() ?? '';
    const linkedinProfileId = input.linkedinProfileId?.trim() ?? '';
    const subject = input.subject ?? '';
    const body = input.body ?? '';

    if (!isNonEmptyString(unipileAccountId)) {
      return {
        success: false,
        message: 'Failed to send LinkedIn InMail',
        error: 'Unipile account ID is required',
      };
    }

    if (!isNonEmptyString(linkedinProfileId)) {
      return {
        success: false,
        message: 'Failed to send LinkedIn InMail',
        error: 'LinkedIn profile ID is required',
      };
    }

    try {
      const messagingService = createLinkedinUnipileMessagingServiceForTools();
      const result = await messagingService.sendMessage(
        unipileAccountId,
        [linkedinProfileId],
        body,
        undefined,
        undefined,
        undefined,
        subject,
        true,
      );

      this.logger.log(
        `LinkedIn InMail sent via Unipile account ${unipileAccountId}`,
      );

      return {
        success: true,
        message: 'LinkedIn InMail sent successfully',
        result: {
          unipileAccountId,
          linkedinProfileId,
          subject,
          body,
          response: result,
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to send LinkedIn InMail: ${getUnipileToolErrorMessage(error)}`,
      );

      return {
        success: false,
        message: 'Failed to send LinkedIn InMail',
        error: getUnipileToolErrorMessage(error),
      };
    }
  }
}
