import { Injectable, Logger } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';
import { FeatureFlagKey } from 'twenty-shared/types';

import { LinkedinUnipileRequestService } from 'src/engine/core-modules/arx-chat/services/linkedin-unipile-request.service';
import { FeatureFlagService } from 'src/engine/core-modules/feature-flag/services/feature-flag.service';
import { LinkedinProviderIdStoreService } from 'src/engine/core-modules/outreach-command/services/linkedin-provider-id.store';
import { extractLinkedinProfileId } from 'src/engine/core-modules/outreach-command/utils/extract-linkedin-profile-id.util';
import {
  FollowLinkedinProfileToolInputZodSchema,
  type FollowLinkedinProfileToolInput,
} from 'src/engine/core-modules/tool/tools/unipile-messaging-tool/types/follow-linkedin-profile-tool-input.type';
import { OUTREACH_MOCK_UNIPILE_PROFILE_FOLLOW_RESPONSE_ID } from 'src/engine/core-modules/tool/tools/unipile-messaging-tool/utils/is-outreach-mock-unipile-enabled.util';
import {
  createLinkedinUnipileMessagingServiceForTools,
  getUnipileToolErrorMessage,
} from 'src/engine/core-modules/tool/tools/unipile-messaging-tool/utils/unipile-messaging-tool.util';
import { type ToolExecutionContext } from 'src/engine/core-modules/tool/types/tool-execution-context.type';
import { type ToolInput } from 'src/engine/core-modules/tool/types/tool-input.type';
import { type ToolOutput } from 'src/engine/core-modules/tool/types/tool-output.type';
import { type Tool } from 'src/engine/core-modules/tool/types/tool.type';

@Injectable()
export class FollowLinkedinProfileTool implements Tool {
  private readonly logger = new Logger(FollowLinkedinProfileTool.name);

  constructor(
    private readonly linkedinUnipileRequestService: LinkedinUnipileRequestService,
    private readonly linkedinProviderIdStore: LinkedinProviderIdStoreService,
    private readonly featureFlagService: FeatureFlagService,
  ) {}

  description =
    'Follow a LinkedIn profile via Unipile magic route (followingStates). Requires provider_id (ACo…); resolves from slug/URL when needed.';
  inputSchema = FollowLinkedinProfileToolInputZodSchema;

  async execute(
    parameters: ToolInput,
    context: ToolExecutionContext,
  ): Promise<ToolOutput> {
    const input = parameters as FollowLinkedinProfileToolInput;
    const unipileAccountId = input.unipileAccountId?.trim() ?? '';
    const linkedinProfileId =
      extractLinkedinProfileId(input.linkedinProfileId) ||
      extractLinkedinProfileId(input.linkedinUrl);

    if (!isNonEmptyString(unipileAccountId)) {
      return {
        success: false,
        message: 'Failed to follow LinkedIn profile',
        error: 'Unipile account ID is required',
      };
    }

    if (!isNonEmptyString(linkedinProfileId)) {
      return {
        success: false,
        message: 'Failed to follow LinkedIn profile',
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
          `IS_OUTREACH_MOCK_UNIPILE_ENABLED: skipping Unipile follow for ${linkedinProfileId}`,
        );

        return {
          success: true,
          message: 'LinkedIn profile followed successfully',
          result: {
            mock: true,
            unipileAccountId,
            linkedinProfileId,
            response: {
              object: 'LinkedinRawData',
              id: OUTREACH_MOCK_UNIPILE_PROFILE_FOLLOW_RESPONSE_ID,
            },
          },
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

      const response =
        await this.linkedinUnipileRequestService.followLinkedinProfile(
          unipileAccountId,
          providerId,
        );

      this.logger.log(
        `Followed LinkedIn profile ${providerId} via account ${unipileAccountId}`,
      );

      return {
        success: true,
        message: 'LinkedIn profile followed successfully',
        result: {
          unipileAccountId,
          linkedinProfileId: providerId,
          response,
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to follow LinkedIn profile: ${getUnipileToolErrorMessage(error)}`,
      );

      return {
        success: false,
        message: 'Failed to follow LinkedIn profile',
        error: getUnipileToolErrorMessage(error),
      };
    }
  }
}
