import { Injectable, Logger } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';
import { isDefined } from 'twenty-shared/utils';
import { StepStatus } from 'twenty-shared/workflow';
import { In, type ObjectLiteral } from 'typeorm';

import { getRegisteredAccountRateLimiter } from 'src/engine/core-modules/account-rate-limit/account-rate-limiter.registry';
import { GTM_PROJECT_PAUSED_PENDING_REASON } from 'src/engine/core-modules/gtm-command/services/gtm-outreach-throttle.service';
import {
  CAPACITY_PENDING_REASONS,
  SEQUENCE_DELAY_PENDING_REASON,
} from 'src/engine/core-modules/gtm-command/utils/gtm-experiment.util';
import { InjectMessageQueue } from 'src/engine/core-modules/message-queue/decorators/message-queue.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { MessageQueueService } from 'src/engine/core-modules/message-queue/services/message-queue.service';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';
import { WorkflowRunStatus } from 'src/modules/workflow/common/standard-objects/workflow-run.workspace-entity';
import { RESUME_DELAYED_WORKFLOW_JOB_NAME } from 'src/modules/workflow/workflow-executor/workflow-actions/delay/contants/resume-delayed-workflow-job-name';
import { ResumeDelayedWorkflowJobData } from 'src/modules/workflow/workflow-executor/workflow-actions/delay/types/resume-delayed-workflow-job-data.type';
import { buildRunWorkflowJobOptions } from 'src/modules/workflow/workflow-runner/utils/build-run-workflow-job-options.util';
import { WorkflowRunWorkspaceService } from 'src/modules/workflow/workflow-runner/workflow-run/workflow-run.workspace-service';

type ProjectRecord = ObjectLiteral & {
  id: string;
  outreachStatus?: string | null;
};

type CandidateRecord = ObjectLiteral & {
  id: string;
  projectsId?: string | null;
};

type WorkflowRunRecord = ObjectLiteral & {
  id: string;
  status: WorkflowRunStatus;
  candidateId?: string | null;
  state?: {
    stepInfos?: Record<
      string,
      {
        status?: StepStatus;
        pendingReason?: string;
        scheduledAt?: string;
        waitMs?: number;
        remainingMs?: number;
      }
    >;
    flow?: {
      steps?: Array<{ id: string; type?: string }>;
    };
  } | null;
};

@Injectable()
export class GtmProjectOutreachControlService {
  private readonly logger = new Logger(GtmProjectOutreachControlService.name);

  constructor(
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
    private readonly workflowRunWorkspaceService: WorkflowRunWorkspaceService,
    @InjectMessageQueue(MessageQueue.delayedJobsQueue)
    private readonly delayedQueue: MessageQueueService,
  ) {}

