import { Injectable, Logger } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';
import { FeatureFlagKey } from 'twenty-shared/types';

import { LinkedinUnipileRequestService } from 'src/engine/core-modules/arx-chat/services/linkedin-unipile-request.service';
import { FeatureFlagService } from 'src/engine/core-modules/feature-flag/services/feature-flag.service';
import { LinkedinProviderIdStoreService } from 'src/engine/core-modules/outreach-command/services/linkedin-provider-id.store';
import { extractLinkedinProfileId } from 'src/engine/core-modules/outreach-command/utils/extract-linkedin-profile-id.util';
import {
  FetchLinkedinActivityToolInputZodSchema,
  type FetchLinkedinActivityToolInput,
} from 'src/engine/core-modules/tool/tools/unipile-messaging-tool/types/fetch-linkedin-activity-tool-input.type';
import {
  normalizeLinkedinActivityPosts,
  normalizeLinkedinActivityUserComments,
  pickMostRecentLinkedinActivityPost,
} from 'src/engine/core-modules/tool/tools/unipile-messaging-tool/utils/normalize-linkedin-activity.util';
import {
  createLinkedinUnipileMessagingServiceForTools,
  getUnipileToolErrorMessage,
} from 'src/engine/core-modules/tool/tools/unipile-messaging-tool/utils/unipile-messaging-tool.util';
import { type ToolExecutionContext } from 'src/engine/core-modules/tool/types/tool-execution-context.type';
import { type ToolInput } from 'src/engine/core-modules/tool/types/tool-input.type';
import { type ToolOutput } from 'src/engine/core-modules/tool/types/tool-output.type';
import { type Tool } from 'src/engine/core-modules/tool/types/tool.type';

@Injectable()
export class FetchLinkedinActivityTool implements Tool {
  private readonly logger = new Logger(FetchLinkedinActivityTool.name);

  constructor(
    private readonly linkedinUnipileRequestService: LinkedinUnipileRequestService,
    private readonly linkedinProviderIdStore: LinkedinProviderIdStoreService,
    private readonly featureFlagService: FeatureFlagService,
  ) {}

  description =
    'Fetch LinkedIn posts and optional user-comment activity via Unipile. Returns normalized posts, mostRecentPost (for commenting with socialId), and userComments.';
  inputSchema = FetchLinkedinActivityToolInputZodSchema;

  async execute(
    parameters: ToolInput,
    context: ToolExecutionContext,
  ): Promise<ToolOutput> {
    const input = parameters as FetchLinkedinActivityToolInput;
    const unipileAccountId = input.unipileAccountId?.trim() ?? '';
    const linkedinProfileId =
      extractLinkedinProfileId(input.linkedinProfileId) ||
      extractLinkedinProfileId(input.linkedinUrl);
    const postsLimit = input.postsLimit ?? 10;
    const includeUserComments = input.includeUserComments !== false;
    const userCommentsLimit = input.userCommentsLimit ?? 10;
    const excludePostSocialIds = Array.isArray(input.excludePostSocialIds)
      ? input.excludePostSocialIds
      : [];

    if (!isNonEmptyString(unipileAccountId)) {
      return {
        success: false,
        message: 'Failed to fetch LinkedIn activity',
        error: 'Unipile account ID is required',
      };
    }

    if (!isNonEmptyString(linkedinProfileId)) {
      return {
        success: false,
        message: 'Failed to fetch LinkedIn activity',
        error: 'LinkedIn profile ID is required',
      };
    }

    try {
      // temporary: `&& false` forces real Unipile; send/connect stay mock-gated
      const isMockUnipileEnabled =
        (await this.featureFlagService.isFeatureEnabled(
          FeatureFlagKey.IS_OUTREACH_MOCK_UNIPILE_ENABLED,
          context.workspaceId,
        )) && false;

      if (isMockUnipileEnabled) {
        const mockPosts = [
          {
            id: 'mock-post-1',
            socialId: 'urn:li:activity:mock-1',
            text: 'Mock LinkedIn post for outreach testing.',
            parsedDatetime: new Date().toISOString(),
            shareUrl:
              'https://www.linkedin.com/feed/update/urn:li:activity:mock-1',
            isRepost: false,
          },
          {
            id: 'mock-post-2',
            socialId: 'urn:li:activity:mock-2',
            text: 'Second mock LinkedIn post for distinct-comment rounds.',
            parsedDatetime: new Date(Date.now() - 86_400_000).toISOString(),
            shareUrl:
              'https://www.linkedin.com/feed/update/urn:li:activity:mock-2',
            isRepost: false,
          },
        ];
        const mostRecentPost = pickMostRecentLinkedinActivityPost(mockPosts, {
          excludePostSocialIds,
        });

        return {
          success: true,
          message: 'LinkedIn activity fetched successfully',
          result: {
            mock: true,
            unipileAccountId,
            linkedinProfileId,
            posts: mockPosts,
            mostRecentPost,
            userComments: includeUserComments ? [] : [],
            postsCount: mockPosts.length,
            userCommentsCount: 0,
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

      const postsPayload =
        await this.linkedinUnipileRequestService.fetchLinkedinUserPosts(
          unipileAccountId,
          providerId,
          {
            limit: postsLimit,
            cacheIdentifiers: [linkedinProfileId],
          },
        );

      const posts = normalizeLinkedinActivityPosts(postsPayload, postsLimit);
      const mostRecentPost = pickMostRecentLinkedinActivityPost(posts, {
        excludePostSocialIds,
      });

      let userComments: ReturnType<
        typeof normalizeLinkedinActivityUserComments
      > = [];

      if (includeUserComments) {
        const commentsPayload =
          await this.linkedinUnipileRequestService.fetchLinkedinUserComments(
            unipileAccountId,
            providerId,
            { limit: userCommentsLimit },
          );

        userComments = normalizeLinkedinActivityUserComments(
          commentsPayload,
          userCommentsLimit,
        );
      }

      this.logger.log(
        `Fetched LinkedIn activity for ${linkedinProfileId}: ${posts.length} posts, ${userComments.length} comments`,
      );

      return {
        success: true,
        message: 'LinkedIn activity fetched successfully',
        result: {
          unipileAccountId,
          linkedinProfileId,
          providerId,
          posts,
          mostRecentPost,
          userComments,
          postsCount: posts.length,
          userCommentsCount: userComments.length,
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to fetch LinkedIn activity: ${getUnipileToolErrorMessage(error)}`,
      );

      return {
        success: false,
        message: 'Failed to fetch LinkedIn activity',
        error: getUnipileToolErrorMessage(error),
      };
    }
  }
}
