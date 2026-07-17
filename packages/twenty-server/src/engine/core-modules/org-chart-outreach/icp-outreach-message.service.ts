import { BadRequestException, Injectable, Logger } from '@nestjs/common';

import { z } from 'zod';

import { LinkedinUnipileEstimateAccountService } from 'src/engine/core-modules/arx-chat/services/linkedin-unipile-estimate-account.service';
import { LinkedinUnipileRequestService } from 'src/engine/core-modules/arx-chat/services/linkedin-unipile-request.service';
import { LLMChatModelService } from 'src/engine/core-modules/llm-chat-model/llm-chat-model.service';
import type {
    GenerateIcpCommentParams,
    GenerateIcpCommentResponse,
    GenerateIcpMessageParams,
    GenerateIcpMessageResponse,
    LinkedinPostSummary,
    SendPostCommentParams,
    SendPostCommentResponse,
} from 'src/engine/core-modules/org-chart-outreach/org-chart-outreach.types';
import { buildIcpOutreachMessagePrompt } from 'src/engine/core-modules/org-chart-outreach/prompts/icp-outreach-message.prompt';
import { buildIcpPostCommentPrompt } from 'src/engine/core-modules/org-chart-outreach/prompts/icp-post-comment.prompt';
import {
    CONNECTION_REQUEST_MAX_LENGTH,
    DIRECT_MESSAGE_MAX_LENGTH,
    INMAIL_SUBJECT_MAX_LENGTH,
} from 'src/engine/core-modules/org-chart-outreach/prompts/outreach-message-composition.prompt';
import { icpProfileSchema } from 'src/engine/core-modules/org-chart-outreach/schemas/icp-extraction.schema';
import {
    extractTargetProviderId,
    filterPostsWithinDays,
    summarizeLinkedinPosts,
} from 'src/engine/core-modules/org-chart-outreach/utils/linkedin-profile-context.util';
import { normalizeLlmJsonContent } from 'src/engine/core-modules/org-chart-outreach/utils/outreach-company-resolver.util';

const messageResultSchema = z.object({
  message: z.string().min(1),
  subject: z.string().optional(),
});

const commentsResultSchema = z.object({
  comments: z.array(z.string().min(1)).min(1).max(5),
});

const DEFAULT_RECENT_POST_DAYS = 30;
const DEFAULT_COMMENT_VARIANTS = 3;
const COMMENT_MAX_LENGTH = 600;

/** Picks the newest post, preferring originals over reposts. */
export const pickMostRecentPost = (
  posts: LinkedinPostSummary[],
): LinkedinPostSummary | null => {
  if (posts.length === 0) {
    return null;
  }
  const byDateDesc = [...posts].sort(
    (a, b) =>
      (Date.parse(b.parsedDatetime ?? '') || 0) -
      (Date.parse(a.parsedDatetime ?? '') || 0),
  );
  return byDateDesc.find((post) => !post.isRepost) ?? byDateDesc[0];
};

@Injectable()
export class IcpOutreachMessageService {
  private readonly logger = new Logger(IcpOutreachMessageService.name);

  constructor(
    private readonly llmChatModelService: LLMChatModelService,
    private readonly linkedinUnipileRequestService: LinkedinUnipileRequestService,
    private readonly linkedinUnipileEstimateAccountService: LinkedinUnipileEstimateAccountService,
  ) {}

