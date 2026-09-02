import { Injectable, Logger } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';
import { graphQltoUpdateOneCandidate } from 'twenty-shared';
import {
  patchOutreachAnalyticsDeferredResume,
  resolveOutreachResumeAt,
  resolveOutreachStageBeforeDefer,
} from 'twenty-shared/arx';
import { type ObjectLiteral } from 'typeorm';

import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { parseOutreachResumeAtFromHint } from 'src/engine/core-modules/outreach-command/utils/parse-outreach-resume-at.util';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';

export const OUTREACH_DEFERRED_RESUME_JOB_NAME = 'outreach-deferred-resume';

export type OutreachDeferredResumeJobData = {
  workspaceId: string;
  candidateId: string;
};

type CandidateRecord = ObjectLiteral & {
  id: string;
  projectsId?: string | null;
  outreachSequenceStage?: string | null;
  outreachAnalytics?: unknown;
};

@Injectable()
export class OutreachDeferredResumeService {
  private readonly logger = new Logger(OutreachDeferredResumeService.name);

  constructor(
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
    private readonly staticGraphQLService: StaticGraphQLService,
  ) {}

  async resumeDueCandidates({
    workspaceId,
  }: {
    workspaceId: string;
  }): Promise<{ resumed: number }> {
    const authContext = buildSystemAuthContext(workspaceId);

    return this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        const candidateRepository =
          await this.globalWorkspaceOrmManager.getRepository<CandidateRecord>(
            workspaceId,
            'candidate',
            { shouldBypassPermissionChecks: true },
          );

        const now = new Date();
        const dueCandidates = await candidateRepository.find({
          where: {
            outreachSequenceStage: 'DEFERRED',
          },
          take: 500,
        });

        let resumed = 0;

        for (const candidate of dueCandidates) {
          const resumeAtIso = resolveOutreachResumeAt(candidate.outreachAnalytics);

          if (!resumeAtIso) {
            continue;
          }

          const resumeAt = new Date(resumeAtIso);

          if (resumeAt.getTime() > now.getTime()) {
            continue;
          }

          const nextStage =
            resolveOutreachStageBeforeDefer(candidate.outreachAnalytics) ??
            'CONNECTION_ACCEPTED';

          await candidateRepository.update(candidate.id, {
            outreachSequenceStage: nextStage,
            outreachAnalytics: patchOutreachAnalyticsDeferredResume({
              existingAnalytics: candidate.outreachAnalytics,
              clearResume: true,
            }),
          });

          resumed += 1;
          this.logger.log(
            `Resumed deferred candidate ${candidate.id} → ${nextStage}`,
          );
        }

        return { resumed };
      },
      authContext,
    );
  }

  async resumeCandidateById({
    workspaceId,
    candidateId,
    apiToken,
  }: {
    workspaceId: string;
    candidateId: string;
    apiToken?: string;
  }): Promise<void> {
    const authContext = buildSystemAuthContext(workspaceId);

    await this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        const candidateRepository =
          await this.globalWorkspaceOrmManager.getRepository<CandidateRecord>(
            workspaceId,
            'candidate',
            { shouldBypassPermissionChecks: true },
          );

        const candidate = await candidateRepository.findOne({
          where: { id: candidateId },
        });

        if (!candidate || candidate.outreachSequenceStage !== 'DEFERRED') {
          return;
        }

        const nextStage =
          resolveOutreachStageBeforeDefer(candidate.outreachAnalytics) ??
          'CONNECTION_ACCEPTED';

        const outreachAnalytics = patchOutreachAnalyticsDeferredResume({
          existingAnalytics: candidate.outreachAnalytics,
          clearResume: true,
        });

        if (apiToken) {
          await this.staticGraphQLService.executeGraphQL(
            graphQltoUpdateOneCandidate,
            {
              idToUpdate: candidateId,
              input: {
                outreachSequenceStage: nextStage,
                outreachAnalytics,
              },
            },
            apiToken,
          );
        } else {
          await candidateRepository.update(candidateId, {
            outreachSequenceStage: nextStage,
            outreachAnalytics,
          });
        }
      },
      authContext,
    );
  }

  scheduleResumeCheckForCandidate({
    workspaceId,
    candidateId,
    resumeAt,
  }: {
    workspaceId: string;
    candidateId: string;
    resumeAt: string;
  }): OutreachDeferredResumeJobData & { delayMs: number } {
    const delayMs = Math.max(0, new Date(resumeAt).getTime() - Date.now());

    return {
      workspaceId,
      candidateId,
      delayMs,
    };
  }
}

export const buildDeferredResumeFields = ({
  classifiedStage,
  extractedTimeHint,
  currentStage,
  existingAnalytics,
}: {
  classifiedStage: string;
  extractedTimeHint?: string;
  currentStage?: string | null;
  existingAnalytics?: unknown;
}): Record<string, unknown> => {
  if (classifiedStage.toUpperCase() !== 'DEFERRED') {
    return {};
  }

  const resumeAt = isNonEmptyString(extractedTimeHint)
    ? parseOutreachResumeAtFromHint(extractedTimeHint)
    : null;

  const stageBeforeDefer =
    isNonEmptyString(currentStage) && currentStage.toUpperCase() !== 'DEFERRED'
      ? currentStage.toUpperCase()
      : undefined;

  if (!resumeAt && !stageBeforeDefer) {
    return {};
  }

  return {
    outreachAnalytics: patchOutreachAnalyticsDeferredResume({
      existingAnalytics,
      resumeAt,
      stageBeforeDefer,
    }),
  };
};
