import { Injectable, Logger } from '@nestjs/common';

import { FeatureFlagKey } from 'twenty-shared/types';

import { FeatureFlagService } from 'src/engine/core-modules/feature-flag/services/feature-flag.service';
import { buildOutreachMockUnipileMessageResponseId } from 'src/engine/core-modules/tool/tools/unipile-messaging-tool/utils/is-outreach-mock-unipile-enabled.util';

import { isNonEmptyString } from '@sniptt/guards';

import { isAccountRateLimitDeferredError } from 'src/engine/core-modules/account-rate-limit/account-rate-limit-deferred.error';
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

  constructor(private readonly featureFlagService: FeatureFlagService) {}

  async execute(
    parameters: ToolInput,
    context: ToolExecutionContext,
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
      const isMockUnipileEnabled =
        await this.featureFlagService.isFeatureEnabled(
          FeatureFlagKey.IS_OUTREACH_MOCK_UNIPILE_ENABLED,
          context.workspaceId,
        );

      if (isMockUnipileEnabled) {
        this.logger.log(
          `IS_OUTREACH_MOCK_UNIPILE_ENABLED: skipping Unipile WhatsApp send to ${phone}`,
        );

        return {
          success: true,
          message: 'WhatsApp message sent successfully',
          result: {
            mock: true,
            unipileAccountId,
            phone,
            body,
            response: { id: buildOutreachMockUnipileMessageResponseId() },
          },
        };
      }

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
      if (isAccountRateLimitDeferredError(error)) {
        throw error;
      }
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
