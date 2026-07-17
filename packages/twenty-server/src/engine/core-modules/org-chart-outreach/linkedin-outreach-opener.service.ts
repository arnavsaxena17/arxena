import {
    BadRequestException,
    Injectable,
    Logger,
} from '@nestjs/common';

import { z } from 'zod';

import { LinkedinUnipileEstimateAccountMode } from 'src/engine/core-modules/arx-chat/enums/linkedin-unipile-estimate-account-mode.enum';
import { LinkedinUnipileEstimateAccountService } from 'src/engine/core-modules/arx-chat/services/linkedin-unipile-estimate-account.service';
import { LinkedinUnipileRequestService } from 'src/engine/core-modules/arx-chat/services/linkedin-unipile-request.service';
import { WorkspaceMemberProfileUnipileService } from 'src/engine/core-modules/arx-chat/services/workspace-member-profile-unipile.service';
import type { LinkedinSenderFullProfileResult } from 'src/engine/core-modules/arx-chat/types/linkedin-sender-profile-cache.types';
import { EnvironmentService } from 'src/engine/core-modules/environment/environment.service';
import { LLMChatModelService } from 'src/engine/core-modules/llm-chat-model/llm-chat-model.service';
import type {
    GenerateOutreachMessageParams,
    GenerateOutreachMessageResponse,
    OutreachCompanySelectionLlmResult,
    OutreachConnectionRequestLlmResult,
    OutreachDirectMessageLlmResult,
    OutreachInmailLlmResult,
    SuggestedOutreachCompany,
} from 'src/engine/core-modules/org-chart-outreach/org-chart-outreach.types';
import { buildOutreachCompanySelectionPrompt } from 'src/engine/core-modules/org-chart-outreach/prompts/outreach-company-selection.prompt';
import {
    buildOutreachMessageCompositionPrompt,
    CONNECTION_REQUEST_MAX_LENGTH,
    DIRECT_MESSAGE_MAX_LENGTH,
    INMAIL_SUBJECT_MAX_LENGTH,
} from 'src/engine/core-modules/org-chart-outreach/prompts/outreach-message-composition.prompt';
import { normalizeLinkedinIdentifier } from 'src/engine/core-modules/org-chart-outreach/utils/linkedin-identifier.util';
import {
    buildOutreachProfileContext,
    extractTargetProviderId,
} from 'src/engine/core-modules/org-chart-outreach/utils/linkedin-profile-context.util';
import {
    buildLinkedinCompanyUrl,
    buildOrgChartUrl,
    normalizeLlmJsonContent,
    pickBestCompanySearchMatch,
    resolveCompanySlugFromAutocompleteItem,
    sleepMs,
} from 'src/engine/core-modules/org-chart-outreach/utils/outreach-company-resolver.util';
import { OrgChartSuperImposeAutocompleteService } from 'src/engine/core-modules/org-chart/services/org-chart-super-impose-autocomplete.service';
import { hasWorkspaceMemberLinkedinFullProfile } from 'twenty-shared';

const companySelectionSchema = z.object({
  companies: z
    .array(
      z.object({
        name: z.string().min(1),
        rationale: z.string().min(1),
      }),
    )
    .min(1)
    .max(3),
  excludedReason: z.string().optional(),
});

const connectionRequestSchema = z.object({
  message: z.string().min(1),
});

const inmailSchema = z.object({
  subject: z.string().min(1),
  message: z.string().min(1),
});

const directMessageSchema = z.object({
  message: z.string().min(1),
});

@Injectable()
export class LinkedinOutreachOpenerService {
  private readonly logger = new Logger(LinkedinOutreachOpenerService.name);

  constructor(
    private readonly linkedinUnipileRequestService: LinkedinUnipileRequestService,
    private readonly linkedinUnipileEstimateAccountService: LinkedinUnipileEstimateAccountService,
    private readonly workspaceMemberProfileUnipileService: WorkspaceMemberProfileUnipileService,
    private readonly orgChartSuperImposeAutocompleteService: OrgChartSuperImposeAutocompleteService,
    private readonly llmChatModelService: LLMChatModelService,
    private readonly environmentService: EnvironmentService,
  ) {}

