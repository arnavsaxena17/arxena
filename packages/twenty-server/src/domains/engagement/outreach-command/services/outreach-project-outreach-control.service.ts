import { Injectable, Logger } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';
import {
  buildCandidateFlagsPatchUpdate,
  isCandidateFlagTrue,
  type CandidateFlags,
} from 'twenty-shared/arx';
import { isDefined } from 'twenty-shared/utils';
import { StepStatus, WorkflowActionType } from 'twenty-shared/workflow';
import { In, type ObjectLiteral } from 'typeorm';

import { getRegisteredAccountRateLimiter } from 'src/engine/core-modules/account-rate-limit/account-rate-limiter.registry';
import { ProcessCandidatesService } from 'src/domains/ingestion/candidate-sourcing/jobs/process-candidates.service';
import { OutreachPeopleCacheService } from 'src/domains/engagement/outreach-command/services/outreach-people-cache.service';
import { OUTREACH_PROJECT_PAUSED_PENDING_REASON } from 'src/domains/engagement/outreach-command/services/outreach-throttle.service';
import {
  CAPACITY_PENDING_REASONS,
  SEQUENCE_DELAY_PENDING_REASON,
} from 'src/domains/engagement/outreach-command/utils/outreach-experiment.util';
import {
  buildEnrollmentIndex,
  buildEnrollmentProfileRows,
  type EnrolledPersonIdentity,
  type EnrollmentIndex,
  type EnrollablePersonRow,
  isPersonKnownDoNotContact,
  matchCandidateByPersonIdentity,
  partitionSelectedPersonIds,
} from 'src/domains/engagement/outreach-command/utils/outreach-selection-enrollment.util';
import {
  readPersonIdentity,
  type PersonIdentityRecord,
} from 'src/domains/engagement/outreach-command/utils/read-person-identity.util';
import { hasOutreachReply } from 'src/domains/engagement/outreach-command/utils/outreach-replied.util';
import {
  buildWorkflowRunStepDeferralClearPatch,
  normalizeWorkflowRunStepDeferralFields,
  readWorkflowRunStepPendingReason,
  readWorkflowRunStepScheduledAt,
} from 'src/domains/engagement/outreach-command/utils/read-workflow-run-step-pending-fields.util';
import { InjectMessageQueue } from 'src/engine/core-modules/message-queue/decorators/message-queue.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { MessageQueueService } from 'src/engine/core-modules/message-queue/services/message-queue.service';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';
import {
  WorkflowRunStatus,
  type WorkflowRunWorkspaceEntity,
} from 'src/modules/workflow/common/standard-objects/workflow-run.workspace-entity';
import { RUN_WORKFLOW_JOB_NAME } from 'src/modules/workflow/workflow-runner/constants/run-workflow-job-name';
import { type RunWorkflowJobData } from 'src/modules/workflow/workflow-runner/types/run-workflow-job-data.type';
import { buildRunWorkflowJobOptions } from 'src/modules/workflow/workflow-runner/utils/build-run-workflow-job-options.util';
import { getRunnableStepIds } from 'src/modules/workflow/workflow-runner/utils/get-runnable-step-ids.util';
import {
  cancelResumeDelayedWorkflowJobs,
  scheduleResumeDelayedWorkflowJob,
} from 'src/modules/workflow/workflow-executor/workflow-actions/delay/utils/resume-delayed-workflow-job-scheduler.util';
import { OutreachWorkflowRunFlowSyncService } from 'src/domains/engagement/outreach-command/services/outreach-workflow-run-flow-sync.service';
import { OutreachWorkflowRunRepairService } from 'src/domains/engagement/outreach-command/services/outreach-workflow-run-repair.service';
import {
  collectOutreachSequencerWorkflowIdsFromProject,
  filterOutreachPauseResumeWorkflowRuns,
  mergeOutreachSequencerWorkflowIds,
  OUTREACH_SEQUENCER_SEEDED_WORKFLOW_NAMES,
} from 'src/domains/engagement/outreach-command/utils/resolve-outreach-pause-resume-workflow-ids.util';
import { WorkflowRunWorkspaceService } from 'src/modules/workflow/workflow-runner/workflow-run/workflow-run.workspace-service';

