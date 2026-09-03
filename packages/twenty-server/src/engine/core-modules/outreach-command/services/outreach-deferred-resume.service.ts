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
  outreachConversationStage?: string | null;
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
          where: [
            { outreachSequenceStage: 'DEFERRED' },
            { outreachConversationStage: 'SNOOZED' },
          ],
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

          const resumePatch = buildOutreachSnoozeResumePatch(candidate);

          await candidateRepository.update(candidate.id, resumePatch);

          resumed += 1;
          this.logger.log(
            `Resumed deferred candidate ${candidate.id}`,
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

        if (
          !candidate ||
          (candidate.outreachSequenceStage !== 'DEFERRED' &&
            candidate.outreachConversationStage !== 'SNOOZED')
        ) {
          return;
        }

        const resumePatch = buildOutreachSnoozeResumePatch(candidate);

        if (apiToken) {
          await this.staticGraphQLService.executeGraphQL(
            graphQltoUpdateOneCandidate,
            {
              idToUpdate: candidateId,
              input: resumePatch,
            },
            apiToken,
          );
        } else {
          await candidateRepository.update(candidateId, resumePatch);
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

const buildOutreachSnoozeResumePatch = (
  candidate: CandidateRecord,
): Record<string, unknown> => {
  const outreachAnalytics = patchOutreachAnalyticsDeferredResume({
    existingAnalytics: candidate.outreachAnalytics,
    clearResume: true,
  });

  if (candidate.outreachConversationStage === 'SNOOZED') {
    return {
      outreachConversationStage: 'NONE',
      outreachAnalytics,
    };
  }

  const nextStage =
    resolveOutreachStageBeforeDefer(candidate.outreachAnalytics) ??
    'CONNECTION_ACCEPTED';

  return {
    outreachSequenceStage: nextStage,
    outreachAnalytics,
  };
};

export const buildDeferredResumeFields = ({
  classifiedConversationStage,
  extractedTimeHint,
  currentStage,
  existingAnalytics,
}: {
  classifiedConversationStage: string;
  extractedTimeHint?: string;
  currentStage?: string | null;
  existingAnalytics?: unknown;
}): Record<string, unknown> => {
  if (classifiedConversationStage.toUpperCase() !== 'SNOOZED') {
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