  async generateMessage(
    params: GenerateOutreachMessageParams,
  ): Promise<GenerateOutreachMessageResponse> {
    // Accepts a public identifier, provider id, or full LinkedIn profile URL.
    const targetIdentifier = normalizeLinkedinIdentifier(
      params.targetIdentifier,
    );
    if (!targetIdentifier) {
      throw new BadRequestException('targetIdentifier is required');
    }

    const includePosts = params.includePosts ?? true;
    const includeComments = params.includeComments ?? false;
    const includeOrgChartLinks = params.includeOrgChartLinks ?? false;
    const postsLimit = params.postsLimit ?? 10;
    const commentsLimit = params.commentsLimit ?? 10;
    const tone = params.tone ?? 'professional';

    const outreachAccountMode =
      this.linkedinUnipileEstimateAccountService.getOutreachAccountMode();
    const isSharedPoolAccount =
      this.linkedinUnipileEstimateAccountService.isSharedSalesNavigatorPoolMode(
        outreachAccountMode,
      );

    this.logger.log(
      `Outreach generate-message using LinkedIn Unipile account mode=${outreachAccountMode}`,
    );

    return this.linkedinUnipileEstimateAccountService.withOutreachLinkedinSession(
      params.apiToken,
      params.accountId,
      async (session) => {
        this.logger.log(
          `Outreach generate-message resolved LinkedIn Unipile accountId=${session.accountId}`,
        );

        const cleanupContext = {
          accountId: session.accountId,
          workspaceMemberId: params.workspaceMemberId,
          workspaceId: params.workspaceId,
          authToken: params.apiToken,
          context: 'LinkedIn outreach opener generation',
          ...(isSharedPoolAccount ? { isSharedPoolAccount: true as const } : {}),
        };

        const senderResult = await this.resolveSenderProfile({
          workspaceMemberId: params.workspaceMemberId,
          apiToken: params.apiToken,
          unipileAccountId: session.accountId,
          refreshSenderProfile: params.refreshSenderProfile === true,
          cleanupContext,
        });

        const targetProfile =
          await this.linkedinUnipileRequestService.fetchLinkedinUserProfile(
            session.accountId,
            targetIdentifier,
            {
              linkedinSections: ['*'],
              cleanupContext,
            },
          );

        if (!targetProfile) {
          throw new BadRequestException(
            'Failed to fetch target LinkedIn profile',
          );
        }

        const targetProviderId = extractTargetProviderId(
          targetProfile,
          targetIdentifier,
        );

        let postsPayload: Record<string, unknown> | null = null;
        let commentsPayload: Record<string, unknown> | null = null;

        if (includePosts) {
          await sleepMs(2000);
          postsPayload =
            await this.linkedinUnipileRequestService.fetchLinkedinUserPosts(
              session.accountId,
              targetProviderId,
              { limit: postsLimit, cleanupContext },
            );
        }

        if (includeComments) {
          await sleepMs(2000);
          commentsPayload =
            await this.linkedinUnipileRequestService.fetchLinkedinUserComments(
              session.accountId,
              targetProviderId,
              { limit: commentsLimit, cleanupContext },
            );
        }

        const profileContext = buildOutreachProfileContext({
          senderProfile: senderResult.entry.fullProfile,
          targetProfile,
          postsPayload,
          commentsPayload,
          postsLimit,
          commentsLimit,
        });

        const companySelection = await this.selectCompaniesWithLlm(
          profileContext,
        );

        const suggestedCompanies = await this.resolveSuggestedCompanies({
          apiToken: params.apiToken,
          companies: companySelection.companies,
          includeOrgChartLinks,
        });

        const composedMessage = await this.composeMessageWithLlm({
          profileContext,
          suggestedCompanies,
          messageType: params.messageType,
          includeOrgChartLinks,
          tone,
          customInstructions: params.customInstructions,
        });

        const postsCount = profileContext.posts.length;
        const commentsCount = profileContext.comments.length;

        const response: GenerateOutreachMessageResponse = {
          messageType: params.messageType,
          message: composedMessage.message,
          suggestedCompanies,
          contextUsed: {
            senderPublicIdentifier: senderResult.entry.publicIdentifier,
            targetPublicIdentifier: profileContext.target.publicIdentifier,
            senderProfileFromCache: senderResult.fromCache,
            postsCount,
            commentsCount,
          },
        };

        if (params.messageType === 'connection_request') {
          response.connectionNote = composedMessage.message;
        }

        if (params.messageType === 'inmail' && composedMessage.subject) {
          response.subject = composedMessage.subject;
        }

        return response;
      },
    );
  }