  /**
   * Prompt 3: generates the outreach message from the extracted ICP, grounded
   * in (1) what the recipient's company does and (2) their most recent post
   * within the last month, referencing ranked target companies as the lure.
   */
  async generateIcpMessage(
    params: GenerateIcpMessageParams,
  ): Promise<GenerateIcpMessageResponse> {
    const icp = icpProfileSchema.parse(params.icp);
    const targetIdentifier = params.targetIdentifier?.trim();
    if (!targetIdentifier) {
      throw new BadRequestException('targetIdentifier is required');
    }

    const recentPostDays = params.recentPostDays ?? DEFAULT_RECENT_POST_DAYS;
    const postsLimit = params.postsLimit ?? 10;

    const fetched =
      await this.linkedinUnipileEstimateAccountService.withOutreachLinkedinSession(
        params.apiToken,
        params.accountId,
        async (session) => {
          this.logger.log(
            `ICP message generation using LinkedIn Unipile accountId=${session.accountId}`,
          );

          const cleanupContext = {
            accountId: session.accountId,
            workspaceMemberId: params.workspaceMemberId,
            workspaceId: params.workspaceId,
            authToken: params.apiToken,
            context: 'ICP outreach message generation',
          };

          const targetProfile =
            await this.linkedinUnipileRequestService.fetchLinkedinUserProfile(
              session.accountId,
              targetIdentifier,
              { linkedinSections: ['*'], cleanupContext },
            );

          if (!targetProfile) {
            throw new BadRequestException(
              `Failed to fetch LinkedIn profile for "${targetIdentifier}"`,
            );
          }

          const providerId = extractTargetProviderId(
            targetProfile,
            targetIdentifier,
          );

          const postsPayload =
            await this.linkedinUnipileRequestService.fetchLinkedinUserPosts(
              session.accountId,
              providerId,
              { limit: postsLimit, cleanupContext },
            );

          return { targetProfile, postsPayload };
        },
      );

    const posts = summarizeLinkedinPosts(fetched.postsPayload, postsLimit);
    const postsWithinWindow = filterPostsWithinDays(posts, recentPostDays);
    const recentPost = pickMostRecentPost(postsWithinWindow);

    const targetName = [
      fetched.targetProfile.first_name,
      fetched.targetProfile.last_name,
    ]
      .filter((part): part is string => typeof part === 'string')
      .join(' ');

    const prompt = buildIcpOutreachMessagePrompt({
      icp,
      sells: params.sells,
      chartFunction: params.chartFunction,
      targetName: targetName || undefined,
      targetHeadline:
        typeof fetched.targetProfile.headline === 'string'
          ? fetched.targetProfile.headline
          : undefined,
      recentPost,
      rankedCandidates: params.rankedCandidates ?? [],
      messageType: params.messageType,
      tone: params.tone ?? 'professional',
      customInstructions: params.customInstructions,
    });

    const composed = await this.invokeMessageLlm(prompt, params.messageType);

    this.logger.log(
      `ICP message generated type=${params.messageType} target=${targetIdentifier} recentPostUsed=${Boolean(recentPost)} length=${composed.message.length}`,
    );

    return {
      messageType: params.messageType,
      message: composed.message,
      ...(composed.subject ? { subject: composed.subject } : {}),
      recentPostUsed: recentPost,
      contextUsed: {
        targetPublicIdentifier:
          typeof fetched.targetProfile.public_identifier === 'string'
            ? fetched.targetProfile.public_identifier
            : undefined,
        postsConsidered: posts.length,
        postsWithinWindow: postsWithinWindow.length,
        recentPostDays,
        rankedCandidatesCount: params.rankedCandidates?.length ?? 0,
      },
    };
  }

  /**
   * Generates public comment variants for the target's post: value-add first,
   * with a light redirect toward org charts relevant to the author's ICP.
   */
  async generateIcpComment(
    params: GenerateIcpCommentParams,
  ): Promise<GenerateIcpCommentResponse> {
    const icp = icpProfileSchema.parse(params.icp);
    const variants = Math.min(
      Math.max(params.variants ?? DEFAULT_COMMENT_VARIANTS, 1),
      3,
    );
    const recentPostDays = params.recentPostDays ?? DEFAULT_RECENT_POST_DAYS;

    const resolved = await this.resolvePostForComment(params, recentPostDays);

    const prompt = buildIcpPostCommentPrompt({
      icp,
      sells: params.sells,
      chartFunction: params.chartFunction,
      authorName: resolved.authorName,
      post: resolved.post,
      rankedCandidates: params.rankedCandidates ?? [],
      variants,
      customInstructions: params.customInstructions,
    });

    const model = this.llmChatModelService.getJSONChatModel();
    const response = await model.invoke(prompt);
    const rawContent = normalizeLlmJsonContent(response);

    if (!rawContent) {
      throw new BadRequestException('LLM returned empty comment generation');
    }

    const parsed = commentsResultSchema.parse(JSON.parse(rawContent));
    const comments = parsed.comments
      .map((comment) => comment.trim())
      .filter(Boolean)
      .map((comment) =>
        comment.length > COMMENT_MAX_LENGTH
          ? comment.slice(0, COMMENT_MAX_LENGTH)
          : comment,
      )
      .slice(0, variants);

    this.logger.log(
      `ICP comments generated count=${comments.length} postSource=${resolved.postSource}`,
    );

    return {
      comments,
      post: resolved.post,
      contextUsed: {
        postSource: resolved.postSource,
        authorIdentifier: params.personIdentifier?.trim() || undefined,
        postsConsidered: resolved.postsConsidered,
      },
    };
  }

