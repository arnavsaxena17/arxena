import { Injectable, Logger } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';

import { normalizeWhatsAppOutboundMessage } from 'src/engine/core-modules/arx-chat/utils/whatsapp-message-format.util';
import {
  SendWhatsappMessageToolInputZodSchema,
  type SendWhatsappMessageToolInput,
} from 'src/engine/core-modules/tool/tools/unipile-messaging-tool/types/send-whatsapp-message-tool-input.type';
import {
  buildWhatsappAttendeeIdFromPhone,
  createWhatsappUnipileMessagingServiceForTools,
  getUnipileToolErrorMessage,
} from 'src/engine/core-modules/tool/tools/unipile-messaging-tool/utils/unipile-messaging-tool.util';
import { type ToolExecutionContext } from 'src/engine/core-modules/tool/types/tool-execution-context.type';
import { type ToolInput } from 'src/engine/core-modules/tool/types/tool-input.type';
import { type ToolOutput } from 'src/engine/core-modules/tool/types/tool-output.type';
import { type Tool } from 'src/engine/core-modules/tool/types/tool.type';

@Injectable()
export class SendWhatsappMessageTool implements Tool {
  private readonly logger = new Logger(SendWhatsappMessageTool.name);

  description =
    'Send a WhatsApp message via Unipile. Requires a Unipile WhatsApp account ID and recipient phone number.';
  inputSchema = SendWhatsappMessageToolInputZodSchema;

  async execute(
    parameters: ToolInput,
    _context: ToolExecutionContext,
  ): Promise<ToolOutput> {
    const input = parameters as SendWhatsappMessageToolInput;
    const unipileAccountId = input.unipileAccountId?.trim() ?? '';
    const phone = input.phone?.trim() ?? '';
    const body = normalizeWhatsAppOutboundMessage(input.body ?? '');

    if (!isNonEmptyString(unipileAccountId)) {
      return {
        success: false,
        message: 'Failed to send WhatsApp message',
        error: 'Unipile account ID is required',
      };
    }

    if (!isNonEmptyString(phone)) {
      return {
        success: false,
        message: 'Failed to send WhatsApp message',
        error: 'Phone number is required',
      };
    }

    try {
      const messagingService = createWhatsappUnipileMessagingServiceForTools();
      const attendeeId = buildWhatsappAttendeeIdFromPhone(phone);
      const result = await messagingService.sendMessage(
        unipileAccountId,
        [attendeeId],
        body,
        undefined,
        null,
      );

      this.logger.log(
        `WhatsApp message sent via Unipile account ${unipileAccountId}`,
      );

      return {
        success: true,
        message: 'WhatsApp message sent successfully',
        result: {
          unipileAccountId,
          phone,
          body,
          response: result,
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to send WhatsApp message: ${getUnipileToolErrorMessage(error)}`,
      );

      return {
        success: false,
        message: 'Failed to send WhatsApp message',
        error: getUnipileToolErrorMessage(error),
      };
    }
  }
}
