import { Injectable, Logger } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';
import { FeatureFlagKey } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';
import { type ObjectLiteral } from 'typeorm';

import { isAccountRateLimitDeferredError } from 'src/engine/core-modules/account-rate-limit/account-rate-limit-deferred.error';
import { LinkedinUnipileRequestService } from 'src/engine/core-modules/arx-chat/services/linkedin-unipile-request.service';
import { FeatureFlagService } from 'src/engine/core-modules/feature-flag/services/feature-flag.service';
import { extractLinkedinProfileId } from 'src/engine/core-modules/outreach-command/utils/extract-linkedin-profile-id.util';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';

type WorkspaceMemberArxRecord = ObjectLiteral & {
  id: string;
  workspaceMemberId: string;
  linkedinUnipileAccountId: string | null;
};

type CandidateRecord = ObjectLiteral & {
  id: string;
  linkedinUrl?: { primaryLinkUrl?: string } | null;
  linkedinProfileId?: string | null;
};

type UnipileUserCommentAuthor = {
  id?: string;
  display_name?: string;
  public_identifier?: string;
  profile_url?: string;
};

type UnipileUserCommentParentPost = {
  object?: string;
  id?: string;
  share_url?: string;
  text?: string;
  author?: UnipileUserCommentAuthor;
};

type UnipileUserComment = {
  object?: string;
  id?: string;
  thread_id?: string;
  created_at?: string;
  text?: string;
  reply_counter?: number;
  impressions_counter?: number;
  author?: UnipileUserCommentAuthor;
  parent_post?: UnipileUserCommentParentPost | null;
};

type UnipileUserCommentsResponse = {
  data?: UnipileUserComment[];
  total_count?: number;
  next_cursor?: string | null;
};

export type FetchUserCommentsInput = {
  workspaceMemberId?: string;
  linkedinUrl?: string;
  linkedinProfileId?: string;
  candidateId?: string;
  /** Unipile user id; use `me` for the connected account owner. */
  userId?: string;
  accountId?: string;
  limit?: number;
  cursor?: string;
};

export type FetchUserCommentItem = {
  id: string;
  text: string;
  createdAt: string;
  threadId: string;
  replyCounter: number;
  authorName: string;
  authorUrl: string;
  parentPostId: string;
  parentPostUrl: string;
  parentPostText: string;
};

@Injectable()
export class FetchUserCommentsService {
  private readonly logger = new Logger(FetchUserCommentsService.name);

  constructor(
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
    private readonly linkedinUnipileRequestService: LinkedinUnipileRequestService,
    private readonly featureFlagService: FeatureFlagService,
  ) {}

