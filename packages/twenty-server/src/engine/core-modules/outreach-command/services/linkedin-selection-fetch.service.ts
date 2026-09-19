import { Injectable, Logger } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';
import { FeatureFlagKey } from 'twenty-shared/types';
import { isDefined, normalizeOtherFields } from 'twenty-shared/utils';
import { In, type ObjectLiteral } from 'typeorm';

import { LinkedinUnipileRequestService } from 'src/engine/core-modules/arx-chat/services/linkedin-unipile-request.service';
import { FeatureFlagService } from 'src/engine/core-modules/feature-flag/services/feature-flag.service';
import { FetchLinkedinMessagesService } from 'src/engine/core-modules/outreach-command/services/fetch-linkedin-messages.service';
import { FetchLinkedinProfileService } from 'src/engine/core-modules/outreach-command/services/fetch-linkedin-profile.service';
import { extractLinkedinProfileId } from 'src/engine/core-modules/outreach-command/utils/extract-linkedin-profile-id.util';
import {
  normalizeLinkedinActivityPosts,
  pickMostRecentLinkedinActivityPost,
} from 'src/engine/core-modules/tool/tools/unipile-messaging-tool/utils/normalize-linkedin-activity.util';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';

type WorkspaceMemberArxRecord = ObjectLiteral & {
  id: string;
  linkedinUnipileAccountId: string | null;
};

type CandidateRecord = ObjectLiteral & {
  id: string;
  peopleId?: string | null;
  otherFields?: Record<string, unknown> | null;
};

type PersonIdentityRecord = ObjectLiteral & {
  id: string;
  linkedinLink?: { primaryLinkUrl?: string | null } | null;
  linkedinProfileId?: string | null;
  linkedinProfile?: Record<string, unknown> | null;
  linkedinPosts?: Record<string, unknown> | null;
};

export type LinkedinSelectionFetchInput = {
  workspaceMemberId: string;
  candidateIds?: string[];
  personIds?: string[];
  forceRefresh?: boolean;
  limit?: number;
  postsLimit?: number;
};

export type LinkedinSelectionFetchRecordResult = {
  candidateId: string;
  success: boolean;
  total?: number;
  error?: string;
};

@Injectable()
export class LinkedinSelectionFetchService {
  private readonly logger = new Logger(LinkedinSelectionFetchService.name);

  constructor(
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
    private readonly fetchLinkedinMessagesService: FetchLinkedinMessagesService,
    private readonly fetchLinkedinProfileService: FetchLinkedinProfileService,
    private readonly linkedinUnipileRequestService: LinkedinUnipileRequestService,
    private readonly featureFlagService: FeatureFlagService,
  ) {}

  async fetchMessages({
    workspaceId,
    input,
  }: {
    workspaceId: string;
    input: LinkedinSelectionFetchInput;
  }) {
    return this.runForCandidates({
      workspaceId,
      input,
      emptyError: 'No candidates found to fetch LinkedIn messages for',
      runOne: async (candidate) => {
        const person = await this.resolvePersonIdentity({
          workspaceId,
          peopleId: candidate.peopleId,
        });
        const result = await this.fetchLinkedinMessagesService.execute({
          workspaceId,
          input: {
            workspaceMemberId: input.workspaceMemberId,
            candidateId: candidate.id,
            linkedinUrl: person?.linkedinLink?.primaryLinkUrl ?? undefined,
            linkedinProfileId: person?.linkedinProfileId ?? undefined,
            forceRefresh: input.forceRefresh ?? true,
            limit: input.limit,
          },
        });

        if (!result.success) {
          return {
            candidateId: candidate.id,
            success: false,
            error: result.error || 'Failed to fetch LinkedIn messages',
          };
        }

        return {
          candidateId: candidate.id,
          success: true,
          total: result.total,
        };
      },
    });
  }