  private usesCachedMemberSenderProfile(): boolean {
    return (
      this.linkedinUnipileEstimateAccountService.getOutreachAccountMode() !==
      LinkedinUnipileEstimateAccountMode.Session
    );
  }

  private async resolveSenderProfile(args: {
    workspaceMemberId: string;
    apiToken: string;
    unipileAccountId: string;
    refreshSenderProfile: boolean;
    cleanupContext: {
      accountId: string;
      workspaceMemberId: string;
      workspaceId: string;
      authToken: string;
      context: string;
    };
  }): Promise<LinkedinSenderFullProfileResult> {
    if (this.usesCachedMemberSenderProfile()) {
      if (args.refreshSenderProfile) {
        throw new BadRequestException(
          'Refreshing the sender LinkedIn profile requires LINKEDIN_UNIPILE_OUTREACH_ACCOUNT_MODE=session',
        );
      }

      const stored =
        await this.workspaceMemberProfileUnipileService.getWorkspaceMemberLinkedinProfile(
          args.workspaceMemberId,
          args.apiToken,
        );

      if (stored && hasWorkspaceMemberLinkedinFullProfile(stored)) {
        this.logger.log(
          `Outreach sender profile loaded from workspace member profile (shared pool mode) workspaceMemberId=${args.workspaceMemberId}`,
        );

        return {
          fromCache: true,
          entry: {
            me: stored.me,
            fullProfile: stored.fullProfile,
            publicIdentifier: stored.publicIdentifier.trim(),
            fetchedAt: stored.fetchedAt ?? new Date().toISOString(),
            linkedinUnipileAccountId: stored.linkedinUnipileAccountId,
          },
        };
      }

      throw new BadRequestException(
        'Sender LinkedIn profile is not cached on your workspace member profile. Sync LinkedIn from the Chrome extension before generating outreach messages.',
      );
    }

    const senderResult =
      await this.linkedinUnipileRequestService.fetchLinkedinSenderFullProfile(
        args.unipileAccountId,
        {
          cleanupContext: args.cleanupContext,
          refresh: args.refreshSenderProfile,
        },
      );

    if (!senderResult) {
      throw new BadRequestException('Failed to fetch sender LinkedIn profile');
    }

    return senderResult;
  }

  private async selectCompaniesWithLlm(
    profileContext: ReturnType<typeof buildOutreachProfileContext>,
  ): Promise<OutreachCompanySelectionLlmResult> {
    const model = this.llmChatModelService.getJSONChatModel();
    const prompt = buildOutreachCompanySelectionPrompt(profileContext);
    const response = await model.invoke(prompt);
    const rawContent = normalizeLlmJsonContent(response);

    if (!rawContent) {
      throw new BadRequestException('LLM returned empty company selection');
    }

    const parsed = companySelectionSchema.parse(
      JSON.parse(rawContent) as OutreachCompanySelectionLlmResult,
    );

    this.logger.log(
      `Outreach company selection: ${parsed.companies.map((c) => c.name).join(', ')}`,
    );

    return parsed;
  }

