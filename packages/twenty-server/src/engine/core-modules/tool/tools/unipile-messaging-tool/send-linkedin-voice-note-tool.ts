import { Injectable, Logger } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';
import { FeatureFlagKey } from 'twenty-shared/types';

import { isAccountRateLimitDeferredError } from 'src/engine/core-modules/account-rate-limit/account-rate-limit-deferred.error';
import { FeatureFlagService } from 'src/engine/core-modules/feature-flag/services/feature-flag.service';
import { FileService } from 'src/engine/core-modules/file/services/file.service';
import { LinkedinProviderIdStoreService } from 'src/engine/core-modules/outreach-command/services/linkedin-provider-id.store';
import { extractLinkedinProfileId } from 'src/engine/core-modules/outreach-command/utils/extract-linkedin-profile-id.util';
import {
  SendLinkedinVoiceNoteToolInputZodSchema,
  type SendLinkedinVoiceNoteToolInput,
} from 'src/engine/core-modules/tool/tools/unipile-messaging-tool/types/send-linkedin-voice-note-tool-input.type';
import { OUTREACH_MOCK_UNIPILE_VOICE_NOTE_RESPONSE_ID } from 'src/engine/core-modules/tool/tools/unipile-messaging-tool/utils/is-outreach-mock-unipile-enabled.util';
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
export class SendLinkedinVoiceNoteTool implements Tool {
  private readonly logger = new Logger(SendLinkedinVoiceNoteTool.name);

  constructor(
    private readonly fileService: FileService,
    private readonly linkedinProviderIdStore: LinkedinProviderIdStoreService,
    private readonly featureFlagService: FeatureFlagService,
  ) {}

  description =
    'Send a LinkedIn voice note via Unipile. Requires exactly one audio file (.m4a preferred) and a Unipile LinkedIn account.';
  inputSchema = SendLinkedinVoiceNoteToolInputZodSchema;

  async execute(
    parameters: ToolInput,
    context: ToolExecutionContext,
  ): Promise<ToolOutput> {
    const input = parameters as SendLinkedinVoiceNoteToolInput;
    const unipileAccountId = input.unipileAccountId?.trim() ?? '';
    const linkedinProfileId =
      extractLinkedinProfileId(input.linkedinProfileId) ||
      extractLinkedinProfileId(input.linkedinUrl);
    const body = input.body ?? '';

    if (!isNonEmptyString(unipileAccountId)) {
      return {
        success: false,
        message: 'Failed to send LinkedIn voice note',
        error: 'Unipile account ID is required',
      };
    }

    if (!isNonEmptyString(linkedinProfileId)) {
      return {
        success: false,
        message: 'Failed to send LinkedIn voice note',
        error: 'LinkedIn profile ID is required',
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
          `IS_OUTREACH_MOCK_UNIPILE_ENABLED: skipping Unipile voice note for ${linkedinProfileId}`,
        );

        return {
          success: true,
          message: 'LinkedIn voice note sent successfully',
          result: {
            mock: true,
            unipileAccountId,
            linkedinProfileId,
            body,
            response: { id: OUTREACH_MOCK_UNIPILE_VOICE_NOTE_RESPONSE_ID },
          },
        };
      }

      const attachments = await loadUnipileChatAttachments({
        files: input.files,
        workspaceId: context.workspaceId,
        fileService: this.fileService,
      });
      const voiceAttachment = attachments[0];

      if (!voiceAttachment) {
        return {
          success: false,
          message: 'Failed to send LinkedIn voice note',
          error: 'Exactly one audio file is required for a voice note',
        };
      }

      const messagingService = createLinkedinUnipileMessagingServiceForTools();
      const providerId = await this.linkedinProviderIdStore.resolveForSend({
        workspaceId: context.workspaceId,
        candidateId: input.candidateId,
        identifier: linkedinProfileId,
        fetchProviderId: () =>
          messagingService.resolveProviderId(
            unipileAccountId,
            linkedinProfileId,
          ),
      });
      const result = await messagingService.sendMessage(
        unipileAccountId,
        [providerId],
        body,
        [],
        voiceAttachment,
      );

      this.logger.log(
        `LinkedIn voice note sent via Unipile account ${unipileAccountId}`,
      );

      return {
        success: true,
        message: 'LinkedIn voice note sent successfully',
        result: {
          unipileAccountId,
          linkedinProfileId: providerId,
          body,
          response: result,
        },
      };
    } catch (error) {
      if (isAccountRateLimitDeferredError(error)) {
        throw error;
      }
      this.logger.error(
        `Failed to send LinkedIn voice note: ${getUnipileToolErrorMessage(error)}`,
      );

      return {
        success: false,
        message: 'Failed to send LinkedIn voice note',
        error: getUnipileToolErrorMessage(error),
      };
    }
  }
}