  async fetchPosts({
    workspaceId,
    input,
  }: {
    workspaceId: string;
    input: LinkedinSelectionFetchInput;
  }) {
    const accountId = await this.resolveUnipileAccountId({
      workspaceId,
      workspaceMemberId: input.workspaceMemberId,
    });

    if (!isNonEmptyString(accountId)) {
      return {
        success: false,
        results: [] as LinkedinSelectionFetchRecordResult[],
        error: 'No LinkedIn Unipile account on workspace member',
      };
    }

    // temporary: `&& false` forces real Unipile; send/connect stay mock-gated
    const isMockUnipileEnabled =
      (await this.featureFlagService.isFeatureEnabled(
        FeatureFlagKey.IS_OUTREACH_MOCK_UNIPILE_ENABLED,
        workspaceId,
      )) && false;

    const postsLimit = input.postsLimit ?? 20;

    return this.runForCandidates({
      workspaceId,
      input,
      emptyError: 'No candidates found to fetch LinkedIn posts for',
      runOne: async (candidate) => {
        const person = await this.resolvePersonIdentity({
          workspaceId,
          peopleId: candidate.peopleId,
        });
        const identifier =
          extractLinkedinProfileId(person?.linkedinProfileId) ||
          extractLinkedinProfileId(person?.linkedinLink?.primaryLinkUrl);

        if (!isNonEmptyString(identifier)) {
          return {
            candidateId: candidate.id,
            success: false,
            error: 'Candidate has no LinkedIn URL or profile id',
          };
        }

        let postsPayload: Record<string, unknown> | null = null;

        if (isMockUnipileEnabled) {
          postsPayload = {
            items: [
              {
                id: 'mock-post-1',
                social_id: 'urn:li:activity:mock-1',
                text: 'Mock LinkedIn post for outreach testing.',
                parsed_datetime: new Date().toISOString(),
                share_url:
                  'https://www.linkedin.com/feed/update/urn:li:activity:mock-1',
                is_repost: false,
              },
            ],
          };
        } else {
          postsPayload =
            await this.linkedinUnipileRequestService.fetchLinkedinUserPosts(
              accountId,
              identifier,
              { limit: postsLimit },
            );
        }

        if (!isDefined(postsPayload)) {
          return {
            candidateId: candidate.id,
            success: false,
            error: 'Unipile returned no posts',
          };
        }

        const posts = normalizeLinkedinActivityPosts(postsPayload, postsLimit);
        const mostRecentPost = pickMostRecentLinkedinActivityPost(posts);
        const linkedinPosts = {
          fetchedAt: new Date().toISOString(),
          posts,
          mostRecentPost,
        };

        await this.stampPersonLinkedinJson({
          workspaceId,
          peopleId: candidate.peopleId,
          candidateId: candidate.id,
          existingOtherFields: candidate.otherFields,
          linkedinPosts,
        });

        return {
          candidateId: candidate.id,
          success: true,
          total: posts.length,
        };
      },
    });
  }

  async fetchProfiles({
    workspaceId,
    input,
  }: {
    workspaceId: string;
    input: LinkedinSelectionFetchInput;
  }) {
    return this.runForCandidates({
      workspaceId,
      input,
      emptyError: 'No candidates found to fetch LinkedIn profiles for',
      runOne: async (candidate) => {
        const person = await this.resolvePersonIdentity({
          workspaceId,
          peopleId: candidate.peopleId,
        });
        const result = await this.fetchLinkedinProfileService.execute({
          workspaceId,
          input: {
            workspaceMemberId: input.workspaceMemberId,
            candidateId: candidate.id,
            linkedinUrl: person?.linkedinLink?.primaryLinkUrl ?? undefined,
            linkedinProfileId: person?.linkedinProfileId ?? undefined,
          },
        });

        if (!result.success) {
          return {
            candidateId: candidate.id,
            success: false,
            error: result.error || 'Failed to fetch LinkedIn profile',
          };
        }

        const { people: _people, ...profile } = result;
        const linkedinProfile = {
          ...profile,
          fetchedAt: new Date().toISOString(),
        };

        await this.stampPersonLinkedinJson({
          workspaceId,
          peopleId: candidate.peopleId,
          candidateId: candidate.id,
          existingOtherFields: candidate.otherFields,
          linkedinProfile,
        });

        return {
          candidateId: candidate.id,
          success: true,
        };
      },
    });
  }

  private async runForCandidates({
    workspaceId,
    input,
    emptyError,
    runOne,
  }: {
    workspaceId: string;
    input: LinkedinSelectionFetchInput;
    emptyError: string;
    runOne: (
      candidate: CandidateRecord,
    ) => Promise<LinkedinSelectionFetchRecordResult>;
  }): Promise<{
    success: boolean;
    results: LinkedinSelectionFetchRecordResult[];
    error?: string;
  }> {
    const candidates = await this.resolveCandidates({
      workspaceId,
      candidateIds: (input.candidateIds ?? []).filter(isNonEmptyString),
      personIds: (input.personIds ?? []).filter(isNonEmptyString),
    });

    if (candidates.length === 0) {
      return {
        success: false,
        results: [],
        error: emptyError,
      };
    }

    const results: LinkedinSelectionFetchRecordResult[] = [];

    for (const candidate of candidates) {
      try {
        results.push(await runOne(candidate));
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'LinkedIn fetch failed';

        this.logger.error(
          `LinkedIn selection fetch failed for candidate ${candidate.id}: ${message}`,
        );
        results.push({
          candidateId: candidate.id,
          success: false,
          error: message,
        });
      }
    }

    return {
      success: results.every((result) => result.success),
      results,
    };
  }

