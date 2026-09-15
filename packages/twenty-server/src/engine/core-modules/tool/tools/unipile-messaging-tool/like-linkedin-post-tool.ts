import { Injectable, Logger } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';
import { FeatureFlagKey } from 'twenty-shared/types';

import { LinkedinUnipileRequestService } from 'src/engine/core-modules/arx-chat/services/linkedin-unipile-request.service';
import { FeatureFlagService } from 'src/engine/core-modules/feature-flag/services/feature-flag.service';
import {
  LikeLinkedinPostToolInputZodSchema,
  type LikeLinkedinPostToolInput,
} from 'src/engine/core-modules/tool/tools/unipile-messaging-tool/types/like-linkedin-post-tool-input.type';
import { OUTREACH_MOCK_UNIPILE_POST_LIKE_RESPONSE_ID } from 'src/engine/core-modules/tool/tools/unipile-messaging-tool/utils/is-outreach-mock-unipile-enabled.util';
import { getUnipileToolErrorMessage } from 'src/engine/core-modules/tool/tools/unipile-messaging-tool/utils/unipile-messaging-tool.util';
import { type ToolExecutionContext } from 'src/engine/core-modules/tool/types/tool-execution-context.type';
import { type ToolInput } from 'src/engine/core-modules/tool/types/tool-input.type';
import { type ToolOutput } from 'src/engine/core-modules/tool/types/tool-output.type';
import { type Tool } from 'src/engine/core-modules/tool/types/tool.type';

@Injectable()
export class LikeLinkedinPostTool implements Tool {
  private readonly logger = new Logger(LikeLinkedinPostTool.name);

  constructor(
    private readonly linkedinUnipileRequestService: LinkedinUnipileRequestService,
    private readonly featureFlagService: FeatureFlagService,
  ) {}

  description =
    'React to a LinkedIn post via Unipile (POST /posts/reaction). Pass the post social_id from FETCH_LINKEDIN_ACTIVITY (mostRecentPost.socialId). Defaults to like.';
  inputSchema = LikeLinkedinPostToolInputZodSchema;

  async execute(
    parameters: ToolInput,
    context: ToolExecutionContext,
  ): Promise<ToolOutput> {
    const input = parameters as LikeLinkedinPostToolInput;
    const unipileAccountId = input.unipileAccountId?.trim() ?? '';
    const postId = input.postId?.trim() ?? '';
    const reactionType = input.reactionType ?? 'like';
    const commentId = input.commentId?.trim() || undefined;

    if (!isNonEmptyString(unipileAccountId)) {
      return {
        success: false,
        message: 'Failed to like LinkedIn post',
        error: 'Unipile account ID is required',
      };
    }

    if (!isNonEmptyString(postId)) {
      return {
        success: false,
        message: 'Failed to like LinkedIn post',
        error: 'Post social_id is required',
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
          `IS_OUTREACH_MOCK_UNIPILE_ENABLED: skipping Unipile reaction for post ${postId}`,
        );

        return {
          success: true,
          message: 'LinkedIn post reaction sent successfully',
          result: {
            mock: true,
            unipileAccountId,
            postId,
            reactionType,
            response: {
              object: 'ReactionAdded',
              id: OUTREACH_MOCK_UNIPILE_POST_LIKE_RESPONSE_ID,
            },
          },
        };
      }

      const response =
        await this.linkedinUnipileRequestService.reactToLinkedinPost(
          unipileAccountId,
          postId,
          {
            reactionType,
            commentId,
          },
        );

      this.logger.log(
        `Reacted (${reactionType}) to LinkedIn post ${postId} via account ${unipileAccountId}`,
      );

      return {
        success: true,
        message: 'LinkedIn post reaction sent successfully',
        result: {
          unipileAccountId,
          postId,
          reactionType,
          response,
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to like LinkedIn post: ${getUnipileToolErrorMessage(error)}`,
      );

      return {
        success: false,
        message: 'Failed to like LinkedIn post',
        error: getUnipileToolErrorMessage(error),
      };
    }
  }
}
