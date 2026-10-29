import { Injectable, Logger, Optional } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';
import { isDefined } from 'twenty-shared/utils';

import { isAccountRateLimitDeferredError } from 'src/engine/core-modules/account-rate-limit/account-rate-limit-deferred.error';
import { LinkedinUnipileRequestService } from 'src/engine/core-modules/arx-chat/services/linkedin-unipile-request.service';
import { LINKEDIN_VIEWER_FACTS_CACHE_PREFIX } from 'src/engine/core-modules/cache-storage/constants/linkedin-provider-query-cache.const';
import { ProviderQueryCacheService } from 'src/engine/core-modules/cache-storage/services/provider-query-cache.service';
import { extractLinkedinProfileId } from 'src/engine/core-modules/outreach-command/utils/extract-linkedin-profile-id.util';
import {
  extractWarmProfileFacts,
  extractWarmViewerFacts,
  pickWarmWinner,
  scoreWarmOverlap,
  type WarmMemberScore,
  type WarmProfileFacts,
  type WarmViewerFacts,
} from 'src/engine/core-modules/outreach-command/utils/outreach-warm-overlap.util';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';

type CachedViewerFacts = WarmViewerFacts & { profile: WarmProfileFacts };

export type WarmOverlapResult = {
  winnerMemberId: string | null;
  scores: WarmMemberScore[];
};

@Injectable()
export class OutreachWarmOverlapService {
  private readonly logger = new Logger(OutreachWarmOverlapService.name);

  constructor(
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
    private readonly linkedinUnipileRequestService: LinkedinUnipileRequestService,
    @Optional()
    private readonly providerQueryCache?: ProviderQueryCacheService,
  ) {}

  // One profile fetch per seat, serialized, never the people search. A seat
  // with no account of its own is skipped: the profile fetch fallback would
  // attribute another seat's mutual count to it.
  async scoreCandidate({
    workspaceId,
    candidateId,
    memberIds,
    tieBreakLoad,
    recruiterId,
  }: {
    workspaceId: string;
    candidateId: string;
    memberIds: string[];
    tieBreakLoad: Record<string, number>;
    recruiterId: string | null;
  }): Promise<WarmOverlapResult | null> {
    const authContext = buildSystemAuthContext(workspaceId);
    const context =
      await this.globalWorkspaceOrmManager.executeInWorkspaceContext(
        async () => {
          const candidateRepository =
            await this.globalWorkspaceOrmManager.getRepository<{
              id: string;
              peopleId?: string | null;
            }>(workspaceId, 'candidate', {
              shouldBypassPermissionChecks: true,
            });
          const candidate = await candidateRepository.findOne({
            where: { id: candidateId },
          });
          const personRepository =
            await this.globalWorkspaceOrmManager.getRepository<{
              id: string;
              linkedinProfileId?: string | null;
              linkedinLink?: { primaryLinkUrl?: string | null } | null;
            }>(workspaceId, 'person', { shouldBypassPermissionChecks: true });
          const person = isNonEmptyString(candidate?.peopleId)
            ? await personRepository.findOne({
                where: { id: candidate.peopleId },
              })
            : null;
          const identifier =
            extractLinkedinProfileId(person?.linkedinProfileId) ||
            extractLinkedinProfileId(person?.linkedinLink?.primaryLinkUrl);
          const memberRepository =
            await this.globalWorkspaceOrmManager.getRepository<{
              id: string;
              linkedinUnipileAccountId?: string | null;
              linkedinProfile?: Record<string, unknown> | null;
            }>(workspaceId, 'workspaceMember', {
              shouldBypassPermissionChecks: true,
            });
          const members = (await memberRepository.find({})).filter((member) =>
            memberIds.includes(member.id),
          );

          return { identifier, members };
        },
        authContext,
      );

    if (!isNonEmptyString(context.identifier)) {
      return null;
    }

    const scores: WarmMemberScore[] = [];
    let prospectFacts: WarmProfileFacts | null = null;
    const viewerByMember = new Map<string, CachedViewerFacts>();

    for (const member of [...context.members].sort((a, b) =>
      a.id.localeCompare(b.id),
    )) {
      const accountId = member.linkedinUnipileAccountId?.trim() ?? '';

      if (!isNonEmptyString(accountId)) {
        scores.push({
          memberId: member.id,
          score: 0,
          reasons: [],
          error: 'no_linkedin_account',
        });
        continue;
      }

      try {
        const facts = await this.readViewerFacts({
          accountId,
          identifier: context.identifier,
        });

        viewerByMember.set(member.id, facts);
        prospectFacts = prospectFacts ?? facts.profile;
      } catch (error) {
        scores.push({
          memberId: member.id,
          score: 0,
          reasons: [],
          error: isAccountRateLimitDeferredError(error)
            ? 'rate_limited'
            : 'profile_fetch_failed',
        });
        this.logger.warn(
          `Warm overlap fetch failed for member ${member.id}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    for (const member of context.members) {
      const viewer = viewerByMember.get(member.id);

      if (!isDefined(viewer)) {
        continue;
      }

      scores.push(
        scoreWarmOverlap({
          memberId: member.id,
          viewerFacts: viewer,
          memberFacts: extractWarmProfileFacts(member.linkedinProfile),
          prospectFacts: prospectFacts ?? viewer.profile,
        }),
      );
    }

    return {
      winnerMemberId: pickWarmWinner({
        scores,
        loadByMemberId: tieBreakLoad,
        recruiterId,
      }),
      scores,
    };
  }

  private async readViewerFacts({
    accountId,
    identifier,
  }: {
    accountId: string;
    identifier: string;
  }): Promise<CachedViewerFacts> {
    const cacheParts = {
      accountId: accountId.trim(),
      publicIdentifier: identifier.trim().toLowerCase(),
    };
    const cached = await this.providerQueryCache?.get<CachedViewerFacts>(
      LINKEDIN_VIEWER_FACTS_CACHE_PREFIX,
      cacheParts,
    );

    if (isDefined(cached)) {
      return cached;
    }

    const profile =
      await this.linkedinUnipileRequestService.fetchLinkedinUserProfile(
        accountId,
        identifier,
        { notify: false, viewerScoped: true },
      );

    if (!isDefined(profile)) {
      throw new Error('Unipile returned no profile');
    }

    const facts: CachedViewerFacts = {
      ...extractWarmViewerFacts(profile),
      profile: extractWarmProfileFacts(profile),
    };

    await this.providerQueryCache?.set(
      LINKEDIN_VIEWER_FACTS_CACHE_PREFIX,
      cacheParts,
      facts,
    );

    return facts;
  }
}