  private async resolveCandidates({
    workspaceId,
    candidateIds,
    personIds,
  }: {
    workspaceId: string;
    candidateIds: string[];
    personIds: string[];
  }): Promise<CandidateRecord[]> {
    if (candidateIds.length === 0 && personIds.length === 0) {
      return [];
    }

    const authContext = buildSystemAuthContext(workspaceId);

    return this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        const candidateRepository =
          await this.globalWorkspaceOrmManager.getRepository<CandidateRecord>(
            workspaceId,
            'candidate',
            { shouldBypassPermissionChecks: true },
          );

        if (candidateIds.length > 0) {
          return candidateRepository.find({
            where: { id: In(candidateIds) },
          });
        }

        return candidateRepository.find({
          where: { peopleId: In(personIds) },
        });
      },
      authContext,
    );
  }

  private async resolveUnipileAccountId({
    workspaceId,
    workspaceMemberId,
  }: {
    workspaceId: string;
    workspaceMemberId: string;
  }): Promise<string> {
    const authContext = buildSystemAuthContext(workspaceId);

    return this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        const memberRepository =
          await this.globalWorkspaceOrmManager.getRepository<WorkspaceMemberArxRecord>(
            workspaceId,
            'workspaceMember',
            { shouldBypassPermissionChecks: true },
          );

        if (isNonEmptyString(workspaceMemberId)) {
          const member = await memberRepository.findOne({
            where: { id: workspaceMemberId },
          });
          const accountId = member?.linkedinUnipileAccountId?.trim() ?? '';

          if (isNonEmptyString(accountId)) {
            return accountId;
          }
        }

        const members = await memberRepository.find({ where: {}, take: 20 });
        const withAccount = members.find((member) =>
          isNonEmptyString(member.linkedinUnipileAccountId),
        );

        return withAccount?.linkedinUnipileAccountId?.trim() ?? '';
      },
      authContext,
    );
  }

  private async resolvePersonIdentity({
    workspaceId,
    peopleId,
  }: {
    workspaceId: string;
    peopleId?: string | null;
  }): Promise<PersonIdentityRecord | null> {
    const trimmedPeopleId = peopleId?.trim() ?? '';

    if (!isNonEmptyString(trimmedPeopleId)) {
      return null;
    }

    const authContext = buildSystemAuthContext(workspaceId);

    return this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        const personRepository =
          await this.globalWorkspaceOrmManager.getRepository<PersonIdentityRecord>(
            workspaceId,
            'person',
            { shouldBypassPermissionChecks: true },
          );

        return personRepository.findOne({
          where: { id: trimmedPeopleId },
        });
      },
      authContext,
    );
  }

  // Persist LinkedIn JSON caches on Person; mirror into Candidate.otherFields
  // when present so older UI paths that still read otherFields keep working.
  private async stampPersonLinkedinJson({
    workspaceId,
    peopleId,
    candidateId,
    existingOtherFields,
    linkedinProfile,
    linkedinPosts,
  }: {
    workspaceId: string;
    peopleId?: string | null;
    candidateId: string;
    existingOtherFields?: Record<string, unknown> | null;
    linkedinProfile?: Record<string, unknown>;
    linkedinPosts?: Record<string, unknown>;
  }): Promise<void> {
    const trimmedPeopleId = peopleId?.trim() ?? '';

    if (!isNonEmptyString(trimmedPeopleId)) {
      return;
    }

    const authContext = buildSystemAuthContext(workspaceId);
    const otherFields = {
      ...normalizeOtherFields(existingOtherFields),
      ...(isDefined(linkedinProfile)
        ? { linkedin_profile: linkedinProfile }
        : {}),
      ...(isDefined(linkedinPosts) ? { linkedin_posts: linkedinPosts } : {}),
    };

    await this.globalWorkspaceOrmManager.executeInWorkspaceContext(async () => {
      const personRepository =
        await this.globalWorkspaceOrmManager.getRepository<PersonIdentityRecord>(
          workspaceId,
          'person',
          { shouldBypassPermissionChecks: true },
        );

      const personPatch: Partial<PersonIdentityRecord> = {};

      if (isDefined(linkedinProfile)) {
        personPatch.linkedinProfile = linkedinProfile;
      }

      if (isDefined(linkedinPosts)) {
        personPatch.linkedinPosts = linkedinPosts;
      }

      if (Object.keys(personPatch).length > 0) {
        await personRepository.update(trimmedPeopleId, personPatch);
      }

      // Keep Candidate.otherFields mirror for UI that still reads enrichment there
      const candidateRepository =
        await this.globalWorkspaceOrmManager.getRepository<CandidateRecord>(
          workspaceId,
          'candidate',
          { shouldBypassPermissionChecks: true },
        );

      await candidateRepository.update(candidateId, { otherFields });
    }, authContext);
  }
}