  /** Publishes a comment on a LinkedIn post via Unipile. */
  async sendPostComment(
    params: SendPostCommentParams,
  ): Promise<SendPostCommentResponse> {
    const postId = params.postId?.trim();
    const text = params.text?.trim();
    if (!postId || !text) {
      throw new BadRequestException('postId and text are required');
    }

    return this.linkedinUnipileEstimateAccountService.withOutreachLinkedinSession(
      params.apiToken,
      params.accountId,
      async (session) => {
        this.logger.log(
          `Sending post comment via LinkedIn Unipile accountId=${session.accountId} postId=${postId}`,
        );

        const cleanupContext = {
          accountId: session.accountId,
          workspaceMemberId: params.workspaceMemberId,
          workspaceId: params.workspaceId,
          authToken: params.apiToken,
          context: 'ICP post comment send',
        };

        const unipileResponse =
          await this.linkedinUnipileRequestService.commentOnLinkedinPost(
            session.accountId,
            postId,
            text,
            {
              commentId: params.commentId,
              mentions: params.mentions,
              externalLink: params.externalLink,
              asOrganization: params.asOrganization,
              cleanupContext,
            },
          );

        return {
          success: true,
          postId,
          accountId: session.accountId,
          unipileResponse,
        };
      },
    );
  }

