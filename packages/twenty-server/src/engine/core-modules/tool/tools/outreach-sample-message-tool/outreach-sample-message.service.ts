import { Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';

import { isNonEmptyString } from '@sniptt/guards';
import { resolveOutreachConfigPersonaGuidance } from 'twenty-shared/arx';
import { isDefined, isValidUuid } from 'twenty-shared/utils';
import { type FindOptionsWhere, type ObjectLiteral } from 'typeorm';

import { OrgChartCompanyNewsService } from 'src/engine/core-modules/org-chart/services/org-chart-company-news.service';
import { filterRecentCompanyNewsItems } from 'src/engine/core-modules/org-chart/utils/filter-recent-company-news-items.util';
import {
  buildOutreachFirstMessagePrompt,
  validateOutreachOpenerMessage,
} from 'src/engine/core-modules/outreach-command/prompts/outreach.prompts';
import { FetchLinkedinMessagesService } from 'src/engine/core-modules/outreach-command/services/fetch-linkedin-messages.service';
import { FetchLinkedinProfileService } from 'src/engine/core-modules/outreach-command/services/fetch-linkedin-profile.service';
import { OutreachSenderProfileService } from 'src/engine/core-modules/outreach-command/services/outreach-sender-profile.service';
import {
  type OutreachSampleMessageDraft,
  type OutreachSampleMessageDrafter,
  type OutreachSampleMessageInclude,
  type OutreachSampleMessageProspect,
} from 'src/engine/core-modules/outreach-command/types/outreach-sample-message.types';
import {
  buildFindRecordsLlmText,
  formatOutreachProspectPostsForLlm,
  formatOutreachProspectProfileForLlm,
  formatOutreachTranscriptForLlm,
  rewriteOutreachResolvedPromptSections,
} from 'src/engine/core-modules/outreach-command/utils/format-outreach-llm-context.util';
import {
  pickOutreachOpenerShape,
  pickOutreachOpenerVariant,
} from 'src/engine/core-modules/outreach-command/utils/outreach-opener-assignment.util';
import { UsageOperationType } from 'src/engine/core-modules/usage/enums/usage-operation-type.enum';
import { AgentAsyncExecutorService } from 'src/engine/metadata-modules/ai/ai-agent-execution/services/agent-async-executor.service';
import { AgentEntity } from 'src/engine/metadata-modules/ai/ai-agent/entities/agent.entity';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';
import { InjectWorkspaceScopedRepository } from 'src/engine/twenty-orm/workspace-scoped-repository/inject-workspace-scoped-repository.decorator';
import { WorkspaceScopedRepository } from 'src/engine/twenty-orm/workspace-scoped-repository/workspace-scoped-repository';
import { getOutreachAgentIds } from 'src/engine/workspace-manager/standard-objects-prefill-data/utils/prefill-outreach-workflows.util';

const NEWS_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const NEWS_ITEMS_IN_PROMPT = 3;

const DEFAULT_INCLUDE: Required<OutreachSampleMessageInclude> = {
  senderProfile: true,
  prospectEnrichment: true,
  profile: true,
  posts: true,
  chatHistory: true,
  companyNews: true,
};

type RecordWithId = ObjectLiteral & { id: string };

type CandidateRecord = RecordWithId & {
  peopleId?: string | null;
  outreachWorkspaceMemberId?: string | null;
  outreachProspectEnrichment?: unknown;
  projectId?: string | null;
};

type ProjectRecord = RecordWithId & {
  outreachConfig?: unknown;
};

type PersonRecord = RecordWithId & {
  linkedinLink?: { primaryLinkUrl?: string } | null;
  linkedinProfileId?: string | null;
  linkedinPosts?: { posts?: unknown[] } | null;
  jobCompanyName?: string | null;
};

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

// Drafts a sample of the seeded opener ("Draft first LinkedIn message") for
// one prospect. Enrolled candidates get the full context; Find-list rows have
// no candidate, so only what the row itself carries is available.
@Injectable()
export class OutreachSampleMessageService implements OutreachSampleMessageDrafter {
  private readonly logger = new Logger(OutreachSampleMessageService.name);

  constructor(
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
    private readonly fetchLinkedinProfileService: FetchLinkedinProfileService,
    private readonly fetchLinkedinMessagesService: FetchLinkedinMessagesService,
    private readonly orgChartCompanyNewsService: OrgChartCompanyNewsService,
    private readonly outreachSenderProfileService: OutreachSenderProfileService,
    // AgentAsyncExecutorService sits behind ToolProviderModule → ToolModule (cycle).
    private readonly moduleRef: ModuleRef,
    @InjectWorkspaceScopedRepository(AgentEntity)
    private readonly agentRepository: WorkspaceScopedRepository<AgentEntity>,
  ) {}

  async draftForProspect({
    workspaceId,
    prospect,
    include: requestedInclude,
  }: {
    workspaceId: string;
    prospect: OutreachSampleMessageProspect;
    include?: OutreachSampleMessageInclude;
  }): Promise<OutreachSampleMessageDraft> {
    const include = { ...DEFAULT_INCLUDE, ...(requestedInclude ?? {}) };
    const warnings: string[] = [];
    const { candidate, person, member, project } = await this.loadRecords({
      workspaceId,
      candidateId: prospect.candidateId,
      needsMember: include.senderProfile,
    });
    const linkedinUrl =
      person?.linkedinLink?.primaryLinkUrl ?? prospect.linkedinUrl;
    const fetchInput = {
      candidateId: candidate?.id,
      workspaceMemberId: member?.id,
      linkedinUrl,
      linkedinProfileId: person?.linkedinProfileId ?? undefined,
    };

    const senderJson = include.senderProfile
      ? await this.resolveSenderText({ workspaceId, member })
      : '';

    if (include.senderProfile && !isNonEmptyString(senderJson)) {
      warnings.push('No sender profile is set up, so it was left out.');
    }

    const enrichment = include.prospectEnrichment
      ? candidate?.outreachProspectEnrichment
      : undefined;
    const hasEnrichment =
      isDefined(enrichment) &&
      typeof enrichment === 'object' &&
      Object.keys(enrichment).length > 0;

    const prospectProfileText =
      include.profile && isNonEmptyString(linkedinUrl)
        ? await this.fetchProfileText({ workspaceId, fetchInput, warnings })
        : undefined;

    const posts = include.posts ? (person?.linkedinPosts?.posts ?? []) : [];
    const prospectPostsText =
      posts.length > 0 ? formatOutreachProspectPostsForLlm(posts) : undefined;

    const chatHistory =
      include.chatHistory && isDefined(candidate)
        ? await this.fetchChatHistoryText({
            workspaceId,
            fetchInput,
            warnings,
          })
        : undefined;

    const companyNews = include.companyNews
      ? await this.resolveCompanyNewsText({
          workspaceId,
          companyNameCandidates: [
            prospect.companyName,
            person?.jobCompanyName,
            (enrichment as { companyName?: unknown } | undefined)?.companyName,
          ],
          warnings,
        })
      : undefined;

    const openerSeed =
      prospect.candidateId?.trim() ||
      prospect.linkedinUrl?.trim() ||
      prospect.name;
    const variant = pickOutreachOpenerVariant(openerSeed);
    const shape = pickOutreachOpenerShape(openerSeed);
    // Same project text the seeded sequencer reads; Find-list rows have none.
    const personaGuidance = resolveOutreachConfigPersonaGuidance(
      project?.outreachConfig,
    );
    const prospectEnrichmentJson = hasEnrichment
      ? JSON.stringify(enrichment)
      : this.buildRowSummary(prospect);
    const buildPrompt = (retryFeedback?: string) =>
      rewriteOutreachResolvedPromptSections(
        buildOutreachFirstMessagePrompt({
          senderJson,
          prospectEnrichmentJson,
          prospectProfileText,
          prospectPostsText,
          chatHistory,
          // Only pass the news section when the flag is on, so the prompt stays
          // identical to the seeded opener otherwise.
          companyNews: include.companyNews ? (companyNews ?? '') : undefined,
          personaGuidance,
          openerSeed,
          variant,
          shape,
          retryFeedback,
          kind: 'opener',
        }),
      );

    let prompt = buildPrompt();
    let draft = await this.runLinkedinAgent({ workspaceId, prompt });
    let message = draft.message;
    let tier = draft.tier;
    let hookUsed = draft.hookUsed;
    // Persona guidance may set its own ask, so the A/B ask check is skipped.
    const validationOptions = {
      checkAskVariant: !isNonEmptyString(personaGuidance),
    };
    let validation = validateOutreachOpenerMessage(
      message,
      variant,
      validationOptions,
    );

    // Two retries with the failed checks fed back into the prompt, then hold.
    for (
      let retryIndex = 0;
      retryIndex < 2 && !validation.ok;
      retryIndex += 1
    ) {
      prompt = buildPrompt(validation.problems.join('; '));
      draft = await this.runLinkedinAgent({ workspaceId, prompt });
      message = draft.message;
      tier = draft.tier ?? tier;
      hookUsed = draft.hookUsed ?? hookUsed;
      validation = validateOutreachOpenerMessage(
        message,
        variant,
        validationOptions,
      );
    }

    if (!isNonEmptyString(message.trim()) || !validation.ok) {
      return {
        message: '',
        warnings: [
          ...warnings,
          !isNonEmptyString(message.trim())
            ? 'No message: opener agent returned an empty body.'
            : `Opener held for review: ${validation.problems.join('; ')}`,
        ],
        openerVariant: variant,
        openerShape: shape,
      };
    }

    return {
      message,
      warnings,
      openerVariant: variant,
      openerShape: shape,
      ...(isDefined(tier) ? { tier } : {}),
      ...(isDefined(hookUsed) ? { hookUsed } : {}),
    };
  }

  // Find-list rows carry no Qualify enrichment, so the row's own fields stand
  // in for it when a citeable profile/posts/news context is also present.
  private buildRowSummary(prospect: OutreachSampleMessageProspect): string {
    return JSON.stringify({
      name: prospect.name,
      ...(isNonEmptyString(prospect.title) ? { title: prospect.title } : {}),
      ...(isNonEmptyString(prospect.companyName)
        ? { company: prospect.companyName }
        : {}),
    });
  }

  private async loadRecords({
    workspaceId,
    candidateId,
    needsMember,
  }: {
    workspaceId: string;
    candidateId?: string;
    needsMember: boolean;
  }): Promise<{
    candidate: CandidateRecord | null;
    person: PersonRecord | null;
    member: RecordWithId | null;
    project: ProjectRecord | null;
  }> {
    if (!isNonEmptyString(candidateId)) {
      return { candidate: null, person: null, member: null, project: null };
    }

    if (!isValidUuid(candidateId)) {
      throw new Error('candidateId must be a valid UUID');
    }

    return this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        const findOne = async <TRecord extends RecordWithId>(
          objectName: string,
          id: string,
        ): Promise<TRecord | null> => {
          const repository =
            await this.globalWorkspaceOrmManager.getRepository<TRecord>(
              workspaceId,
              objectName,
              { shouldBypassPermissionChecks: true },
            );

          return (
            (
              await repository.find({
                where: { id } as FindOptionsWhere<TRecord>,
                take: 1,
              })
            )[0] ?? null
          );
        };

        // CRM tab rows are keyed by candidate id; a miss means the
        // row is not enrolled, which is fine.
        const candidate = await findOne<CandidateRecord>(
          'candidate',
          candidateId,
        );

        if (!isDefined(candidate)) {
          return { candidate: null, person: null, member: null, project: null };
        }

        const peopleId = candidate.peopleId?.trim() ?? '';
        const memberId = candidate.outreachWorkspaceMemberId?.trim() ?? '';
        const projectId = candidate.projectId?.trim() ?? '';

        return {
          candidate,
          person: isNonEmptyString(peopleId)
            ? await findOne<PersonRecord>('person', peopleId)
            : null,
          member:
            needsMember && isNonEmptyString(memberId)
              ? await findOne<RecordWithId>('workspaceMember', memberId)
              : null,
          project: isNonEmptyString(projectId)
            ? await findOne<ProjectRecord>('project', projectId)
            : null,
        };
      },
      buildSystemAuthContext(workspaceId),
    );
  }

  // The live opener dumps the assigned member record. Rows without an
  // assigned member fall back to the workspace operator's sender profile.
  private async resolveSenderText({
    workspaceId,
    member,
  }: {
    workspaceId: string;
    member: RecordWithId | null;
  }): Promise<string> {
    if (isDefined(member)) {
      return buildFindRecordsLlmText([member]);
    }

    const profile =
      await this.outreachSenderProfileService.resolveOperatorSenderProfile({
        workspaceId,
      });

    return isDefined(profile) ? JSON.stringify(profile) : '';
  }

  private async fetchProfileText({
    workspaceId,
    fetchInput,
    warnings,
  }: {
    workspaceId: string;
    fetchInput: Parameters<FetchLinkedinProfileService['execute']>[0]['input'];
    warnings: string[];
  }): Promise<string | undefined> {
    try {
      const result = await this.fetchLinkedinProfileService.execute({
        workspaceId,
        input: fetchInput,
      });

      if (!result.success) {
        warnings.push(
          `LinkedIn profile fetch failed: ${result.error ?? 'unknown error'}`,
        );

        return undefined;
      }

      return formatOutreachProspectProfileForLlm(result) || undefined;
    } catch (error) {
      warnings.push(`LinkedIn profile fetch failed: ${errorMessage(error)}`);

      return undefined;
    }
  }

  private async fetchChatHistoryText({
    workspaceId,
    fetchInput,
    warnings,
  }: {
    workspaceId: string;
    fetchInput: Parameters<FetchLinkedinMessagesService['execute']>[0]['input'];
    warnings: string[];
  }): Promise<string | undefined> {
    try {
      const result = await this.fetchLinkedinMessagesService.execute({
        workspaceId,
        input: fetchInput,
      });

      if (!result.success) {
        warnings.push(
          `LinkedIn chat history fetch failed: ${result.error ?? 'unknown error'}`,
        );

        return undefined;
      }

      return formatOutreachTranscriptForLlm(result) || undefined;
    } catch (error) {
      warnings.push(
        `LinkedIn chat history fetch failed: ${errorMessage(error)}`,
      );

      return undefined;
    }
  }

  // News is best effort: a failed lookup never blocks the draft.
  private async resolveCompanyNewsText({
    workspaceId,
    companyNameCandidates,
    warnings,
  }: {
    workspaceId: string;
    companyNameCandidates: unknown[];
    warnings: string[];
  }): Promise<string | undefined> {
    const companyName = companyNameCandidates.find((value): value is string =>
      isNonEmptyString(value),
    );

    if (!isNonEmptyString(companyName)) {
      warnings.push('No company name on the row, so company news was skipped.');

      return undefined;
    }

    // Own key space: org-chart news is keyed by org-chart company id.
    const storageKey = `outreach-sample-${workspaceId}-${slugify(companyName)}`;

    try {
      let storage =
        await this.orgChartCompanyNewsService.getStoredCompanyNews(storageKey);
      const isFresh =
        isDefined(storage) &&
        Date.now() - Date.parse(storage.updatedAt) < NEWS_MAX_AGE_MS;

      if (!isFresh) {
        storage =
          await this.orgChartCompanyNewsService.fetchAndStoreCompanyNews({
            companyId: storageKey,
            companyName,
            workspaceId,
          });
      }

      // Drop stale / undated items so the opener never cites old coverage.
      const items = filterRecentCompanyNewsItems(
        this.orgChartCompanyNewsService.mergeNewsItemsFromStorage(storage),
      ).slice(0, NEWS_ITEMS_IN_PROMPT);

      if (items.length === 0) {
        warnings.push(`No recent news found for ${companyName}.`);

        return undefined;
      }

      return [
        `Company: ${companyName}`,
        'Only use the recent items below. Do not refer to older company news.',
        ...items.map((item) => `- (${item.date}) ${item.summary}`),
      ].join('\n');
    } catch (error) {
      warnings.push(`Company news lookup failed: ${errorMessage(error)}`);

      return undefined;
    }
  }

  private async runLinkedinAgent({
    workspaceId,
    prompt,
  }: {
    workspaceId: string;
    prompt: string;
  }): Promise<{
    message: string;
    tier?: number;
    hookUsed?: string;
  }> {
    const agent = await this.agentRepository.findOne(workspaceId, {
      where: { id: getOutreachAgentIds(workspaceId).linkedinMessage },
    });

    if (!isDefined(agent)) {
      throw new Error(
        'The seeded LinkedIn message agent was not found for this workspace.',
      );
    }

    const agentExecutor = this.moduleRef.get(AgentAsyncExecutorService, {
      strict: false,
    });
    const executionResult = await agentExecutor.executeAgent({
      agent,
      userPrompt: prompt,
      authContext: buildSystemAuthContext(workspaceId),
      workspaceId,
      userWorkspaceId: null,
      operationType: UsageOperationType.AI_WORKFLOW_TOKEN,
    });

    if (executionResult.hasNoMoreAvailableCredits) {
      throw new Error('credit_balance_exhausted: AI agent stopped.');
    }

    const result = executionResult.result as {
      message?: unknown;
      tier?: unknown;
      hook_used?: unknown;
    } | null;
    const message = result?.message;

    if (!isNonEmptyString(message)) {
      this.logger.warn(
        `Sample LinkedIn opener returned no message: ${JSON.stringify(executionResult.result)}`,
      );

      throw new Error('The agent returned no message.');
    }

    return {
      message,
      ...(typeof result?.tier === 'number' ? { tier: result.tier } : {}),
      ...(typeof result?.hook_used === 'string'
        ? { hookUsed: result.hook_used }
        : {}),
    };
  }
}
