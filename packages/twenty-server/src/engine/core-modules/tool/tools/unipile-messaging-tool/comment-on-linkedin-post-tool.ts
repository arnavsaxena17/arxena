import { Injectable, Logger } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';
import { FeatureFlagKey } from 'twenty-shared/types';

import { LinkedinUnipileRequestService } from 'src/engine/core-modules/arx-chat/services/linkedin-unipile-request.service';
import { FeatureFlagService } from 'src/engine/core-modules/feature-flag/services/feature-flag.service';
import {
  CommentOnLinkedinPostToolInputZodSchema,
  type CommentOnLinkedinPostToolInput,
} from 'src/engine/core-modules/tool/tools/unipile-messaging-tool/types/comment-on-linkedin-post-tool-input.type';
import { OUTREACH_MOCK_UNIPILE_POST_COMMENT_RESPONSE_ID } from 'src/engine/core-modules/tool/tools/unipile-messaging-tool/utils/is-outreach-mock-unipile-enabled.util';
import { getUnipileToolErrorMessage } from 'src/engine/core-modules/tool/tools/unipile-messaging-tool/utils/unipile-messaging-tool.util';
import { type ToolExecutionContext } from 'src/engine/core-modules/tool/types/tool-execution-context.type';
import { type ToolInput } from 'src/engine/core-modules/tool/types/tool-input.type';
import { type ToolOutput } from 'src/engine/core-modules/tool/types/tool-output.type';
import { type Tool } from 'src/engine/core-modules/tool/types/tool.type';

@Injectable()
export class CommentOnLinkedinPostTool implements Tool {
  private readonly logger = new Logger(CommentOnLinkedinPostTool.name);

  constructor(
    private readonly linkedinUnipileRequestService: LinkedinUnipileRequestService,
    private readonly featureFlagService: FeatureFlagService,
  ) {}

  description =
    'Comment on a LinkedIn post via Unipile. Pass the post social_id from FETCH_LINKEDIN_ACTIVITY (mostRecentPost.socialId), not the URL post id.';
  inputSchema = CommentOnLinkedinPostToolInputZodSchema;

  async execute(
    parameters: ToolInput,
    context: ToolExecutionContext,
  ): Promise<ToolOutput> {
    const input = parameters as CommentOnLinkedinPostToolInput;
    const unipileAccountId = input.unipileAccountId?.trim() ?? '';
    const postId = input.postId?.trim() ?? '';
    const text = input.text?.trim() ?? '';
    const commentId = input.commentId?.trim() || undefined;

    if (!isNonEmptyString(unipileAccountId)) {
      return {
        success: false,
        message: 'Failed to comment on LinkedIn post',
        error: 'Unipile account ID is required',
      };
    }

    if (!isNonEmptyString(postId)) {
      return {
        success: false,
        message: 'Failed to comment on LinkedIn post',
        error: 'Post social_id is required',
      };
    }

    if (!isNonEmptyString(text)) {
      return {
        success: false,
        message: 'Failed to comment on LinkedIn post',
        error: 'Comment text is required',
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
          `IS_OUTREACH_MOCK_UNIPILE_ENABLED: skipping Unipile comment for post ${postId}`,
        );

        return {
          success: true,
          message: 'LinkedIn post comment sent successfully',
          result: {
            mock: true,
            unipileAccountId,
            postId,
            text,
            response: {
              object: 'CommentSent',
              comment_id: OUTREACH_MOCK_UNIPILE_POST_COMMENT_RESPONSE_ID,
            },
          },
        };
      }

      const response =
        await this.linkedinUnipileRequestService.commentOnLinkedinPost(
          unipileAccountId,
          postId,
          text,
          {
            commentId,
          },
        );

      this.logger.log(
        `Commented on LinkedIn post ${postId} via account ${unipileAccountId}`,
      );

      return {
        success: true,
        message: 'LinkedIn post comment sent successfully',
        result: {
          unipileAccountId,
          postId,
          text,
          response,
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to comment on LinkedIn post: ${getUnipileToolErrorMessage(error)}`,
      );

      return {
        success: false,
        message: 'Failed to comment on LinkedIn post',
        error: getUnipileToolErrorMessage(error),
      };
    }
  }
}