type ProjectRecord = ObjectLiteral & {
  id: string;
  outreachStatus?: string | null;
  outreachWorkflowId?: string | null;
  outreachConfig?: unknown;
  experimentConfig?: string | null;
};

// upload-profiles is the same entry point the People tab's Enroll action uses.
const OUTREACH_ENROLLMENT_DATA_SOURCE = 'linkedin_search';
const OUTREACH_ENROLLMENT_JOB_NAME = 'Outreach';
// Enrollment is queued, so the request waits for the worker to create the
// Candidate rows. Long enough for a normal batch, short enough to answer.
const OUTREACH_ENROLLMENT_POLL_TIMEOUT_MS = 20_000;
const OUTREACH_ENROLLMENT_POLL_INTERVAL_MS = 750;
const OUTREACH_ENROLLMENT_INDEX_LIMIT = 5_000;

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

type CandidateRecord = ObjectLiteral & {
  id: string;
  projectId?: string | null;
};

type OutreachCandidateRecord = CandidateRecord & {
  peopleId?: string | null;
  outreachSequenceStage?: string | null;
  outreachAnalytics?: unknown;
  candidateFlags?: CandidateFlags | null;
};

type WorkflowRunRecord = ObjectLiteral & {
  id: string;
  status: WorkflowRunStatus;
  candidateId?: string | null;
  workflowId?: string | null;
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
export class OutreachProjectOutreachControlService {
  private readonly logger = new Logger(
    OutreachProjectOutreachControlService.name,
  );

  constructor(
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
    private readonly workflowRunWorkspaceService: WorkflowRunWorkspaceService,
    private readonly outreachWorkflowRunFlowSyncService: OutreachWorkflowRunFlowSyncService,
    private readonly outreachWorkflowRunRepairService: OutreachWorkflowRunRepairService,
    private readonly outreachPeopleCacheService: OutreachPeopleCacheService,
    private readonly processCandidatesService: ProcessCandidatesService,
    @InjectMessageQueue(MessageQueue.delayedJobsQueue)
    private readonly delayedQueue: MessageQueueService,
    @InjectMessageQueue(MessageQueue.workflowQueue)
    private readonly workflowQueue: MessageQueueService,
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

        const allowedWorkflowIds = await this.resolvePauseResumeWorkflowIds({
          workspaceId,
          projectId,
        });
        const runs = filterOutreachPauseResumeWorkflowRuns({
          runs: await this.findProjectRunningRuns({
            workspaceId,
            projectId,
          }),
          allowedWorkflowIds,
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

          await cancelResumeDelayedWorkflowJobs({
            delayedQueue: this.delayedQueue,
            workflowRunId: run.id,
          });

          const stepInfos = run.state?.stepInfos ?? {};
          const now = Date.now();

          for (const [stepId, stepInfo] of Object.entries(stepInfos)) {
            if (stepInfo.status !== StepStatus.PENDING) {
              continue;
            }

            const pendingReason =
              readWorkflowRunStepPendingReason(stepInfo) ?? '';
            const isSequenceDelay =
              pendingReason === SEQUENCE_DELAY_PENDING_REASON ||
              run.state?.flow?.steps?.find((step) => step.id === stepId)
                ?.type === 'DELAY';

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
                  pendingReason: OUTREACH_PROJECT_PAUSED_PENDING_REASON,
                  remainingMs,
                  scheduledAt,
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
                  ...normalizeWorkflowRunStepDeferralFields(stepInfo),
                  status: StepStatus.PENDING,
                  pendingReason: OUTREACH_PROJECT_PAUSED_PENDING_REASON,
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
  }): Promise<{ resumedRuns: number; kickedIdleRuns: number }> {
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

        const allowedWorkflowIds = await this.resolvePauseResumeWorkflowIds({
          workspaceId,
          projectId,
        });
        const runs = filterOutreachPauseResumeWorkflowRuns({
          runs: await this.findProjectRunningRuns({
            workspaceId,
            projectId,
          }),
          allowedWorkflowIds,
        });

        let resumedRuns = 0;
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
              `Failed to sync workflow run ${run.id} to latest version: ${
                error instanceof Error ? error.message : String(error)
              }`,
            );
          }

          try {
            await this.outreachWorkflowRunRepairService.repairStaleFormAfterSend(
              {
                workspaceId,
                workflowRunId: run.id,
              },
            );
          } catch (error) {
            this.logger.warn(
              `Failed stale FORM-after-send repair for run ${run.id}: ${
                error instanceof Error ? error.message : String(error)
              }`,
            );
          }

          const freshRun =
            await this.workflowRunWorkspaceService.getWorkflowRunOrFail({
              workflowRunId: run.id,
              workspaceId,
            });
          const stepInfos = freshRun.state?.stepInfos ?? {};

          for (const [stepId, stepInfo] of Object.entries(stepInfos)) {
            if (stepInfo.status !== StepStatus.PENDING) {
              continue;
            }

            const pendingReason =
              readWorkflowRunStepPendingReason(stepInfo) ?? '';

            if (!CAPACITY_PENDING_REASONS.has(pendingReason)) {
              continue;
            }

            const isSequenceDelay =
              typeof stepInfo.remainingMs === 'number' &&
              stepInfo.remainingMs > 0 &&
              freshRun.state?.flow?.steps?.find((step) => step.id === stepId)
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
                workflowRunId: freshRun.id,
              });

              await scheduleResumeDelayedWorkflowJob({
                delayedQueue: this.delayedQueue,
                data: {
                  workspaceId,
                  workflowRunId: freshRun.id,
                  stepId,
                },
                delay: remainingMs,
              });
              resumedRuns += 1;
              continue;
            }

            const stepType = freshRun.state?.flow?.steps?.find(
              (step) => step.id === stepId,
            )?.type;

            // Keep FORM parked for approval; only clear the stale pause reason
            // so the diagram does not say "waiting until outreach resumes".
            if (stepType === WorkflowActionType.FORM) {
              await this.workflowRunWorkspaceService.updateWorkflowRunStepInfo({
                stepId,
                stepInfo: {
                  status: StepStatus.PENDING,
                  ...buildWorkflowRunStepDeferralClearPatch(),
                },
                workspaceId,
                workflowRunId: freshRun.id,
              });
              resumedRuns += 1;
              continue;
            }

            // Capacity waits: delay 0 + retryPendingStep so the send gate
            // recomputes window / spacing / rate limits with live config.
            await scheduleResumeDelayedWorkflowJob({
              delayedQueue: this.delayedQueue,
              data: {
                workspaceId,
                workflowRunId: freshRun.id,
                stepId,
                retryPendingStep: true,
              },
              delay: 0,
            });
            resumedRuns += 1;
          }

          const didKickIdleRun = await this.kickIdleRunningWorkflowRun({
            workspaceId,
            workflowRun: freshRun,
          });

          if (didKickIdleRun) {
            kickedIdleRuns += 1;
          }
        }

        return { resumedRuns, kickedIdleRuns };
      },
      authContext,
    );
  }

  async startCandidates({
    workspaceId,
    candidateIds,
    personIds,
    projectId,
    startAllQueuedInProject,
    apiToken,
    workspaceMemberId,
    origin,
    enrollmentPollTimeoutMs = OUTREACH_ENROLLMENT_POLL_TIMEOUT_MS,
  }: {
    workspaceId: string;
    candidateIds?: string[];
    personIds?: string[];
    projectId?: string | null;
    // "Whole table": every enrolled, not-yet-started QUEUED candidate of the project
    startAllQueuedInProject?: boolean;
    // Only needed to enroll a selection the CRM has never seen: the queued
    // upload-profiles job writes through the caller's token.
    apiToken?: string;
    workspaceMemberId?: string;
    origin?: string;
    enrollmentPollTimeoutMs?: number;
  }): Promise<{
    startedCandidates: number;
    unenrolledPersonIds: string[];
    enrollingPersonIds: string[];
    skippedDoNotContact: number;
    skippedReplied: number;
  }> {
    const uniqueCandidateIds = [
      ...new Set((candidateIds ?? []).filter(isNonEmptyString)),
    ];
    const uniquePersonIds = [
      ...new Set((personIds ?? []).filter(isNonEmptyString)),
    ];
    // People-tab rows that were never enrolled are keyed by content-hash ids;
    // only UUIDs can be looked up in the person/candidate tables.
    const { uuidPersonIds, hashPersonIds } =
      partitionSelectedPersonIds(uniquePersonIds);

    const isProjectWideStart =
      startAllQueuedInProject === true && isNonEmptyString(projectId);

    if (
      !isProjectWideStart &&
      uniqueCandidateIds.length === 0 &&
      uniquePersonIds.length === 0
    ) {
      return {
        startedCandidates: 0,
        unenrolledPersonIds: [],
        enrollingPersonIds: [],
        skippedDoNotContact: 0,
        skippedReplied: 0,
      };
    }

    // Selecting Start Outreach on a search hit used to reach Postgres as a hash
    // id in a uuid column (500) and then as "not enrolled". Resolve the
    // selection to Candidates by identity, enrolling the ones the CRM has never
    // seen so one click still starts outreach.
    const enrollmentResolution = await this.resolveAndEnrollSelectedPeople({
      workspaceId,
      projectId,
      hashPersonIds,
      apiToken,
      workspaceMemberId,
      origin,
      enrollmentPollTimeoutMs,
    });

    const allCandidateIds = [
      ...new Set([...uniqueCandidateIds, ...enrollmentResolution.candidateIds]),
    ];

    const authContext = buildSystemAuthContext(workspaceId);
    const entryStages = new Set([
      'QUEUED',
      'CONNECTION_ACCEPTED',
      'REPLIED',
      'MEETING_BOOKED',
    ]);

    return this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        const candidateRepository =
          await this.globalWorkspaceOrmManager.getRepository<
            OutreachCandidateRecord
          >(workspaceId, 'candidate', { shouldBypassPermissionChecks: true });

        let candidates;

        if (isProjectWideStart) {
          const queuedCandidates = await candidateRepository.find({
            where: { projectId, outreachSequenceStage: 'QUEUED' },
          });

          // Skip already started and explicitly stopped prospects; a bulk
          // start must not silently undo a Stop Outreach.
          candidates = queuedCandidates.filter(
            (candidate) =>
              !isCandidateFlagTrue(candidate, 'startOutreach') &&
              !isCandidateFlagTrue(candidate, 'stopOutreach'),
          );
        } else {
          const foundById =
            allCandidateIds.length > 0
              ? await candidateRepository.find({
                  where: { id: In(allCandidateIds) },
                })
              : [];
          const foundByPersonId =
            uuidPersonIds.length > 0
              ? await candidateRepository.find({
                  where: { peopleId: In(uuidPersonIds) },
                })
              : [];

          // One prospect can arrive as both a candidate id and a person id.
          const candidateById = new Map(
            [...foundById, ...foundByPersonId].map((candidate) => [
              candidate.id,
              candidate,
            ]),
          );

          candidates = [...candidateById.values()];
        }

        if (isNonEmptyString(projectId)) {
          candidates = candidates.filter(
            (candidate) => candidate.projectId === projectId,
          );
        }

        // A reply can land on any round's candidate (round 1 usually owns it
        // while we are starting round 2), so the check is workspace-wide. Rows
        // whose prospect already engaged are dropped instead of started, and
        // the caller reports the count instead of silently doing nothing.
        const repliedPersonIds = await this.loadRepliedPersonIds({
          candidateRepository,
          personIds: candidates
            .map((candidate) => candidate.peopleId)
            .filter(isNonEmptyString),
        });
        const startableCandidates = candidates.filter(
          (candidate) => !repliedPersonIds.has(candidate.peopleId ?? ''),
        );
        const skippedReplied = candidates.length - startableCandidates.length;

        candidates = startableCandidates;

        let startedCandidates = 0;

        for (const candidate of candidates) {
          const currentStage = candidate.outreachSequenceStage ?? '';
          const nextStage = entryStages.has(currentStage)
            ? currentStage
            : 'QUEUED';

          // Sequencer watches candidate.upserted with startOutreach=true.
          // Re-start after a FAILED run must flip false→true or the update
          // is a no-op and no new run is enqueued.
          if (isCandidateFlagTrue(candidate, 'startOutreach')) {
            await candidateRepository.update(
              candidate.id,
              buildCandidateFlagsPatchUpdate(candidate, {
                startOutreach: false,
              }),
            );
          }

          await candidateRepository.update(candidate.id, {
            ...buildCandidateFlagsPatchUpdate(candidate, {
              startOutreach: true,
              stopOutreach: false,
            }),
            outreachSequenceStage: nextStage,
          });
          startedCandidates += 1;
        }

        // People saved to CRM but never enrolled have no candidate row, so
        // there is nothing for the sequencer's candidate.upserted trigger to fire on.
        const enrolledPersonIds = new Set(
          candidates
            .map((candidate) => candidate.peopleId)
            .filter(isNonEmptyString),
        );
        const unenrolledPersonIds = uuidPersonIds.filter(
          (personId) => !enrolledPersonIds.has(personId),
        );

        return {
          startedCandidates,
          unenrolledPersonIds: [
            ...unenrolledPersonIds,
            ...enrollmentResolution.unenrolledPersonIds,
          ],
          enrollingPersonIds: enrollmentResolution.enrollingPersonIds,
          skippedDoNotContact: enrollmentResolution.skippedDoNotContact,
          skippedReplied,
        };
      },
      authContext,
    );
  }

  // Workspace-wide on purpose: a reply is recorded on whichever round's
  // candidate received it, and starting another round must not reopen a thread
  // the prospect already answered.
  private async loadRepliedPersonIds({
    candidateRepository,
    personIds,
  }: {
    candidateRepository: {
      find: (options: {
        where: Record<string, unknown>;
      }) => Promise<OutreachCandidateRecord[]>;
    };
    personIds: string[];
  }): Promise<Set<string>> {
    const uniquePersonIds = [...new Set(personIds)];

    if (uniquePersonIds.length === 0) {
      return new Set();
    }

    const rows = await candidateRepository.find({
      where: { peopleId: In(uniquePersonIds) },
    });

    return new Set(
      rows
        .filter((row) => hasOutreachReply(row))
        .map((row) => row.peopleId)
        .filter(isNonEmptyString),
    );
  }

  // Maps a People-tab hash selection onto enrolled Candidates: people who are
  // already Candidates resolve immediately, the rest are queued through
  // upload-profiles and matched again until the worker creates them.
  private async resolveAndEnrollSelectedPeople({
    workspaceId,
    projectId,
    hashPersonIds,
    apiToken,
    workspaceMemberId,
    origin,
    enrollmentPollTimeoutMs,
  }: {
    workspaceId: string;
    projectId?: string | null;
    hashPersonIds: string[];
    apiToken?: string;
    workspaceMemberId?: string;
    origin?: string;
    enrollmentPollTimeoutMs: number;
  }): Promise<{
    candidateIds: string[];
    unenrolledPersonIds: string[];
    enrollingPersonIds: string[];
    skippedDoNotContact: number;
  }> {
    const nothingResolved = {
      candidateIds: [],
      enrollingPersonIds: [],
      skippedDoNotContact: 0,
    };

    if (hashPersonIds.length === 0) {
      return { ...nothingResolved, unenrolledPersonIds: [] };
    }

    // The People cache is project-scoped, and upload-profiles writes through a
    // caller token. Without either there is nothing to read and nothing to write.
    const canEnroll =
      isNonEmptyString(projectId) &&
      projectId !== 'project-id' &&
      isNonEmptyString(apiToken) &&
      this.processCandidatesService.isDataSourceSupported(
        OUTREACH_ENROLLMENT_DATA_SOURCE,
      );

    if (!canEnroll) {
      return { ...nothingResolved, unenrolledPersonIds: hashPersonIds };
    }

    const payload = await this.outreachPeopleCacheService.get(
      workspaceId,
      projectId,
    );
    const rowById = new Map(
      (payload?.people ?? []).map((person) => [person.id, person]),
    );

    const selectedRows: EnrollablePersonRow[] = [];
    const unknownPersonIds: string[] = [];

    for (const personId of hashPersonIds) {
      const row = rowById.get(personId);

      if (isDefined(row)) {
        selectedRows.push({
          id: row.id,
          name: row.name,
          title: row.title,
          companyName: row.companyName,
          linkedinUrl: row.linkedinUrl,
          email: row.email,
        });
      } else {
        unknownPersonIds.push(personId);
      }
    }

    let enrollmentIndex = await this.loadEnrollmentIndex({
      workspaceId,
      projectId,
      includeDoNotContact: true,
    });

    const candidateIds = new Set<string>();
    const rowsToEnroll: EnrollablePersonRow[] = [];
    const unenrollablePersonIds: string[] = [];
    let skippedDoNotContact = 0;

    for (const row of selectedRows) {
      const candidateId = matchCandidateByPersonIdentity(row, enrollmentIndex);

      if (isDefined(candidateId)) {
        candidateIds.add(candidateId);
        continue;
      }

      if (isPersonKnownDoNotContact(row, enrollmentIndex)) {
        skippedDoNotContact += 1;
        continue;
      }

      // upload-profiles matches on the LinkedIn profile, so a row without one
      // can never become a Candidate.
      if (!isNonEmptyString(row.name) || !isNonEmptyString(row.linkedinUrl)) {
        unenrollablePersonIds.push(row.id);
        continue;
      }

      rowsToEnroll.push(row);
    }

    const unresolvedPersonIds = [
      ...unknownPersonIds,
      ...unenrollablePersonIds,
    ];

    if (rowsToEnroll.length === 0) {
      return {
        candidateIds: [...candidateIds],
        unenrolledPersonIds: unresolvedPersonIds,
        enrollingPersonIds: [],
        skippedDoNotContact,
      };
    }

    try {
      await this.processCandidatesService.queueRawDataForProcessing(
        buildEnrollmentProfileRows(rowsToEnroll),
        OUTREACH_ENROLLMENT_DATA_SOURCE,
        projectId,
        OUTREACH_ENROLLMENT_JOB_NAME,
        workspaceMemberId ?? '',
        new Date().toISOString(),
        origin ?? '',
        apiToken,
        undefined,
        { workspaceId },
      );
    } catch (error) {
      this.logger.warn(
        `Failed to enroll selected prospects: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      return {
        candidateIds: [...candidateIds],
        unenrolledPersonIds: [
          ...unresolvedPersonIds,
          ...rowsToEnroll.map((row) => row.id),
        ],
        enrollingPersonIds: [],
        skippedDoNotContact,
      };
    }

    // The upload is queued, so the Candidate rows land when the worker has
    // transformed the batch. Wait a bounded time so one click ends in outreach
    // actually starting rather than in a second manual step.
    const pendingById = new Map(rowsToEnroll.map((row) => [row.id, row]));
    const deadline = Date.now() + Math.max(0, enrollmentPollTimeoutMs);

    while (pendingById.size > 0 && Date.now() < deadline) {
      await sleep(OUTREACH_ENROLLMENT_POLL_INTERVAL_MS);

      enrollmentIndex = await this.loadEnrollmentIndex({
        workspaceId,
        projectId,
        includeDoNotContact: false,
      });

      for (const [personId, row] of pendingById) {
        const candidateId = matchCandidateByPersonIdentity(
          row,
          enrollmentIndex,
        );

        if (isDefined(candidateId)) {
          candidateIds.add(candidateId);
          pendingById.delete(personId);
        }
      }
    }

    if (pendingById.size > 0) {
      this.logger.log(
        `Enrollment still running for ${pendingById.size} selected prospect(s) in project ${projectId}`,
      );
    }

    return {
      candidateIds: [...candidateIds],
      unenrolledPersonIds: unresolvedPersonIds,
      enrollingPersonIds: [...pendingById.keys()],
      skippedDoNotContact,
    };
  }

  // Identity keys of the project's Candidates, plus (on the first pass) every
  // do-not-contact person in the workspace: a Stop in another project must
  // still keep that person out of a fresh Start.
  private async loadEnrollmentIndex({
    workspaceId,
    projectId,
    includeDoNotContact,
  }: {
    workspaceId: string;
    projectId: string;
    includeDoNotContact: boolean;
  }): Promise<EnrollmentIndex> {
    const authContext = buildSystemAuthContext(workspaceId);

    return this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        const candidateRepository =
          await this.globalWorkspaceOrmManager.getRepository<
            CandidateRecord & { peopleId?: string | null }
          >(workspaceId, 'candidate', { shouldBypassPermissionChecks: true });
        const candidates = await candidateRepository.find({
          where: { projectId },
          take: OUTREACH_ENROLLMENT_INDEX_LIMIT,
        });

        const personRepository =
          await this.globalWorkspaceOrmManager.getRepository<PersonIdentityRecord>(
            workspaceId,
            'person',
            { shouldBypassPermissionChecks: true },
          );

        const candidatePersonIds = candidates
          .map((candidate) => candidate.peopleId)
          .filter(isNonEmptyString);
        const candidatePeople =
          candidatePersonIds.length > 0
            ? await personRepository.find({
                where: { id: In(candidatePersonIds) },
              })
            : [];
        const personById = new Map(
          candidatePeople.map((person) => [person.id, person]),
        );

        const identities: EnrolledPersonIdentity[] = [];

        for (const candidate of candidates) {
          const person = isNonEmptyString(candidate.peopleId)
            ? personById.get(candidate.peopleId)
            : undefined;

          if (!isDefined(person)) {
            continue;
          }

          identities.push({
            candidateId: candidate.id,
            ...readPersonIdentity(person),
            doNotContact: person.doNotContact === true,
          });
        }

        if (includeDoNotContact) {
          const blockedPeople = await personRepository.find({
            where: { doNotContact: true },
            take: OUTREACH_ENROLLMENT_INDEX_LIMIT,
          });

          for (const person of blockedPeople) {
            identities.push({
              ...readPersonIdentity(person),
              doNotContact: true,
            });
          }
        }

        return buildEnrollmentIndex(identities);
      },
      authContext,
    );
  }

  // Stop must not enroll anyone, so People-tab hash ids are only mapped onto
  // Candidates that already exist. Anything still unmatched is left alone.
  private async resolveEnrolledCandidateIdsForSelectedPeople({
    workspaceId,
    projectId,
    hashPersonIds,
  }: {
    workspaceId: string;
    projectId?: string | null;
    hashPersonIds: string[];
  }): Promise<string[]> {
    if (hashPersonIds.length === 0) {
      return [];
    }

    // The People cache is keyed by project; without one the hash ids cannot be
    // mapped to a person at all.
    if (!isNonEmptyString(projectId) || projectId === 'project-id') {
      return [];
    }

    const payload = await this.outreachPeopleCacheService.get(
      workspaceId,
      projectId,
    );
    const rowById = new Map(
      (payload?.people ?? []).map((person) => [person.id, person]),
    );

    const enrollmentIndex = await this.loadEnrollmentIndex({
      workspaceId,
      projectId,
      includeDoNotContact: false,
    });

    const candidateIds = new Set<string>();

    for (const personId of hashPersonIds) {
      const row = rowById.get(personId);

      if (!isDefined(row)) {
        continue;
      }

      const candidateId = matchCandidateByPersonIdentity(
        {
          name: row.name,
          companyName: row.companyName,
          email: row.email,
          linkedinUrl: row.linkedinUrl,
        },
        enrollmentIndex,
      );

      if (isDefined(candidateId)) {
        candidateIds.add(candidateId);
      }
    }

    return [...candidateIds];
  }

  async stopCandidates({
    workspaceId,
    projectId,
    candidateIds,
    personIds,
  }: {
    workspaceId: string;
    projectId?: string | null;
    candidateIds?: string[];
    personIds?: string[];
  }): Promise<{ stoppedCandidates: number; stoppedRuns: number }> {
    const uniqueCandidateIds = [
      ...new Set((candidateIds ?? []).filter(isNonEmptyString)),
    ];
    const uniquePersonIds = [
      ...new Set((personIds ?? []).filter(isNonEmptyString)),
    ];
    // A People-tab row that is not enrolled has a content-hash id, which
    // Postgres rejects against the uuid peopleId column. Resolve what can be
    // resolved and ignore the rest instead of failing the whole request.
    const { uuidPersonIds, hashPersonIds } =
      partitionSelectedPersonIds(uniquePersonIds);

    if (uniqueCandidateIds.length === 0 && uniquePersonIds.length === 0) {
      return { stoppedCandidates: 0, stoppedRuns: 0 };
    }

    const candidateIdsFromPeopleCache =
      await this.resolveEnrolledCandidateIdsForSelectedPeople({
        workspaceId,
        projectId,
        hashPersonIds,
      });
    const allCandidateIds = [
      ...new Set([...uniqueCandidateIds, ...candidateIdsFromPeopleCache]),
    ];

    const authContext = buildSystemAuthContext(workspaceId);

    return this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        const candidateRepository =
          await this.globalWorkspaceOrmManager.getRepository<
            OutreachCandidateRecord
          >(workspaceId, 'candidate', { shouldBypassPermissionChecks: true });

        const foundById =
          allCandidateIds.length > 0
            ? await candidateRepository.find({
                where: { id: In(allCandidateIds) },
              })
            : [];
        const foundByPersonId =
          uuidPersonIds.length > 0
            ? await candidateRepository.find({
                where: { peopleId: In(uuidPersonIds) },
              })
            : [];

        let candidates = [
          ...new Map(
            [...foundById, ...foundByPersonId].map((candidate) => [
              candidate.id,
              candidate,
            ]),
          ).values(),
        ];

        if (isNonEmptyString(projectId)) {
          candidates = candidates.filter(
            (candidate) => candidate.projectId === projectId,
          );
        }

        let stoppedCandidates = 0;
        let stoppedRuns = 0;
        const personIdsToBlock = new Set<string>();

        for (const candidate of candidates) {
          await candidateRepository.update(candidate.id, {
            outreachSequenceStage: 'STOPPED',
            ...buildCandidateFlagsPatchUpdate(candidate, {
              startOutreach: false,
              stopOutreach: true,
            }),
          });
          stoppedCandidates += 1;

          if (isNonEmptyString(candidate.peopleId)) {
            personIdsToBlock.add(candidate.peopleId);
          }
        }

        if (personIdsToBlock.size > 0) {
          const personRepository =
            await this.globalWorkspaceOrmManager.getRepository<
              ObjectLiteral & { id: string; doNotContact?: boolean | null }
            >(workspaceId, 'person', { shouldBypassPermissionChecks: true });

          await personRepository.update(
            { id: In([...personIdsToBlock]) },
            { doNotContact: true },
          );
        }

        if (candidates.length === 0) {
          return { stoppedCandidates, stoppedRuns };
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

  // Stage B (pinned / Per Enrolled Candidate) + Stage C (Enrolled Person Updated).
  async resolvePauseResumeWorkflowIds({
    workspaceId,
    projectId,
  }: {
    workspaceId: string;
    projectId: string;
  }): Promise<Set<string>> {
    const projectRepository =
      await this.globalWorkspaceOrmManager.getRepository<ProjectRecord>(
        workspaceId,
        'project',
        { shouldBypassPermissionChecks: true },
      );
    const project = await projectRepository.findOne({
      where: { id: projectId },
    });

    const projectWorkflowIds = collectOutreachSequencerWorkflowIdsFromProject({
      outreachWorkflowId: project?.outreachWorkflowId,
      outreachConfig: project?.outreachConfig,
      experimentConfig: project?.experimentConfig,
    });

    const workflowRepository =
      await this.globalWorkspaceOrmManager.getRepository<
        ObjectLiteral & { id: string; name?: string | null }
      >(workspaceId, 'workflow', { shouldBypassPermissionChecks: true });
    const workflowsMatchedByName = await workflowRepository.find({
      where: {
        name: In([...OUTREACH_SEQUENCER_SEEDED_WORKFLOW_NAMES]),
      },
      select: { id: true },
      take: 50,
    });

    return mergeOutreachSequencerWorkflowIds({
      projectWorkflowIds,
      workflowsMatchedByName,
    });
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

        return candidate?.projectId ?? null;
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
      where: { projectId: projectId },
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

  private async kickIdleRunningWorkflowRun({
    workspaceId,
    workflowRun,
  }: {
    workspaceId: string;
    workflowRun: WorkflowRunWorkspaceEntity;
  }): Promise<boolean> {
    const steps = workflowRun.state?.flow?.steps;

    if (!isDefined(steps) || steps.length === 0) {
      return false;
    }

    const stepInfos = workflowRun.state?.stepInfos ?? {};
    const runnableStepIds = getRunnableStepIds({
      steps,
      stepInfos,
    });

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

    this.logger.log(
      `Kicked idle workflow run ${workflowRun.id} for steps: ${runnableStepIds.join(', ')}`,
    );

    return true;
  }
}
