import { Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';

import { isNonEmptyString } from '@sniptt/guards';
import {
  patchOutreachAnalyticsDeferredResume,
  resolveOutreachResumeAt,
  resolveOutreachStageBeforeDefer,
} from 'twenty-shared/arx';
import { StepStatus, WorkflowActionType } from 'twenty-shared/workflow';
import { isDefined } from 'twenty-shared/utils';
import { In, type ObjectLiteral } from 'typeorm';

import {
  OUTREACH_CANDIDATE_PAUSED_PENDING_REASON,
  OUTREACH_PROJECT_PAUSED_PENDING_REASON,
} from 'src/engine/core-modules/outreach-command/services/outreach-throttle.service';
import {
  OUTREACH_DEFERRED_RESUME_JOB_NAME,
  type OutreachDeferredResumeJobData,
} from 'src/engine/core-modules/outreach-command/services/outreach-deferred-resume.service';
import {
  type CandidateOutreachJourney,
  type CandidateOutreachJourneyActiveRun,
  type OutreachCandidateRunSummary,
  type OutreachProjectJourneySummary,
} from 'src/engine/core-modules/outreach-command/types/outreach-candidate-journey.types';
import {
  CAPACITY_PENDING_REASONS,
  SEQUENCE_DELAY_PENDING_REASON,
} from 'src/engine/core-modules/outreach-command/utils/outreach-experiment.util';
import { parseOutreachResumeAtFromHint } from 'src/engine/core-modules/outreach-command/utils/parse-outreach-resume-at.util';
import {
  normalizeWorkflowRunStepDeferralFields,
  readWorkflowRunStepPendingReason,
  readWorkflowRunStepScheduledAt,
} from 'src/engine/core-modules/outreach-command/utils/read-workflow-run-step-pending-fields.util';
import { InjectMessageQueue } from 'src/engine/core-modules/message-queue/decorators/message-queue.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { MessageQueueService } from 'src/engine/core-modules/message-queue/services/message-queue.service';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';
import {
  WorkflowRunCurrentStepKind,
  WorkflowRunStatus,
  type WorkflowRunWorkspaceEntity,
} from 'src/modules/workflow/common/standard-objects/workflow-run.workspace-entity';
import { RUN_WORKFLOW_JOB_NAME } from 'src/modules/workflow/workflow-runner/constants/run-workflow-job-name';
import { type RunWorkflowJobData } from 'src/modules/workflow/workflow-runner/types/run-workflow-job-data.type';
import { buildRunWorkflowJobOptions } from 'src/modules/workflow/workflow-runner/utils/build-run-workflow-job-options.util';
import { computeWorkflowRunProgressFields } from 'src/modules/workflow/workflow-runner/utils/compute-workflow-run-progress-fields.util';
import { getRunnableStepIds } from 'src/modules/workflow/workflow-runner/utils/get-runnable-step-ids.util';
import { WorkflowRunWorkspaceService } from 'src/modules/workflow/workflow-runner/workflow-run/workflow-run.workspace-service';
import { WorkflowRunnerWorkspaceService } from 'src/modules/workflow/workflow-runner/workspace-services/workflow-runner.workspace-service';
import { OutreachWorkflowRunFlowSyncService } from 'src/engine/core-modules/outreach-command/services/outreach-workflow-run-flow-sync.service';
import {
  cancelResumeDelayedWorkflowJobs,
  scheduleResumeDelayedWorkflowJob,
} from 'src/modules/workflow/workflow-executor/workflow-actions/delay/utils/resume-delayed-workflow-job-scheduler.util';

type CandidateRecord = ObjectLiteral & {
  id: string;
  projectsId?: string | null;
  outreachSequenceStage?: string | null;
  linkedinFollowUpCount?: number | null;
  pendingChannel?: string | null;
  outreachAnalytics?: unknown;
  updatedAt?: string | Date | null;
};

type WorkflowRunRecord = WorkflowRunWorkspaceEntity;

const ACTIVE_RUN_STATUSES = [
  WorkflowRunStatus.RUNNING,
  WorkflowRunStatus.ENQUEUED,
  WorkflowRunStatus.NOT_STARTED,
];

const extractDraftPreview = (
  run: WorkflowRunRecord,
  formStepId: string,
): string | null => {
  const steps = run.state?.flow?.steps ?? [];
  const formIndex = steps.findIndex((step) => step.id === formStepId);

  if (formIndex <= 0) {
    return null;
  }

  for (let index = formIndex - 1; index >= 0; index -= 1) {
    const priorStep = steps[index];
    const stepInfo = run.state?.stepInfos?.[priorStep.id];

    if (stepInfo?.status !== StepStatus.SUCCESS) {
      continue;
    }

    const result = stepInfo.result;

    if (result && typeof result === 'object' && 'message' in result) {
      const message = (result as { message?: unknown }).message;

      if (typeof message === 'string' && message.trim().length > 0) {
        return message.trim();
      }
    }
  }

  return null;
};

const findPendingFormStepId = (run: WorkflowRunRecord): string | null => {
  const steps = run.state?.flow?.steps ?? [];
  const stepInfos = run.state?.stepInfos ?? {};

  for (const step of steps) {
    if (step.type !== WorkflowActionType.FORM) {
      continue;
    }

    if (stepInfos[step.id]?.status === StepStatus.PENDING) {
      return step.id;
    }
  }

  return null;
};

@Injectable()
export class OutreachCandidateJourneyService {
  private readonly logger = new Logger(OutreachCandidateJourneyService.name);

  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
    private readonly workflowRunWorkspaceService: WorkflowRunWorkspaceService,
    private readonly outreachWorkflowRunFlowSyncService: OutreachWorkflowRunFlowSyncService,
    @InjectMessageQueue(MessageQueue.delayedJobsQueue)
    private readonly delayedQueue: MessageQueueService,
    @InjectMessageQueue(MessageQueue.workflowQueue)
    private readonly workflowQueue: MessageQueueService,
  ) {}

  // Lazy resolve — WorkflowRunnerModule cannot be imported here (Tool ↔ Outreach cycle)
  private getWorkflowRunnerWorkspaceService(): WorkflowRunnerWorkspaceService {
    return this.moduleRef.get(WorkflowRunnerWorkspaceService, {
      strict: false,
    });
  }
  async getJourney({
    workspaceId,
    projectId,
    candidateId,
  }: {
    workspaceId: string;
    projectId: string;
    candidateId: string;
  }): Promise<CandidateOutreachJourney | null> {
    const authContext = buildSystemAuthContext(workspaceId);

    return this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        const candidate = await this.getCandidateOrFail({
          workspaceId,
          projectId,
          candidateId,
        });

        if (!candidate) {
          return null;
        }

        const activeRuns = await this.findActiveRunsForCandidate({
          workspaceId,
          candidateId,
        });

        return this.buildJourneyResponse({
          candidate,
          projectId,
          activeRuns,
        });
      },
      authContext,
    );
  }

  async getProjectSummary({
    workspaceId,
    projectId,
  }: {
    workspaceId: string;
    projectId: string;
  }): Promise<OutreachProjectJourneySummary> {
    const authContext = buildSystemAuthContext(workspaceId);

    return this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        const candidateRepository =
          await this.globalWorkspaceOrmManager.getRepository<CandidateRecord>(
            workspaceId,
            'candidate',
            { shouldBypassPermissionChecks: true },
          );

        const candidates = await candidateRepository.find({
          where: { projectsId: projectId },
          select: {
            id: true,
            outreachSequenceStage: true,
            outreachAnalytics: true,
          },
          take: 5000,
        });

        const byStage: Record<string, number> = {};
        const byCandidateId: Record<string, OutreachCandidateRunSummary> = {};
        let needsApproval = 0;
        let dueThisWeek = 0;
        let snoozed = 0;

        const weekFromNow = Date.now() + 7 * 24 * 60 * 60 * 1000;

        for (const candidate of candidates) {
          const stage = (
            candidate.outreachSequenceStage ?? 'QUEUED'
          ).toUpperCase();
          byStage[stage] = (byStage[stage] ?? 0) + 1;

          const resumeAtIso = resolveOutreachResumeAt(
            candidate.outreachAnalytics,
          );

          if (stage === 'DEFERRED' && isDefined(resumeAtIso)) {
            snoozed += 1;
            const resumeMs = new Date(resumeAtIso).getTime();

            if (Number.isFinite(resumeMs) && resumeMs <= weekFromNow) {
              dueThisWeek += 1;
            }
          }
        }

        const candidateIds = candidates.map((candidate) => candidate.id);

        if (candidateIds.length > 0) {
          const workflowRunRepository =
            await this.globalWorkspaceOrmManager.getRepository<WorkflowRunRecord>(
              workspaceId,
              'workflowRun',
              { shouldBypassPermissionChecks: true },
            );

          const runs = await workflowRunRepository.find({
            where: {
              candidateId: In(candidateIds),
              status: In(ACTIVE_RUN_STATUSES),
            },
            take: 2000,
          });

          for (const run of runs) {
            if (!isNonEmptyString(run.candidateId)) {
              continue;
            }

            const progress = computeWorkflowRunProgressFields({
              state: run.state,
              status: run.status,
            });

            const pendingFormStepId = findPendingFormStepId(run);
            const pendingStepId =
              pendingFormStepId ??
              Object.entries(run.state?.stepInfos ?? {}).find(
                ([, stepInfo]) => stepInfo.status === StepStatus.PENDING,
              )?.[0] ??
              null;

            const pendingReason = pendingStepId
              ? readWorkflowRunStepPendingReason(
                  run.state?.stepInfos?.[pendingStepId] ?? {},
                ) ?? null
              : null;

            const runNeedsApproval =
              progress.currentStepKind === WorkflowRunCurrentStepKind.FORM;

            if (runNeedsApproval) {
              needsApproval += 1;
            }

            if (progress.resumeAt) {
              const resumeMs = new Date(progress.resumeAt).getTime();

              if (Number.isFinite(resumeMs) && resumeMs <= weekFromNow) {
                dueThisWeek += 1;
              }
            }

            const existingSummary = byCandidateId[run.candidateId];

            if (
              !existingSummary ||
              runNeedsApproval ||
              (progress.currentStepKind &&
                existingSummary.currentStepKind !== 'FORM')
            ) {
              byCandidateId[run.candidateId] = {
                status: run.status,
                currentStepName: progress.currentStepName,
                currentStepKind: progress.currentStepKind,
                resumeAt: progress.resumeAt,
                pendingReason,
                needsApproval: runNeedsApproval,
              };
            }
          }
        }

        return {
          totalEnrolled: candidates.length,
          byStage,
          needsApproval,
          dueThisWeek,
          snoozed,
          byCandidateId,
        };
      },
      authContext,
    );
  }

  async pauseCandidate({
    workspaceId,
    projectId,
    candidateId,
  }: {
    workspaceId: string;
    projectId: string;
    candidateId: string;
  }): Promise<{ pausedSteps: number }> {
    const authContext = buildSystemAuthContext(workspaceId);

    return this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        await this.getCandidateOrFail({ workspaceId, projectId, candidateId });

        const runs = await this.findActiveRunsForCandidate({
          workspaceId,
          candidateId,
        });

        let pausedSteps = 0;

        for (const run of runs) {
          pausedSteps += await this.pauseRunSteps({
            workspaceId,
            run,
            pendingReason: OUTREACH_CANDIDATE_PAUSED_PENDING_REASON,
          });
        }

        return { pausedSteps };
      },
      authContext,
    );
  }

  async resumeCandidate({
    workspaceId,
    projectId,
    candidateId,
  }: {
    workspaceId: string;
    projectId: string;
    candidateId: string;
  }): Promise<{ resumedSteps: number; kickedIdleRuns: number }> {
    const authContext = buildSystemAuthContext(workspaceId);

    return this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        const candidate = await this.getCandidateOrFail({
          workspaceId,
          projectId,
          candidateId,
        });

        if (!candidate) {
          return { resumedSteps: 0, kickedIdleRuns: 0 };
        }

        const candidateRepository =
          await this.globalWorkspaceOrmManager.getRepository<CandidateRecord>(
            workspaceId,
            'candidate',
            { shouldBypassPermissionChecks: true },
          );

        if (
          candidate.outreachSequenceStage === 'DEFERRED' ||
          isDefined(resolveOutreachResumeAt(candidate.outreachAnalytics))
        ) {
          const nextStage =
            resolveOutreachStageBeforeDefer(candidate.outreachAnalytics) ??
            'CONNECTION_ACCEPTED';

          await candidateRepository.update(candidateId, {
            outreachSequenceStage: nextStage,
            outreachAnalytics: patchOutreachAnalyticsDeferredResume({
              existingAnalytics: candidate.outreachAnalytics,
              clearResume: true,
            }),
          });
        }

        const runs = await this.findActiveRunsForCandidate({
          workspaceId,
          candidateId,
        });

        let resumedSteps = 0;
        let kickedIdleRuns = 0;

        for (const run of runs) {
          try {
            await this.outreachWorkflowRunFlowSyncService.syncRunToLatestPublishedVersion(
              {
                workspaceId,
                workflowRunId: run.id,
                projectId,
              },
            );
          } catch (error) {
            this.logger.warn(
              `Failed to sync run ${run.id}: ${
                error instanceof Error ? error.message : String(error)
              }`,
            );
          }

          const freshRun =
            await this.workflowRunWorkspaceService.getWorkflowRunOrFail({
              workflowRunId: run.id,
              workspaceId,
            });

          resumedSteps += await this.resumePausedRunSteps({
            workspaceId,
            run: freshRun,
            allowedPendingReasons: new Set([
              OUTREACH_CANDIDATE_PAUSED_PENDING_REASON,
              OUTREACH_PROJECT_PAUSED_PENDING_REASON,
              ...CAPACITY_PENDING_REASONS,
            ]),
          });

          if (
            await this.kickIdleRunningWorkflowRun({
              workspaceId,
              workflowRun: freshRun,
            })
          ) {
            kickedIdleRuns += 1;
          }
        }

        return { resumedSteps, kickedIdleRuns };
      },
      authContext,
    );
  }

  async snoozeCandidate({
    workspaceId,
    projectId,
    candidateId,
    resumeAt,
  }: {
    workspaceId: string;
    projectId: string;
    candidateId: string;
    resumeAt: string;
  }): Promise<{ updatedRuns: number }> {
    const authContext = buildSystemAuthContext(workspaceId);
    const resumeAtDate = new Date(resumeAt);
    const delayMs = Math.max(0, resumeAtDate.getTime() - Date.now());

    return this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        const candidateRepository =
          await this.globalWorkspaceOrmManager.getRepository<CandidateRecord>(
            workspaceId,
            'candidate',
            { shouldBypassPermissionChecks: true },
          );

        const candidate = await this.getCandidateOrFail({
          workspaceId,
          projectId,
          candidateId,
        });

        if (!candidate) {
          return { updatedRuns: 0 };
        }

        const stageBeforeDefer =
          candidate.outreachSequenceStage &&
          candidate.outreachSequenceStage !== 'DEFERRED'
            ? candidate.outreachSequenceStage
            : resolveOutreachStageBeforeDefer(candidate.outreachAnalytics);

        await candidateRepository.update(candidateId, {
          outreachSequenceStage: 'DEFERRED',
          outreachAnalytics: patchOutreachAnalyticsDeferredResume({
            existingAnalytics: candidate.outreachAnalytics,
            resumeAt: resumeAtDate.toISOString(),
            stageBeforeDefer: isNonEmptyString(stageBeforeDefer)
              ? stageBeforeDefer
              : undefined,
          }),
        });

        const runs = await this.findActiveRunsForCandidate({
          workspaceId,
          candidateId,
        });

        let updatedRuns = 0;

        for (const run of runs) {
          const rescheduled = await this.rescheduleDelaySteps({
            workspaceId,
            run,
            delayMs,
            scheduledAt: resumeAtDate.toISOString(),
          });

          if (rescheduled > 0) {
            updatedRuns += 1;
          }
        }

        if (delayMs > 0) {
          await this.delayedQueue.add<OutreachDeferredResumeJobData>(
            OUTREACH_DEFERRED_RESUME_JOB_NAME,
            { workspaceId, candidateId },
            { delay: delayMs },
          );
        }

        return { updatedRuns };
      },
      authContext,
    );
  }

  async skipDelayStep({
    workspaceId,
    projectId,
    candidateId,
    workflowRunId,
    stepId,
  }: {
    workspaceId: string;
    projectId: string;
    candidateId: string;
    workflowRunId: string;
    stepId: string;
  }): Promise<{ ok: boolean }> {
    const authContext = buildSystemAuthContext(workspaceId);

    return this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        await this.getCandidateOrFail({ workspaceId, projectId, candidateId });

        const run = await this.workflowRunWorkspaceService.getWorkflowRunOrFail({
          workflowRunId,
          workspaceId,
        });

        if (run.candidateId !== candidateId) {
          throw new Error('Workflow run does not belong to candidate');
        }

        const step = run.state?.flow?.steps?.find(
          (flowStep) => flowStep.id === stepId,
        );

        if (step?.type !== WorkflowActionType.DELAY) {
          throw new Error('Step is not a delay step');
        }

        await cancelResumeDelayedWorkflowJobs({
          delayedQueue: this.delayedQueue,
          workflowRunId,
        });

        await this.workflowRunWorkspaceService.updateWorkflowRunStepInfo({
          stepId,
          stepInfo: {
            status: StepStatus.SUCCESS,
            result: { skipped: true },
          },
          workspaceId,
          workflowRunId,
        });

        await this.getWorkflowRunnerWorkspaceService().resume({
          workspaceId,
          workflowRunId,
          lastExecutedStepId: stepId,
        });

        return { ok: true };
      },
      authContext,
    );
  }

  async approveFormStep({
    workspaceId,
    projectId,
    candidateId,
    workflowRunId,
    stepId,
    response,
  }: {
    workspaceId: string;
    projectId: string;
    candidateId: string;
    workflowRunId: string;
    stepId: string;
    response: object;
  }): Promise<{ ok: boolean }> {
    const authContext = buildSystemAuthContext(workspaceId);

    return this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        await this.getCandidateOrFail({ workspaceId, projectId, candidateId });

        const run = await this.workflowRunWorkspaceService.getWorkflowRunOrFail(
          {
            workflowRunId,
            workspaceId,
          },
        );

        if (run.candidateId !== candidateId) {
          throw new Error('Workflow run does not belong to candidate');
        }

        await this.getWorkflowRunnerWorkspaceService().submitFormStep({
          workspaceId,
          workflowRunId,
          stepId,
          response,
        });

        return { ok: true };
      },
      authContext,
    );
  }

  persistResumeAtFromClassifierHint({
    extractedTimeHint,
    currentStage,
    existingAnalytics,
  }: {
    extractedTimeHint: string;
    currentStage?: string | null;
    existingAnalytics?: unknown;
  }): { outreachAnalytics: ReturnType<typeof patchOutreachAnalyticsDeferredResume> } {
    const resumeAt = parseOutreachResumeAtFromHint(extractedTimeHint) ?? null;
    const stageBeforeDefer =
      isNonEmptyString(currentStage) &&
      currentStage.toUpperCase() !== 'DEFERRED'
        ? currentStage.toUpperCase()
        : undefined;

    return {
      outreachAnalytics: patchOutreachAnalyticsDeferredResume({
        existingAnalytics,
        resumeAt,
        stageBeforeDefer,
      }),
    };
  }

  private buildJourneyResponse({
    candidate,
    projectId,
    activeRuns,
  }: {
    candidate: CandidateRecord;
    projectId: string;
    activeRuns: WorkflowRunRecord[];
  }): CandidateOutreachJourney {
    const mappedRuns: CandidateOutreachJourneyActiveRun[] = activeRuns.map(
      (run) => {
        const progress = computeWorkflowRunProgressFields({
          state: run.state,
          status: run.status,
        });
        const pendingFormStepId = findPendingFormStepId(run);
        const pendingStepId =
          pendingFormStepId ??
          Object.entries(run.state?.stepInfos ?? {}).find(
            ([, stepInfo]) => stepInfo.status === StepStatus.PENDING,
          )?.[0] ??
          null;

        const pendingReason = pendingStepId
          ? readWorkflowRunStepPendingReason(
              run.state?.stepInfos?.[pendingStepId] ?? {},
            ) ?? null
          : null;

        return {
          workflowRunId: run.id,
          workflowName: run.name ?? 'Workflow run',
          status: run.status,
          currentStepName: progress.currentStepName,
          currentStepKind: progress.currentStepKind,
          resumeAt: progress.resumeAt,
          pendingReason,
          pendingStepId,
          pendingFormStepId,
          draftPreview: pendingFormStepId
            ? extractDraftPreview(run, pendingFormStepId)
            : null,
          upcomingSteps: progress.upcomingSteps,
        };
      },
    );

    const outreachPaused = mappedRuns.some(
      (run) => run.pendingReason === OUTREACH_CANDIDATE_PAUSED_PENDING_REASON,
    );

    return {
      candidateId: candidate.id,
      projectId,
      outreachSequenceStage: (
        candidate.outreachSequenceStage ?? 'QUEUED'
      ).toUpperCase(),
      linkedinFollowUpCount: candidate.linkedinFollowUpCount ?? 0,
      pendingChannel: candidate.pendingChannel ?? null,
      outreachResumeAt: resolveOutreachResumeAt(candidate.outreachAnalytics),
      outreachPaused,
      activeRuns: mappedRuns,
      stageHistory: this.buildStageHistory(candidate),
    };
  }

  private buildStageHistory(candidate: CandidateRecord) {
    const history: CandidateOutreachJourney['stageHistory'] = [];
    const updatedAt = candidate.updatedAt;

    if (isDefined(updatedAt)) {
      history.push({
        stage: (candidate.outreachSequenceStage ?? 'QUEUED').toUpperCase(),
        at: new Date(updatedAt).toISOString(),
      });
    }

    return history;
  }

  private async getCandidateOrFail({
    workspaceId,
    projectId,
    candidateId,
  }: {
    workspaceId: string;
    projectId: string;
    candidateId: string;
  }): Promise<CandidateRecord | null> {
    const candidateRepository =
      await this.globalWorkspaceOrmManager.getRepository<CandidateRecord>(
        workspaceId,
        'candidate',
        { shouldBypassPermissionChecks: true },
      );

    return candidateRepository.findOne({
      where: { id: candidateId, projectsId: projectId },
    });
  }

  private async findActiveRunsForCandidate({
    workspaceId,
    candidateId,
  }: {
    workspaceId: string;
    candidateId: string;
  }): Promise<WorkflowRunRecord[]> {
    const workflowRunRepository =
      await this.globalWorkspaceOrmManager.getRepository<WorkflowRunRecord>(
        workspaceId,
        'workflowRun',
        { shouldBypassPermissionChecks: true },
      );

    return workflowRunRepository.find({
      where: {
        candidateId,
        status: In(ACTIVE_RUN_STATUSES),
      },
      order: { createdAt: 'DESC' },
      take: 20,
    });
  }

  private async pauseRunSteps({
    workspaceId,
    run,
    pendingReason,
  }: {
    workspaceId: string;
    run: WorkflowRunRecord;
    pendingReason: string;
  }): Promise<number> {
    await cancelResumeDelayedWorkflowJobs({
      delayedQueue: this.delayedQueue,
      workflowRunId: run.id,
    });

    const stepInfos = run.state?.stepInfos ?? {};
    const now = Date.now();
    let pausedSteps = 0;

    for (const [stepId, stepInfo] of Object.entries(stepInfos)) {
      if (stepInfo.status !== StepStatus.PENDING) {
        continue;
      }

      const existingReason = readWorkflowRunStepPendingReason(stepInfo) ?? '';
      const isSequenceDelay =
        existingReason === SEQUENCE_DELAY_PENDING_REASON ||
        run.state?.flow?.steps?.find((step) => step.id === stepId)?.type ===
          'DELAY';

      if (isSequenceDelay) {
        const scheduledAt = readWorkflowRunStepScheduledAt(stepInfo);
        const scheduledAtMs = scheduledAt
          ? new Date(scheduledAt).getTime()
          : now + (stepInfo.waitMs ?? 0);
        const remainingMs = Math.max(0, scheduledAtMs - now);

        await this.workflowRunWorkspaceService.updateWorkflowRunStepInfo({
          stepId,
          stepInfo: {
            ...normalizeWorkflowRunStepDeferralFields(stepInfo),
            status: StepStatus.PENDING,
            pendingReason,
            remainingMs,
            scheduledAt,
            waitMs: remainingMs,
          },
          workspaceId,
          workflowRunId: run.id,
        });
        pausedSteps += 1;
        continue;
      }

      await this.workflowRunWorkspaceService.updateWorkflowRunStepInfo({
        stepId,
        stepInfo: {
          ...normalizeWorkflowRunStepDeferralFields(stepInfo),
          status: StepStatus.PENDING,
          pendingReason,
          waitMs: 0,
        },
        workspaceId,
        workflowRunId: run.id,
      });
      pausedSteps += 1;
    }

    return pausedSteps;
  }

  private async resumePausedRunSteps({
    workspaceId,
    run,
    allowedPendingReasons,
  }: {
    workspaceId: string;
    run: WorkflowRunRecord;
    allowedPendingReasons: Set<string>;
  }): Promise<number> {
    const stepInfos = run.state?.stepInfos ?? {};
    let resumedSteps = 0;

    for (const [stepId, stepInfo] of Object.entries(stepInfos)) {
      if (stepInfo.status !== StepStatus.PENDING) {
        continue;
      }

      const pendingReason = readWorkflowRunStepPendingReason(stepInfo) ?? '';

      if (!allowedPendingReasons.has(pendingReason)) {
        continue;
      }

      const isSequenceDelay =
        typeof stepInfo.remainingMs === 'number' &&
        stepInfo.remainingMs > 0 &&
        run.state?.flow?.steps?.find((step) => step.id === stepId)?.type ===
          'DELAY';

      if (isSequenceDelay) {
        const remainingMs = stepInfo.remainingMs ?? 0;
        const scheduledAt = new Date(Date.now() + remainingMs).toISOString();

        await this.workflowRunWorkspaceService.updateWorkflowRunStepInfo({
          stepId,
          stepInfo: {
            status: StepStatus.PENDING,
            pendingReason: SEQUENCE_DELAY_PENDING_REASON,
            waitMs: remainingMs,
            scheduledAt,
            remainingMs,
          },
          workspaceId,
          workflowRunId: run.id,
        });

        await scheduleResumeDelayedWorkflowJob({
          delayedQueue: this.delayedQueue,
          data: { workspaceId, workflowRunId: run.id, stepId },
          delay: remainingMs,
        });
        resumedSteps += 1;
        continue;
      }

      await scheduleResumeDelayedWorkflowJob({
        delayedQueue: this.delayedQueue,
        data: {
          workspaceId,
          workflowRunId: run.id,
          stepId,
          retryPendingStep: true,
        },
        delay: 0,
      });
      resumedSteps += 1;
    }

    return resumedSteps;
  }

  private async rescheduleDelaySteps({
    workspaceId,
    run,
    delayMs,
    scheduledAt,
  }: {
    workspaceId: string;
    run: WorkflowRunRecord;
    delayMs: number;
    scheduledAt: string;
  }): Promise<number> {
    const stepInfos = run.state?.stepInfos ?? {};
    let rescheduled = 0;

    for (const [stepId, stepInfo] of Object.entries(stepInfos)) {
      if (stepInfo.status !== StepStatus.PENDING) {
        continue;
      }

      const stepType = run.state?.flow?.steps?.find(
        (step) => step.id === stepId,
      )?.type;

      if (stepType !== WorkflowActionType.DELAY) {
        continue;
      }

      await cancelResumeDelayedWorkflowJobs({
        delayedQueue: this.delayedQueue,
        workflowRunId: run.id,
      });

      await this.workflowRunWorkspaceService.updateWorkflowRunStepInfo({
        stepId,
        stepInfo: {
          status: StepStatus.PENDING,
          pendingReason: SEQUENCE_DELAY_PENDING_REASON,
          waitMs: delayMs,
          scheduledAt,
          remainingMs: delayMs,
        },
        workspaceId,
        workflowRunId: run.id,
      });

      await scheduleResumeDelayedWorkflowJob({
        delayedQueue: this.delayedQueue,
        data: { workspaceId, workflowRunId: run.id, stepId },
        delay: delayMs,
      });

      rescheduled += 1;
    }

    return rescheduled;
  }

  private async kickIdleRunningWorkflowRun({
    workspaceId,
    workflowRun,
  }: {
    workspaceId: string;
    workflowRun: WorkflowRunRecord;
  }): Promise<boolean> {
    const steps = workflowRun.state?.flow?.steps;

    if (!isDefined(steps) || steps.length === 0) {
      return false;
    }

    const stepInfos = workflowRun.state?.stepInfos ?? {};
    const runnableStepIds = getRunnableStepIds({ steps, stepInfos });

    if (runnableStepIds.length === 0) {
      return false;
    }

    await this.workflowQueue.add<RunWorkflowJobData>(
      RUN_WORKFLOW_JOB_NAME,
      {
        workspaceId,
        workflowRunId: workflowRun.id,
        stepIdsToRetry: runnableStepIds,
      },
      buildRunWorkflowJobOptions(workflowRun.id),
    );

    return true;
  }
}
