import { Injectable } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';
import { isDefined } from 'twenty-shared/utils';
import { type ObjectLiteral } from 'typeorm';

import {
  GtmOutreachThrottleService,
  type GtmOutreachThrottleCheckResult,
} from 'src/engine/core-modules/gtm-command/services/gtm-outreach-throttle.service';
import { extractLinkedinProfileId } from 'src/engine/core-modules/gtm-command/utils/extract-linkedin-profile-id.util';
import {
  type GtmThrottleChannel,
  type GtmThrottleCounters,
} from 'src/engine/core-modules/gtm-command/utils/gtm-outreach-throttle.util';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';

type ProjectThrottleRecord = ObjectLiteral & {
  id: string;
  linkedinConnectsToday?: number | null;
  commentsToday?: number | null;
  emailsToday?: number | null;
  maxConnectsPerDay?: number | null;
  maxCommentsPerDay?: number | null;
  maxEmailsPerDay?: number | null;
  linkedinConnectsThisWeek?: number | null;
  maxConnectsPerWeek?: number | null;
  linkedinConnectsWeekStartedAt?: string | Date | null;
  minConnectGapMinutes?: number | null;
  minMessageGapMinutes?: number | null;
  sendTimezone?: string | null;
  sendWindowStart?: string | null;
  sendWindowEnd?: string | null;
};

type WorkspaceMemberProfilePacingRecord = ObjectLiteral & {
  id: string;
  workspaceMemberId: string;
  linkedinUnipileAccountId?: string | null;
  lastLinkedinConnectAt?: string | Date | null;
  lastLinkedinMessageAt?: string | Date | null;
};

type CandidateLookupRecord = ObjectLiteral & {
  id: string;
  projectsId?: string | null;
  linkedinProfileId?: string | null;
  linkedinUrl?: { primaryLinkUrl?: string } | null;
};

@Injectable()
export class GtmUnipilePacingService {
  constructor(
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
    private readonly gtmOutreachThrottleService: GtmOutreachThrottleService,
  ) {}

  async resolveLinkedinProfileId({
    workspaceId,
    linkedinProfileId,
    linkedinUrl,
  }: {
    workspaceId: string;
    linkedinProfileId?: string | null;
    linkedinUrl?: string | null;
  }): Promise<string> {
    const fromFields =
      extractLinkedinProfileId(linkedinProfileId) ||
      extractLinkedinProfileId(linkedinUrl);

    if (isNonEmptyString(fromFields)) {
      return fromFields;
    }

    return '';
  }

  async check({
    workspaceId,
    workspaceMemberId,
    channel,
    linkedinProfileId,
  }: {
    workspaceId: string;
    workspaceMemberId: string;
    channel: GtmThrottleChannel;
    linkedinProfileId?: string;
  }): Promise<GtmOutreachThrottleCheckResult & { projectId: string | null }> {
    const loaded = await this.loadCounters({
      workspaceId,
      workspaceMemberId,
      linkedinProfileId,
    });

    const result = this.gtmOutreachThrottleService.checkAndReserve({
      counters: loaded.counters,
      channel,
      sendTimezone: loaded.project?.sendTimezone,
      sendWindowStart: loaded.project?.sendWindowStart,
      sendWindowEnd: loaded.project?.sendWindowEnd,
      linkedinConnected: isNonEmptyString(
        loaded.profile?.linkedinUnipileAccountId,
      ),
    });

    return { ...result, projectId: loaded.project?.id ?? null };
  }

