import { Injectable } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';
import { isDefined, escapeForIlike } from 'twenty-shared/utils';
import { ILike, type ObjectLiteral } from 'typeorm';

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

type ProjectPacingRecord = ObjectLiteral & {
  id: string;
  sendTimezone?: string | null;
  sendWindowStart?: string | null;
  sendWindowEnd?: string | null;
  outreachStatus?: string | null;
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
    linkedinProfileId,
    linkedinUrl,
  }: {
    workspaceId: string;
    linkedinProfileId?: unknown;
    linkedinUrl?: unknown;
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
    const loaded = await this.loadPacingContext({
      workspaceId,
      workspaceMemberId,
      linkedinProfileId,
    });

    const result = this.gtmOutreachThrottleService.checkAndReserve({
      counters: loaded.counters,
      channel,
      linkedinConnected: isNonEmptyString(
        loaded.profile?.linkedinUnipileAccountId,
      ),
      outreachStatus: loaded.project?.outreachStatus ?? 'LIVE',
      sendWindow: loaded.project
        ? {
            timezone: loaded.project.sendTimezone ?? 'Asia/Kolkata',
            sendWindowStart: loaded.project.sendWindowStart ?? '08:00',
            sendWindowEnd: loaded.project.sendWindowEnd ?? '10:00',
          }
        : {
            timezone: 'Asia/Kolkata',
            sendWindowStart: '08:00',
            sendWindowEnd: '10:00',
          },
    });

    return { ...result, projectId: loaded.project?.id ?? null };
  }

  async stampSuccess({
    workspaceId,
    workspaceMemberId,
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
    }, authContext);
  }

  private async loadPacingContext({
    workspaceId,
    workspaceMemberId,
    linkedinProfileId,
  }: {
    workspaceId: string;
    workspaceMemberId: string;
    linkedinProfileId?: string;
  }): Promise<{
    counters: GtmThrottleCounters;
    project: ProjectPacingRecord | null;
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
          await this.globalWorkspaceOrmManager.getRepository<ProjectPacingRecord>(
            workspaceId,
            'project',
            { shouldBypassPermissionChecks: true },
          );

        const profile = await profileRepository.findOne({
          where: { workspaceMemberId },
        });

        let project: ProjectPacingRecord | null = null;

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
          let match = candidates[0];

          if (!isDefined(match)) {
            const slug = extractLinkedinProfileId(linkedinProfileId);

            if (isNonEmptyString(slug)) {
              try {
                match =
                  (await candidateRepository.findOne({
                    where: {
                      linkedinUrlPrimaryLinkUrl: ILike(
                        `%/in/${escapeForIlike(slug)}%`,
                      ),
                    },
                  })) ?? undefined;
              } catch {
                match = undefined;
              }
            }
          }

          const projectsId = match?.projectsId;

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
            lastLinkedinConnectAt: profile?.lastLinkedinConnectAt ?? null,
            lastLinkedinMessageAt: profile?.lastLinkedinMessageAt ?? null,
          },
        };
      },
      authContext,
    );
  }
}