  async execute({
    workspaceId,
    input,
  }: {
    workspaceId: string;
    input: FetchUserCommentsInput;
  }): Promise<{
    success: boolean;
    total: number;
    nextCursor: string;
    comments: FetchUserCommentItem[];
    error: string;
  }> {
    const limit = Math.min(Math.max(1, input.limit ?? 50), 200);
    const isOutreachMockEnabled =
      await this.featureFlagService.isFeatureEnabled(
        FeatureFlagKey.IS_OUTREACH_MOCK_UNIPILE_ENABLED,
        workspaceId,
      );

    if (isOutreachMockEnabled) {
      const identifier = this.resolveIdentifier(input) || 'me';

      this.logger.log(
        `IS_OUTREACH_MOCK_UNIPILE_ENABLED: mock user comments for ${identifier}`,
      );

      return {
        success: true,
        total: 1,
        nextCursor: '',
        comments: [
          {
            id: 'mock-comment-1',
            text: 'Great insights — thanks for sharing.',
            createdAt: '2026-08-01T12:00:00.000Z',
            threadId: '',
            replyCounter: 0,
            authorName: 'Mock Commenter',
            authorUrl: `https://www.linkedin.com/in/${identifier}`,
            parentPostId: 'mock-post-1',
            parentPostUrl:
              'https://www.linkedin.com/feed/update/urn:li:activity:1',
            parentPostText: 'We are hiring Account Executives',
          },
        ],
        error: '',
      };
    }

    const authContext = buildSystemAuthContext(workspaceId);

    try {
      const resolved =
        await this.globalWorkspaceOrmManager.executeInWorkspaceContext(
          async () => {
            const accountId = await this.resolveAccountId({
              workspaceId,
              input,
            });
            const identifier = await this.resolveIdentifierFromWorkspace({
              workspaceId,
              input,
            });

            return { accountId, identifier };
          },
          authContext,
        );

      if (!isNonEmptyString(resolved.accountId)) {
        return {
          success: false,
          total: 0,
          nextCursor: '',
          comments: [],
          error: 'No LinkedIn Unipile account on workspace member profile',
        };
      }

      if (!isNonEmptyString(resolved.identifier)) {
        return {
          success: false,
          total: 0,
          nextCursor: '',
          comments: [],
          error:
            'linkedinUrl, linkedinProfileId, candidateId, or userId is required',
        };
      }

      const comments: FetchUserCommentItem[] = [];
      let cursor = isNonEmptyString(input.cursor) ? input.cursor : undefined;
      let nextCursor = '';
      let totalCount = 0;

      while (comments.length < limit) {
        const pageLimit = Math.min(50, limit - comments.length);
        const page =
          await this.linkedinUnipileRequestService.fetchLinkedinUserComments(
            resolved.accountId,
            resolved.identifier,
            {
              limit: pageLimit,
              cursor,
            },
          );

        if (!isDefined(page)) {
          return {
            success: comments.length > 0,
            total: comments.length > 0 ? totalCount || comments.length : 0,
            nextCursor: '',
            comments,
            error:
              comments.length > 0
                ? ''
                : `Failed to fetch comments for ${resolved.identifier}`,
          };
        }

        const payload = page as UnipileUserCommentsResponse;
        const pageComments = (payload.data ?? []).map((comment) =>
          this.mapComment(comment),
        );

        comments.push(...pageComments);
        totalCount = payload.total_count ?? comments.length;
        nextCursor = isNonEmptyString(payload.next_cursor)
          ? payload.next_cursor
          : '';

        if (!isNonEmptyString(nextCursor) || pageComments.length === 0) {
          break;
        }

        cursor = nextCursor;
      }

      return {
        success: true,
        total: totalCount || comments.length,
        nextCursor: comments.length >= limit ? nextCursor : '',
        comments: comments.slice(0, limit),
        error: '',
      };
    } catch (error) {
      if (isAccountRateLimitDeferredError(error)) {
        throw error;
      }

      this.logger.error('fetch-user-comments failed', error);

      return {
        success: false,
        total: 0,
        nextCursor: '',
        comments: [],
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private resolveIdentifier(input: FetchUserCommentsInput): string {
    if (isNonEmptyString(input.userId)) {
      return input.userId.trim();
    }

    return (
      extractLinkedinProfileId(input.linkedinProfileId) ||
      extractLinkedinProfileId(input.linkedinUrl)
    );
  }

  private async resolveAccountId({
    workspaceId,
    input,
  }: {
    workspaceId: string;
    input: FetchUserCommentsInput;
  }): Promise<string> {
    if (isNonEmptyString(input.accountId)) {
      return input.accountId.trim();
    }

    const profileRepository =
      await this.globalWorkspaceOrmManager.getRepository<WorkspaceMemberArxRecord>(
        workspaceId,
        'workspaceMember',
        { shouldBypassPermissionChecks: true },
      );

    const workspaceMemberId = input.workspaceMemberId?.trim() ?? '';

    if (isNonEmptyString(workspaceMemberId)) {
      const profile = await profileRepository.findOne({
        where: { id: workspaceMemberId },
      });
      const accountId = profile?.linkedinUnipileAccountId?.trim() ?? '';

      if (isNonEmptyString(accountId)) {
        return accountId;
      }
    }

    const anyProfile = await profileRepository.find({
      where: {},
      take: 20,
    });
    const withAccount = anyProfile.find((row) =>
      isNonEmptyString(row.linkedinUnipileAccountId),
    );

    return withAccount?.linkedinUnipileAccountId?.trim() ?? '';
  }

  private async resolveIdentifierFromWorkspace({
    workspaceId,
    input,
  }: {
    workspaceId: string;
    input: FetchUserCommentsInput;
  }): Promise<string> {
    const identifier = this.resolveIdentifier(input);

    if (isNonEmptyString(identifier)) {
      return identifier;
    }

    if (!isNonEmptyString(input.candidateId)) {
      return '';
    }

    const candidateRepository =
      await this.globalWorkspaceOrmManager.getRepository<CandidateRecord>(
        workspaceId,
        'candidate',
        { shouldBypassPermissionChecks: true },
      );
    const candidate = await candidateRepository.findOne({
      where: { id: input.candidateId },
    });

    return (
      extractLinkedinProfileId(candidate?.linkedinProfileId) ||
      extractLinkedinProfileId(candidate?.linkedinUrl?.primaryLinkUrl)
    );
  }

  private mapComment(comment: UnipileUserComment): FetchUserCommentItem {
    const parentPost = comment.parent_post;

    return {
      id: comment.id ?? '',
      text: comment.text ?? '',
      createdAt: comment.created_at ?? '',
      threadId: comment.thread_id ?? '',
      replyCounter: comment.reply_counter ?? 0,
      authorName: comment.author?.display_name ?? '',
      authorUrl: comment.author?.profile_url ?? '',
      parentPostId: parentPost?.id ?? '',
      parentPostUrl: parentPost?.share_url ?? '',
      parentPostText: parentPost?.text ?? '',
    };
  }
}
