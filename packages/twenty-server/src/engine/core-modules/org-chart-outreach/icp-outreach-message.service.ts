import { BadRequestException, Injectable, Logger } from '@nestjs/common';

import { z } from 'zod';

import { LinkedinUnipileEstimateAccountService } from 'src/engine/core-modules/arx-chat/services/linkedin-unipile-estimate-account.service';
import { LinkedinUnipileRequestService } from 'src/engine/core-modules/arx-chat/services/linkedin-unipile-request.service';
import { RecruiterProfileService } from 'src/engine/core-modules/arx-chat/services/recruiter-profile';
import { WhatsappOutboundRateLimiterService } from 'src/engine/core-modules/arx-chat/services/whatsapp-unipile/whatsapp-outbound-rate-limiter.service';
import { WhatsappUnipileMessagingService } from 'src/engine/core-modules/arx-chat/services/whatsapp-unipile/whatsapp-unipile-messaging.service';
import { WorkspaceMemberProfileUnipileService } from 'src/engine/core-modules/arx-chat/services/workspace-member-profile-unipile.service';
import { SendEmailFunctionality } from 'src/engine/core-modules/arx-chat/utils/send-gmail';
import { ContactEnrichmentWaterfallService } from 'src/engine/core-modules/contact-enrichment/services/contact-enrichment-waterfall.service';
import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { LLMChatModelService } from 'src/engine/core-modules/llm-chat-model/llm-chat-model.service';
import { IcpExtractionService } from 'src/engine/core-modules/org-chart-outreach/icp-extraction.service';
import type {
    GenerateIcpChannelParams,
    GenerateIcpCommentParams,
    GenerateIcpCommentResponse,
    GenerateIcpEmailParams,
    GenerateIcpEmailResponse,
    GenerateIcpMessageParams,
    GenerateIcpMessageResponse,
    GenerateIcpWhatsappParams,
    GenerateIcpWhatsappResponse,
    IcpChannelMessageType,
    IcpExecutionResult,
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
import {
    icpProfileSchema,
    type IcpProfile,
} from 'src/engine/core-modules/org-chart-outreach/schemas/icp-extraction.schema';
import {
    normalizeLinkedinIdentifier,
    resolveLinkedinProfileUrl,
} from 'src/engine/core-modules/org-chart-outreach/utils/linkedin-identifier.util';
import {
    extractTargetProviderId,
    filterPostsWithinDays,
    summarizeLinkedinPosts,
} from 'src/engine/core-modules/org-chart-outreach/utils/linkedin-profile-context.util';
import { normalizeLlmJsonContent } from 'src/engine/core-modules/org-chart-outreach/utils/outreach-company-resolver.util';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';

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
const EMAIL_MESSAGE_MAX_LENGTH = 4000;
const EMAIL_SUBJECT_MAX_LENGTH = 150;
const WHATSAPP_MESSAGE_MAX_LENGTH = 600;

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

type IcpResolution = {
  icp: IcpProfile;
  sells?: string;
  chartFunction?: string | null;
  icpSource: 'provided' | 'extracted';
};

type TargetContext = {
  targetProfile: Record<string, unknown>;
  providerId: string;
  posts: LinkedinPostSummary[];
  postsWithinWindow: LinkedinPostSummary[];
  recentPost: LinkedinPostSummary | null;
};

type AuthParams = {
  accountId?: string;
  apiToken: string;
  workspaceMemberId: string;
  workspaceId: string;
};

@Injectable()
export class IcpOutreachMessageService {
  private readonly logger = new Logger(IcpOutreachMessageService.name);

  constructor(
    private readonly llmChatModelService: LLMChatModelService,
    private readonly linkedinUnipileRequestService: LinkedinUnipileRequestService,
    private readonly linkedinUnipileEstimateAccountService: LinkedinUnipileEstimateAccountService,
    private readonly icpExtractionService: IcpExtractionService,
    private readonly contactEnrichmentWaterfallService: ContactEnrichmentWaterfallService,
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly staticGraphQLService: StaticGraphQLService,
    private readonly workspaceMemberProfileUnipileService: WorkspaceMemberProfileUnipileService,
    private readonly whatsappOutboundRateLimiter: WhatsappOutboundRateLimiterService,
  ) {}

  private whatsappMessaging(): WhatsappUnipileMessagingService {
    return new WhatsappUnipileMessagingService(
      this.workspaceQueryService,
      this.staticGraphQLService,
      this.workspaceMemberProfileUnipileService,
      this.whatsappOutboundRateLimiter,
    );
  }

  /**
   * Prompt 3: generates the outreach message from the extracted ICP, grounded
   * in (1) what the recipient's company does and (2) their most recent post
   * within the last month, referencing ranked target companies as the lure.
   * When `execute` is set (connection_request only), the invite is sent too.
   */
  async generateIcpMessage(
    params: GenerateIcpMessageParams,
  ): Promise<GenerateIcpMessageResponse> {
    const targetIdentifier = normalizeLinkedinIdentifier(
      params.targetIdentifier,
    );
    if (!targetIdentifier) {
      throw new BadRequestException('targetIdentifier is required');
    }
    if (params.execute && params.messageType !== 'connection_request') {
      throw new BadRequestException(
        'execute is only supported for messageType "connection_request"',
      );
    }

    const recentPostDays = params.recentPostDays ?? DEFAULT_RECENT_POST_DAYS;
    const postsLimit = params.postsLimit ?? 10;

    const target = await this.fetchTargetContext({
      targetIdentifier,
      postsLimit,
      recentPostDays,
      context: 'ICP outreach message generation',
      ...this.authParams(params),
    });

    const icpResolution = await this.resolveIcpContext(
      params,
      target.targetProfile,
    );

    const prompt = buildIcpOutreachMessagePrompt({
      icp: icpResolution.icp,
      sells: icpResolution.sells,
      chartFunction: icpResolution.chartFunction,
      targetName: this.readProfileName(target.targetProfile),
      targetHeadline:
        typeof target.targetProfile.headline === 'string'
          ? target.targetProfile.headline
          : undefined,
      recentPost: target.recentPost,
      rankedCandidates: params.rankedCandidates ?? [],
      messageType: params.messageType,
      tone: params.tone ?? 'professional',
      customInstructions: params.customInstructions,
    });

    const composed = await this.invokeMessageLlm(prompt, params.messageType);

    this.logger.log(
      `ICP message generated type=${params.messageType} target=${targetIdentifier} recentPostUsed=${Boolean(target.recentPost)} length=${composed.message.length}`,
    );

    let execution: IcpExecutionResult | undefined;
    if (params.execute) {
      execution = await this.executeLinkedinInvite({
        providerId: target.providerId,
        message: composed.message,
        ...this.authParams(params),
      });
    }

    return {
      messageType: params.messageType,
      message: composed.message,
      ...(composed.subject ? { subject: composed.subject } : {}),
      recentPostUsed: target.recentPost,
      ...(icpResolution.icpSource === 'extracted'
        ? { icp: icpResolution.icp }
        : {}),
      contextUsed: {
        targetPublicIdentifier:
          typeof target.targetProfile.public_identifier === 'string'
            ? target.targetProfile.public_identifier
            : undefined,
        postsConsidered: target.posts.length,
        postsWithinWindow: target.postsWithinWindow.length,
        recentPostDays,
        rankedCandidatesCount: params.rankedCandidates?.length ?? 0,
        icpSource: icpResolution.icpSource,
      },
      ...(execution ? { execution } : {}),
    };
  }

  /**
   * Generates public comment variants for the target's post: value-add first,
   * with a light redirect toward org charts relevant to the author's ICP.
   * When `execute` is set, the first variant is published on the post.
   */
  async generateIcpComment(
    params: GenerateIcpCommentParams,
  ): Promise<GenerateIcpCommentResponse> {
    const personIdentifier = normalizeLinkedinIdentifier(
      params.personIdentifier,
    );
    const variants = Math.min(
      Math.max(params.variants ?? DEFAULT_COMMENT_VARIANTS, 1),
      3,
    );
    const recentPostDays = params.recentPostDays ?? DEFAULT_RECENT_POST_DAYS;

    if (!params.icp && !personIdentifier) {
      throw new BadRequestException(
        'Provide icp, or personIdentifier (identifier or LinkedIn URL) so the ICP can be extracted from the author\'s profile',
      );
    }

    const resolved = await this.resolvePostForComment(
      { ...params, personIdentifier },
      recentPostDays,
    );

    const icpResolution = params.icp
      ? this.providedIcpResolution(params)
      : await this.extractIcpForIdentifier(personIdentifier, params, undefined);

    const prompt = buildIcpPostCommentPrompt({
      icp: icpResolution.icp,
      sells: icpResolution.sells,
      chartFunction: icpResolution.chartFunction,
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

    let execution: GenerateIcpCommentResponse['execution'];
    if (params.execute) {
      execution = await this.executePostComment({
        postId: resolved.post.id ?? resolved.post.socialId,
        text: comments[0],
        ...this.authParams(params),
      });
    }

    return {
      comments,
      post: resolved.post,
      ...(icpResolution.icpSource === 'extracted'
        ? { icp: icpResolution.icp }
        : {}),
      contextUsed: {
        postSource: resolved.postSource,
        authorIdentifier: personIdentifier || undefined,
        postsConsidered: resolved.postsConsidered,
        icpSource: icpResolution.icpSource,
      },
      ...(execution ? { execution } : {}),
    };
  }

  /**
   * Generates a cold email for the target. The recipient address comes from
   * the contact-enrichment waterfall (Apollo / ContactOut / ...) keyed on the
   * LinkedIn URL, unless the caller provides one. `execute` sends it via the
   * workspace member's connected Gmail.
   */
  async generateIcpEmail(
    params: GenerateIcpEmailParams,
  ): Promise<GenerateIcpEmailResponse> {
    const composed = await this.composeChannelMessage(params, 'email');

    const providedEmail = params.email?.trim();
    let contact: GenerateIcpEmailResponse['contact'];
    if (providedEmail) {
      contact = { emails: [providedEmail], source: 'provided' };
    } else {
      const enriched = await this.contactEnrichmentWaterfallService.fetchContacts(
        resolveLinkedinProfileUrl(params.targetIdentifier),
        { wantEmail: true, wantPhone: false },
      );
      contact = { emails: enriched.emails, source: enriched.source };
    }
    const toEmail = providedEmail ?? contact.emails[0];

    let execution: IcpExecutionResult | undefined;
    if (params.execute) {
      execution = await this.executeEmailSend({
        toEmail,
        subject: composed.subject ?? 'Org charts for your target accounts',
        message: composed.message,
        apiToken: params.apiToken,
        workspaceMemberId: params.workspaceMemberId,
      });
    }

    return {
      subject: composed.subject ?? '',
      message: composed.message,
      ...(toEmail ? { toEmail } : {}),
      contact,
      recentPostUsed: composed.target.recentPost,
      ...(composed.icpResolution.icpSource === 'extracted'
        ? { icp: composed.icpResolution.icp }
        : {}),
      contextUsed: composed.contextUsed,
      ...(execution ? { execution } : {}),
    };
  }

  /**
   * Generates a WhatsApp message for the target. The phone number comes from
   * the contact-enrichment waterfall keyed on the LinkedIn URL, unless the
   * caller provides one. `execute` sends it via the workspace member's
   * connected WhatsApp Unipile account.
   */
  async generateIcpWhatsapp(
    params: GenerateIcpWhatsappParams,
  ): Promise<GenerateIcpWhatsappResponse> {
    const composed = await this.composeChannelMessage(params, 'whatsapp');

    const providedPhone = params.phone?.trim();
    let contact: GenerateIcpWhatsappResponse['contact'];
    if (providedPhone) {
      contact = { phones: [providedPhone], source: 'provided' };
    } else {
      const enriched = await this.contactEnrichmentWaterfallService.fetchContacts(
        resolveLinkedinProfileUrl(params.targetIdentifier),
        { wantEmail: false, wantPhone: true },
      );
      contact = { phones: enriched.phones, source: enriched.source };
    }
    const toPhone = providedPhone ?? contact.phones[0];

    let execution: IcpExecutionResult | undefined;
    if (params.execute) {
      execution = await this.executeWhatsappSend({
        toPhone,
        message: composed.message,
        apiToken: params.apiToken,
      });
    }

    return {
      message: composed.message,
      ...(toPhone ? { toPhone } : {}),
      contact,
      recentPostUsed: composed.target.recentPost,
      ...(composed.icpResolution.icpSource === 'extracted'
        ? { icp: composed.icpResolution.icp }
        : {}),
      contextUsed: composed.contextUsed,
      ...(execution ? { execution } : {}),
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

  private authParams(params: AuthParams): AuthParams {
    return {
      accountId: params.accountId,
      apiToken: params.apiToken,
      workspaceMemberId: params.workspaceMemberId,
      workspaceId: params.workspaceId,
    };
  }

  private readProfileName(
    profile: Record<string, unknown>,
  ): string | undefined {
    const name = [profile.first_name, profile.last_name]
      .filter((part): part is string => typeof part === 'string')
      .join(' ');
    return name || undefined;
  }

  private providedIcpResolution(params: {
    icp?: unknown;
    sells?: string;
    chartFunction?: string | null;
  }): IcpResolution {
    return {
      icp: icpProfileSchema.parse(params.icp),
      sells: params.sells,
      chartFunction: params.chartFunction,
      icpSource: 'provided',
    };
  }

  /**
   * Uses the caller-provided ICP when present; otherwise runs Prompt 1 (ICP
   * extraction) against the target's own profile so the endpoint works with
   * just a LinkedIn URL/identifier.
   */
  private async resolveIcpContext(
    params: GenerateIcpMessageParams | GenerateIcpChannelParams,
    targetProfile: Record<string, unknown>,
  ): Promise<IcpResolution> {
    if (params.icp) {
      return this.providedIcpResolution(params);
    }
    return this.extractIcpForIdentifier(
      normalizeLinkedinIdentifier(params.targetIdentifier),
      params,
      targetProfile,
    );
  }

  private async extractIcpForIdentifier(
    personIdentifier: string,
    params: AuthParams & { sells?: string; chartFunction?: string | null },
    personProfile: Record<string, unknown> | undefined,
  ): Promise<IcpResolution> {
    this.logger.log(
      `ICP not provided — extracting from profile identifier=${personIdentifier}`,
    );

    const extraction = await this.icpExtractionService.extractIcp({
      personProfile,
      personIdentifier: personIdentifier || undefined,
      accountId: params.accountId,
      apiToken: params.apiToken,
      workspaceMemberId: params.workspaceMemberId,
      workspaceId: params.workspaceId,
    });

    return {
      icp: extraction.icp,
      sells: params.sells ?? extraction.sells,
      chartFunction: params.chartFunction ?? extraction.chart_function,
      icpSource: 'extracted',
    };
  }

  private async fetchTargetContext(
    input: AuthParams & {
      targetIdentifier: string;
      postsLimit: number;
      recentPostDays: number;
      context: string;
    },
  ): Promise<TargetContext> {
    const fetched =
      await this.linkedinUnipileEstimateAccountService.withOutreachLinkedinSession(
        input.apiToken,
        input.accountId,
        async (session) => {
          this.logger.log(
            `${input.context} using LinkedIn Unipile accountId=${session.accountId}`,
          );

          const cleanupContext = {
            accountId: session.accountId,
            workspaceMemberId: input.workspaceMemberId,
            workspaceId: input.workspaceId,
            authToken: input.apiToken,
            context: input.context,
          };

          const targetProfile =
            await this.linkedinUnipileRequestService.fetchLinkedinUserProfile(
              session.accountId,
              input.targetIdentifier,
              { linkedinSections: ['*'], cleanupContext },
            );

          if (!targetProfile) {
            throw new BadRequestException(
              `Failed to fetch LinkedIn profile for "${input.targetIdentifier}"`,
            );
          }

          const providerId = extractTargetProviderId(
            targetProfile,
            input.targetIdentifier,
          );

          const postsPayload =
            await this.linkedinUnipileRequestService.fetchLinkedinUserPosts(
              session.accountId,
              providerId,
              { limit: input.postsLimit, cleanupContext },
            );

          return { targetProfile, providerId, postsPayload };
        },
      );

    const posts = summarizeLinkedinPosts(fetched.postsPayload, input.postsLimit);
    const postsWithinWindow = filterPostsWithinDays(posts, input.recentPostDays);
    const recentPost = pickMostRecentPost(postsWithinWindow);

    return {
      targetProfile: fetched.targetProfile,
      providerId: fetched.providerId,
      posts,
      postsWithinWindow,
      recentPost,
    };
  }

  /** Shared generation flow for the email and whatsapp channels. */
  private async composeChannelMessage(
    params: GenerateIcpChannelParams,
    messageType: Extract<IcpChannelMessageType, 'email' | 'whatsapp'>,
  ): Promise<{
    message: string;
    subject?: string;
    target: TargetContext;
    icpResolution: IcpResolution;
    contextUsed: GenerateIcpEmailResponse['contextUsed'];
  }> {
    const targetIdentifier = normalizeLinkedinIdentifier(
      params.targetIdentifier,
    );
    if (!targetIdentifier) {
      throw new BadRequestException('targetIdentifier is required');
    }

    const recentPostDays = params.recentPostDays ?? DEFAULT_RECENT_POST_DAYS;
    const postsLimit = params.postsLimit ?? 10;

    const target = await this.fetchTargetContext({
      targetIdentifier,
      postsLimit,
      recentPostDays,
      context: `ICP ${messageType} generation`,
      ...this.authParams(params),
    });

    const icpResolution = await this.resolveIcpContext(
      params,
      target.targetProfile,
    );

    const prompt = buildIcpOutreachMessagePrompt({
      icp: icpResolution.icp,
      sells: icpResolution.sells,
      chartFunction: icpResolution.chartFunction,
      targetName: this.readProfileName(target.targetProfile),
      targetHeadline:
        typeof target.targetProfile.headline === 'string'
          ? target.targetProfile.headline
          : undefined,
      recentPost: target.recentPost,
      rankedCandidates: params.rankedCandidates ?? [],
      messageType,
      tone: params.tone ?? 'professional',
      customInstructions: params.customInstructions,
    });

    const composed = await this.invokeMessageLlm(prompt, messageType);

    this.logger.log(
      `ICP ${messageType} generated target=${targetIdentifier} recentPostUsed=${Boolean(target.recentPost)} length=${composed.message.length}`,
    );

    return {
      message: composed.message,
      subject: composed.subject,
      target,
      icpResolution,
      contextUsed: {
        targetPublicIdentifier:
          typeof target.targetProfile.public_identifier === 'string'
            ? target.targetProfile.public_identifier
            : undefined,
        postsConsidered: target.posts.length,
        postsWithinWindow: target.postsWithinWindow.length,
        recentPostDays,
        rankedCandidatesCount: params.rankedCandidates?.length ?? 0,
        icpSource: icpResolution.icpSource,
      },
    };
  }

  private async executeLinkedinInvite(
    input: AuthParams & { providerId: string; message: string },
  ): Promise<IcpExecutionResult> {
    try {
      await this.linkedinUnipileEstimateAccountService.withOutreachLinkedinSession(
        input.apiToken,
        input.accountId,
        async (session) => {
          const cleanupContext = {
            accountId: session.accountId,
            workspaceMemberId: input.workspaceMemberId,
            workspaceId: input.workspaceId,
            authToken: input.apiToken,
            context: 'ICP connection request send',
          };
          return this.linkedinUnipileRequestService.sendLinkedinInvitation(
            session.accountId,
            input.providerId,
            input.message,
            { cleanupContext },
          );
        },
      );
      this.logger.log(
        `ICP connection request sent providerId=${input.providerId}`,
      );
      return { attempted: true, success: true };
    } catch (error) {
      this.logger.warn(
        `ICP connection request send failed providerId=${input.providerId}: ${error instanceof Error ? error.message : error}`,
      );
      return {
        attempted: true,
        success: false,
        error:
          error instanceof Error ? error.message : 'LinkedIn invitation failed',
      };
    }
  }

  private async executePostComment(
    input: AuthParams & { postId?: string; text?: string },
  ): Promise<GenerateIcpCommentResponse['execution']> {
    if (!input.postId) {
      return {
        attempted: false,
        success: false,
        error:
          'Post id unknown (comment was generated from raw text); use posts/comment with an explicit postId',
      };
    }
    if (!input.text) {
      return {
        attempted: false,
        success: false,
        error: 'No comment variant was generated to publish',
      };
    }
    try {
      const result = await this.sendPostComment({
        postId: input.postId,
        text: input.text,
        ...this.authParams(input),
      });
      return {
        attempted: true,
        success: result.success,
        commentText: input.text,
        postId: input.postId,
      };
    } catch (error) {
      return {
        attempted: true,
        success: false,
        error:
          error instanceof Error ? error.message : 'Post comment send failed',
        commentText: input.text,
        postId: input.postId,
      };
    }
  }

  private async executeEmailSend(input: {
    toEmail?: string;
    subject: string;
    message: string;
    apiToken: string;
    workspaceMemberId: string;
  }): Promise<IcpExecutionResult> {
    if (!input.toEmail) {
      return {
        attempted: false,
        success: false,
        error:
          'No email address found via contact enrichment; pass "email" explicitly',
      };
    }

    try {
      const senderProfile = await new RecruiterProfileService(
        this.staticGraphQLService,
      ).getRecruiterProfileByRecruiterId(
        input.workspaceMemberId,
        input.apiToken,
      );

      if (!senderProfile?.email) {
        return {
          attempted: false,
          success: false,
          error: 'Sender email not found for the workspace member',
        };
      }

      const sendEmailNameFrom =
        `${senderProfile.firstName ?? ''} ${senderProfile.lastName ?? ''}`.trim() ||
        senderProfile.name ||
        'Arxena';

      const sendResponse = await new SendEmailFunctionality().sendEmailFunction(
        {
          sendEmailFrom: senderProfile.email,
          sendEmailNameFrom,
          sendEmailTo: input.toEmail,
          subject: input.subject,
          message: input.message,
        },
        input.apiToken,
      );

      const sendError = (sendResponse as { error?: string } | undefined)?.error;
      this.logger.log(
        `ICP email send to=${input.toEmail} success=${!sendError && Boolean(sendResponse)}`,
      );
      return {
        attempted: true,
        success: !sendError && Boolean(sendResponse),
        ...(sendError ? { error: sendError } : {}),
      };
    } catch (error) {
      return {
        attempted: true,
        success: false,
        error: error instanceof Error ? error.message : 'Email send failed',
      };
    }
  }

  private async executeWhatsappSend(input: {
    toPhone?: string;
    message: string;
    apiToken: string;
  }): Promise<IcpExecutionResult> {
    if (!input.toPhone) {
      return {
        attempted: false,
        success: false,
        error:
          'No phone number found via contact enrichment; pass "phone" explicitly',
      };
    }

    const result = await this.whatsappMessaging().sendTextToPhoneForMember(
      input.apiToken,
      input.toPhone,
      input.message,
    );
    this.logger.log(
      `ICP whatsapp send to=${input.toPhone} status=${result.status}`,
    );
    return {
      attempted: true,
      success: result.status === 'success',
      ...(result.status !== 'success'
        ? { error: result.message ?? 'WhatsApp send failed' }
        : {}),
    };
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
      ? this.readProfileName(fetched.profile)
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
    messageType: IcpChannelMessageType,
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
        : messageType === 'email'
          ? EMAIL_MESSAGE_MAX_LENGTH
          : messageType === 'whatsapp'
            ? WHATSAPP_MESSAGE_MAX_LENGTH
            : DIRECT_MESSAGE_MAX_LENGTH;
    const message =
      parsed.message.length > maxLength
        ? parsed.message.slice(0, maxLength)
        : parsed.message;

    if (messageType === 'inmail' || messageType === 'email') {
      const subjectMaxLength =
        messageType === 'inmail'
          ? INMAIL_SUBJECT_MAX_LENGTH
          : EMAIL_SUBJECT_MAX_LENGTH;
      const subject = (parsed.subject ?? 'Org charts for your target accounts')
        .slice(0, subjectMaxLength)
        .trim();
      return { message: message.trim(), subject };
    }

    return { message: message.trim() };
  }
}
