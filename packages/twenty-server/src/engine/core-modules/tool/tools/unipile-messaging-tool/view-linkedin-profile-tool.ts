import { Injectable, Logger } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';
import { FeatureFlagKey } from 'twenty-shared/types';

import { LinkedinUnipileRequestService } from 'src/engine/core-modules/arx-chat/services/linkedin-unipile-request.service';
import { FeatureFlagService } from 'src/engine/core-modules/feature-flag/services/feature-flag.service';
import { extractLinkedinProfileId } from 'src/engine/core-modules/outreach-command/utils/extract-linkedin-profile-id.util';
import {
  ViewLinkedinProfileToolInputZodSchema,
  type ViewLinkedinProfileToolInput,
} from 'src/engine/core-modules/tool/tools/unipile-messaging-tool/types/view-linkedin-profile-tool-input.type';
import { OUTREACH_MOCK_UNIPILE_PROFILE_VIEW_RESPONSE_ID } from 'src/engine/core-modules/tool/tools/unipile-messaging-tool/utils/is-outreach-mock-unipile-enabled.util';
import { getUnipileToolErrorMessage } from 'src/engine/core-modules/tool/tools/unipile-messaging-tool/utils/unipile-messaging-tool.util';
import { type ToolExecutionContext } from 'src/engine/core-modules/tool/types/tool-execution-context.type';
import { type ToolInput } from 'src/engine/core-modules/tool/types/tool-input.type';
import { type ToolOutput } from 'src/engine/core-modules/tool/types/tool-output.type';
import { type Tool } from 'src/engine/core-modules/tool/types/tool.type';

@Injectable()
export class ViewLinkedinProfileTool implements Tool {
  private readonly logger = new Logger(ViewLinkedinProfileTool.name);

  constructor(
    private readonly linkedinUnipileRequestService: LinkedinUnipileRequestService,
    private readonly featureFlagService: FeatureFlagService,
  ) {}

  description =
    'Visit a LinkedIn profile via Unipile with notify=true so the viewee is notified. Lightweight — empty profile sections.';
  inputSchema = ViewLinkedinProfileToolInputZodSchema;

  async execute(
    parameters: ToolInput,
    context: ToolExecutionContext,
  ): Promise<ToolOutput> {
    const input = parameters as ViewLinkedinProfileToolInput;
    const unipileAccountId = input.unipileAccountId?.trim() ?? '';
    const linkedinProfileId =
      extractLinkedinProfileId(input.linkedinProfileId) ||
      extractLinkedinProfileId(input.linkedinUrl);

    if (!isNonEmptyString(unipileAccountId)) {
      return {
        success: false,
        message: 'Failed to view LinkedIn profile',
        error: 'Unipile account ID is required',
      };
    }

    if (!isNonEmptyString(linkedinProfileId)) {
      return {
        success: false,
        message: 'Failed to view LinkedIn profile',
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
          `IS_OUTREACH_MOCK_UNIPILE_ENABLED: skipping Unipile profile visit for ${linkedinProfileId}`,
        );

        return {
          success: true,
          message: 'LinkedIn profile viewed successfully',
          result: {
            mock: true,
            unipileAccountId,
            linkedinProfileId,
            response: {
              object: 'UserProfile',
              provider_id: OUTREACH_MOCK_UNIPILE_PROFILE_VIEW_RESPONSE_ID,
            },
          },
        };
      }

      const profile =
        await this.linkedinUnipileRequestService.visitLinkedinProfileNotify(
          unipileAccountId,
          linkedinProfileId,
        );

      this.logger.log(
        `Viewed LinkedIn profile ${linkedinProfileId} via account ${unipileAccountId}`,
      );

      return {
        success: true,
        message: 'LinkedIn profile viewed successfully',
        result: {
          unipileAccountId,
          linkedinProfileId,
          response: profile,
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to view LinkedIn profile: ${getUnipileToolErrorMessage(error)}`,
      );

      return {
        success: false,
        message: 'Failed to view LinkedIn profile',
        error: getUnipileToolErrorMessage(error),
      };
    }
  }
}
