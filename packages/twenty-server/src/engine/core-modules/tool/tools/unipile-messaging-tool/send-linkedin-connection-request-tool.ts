import { Injectable, Logger } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';

import { isAccountRateLimitDeferredError } from 'src/engine/core-modules/account-rate-limit/account-rate-limit-deferred.error';
import { LinkedinProviderIdStoreService } from 'src/engine/core-modules/gtm-command/services/linkedin-provider-id.store';
import {
  SendLinkedinConnectionRequestToolInputZodSchema,
  type SendLinkedinConnectionRequestToolInput,
} from 'src/engine/core-modules/tool/tools/unipile-messaging-tool/types/send-linkedin-connection-request-tool-input.type';
import { extractLinkedinProfileId } from 'src/engine/core-modules/gtm-command/utils/extract-linkedin-profile-id.util';
import { candidateStageImpliesConnectionRequestSent } from 'src/engine/core-modules/gtm-command/utils/gtm-command-materialize.util';
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

  constructor(
    private readonly linkedinProviderIdStore: LinkedinProviderIdStoreService,
  ) {}

  description =
    'Send a LinkedIn connection request via Unipile. Requires a Unipile LinkedIn account ID and recipient profile.';
  inputSchema = SendLinkedinConnectionRequestToolInputZodSchema;

  async execute(
    parameters: ToolInput,
    context: ToolExecutionContext,
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
      const alreadySentError = await this.getAlreadySentError({
        workspaceId: context.workspaceId,
        candidateId: input.candidateId,
        linkedinProfileId,
      });

      if (isNonEmptyString(alreadySentError)) {
        return {
          success: false,
          message: 'Failed to send LinkedIn connection request',
          error: alreadySentError,
        };
      }

      const messagingService = createLinkedinUnipileMessagingServiceForTools();
      const providerId = await this.linkedinProviderIdStore.resolveForSend({
        workspaceId: context.workspaceId,
        candidateId: input.candidateId,
        identifier: linkedinProfileId,
        fetchProviderId: () =>
          messagingService.resolveProviderId(unipileAccountId, linkedinProfileId),
      });
      const result = await messagingService.sendInvitation(
        unipileAccountId,
        linkedinProfileId,
        message,
        providerId,
      );

      this.logger.log(
        `LinkedIn connection request sent via Unipile account ${unipileAccountId}`,
      );

      return {
        success: true,
        message: 'LinkedIn connection request sent successfully',
        result: {
          unipileAccountId,
          linkedinProfileId: providerId,
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

  private async getAlreadySentError({
    workspaceId,
    candidateId,
    linkedinProfileId,
  }: {
    workspaceId: string;
    candidateId?: string;
    linkedinProfileId: string;
  }): Promise<string | undefined> {
    try {
      const candidate = await this.linkedinProviderIdStore.findCandidate({
        workspaceId,
        candidateId,
        identifier: linkedinProfileId,
      });

      if (
        !candidateStageImpliesConnectionRequestSent(
          candidate?.outreachSequenceStage,
        )
      ) {
        return undefined;
      }

      const error =
        'A connection request has already been sent to this recipient.';

      this.logger.warn(
        `Skipping LinkedIn connection request for candidate ${candidate?.id}: ${error}`,
      );

      return error;
    } catch (error) {
      this.logger.warn(
        `Could not check prior LinkedIn connection request: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      return undefined;
    }
  }
}