  async pauseProject({
    workspaceId,
    projectId,
  }: {
    workspaceId: string;
    projectId: string;
  }): Promise<{ pausedRuns: number }> {
    const authContext = buildSystemAuthContext(workspaceId);

    return this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        const projectRepository =
          await this.globalWorkspaceOrmManager.getRepository<ProjectRecord>(
            workspaceId,
            'project',
            { shouldBypassPermissionChecks: true },
          );

        await projectRepository.update(projectId, {
          outreachStatus: 'PAUSED',
        });

        const runs = await this.findProjectRunningRuns({
          workspaceId,
          projectId,
        });

        let pausedRuns = 0;
        const rateLimiter = getRegisteredAccountRateLimiter();

        for (const run of runs) {
          try {
            await rateLimiter?.releaseGhostReservationsForWorkflowRun(run.id);
          } catch (error) {
            this.logger.warn(
              `Failed to release ghosts for run ${run.id}: ${
                error instanceof Error ? error.message : String(error)
              }`,
            );
          }

          const stepInfos = run.state?.stepInfos ?? {};
          const now = Date.now();

          for (const [stepId, stepInfo] of Object.entries(stepInfos)) {
            if (stepInfo.status !== StepStatus.PENDING) {
              continue;
            }

            const pendingReason = stepInfo.pendingReason ?? '';
            const isSequenceDelay =
              pendingReason === SEQUENCE_DELAY_PENDING_REASON ||
              run.state?.flow?.steps?.find((step) => step.id === stepId)
                ?.type === 'DELAY';

            if (isSequenceDelay) {
              const scheduledAtMs = stepInfo.scheduledAt
                ? new Date(stepInfo.scheduledAt).getTime()
                : now + (stepInfo.waitMs ?? 0);
              const remainingMs = Math.max(0, scheduledAtMs - now);

              await this.workflowRunWorkspaceService.updateWorkflowRunStepInfo({
                stepId,
                stepInfo: {
                  ...stepInfo,
                  status: StepStatus.PENDING,
                  pendingReason: GTM_PROJECT_PAUSED_PENDING_REASON,
                  remainingMs,
                  scheduledAt: stepInfo.scheduledAt,
                  waitMs: remainingMs,
                },
                workspaceId,
                workflowRunId: run.id,
              });
              pausedRuns += 1;
              continue;
            }

            if (
              CAPACITY_PENDING_REASONS.has(pendingReason) ||
              pendingReason.length === 0
            ) {
              await this.workflowRunWorkspaceService.updateWorkflowRunStepInfo({
                stepId,
                stepInfo: {
                  ...stepInfo,
                  status: StepStatus.PENDING,
                  pendingReason: GTM_PROJECT_PAUSED_PENDING_REASON,
                  waitMs: 0,
                },
                workspaceId,
                workflowRunId: run.id,
              });
              pausedRuns += 1;
            }
          }
        }

        return { pausedRuns };
      },
      authContext,
    );
  }

  async resumeProject({
    workspaceId,
    projectId,
  }: {
    workspaceId: string;
    projectId: string;
  }): Promise<{ resumedRuns: number }> {
    const authContext = buildSystemAuthContext(workspaceId);

    return this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        const projectRepository =
          await this.globalWorkspaceOrmManager.getRepository<ProjectRecord>(
            workspaceId,
            'project',
            { shouldBypassPermissionChecks: true },
          );

        await projectRepository.update(projectId, {
          outreachStatus: 'LIVE',
        });

        const runs = await this.findProjectRunningRuns({
          workspaceId,
          projectId,
        });

        let resumedRuns = 0;

        for (const run of runs) {
          const stepInfos = run.state?.stepInfos ?? {};

          for (const [stepId, stepInfo] of Object.entries(stepInfos)) {
            if (
              stepInfo.status !== StepStatus.PENDING ||
              stepInfo.pendingReason !== GTM_PROJECT_PAUSED_PENDING_REASON
            ) {
              continue;
            }

            const isSequenceDelay =
              typeof stepInfo.remainingMs === 'number' &&
              stepInfo.remainingMs > 0 &&
              run.state?.flow?.steps?.find((step) => step.id === stepId)
                ?.type === 'DELAY';

            if (isSequenceDelay) {
              const remainingMs = stepInfo.remainingMs ?? 0;
              const scheduledAt = new Date(
                Date.now() + remainingMs,
              ).toISOString();

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

              await this.delayedQueue.add<ResumeDelayedWorkflowJobData>(
                RESUME_DELAYED_WORKFLOW_JOB_NAME,
                {
                  workspaceId,
                  workflowRunId: run.id,
                  stepId,
                },
                {
                  ...buildRunWorkflowJobOptions(run.id),
                  delay: remainingMs,
                },
              );
              resumedRuns += 1;
              continue;
            }

            // Capacity waits: delay 0 + retryPendingStep so the send gate
            // recomputes window / spacing / rate limits with live config.
            await this.delayedQueue.add<ResumeDelayedWorkflowJobData>(
              RESUME_DELAYED_WORKFLOW_JOB_NAME,
              {
                workspaceId,
                workflowRunId: run.id,
                stepId,
                retryPendingStep: true,
              },
              {
                ...buildRunWorkflowJobOptions(run.id),
                delay: 0,
              },
            );
            resumedRuns += 1;
          }
        }

        return { resumedRuns };
      },
      authContext,
    );
  }

  async stopCandidates({
    workspaceId,
    projectId,
    candidateIds,
  }: {
    workspaceId: string;
    projectId: string;
    candidateIds: string[];
  }): Promise<{ stoppedCandidates: number; stoppedRuns: number }> {
    const uniqueIds = [...new Set(candidateIds.filter(isNonEmptyString))];

    if (uniqueIds.length === 0) {
      return { stoppedCandidates: 0, stoppedRuns: 0 };
    }

    const authContext = buildSystemAuthContext(workspaceId);

    return this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        const candidateRepository =
          await this.globalWorkspaceOrmManager.getRepository<
            CandidateRecord & {
              peopleId?: string | null;
              outreachSequenceStage?: string | null;
            }
          >(workspaceId, 'candidate', { shouldBypassPermissionChecks: true });

        const candidates = await candidateRepository.find({
          where: {
            id: In(uniqueIds),
            projectsId: projectId,
          },
        });

        let stoppedCandidates = 0;
        let stoppedRuns = 0;
        const personIds = new Set<string>();

        for (const candidate of candidates) {
          await candidateRepository.update(candidate.id, {
            outreachSequenceStage: 'STOPPED',
          });
          stoppedCandidates += 1;

          if (isNonEmptyString(candidate.peopleId)) {
            personIds.add(candidate.peopleId);
          }
        }

        if (personIds.size > 0) {
          const personRepository =
            await this.globalWorkspaceOrmManager.getRepository<
              ObjectLiteral & { id: string; doNotContact?: boolean | null }
            >(workspaceId, 'person', { shouldBypassPermissionChecks: true });

          await personRepository.update(
            { id: In([...personIds]) },
            { doNotContact: true },
          );
        }

        const workflowRunRepository =
          await this.globalWorkspaceOrmManager.getRepository<WorkflowRunRecord>(
            workspaceId,
            'workflowRun',
            { shouldBypassPermissionChecks: true },
          );
        const runs = await workflowRunRepository.find({
          where: {
            candidateId: In(candidates.map((candidate) => candidate.id)),
            status: In([
              WorkflowRunStatus.RUNNING,
              WorkflowRunStatus.ENQUEUED,
              WorkflowRunStatus.NOT_STARTED,
            ]),
          },
          take: 500,
        });

        for (const run of runs) {
          try {
            await this.workflowRunWorkspaceService.endWorkflowRun({
              workspaceId,
              workflowRunId: run.id,
              status: WorkflowRunStatus.STOPPED,
            });
            stoppedRuns += 1;
          } catch (error) {
            this.logger.warn(
              `Failed to stop workflow run ${run.id}: ${
                error instanceof Error ? error.message : String(error)
              }`,
            );
          }
        }

        return { stoppedCandidates, stoppedRuns };
      },
      authContext,
    );
  }

  async isProjectPaused({
    workspaceId,
    projectId,
  }: {
    workspaceId: string;
    projectId: string;
  }): Promise<boolean> {
    const authContext = buildSystemAuthContext(workspaceId);

    return this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        const projectRepository =
          await this.globalWorkspaceOrmManager.getRepository<ProjectRecord>(
            workspaceId,
            'project',
            { shouldBypassPermissionChecks: true },
          );
        const project = await projectRepository.findOne({
          where: { id: projectId },
        });

        return (project?.outreachStatus ?? 'LIVE').toUpperCase() === 'PAUSED';
      },
      authContext,
    );
  }

  async findProjectIdForWorkflowRun({
    workspaceId,
    workflowRunId,
  }: {
    workspaceId: string;
    workflowRunId: string;
  }): Promise<string | null> {
    const authContext = buildSystemAuthContext(workspaceId);

    return this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        const workflowRunRepository =
          await this.globalWorkspaceOrmManager.getRepository<WorkflowRunRecord>(
            workspaceId,
            'workflowRun',
            { shouldBypassPermissionChecks: true },
          );
        const run = await workflowRunRepository.findOne({
          where: { id: workflowRunId },
        });

        if (!isNonEmptyString(run?.candidateId)) {
          return null;
        }

        const candidateRepository =
          await this.globalWorkspaceOrmManager.getRepository<CandidateRecord>(
            workspaceId,
            'candidate',
            { shouldBypassPermissionChecks: true },
          );
        const candidate = await candidateRepository.findOne({
          where: { id: run.candidateId },
        });

        return candidate?.projectsId ?? null;
      },
      authContext,
    );
  }

  private async findProjectRunningRuns({
    workspaceId,
    projectId,
  }: {
    workspaceId: string;
    projectId: string;
  }): Promise<WorkflowRunRecord[]> {
    const candidateRepository =
      await this.globalWorkspaceOrmManager.getRepository<CandidateRecord>(
        workspaceId,
        'candidate',
        { shouldBypassPermissionChecks: true },
      );
    const candidates = await candidateRepository.find({
      where: { projectsId: projectId },
      select: { id: true },
      take: 5000,
    });
    const candidateIds = candidates.map((candidate) => candidate.id);

    if (candidateIds.length === 0) {
      return [];
    }

    const workflowRunRepository =
      await this.globalWorkspaceOrmManager.getRepository<WorkflowRunRecord>(
        workspaceId,
        'workflowRun',
        { shouldBypassPermissionChecks: true },
      );

    const runs = await workflowRunRepository.find({
      where: {
        status: WorkflowRunStatus.RUNNING,
        candidateId: In(candidateIds),
      },
      take: 2000,
    });

    return runs.filter((run) => isDefined(run));
  }
}
