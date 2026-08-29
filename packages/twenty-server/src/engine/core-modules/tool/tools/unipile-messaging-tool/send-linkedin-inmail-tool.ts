import { Injectable, Logger } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';

import { isAccountRateLimitDeferredError } from 'src/engine/core-modules/account-rate-limit/account-rate-limit-deferred.error';
import { LinkedinProviderIdStoreService } from 'src/engine/core-modules/outreach-command/services/linkedin-provider-id.store';
import {
  SendLinkedinInmailToolInputZodSchema,
  type SendLinkedinInmailToolInput,
} from 'src/engine/core-modules/tool/tools/unipile-messaging-tool/types/send-linkedin-inmail-tool-input.type';
import { extractLinkedinProfileId } from 'src/engine/core-modules/outreach-command/utils/extract-linkedin-profile-id.util';
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

  constructor(
    private readonly linkedinProviderIdStore: LinkedinProviderIdStoreService,
  ) {}

  description =
    'Send a LinkedIn InMail via Unipile. Requires a Unipile LinkedIn account ID and recipient profile.';
  inputSchema = SendLinkedinInmailToolInputZodSchema;

  async execute(
    parameters: ToolInput,
    context: ToolExecutionContext,
  ): Promise<ToolOutput> {
    const input = parameters as SendLinkedinInmailToolInput;
    const unipileAccountId = input.unipileAccountId?.trim() ?? '';
    const linkedinProfileId =
      extractLinkedinProfileId(input.linkedinProfileId) ||
      extractLinkedinProfileId(input.linkedinUrl);
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
      const providerId = await this.linkedinProviderIdStore.resolveForSend({
        workspaceId: context.workspaceId,
        candidateId: input.candidateId,
        identifier: linkedinProfileId,
        fetchProviderId: () =>
          messagingService.resolveProviderId(unipileAccountId, linkedinProfileId),
      });
      const result = await messagingService.sendMessage(
        unipileAccountId,
        [providerId],
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
          linkedinProfileId: providerId,
          subject,
          body,
          response: result,
        },
      };
    } catch (error) {
      if (isAccountRateLimitDeferredError(error)) {
        throw error;
      }
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