  private async resolvePostForComment(
    params: GenerateIcpCommentParams,
    recentPostDays: number,
  ): Promise<{
    post: LinkedinPostSummary;
    postSource: GenerateIcpCommentResponse['contextUsed']['postSource'];
    postsConsidered: number;
    authorName?: string;
  }> {
    if (params.postText?.trim()) {
      return {
        post: {
          text: params.postText.trim(),
          isRepost: false,
          id: params.postId?.trim() || undefined,
        },
        postSource: 'provided_text',
        postsConsidered: 1,
      };
    }

    if (params.postId?.trim()) {
      const postId = params.postId.trim();
      const postPayload =
        await this.linkedinUnipileEstimateAccountService.withOutreachLinkedinSession(
          params.apiToken,
          params.accountId,
          async (session) =>
            this.linkedinUnipileRequestService.fetchLinkedinPost(
              session.accountId,
              postId,
              {
                cleanupContext: {
                  accountId: session.accountId,
                  workspaceMemberId: params.workspaceMemberId,
                  workspaceId: params.workspaceId,
                  authToken: params.apiToken,
                  context: 'ICP comment post fetch',
                },
              },
            ),
        );

      const text =
        typeof postPayload?.text === 'string' ? postPayload.text.trim() : '';
      if (!text) {
        throw new BadRequestException(
          `Failed to fetch post "${postId}" or it has no text`,
        );
      }

      return {
        post: {
          text,
          isRepost: postPayload?.is_repost === true,
          parsedDatetime:
            typeof postPayload?.parsed_datetime === 'string'
              ? postPayload.parsed_datetime
              : undefined,
          id: typeof postPayload?.id === 'string' ? postPayload.id : postId,
          socialId:
            typeof postPayload?.social_id === 'string'
              ? postPayload.social_id
              : undefined,
          shareUrl:
            typeof postPayload?.share_url === 'string'
              ? postPayload.share_url
              : undefined,
        },
        postSource: 'fetched_by_id',
        postsConsidered: 1,
      };
    }

    const personIdentifier = params.personIdentifier?.trim();
    if (!personIdentifier) {
      throw new BadRequestException(
        'Provide postText, postId, or personIdentifier to locate the post to comment on',
      );
    }

    const fetched =
      await this.linkedinUnipileEstimateAccountService.withOutreachLinkedinSession(
        params.apiToken,
        params.accountId,
        async (session) => {
          const cleanupContext = {
            accountId: session.accountId,
            workspaceMemberId: params.workspaceMemberId,
            workspaceId: params.workspaceId,
            authToken: params.apiToken,
            context: 'ICP comment post lookup',
          };

          const profile =
            await this.linkedinUnipileRequestService.fetchLinkedinUserProfile(
              session.accountId,
              personIdentifier,
              { linkedinSections: [], cleanupContext },
            );

          const providerId = profile
            ? extractTargetProviderId(profile, personIdentifier)
            : personIdentifier;

          const postsPayload =
            await this.linkedinUnipileRequestService.fetchLinkedinUserPosts(
              session.accountId,
              providerId,
              { limit: 10, cleanupContext },
            );

          return { profile, postsPayload };
        },
      );

    const posts = summarizeLinkedinPosts(fetched.postsPayload, 10);
    const postsWithinWindow = filterPostsWithinDays(posts, recentPostDays);
    // Prefer a post inside the window; a slightly older post is still commentable.
    const post =
      pickMostRecentPost(postsWithinWindow) ?? pickMostRecentPost(posts);

    if (!post) {
      throw new BadRequestException(
        `No posts found for "${personIdentifier}" to comment on`,
      );
    }

    const authorName = fetched.profile
      ? [fetched.profile.first_name, fetched.profile.last_name]
          .filter((part): part is string => typeof part === 'string')
          .join(' ') || undefined
      : undefined;

    return {
      post,
      postSource: 'latest_from_person',
      postsConsidered: posts.length,
      authorName,
    };
  }

  private async invokeMessageLlm(
    prompt: string,
    messageType: GenerateIcpMessageParams['messageType'],
  ): Promise<{ message: string; subject?: string }> {
    const model = this.llmChatModelService.getJSONChatModel();

    let response = await model.invoke(prompt);
    let rawContent = normalizeLlmJsonContent(response);
    if (!rawContent) {
      throw new BadRequestException('LLM returned empty outreach message');
    }

    let parsed = messageResultSchema.parse(JSON.parse(rawContent));

    if (
      messageType === 'connection_request' &&
      parsed.message.length > CONNECTION_REQUEST_MAX_LENGTH
    ) {
      this.logger.warn(
        `ICP connection request exceeded ${CONNECTION_REQUEST_MAX_LENGTH} chars (${parsed.message.length}), re-prompting`,
      );
      response = await model.invoke(
        `${prompt}\n\nYour previous message was ${parsed.message.length} characters. Rewrite to fit within ${CONNECTION_REQUEST_MAX_LENGTH} characters.`,
      );
      rawContent = normalizeLlmJsonContent(response);
      if (!rawContent) {
        throw new BadRequestException(
          'LLM returned empty connection request on retry',
        );
      }
      parsed = messageResultSchema.parse(JSON.parse(rawContent));
    }

    const maxLength =
      messageType === 'connection_request'
        ? CONNECTION_REQUEST_MAX_LENGTH
        : DIRECT_MESSAGE_MAX_LENGTH;
    const message =
      parsed.message.length > maxLength
        ? parsed.message.slice(0, maxLength)
        : parsed.message;

    if (messageType === 'inmail') {
      const subject = (parsed.subject ?? 'Org charts for your target accounts')
        .slice(0, INMAIL_SUBJECT_MAX_LENGTH)
        .trim();
      return { message: message.trim(), subject };
    }

    return { message: message.trim() };
  }
}