  async stampSuccess({
    workspaceId,
    workspaceMemberId,
    projectId,
    channel,
    patch,
  }: {
    workspaceId: string;
    workspaceMemberId: string;
    projectId: string | null;
    channel: GtmThrottleChannel;
    patch: Partial<GtmThrottleCounters>;
  }): Promise<void> {
    const authContext = buildSystemAuthContext(workspaceId);

    await this.globalWorkspaceOrmManager.executeInWorkspaceContext(async () => {
      const profileRepository =
        await this.globalWorkspaceOrmManager.getRepository<WorkspaceMemberProfilePacingRecord>(
          workspaceId,
          'workspaceMemberProfile',
          { shouldBypassPermissionChecks: true },
        );
      const profile = await profileRepository.findOne({
        where: { workspaceMemberId },
      });

      if (isDefined(profile)) {
        await profileRepository.update(profile.id, {
          ...(patch.lastLinkedinConnectAt
            ? { lastLinkedinConnectAt: patch.lastLinkedinConnectAt }
            : {}),
          ...(patch.lastLinkedinMessageAt
            ? { lastLinkedinMessageAt: patch.lastLinkedinMessageAt }
            : {}),
        });
      }

      if (isNonEmptyString(projectId) && channel === 'connect') {
        const projectRepository =
          await this.globalWorkspaceOrmManager.getRepository<ProjectThrottleRecord>(
            workspaceId,
            'project',
            { shouldBypassPermissionChecks: true },
          );

        await projectRepository.update(projectId, {
          ...(typeof patch.linkedinConnectsToday === 'number'
            ? { linkedinConnectsToday: patch.linkedinConnectsToday }
            : {}),
          ...(typeof patch.linkedinConnectsThisWeek === 'number'
            ? { linkedinConnectsThisWeek: patch.linkedinConnectsThisWeek }
            : {}),
          ...(patch.linkedinConnectsWeekStartedAt
            ? {
                linkedinConnectsWeekStartedAt:
                  patch.linkedinConnectsWeekStartedAt,
              }
            : {}),
        });
      }
    }, authContext);
  }

  private async loadCounters({
    workspaceId,
    workspaceMemberId,
    linkedinProfileId,
  }: {
    workspaceId: string;
    workspaceMemberId: string;
    linkedinProfileId?: string;
  }): Promise<{
    counters: GtmThrottleCounters;
    project: ProjectThrottleRecord | null;
    profile: WorkspaceMemberProfilePacingRecord | null;
  }> {
    const authContext = buildSystemAuthContext(workspaceId);

    return this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        const profileRepository =
          await this.globalWorkspaceOrmManager.getRepository<WorkspaceMemberProfilePacingRecord>(
            workspaceId,
            'workspaceMemberProfile',
            { shouldBypassPermissionChecks: true },
          );
        const projectRepository =
          await this.globalWorkspaceOrmManager.getRepository<ProjectThrottleRecord>(
            workspaceId,
            'project',
            { shouldBypassPermissionChecks: true },
          );

        const profile = await profileRepository.findOne({
          where: { workspaceMemberId },
        });

        let project: ProjectThrottleRecord | null = null;

        if (isNonEmptyString(linkedinProfileId)) {
          const candidateRepository =
            await this.globalWorkspaceOrmManager.getRepository<CandidateLookupRecord>(
              workspaceId,
              'candidate',
              { shouldBypassPermissionChecks: true },
            );
          const candidates = await candidateRepository.find({
            where: { linkedinProfileId },
            take: 1,
          });
          const projectsId = candidates[0]?.projectsId;

          if (isNonEmptyString(projectsId)) {
            project = await projectRepository.findOne({
              where: { id: projectsId },
            });
          }
        }

        if (!isDefined(project)) {
          const projects = await projectRepository.find({
            order: { createdAt: 'DESC' },
            take: 1,
          });

          project = projects[0] ?? null;
        }

        return {
          profile,
          project,
          counters: {
            linkedinConnectsToday: project?.linkedinConnectsToday ?? 0,
            commentsToday: project?.commentsToday ?? 0,
            emailsToday: project?.emailsToday ?? 0,
            maxConnectsPerDay: project?.maxConnectsPerDay ?? 25,
            maxCommentsPerDay: project?.maxCommentsPerDay ?? 20,
            maxEmailsPerDay: project?.maxEmailsPerDay ?? 50,
            linkedinConnectsThisWeek: project?.linkedinConnectsThisWeek ?? 0,
            maxConnectsPerWeek: project?.maxConnectsPerWeek ?? 100,
            linkedinConnectsWeekStartedAt:
              project?.linkedinConnectsWeekStartedAt ?? null,
            minConnectGapMinutes: project?.minConnectGapMinutes ?? 60,
            minMessageGapMinutes: project?.minMessageGapMinutes ?? 15,
            lastLinkedinConnectAt: profile?.lastLinkedinConnectAt ?? null,
            lastLinkedinMessageAt: profile?.lastLinkedinMessageAt ?? null,
          },
        };
      },
      authContext,
    );
  }
}