  private async resolveSuggestedCompanies(args: {
    apiToken: string;
    companies: Array<{ name: string; rationale: string }>;
    includeOrgChartLinks: boolean;
  }): Promise<SuggestedOutreachCompany[]> {
    const frontendUrl =
      this.environmentService.get('FRONTEND_URL') ?? 'http://localhost:3001';

    const resolved: SuggestedOutreachCompany[] = [];

    for (const company of args.companies) {
      const searchResults =
        await this.orgChartSuperImposeAutocompleteService.searchCompanies({
          apiToken: args.apiToken,
          keywords: company.name,
          limit: 5,
        });

      const bestMatch = pickBestCompanySearchMatch(company.name, searchResults);
      const slug = bestMatch
        ? resolveCompanySlugFromAutocompleteItem(bestMatch)
        : undefined;

      if (!bestMatch || !slug) {
        this.logger.warn(
          `Could not resolve LinkedIn slug for company "${company.name}"`,
        );
        resolved.push({
          name: company.name,
          rationale: company.rationale,
        });
        continue;
      }

      resolved.push({
        name: company.name,
        rationale: company.rationale,
        linkedinSlug: slug,
        linkedinCompanyUrl: buildLinkedinCompanyUrl(slug),
        orgChartUrl: args.includeOrgChartLinks
          ? buildOrgChartUrl(frontendUrl, slug)
          : undefined,
        parameterId: bestMatch.id,
      });
    }

    return resolved;
  }

  private async composeMessageWithLlm(input: {
    profileContext: ReturnType<typeof buildOutreachProfileContext>;
    suggestedCompanies: SuggestedOutreachCompany[];
    messageType: GenerateOutreachMessageParams['messageType'];
    includeOrgChartLinks: boolean;
    tone: GenerateOutreachMessageParams['tone'];
    customInstructions?: string;
  }): Promise<{ message: string; subject?: string }> {
    const model = this.llmChatModelService.getJSONChatModel();
    const prompt = buildOutreachMessageCompositionPrompt({
      context: input.profileContext,
      companies: input.suggestedCompanies,
      messageType: input.messageType,
      includeOrgChartLinks: input.includeOrgChartLinks,
      tone: input.tone ?? 'professional',
      customInstructions: input.customInstructions,
    });

    let response = await model.invoke(prompt);
    let rawContent = normalizeLlmJsonContent(response);

    if (!rawContent) {
      throw new BadRequestException('LLM returned empty outreach message');
    }

    if (input.messageType === 'connection_request') {
      let parsed = connectionRequestSchema.parse(
        JSON.parse(rawContent) as OutreachConnectionRequestLlmResult,
      );

      if (parsed.message.length > CONNECTION_REQUEST_MAX_LENGTH) {
        this.logger.warn(
          `Connection request exceeded ${CONNECTION_REQUEST_MAX_LENGTH} chars, re-prompting`,
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
        parsed = connectionRequestSchema.parse(
          JSON.parse(rawContent) as OutreachConnectionRequestLlmResult,
        );
      }

      if (parsed.message.length > CONNECTION_REQUEST_MAX_LENGTH) {
        parsed.message = parsed.message.slice(0, CONNECTION_REQUEST_MAX_LENGTH);
      }

      return { message: parsed.message.trim() };
    }

    if (input.messageType === 'inmail') {
      const parsed = inmailSchema.parse(
        JSON.parse(rawContent) as OutreachInmailLlmResult,
      );
      const subject =
        parsed.subject.length > INMAIL_SUBJECT_MAX_LENGTH
          ? parsed.subject.slice(0, INMAIL_SUBJECT_MAX_LENGTH)
          : parsed.subject;

      return {
        subject: subject.trim(),
        message: parsed.message.trim(),
      };
    }

    const parsed = directMessageSchema.parse(
      JSON.parse(rawContent) as OutreachDirectMessageLlmResult,
    );
    const message =
      parsed.message.length > DIRECT_MESSAGE_MAX_LENGTH
        ? parsed.message.slice(0, DIRECT_MESSAGE_MAX_LENGTH)
        : parsed.message;

    return { message: message.trim() };
  }
}
