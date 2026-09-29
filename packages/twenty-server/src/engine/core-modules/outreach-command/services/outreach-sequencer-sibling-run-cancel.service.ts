import { Injectable, Logger } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';
import { In, Not, type ObjectLiteral } from 'typeorm';

import { InjectMessageQueue } from 'src/engine/core-modules/message-queue/decorators/message-queue.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { MessageQueueService } from 'src/engine/core-modules/message-queue/services/message-queue.service';
import {
  isOlderWorkflowRunThan,
  readOutreachSequenceStageFromTriggerPayload,
  shouldCancelOutreachSequencerSiblingRuns,
} from 'src/engine/core-modules/outreach-command/utils/cancel-outreach-sequencer-sibling-runs.util';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';
import { WorkflowRunStatus } from 'src/modules/workflow/common/standard-objects/workflow-run.workspace-entity';
import { cancelResumeDelayedWorkflowJobs } from 'src/modules/workflow/workflow-executor/workflow-actions/delay/utils/resume-delayed-workflow-job-scheduler.util';
import { WorkflowRunWorkspaceService } from 'src/modules/workflow/workflow-runner/workflow-run/workflow-run.workspace-service';

type WorkflowNameRecord = ObjectLiteral & {
  id: string;
  name?: string | null;
};

type SiblingWorkflowRunRecord = ObjectLiteral & {
  id: string;
  createdAt?: string | Date | null;
  status: WorkflowRunStatus;
};

const OPEN_SIBLING_STATUSES = [
  WorkflowRunStatus.RUNNING,
  WorkflowRunStatus.ENQUEUED,
  WorkflowRunStatus.NOT_STARTED,
] as const;

// When Candidate Sequencer re-enters on CONNECTION_ACCEPTED / REPLIED, stop older
// open runs for the same candidate+workflow so delayed FU / accept waits cannot
// fire after a newer cycle has already started.
@Injectable()
export class OutreachSequencerSiblingRunCancelService {
  private readonly logger = new Logger(
    OutreachSequencerSiblingRunCancelService.name,
  );

  constructor(
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
    private readonly workflowRunWorkspaceService: WorkflowRunWorkspaceService,
    @InjectMessageQueue(MessageQueue.delayedJobsQueue)
    private readonly delayedQueue: MessageQueueService,
  ) {}

  async cancelOlderSiblingRunsForNewSequencerRun({
    workspaceId,
    workflowRunId,
  }: {
    workspaceId: string;
    workflowRunId: string;
  }): Promise<{ stoppedRunIds: string[] }> {
    const authContext = buildSystemAuthContext(workspaceId);

    return this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        const workflowRun =
          await this.workflowRunWorkspaceService.getWorkflowRunOrFail({
            workspaceId,
            workflowRunId,
          });

        const candidateId = workflowRun.candidateId;

        if (!isNonEmptyString(candidateId)) {
          return { stoppedRunIds: [] };
        }

        const workflowRepository =
          await this.globalWorkspaceOrmManager.getRepository<WorkflowNameRecord>(
            workspaceId,
            'workflow',
            { shouldBypassPermissionChecks: true },
          );
        const workflow = await workflowRepository.findOne({
          where: { id: workflowRun.workflowId },
        });

        const entryStage = readOutreachSequenceStageFromTriggerPayload(
          workflowRun.state?.stepInfos?.trigger?.result,
        );

        if (
          !shouldCancelOutreachSequencerSiblingRuns({
            workflowName: workflow?.name,
            entryStage,
            candidateId,
          })
        ) {
          return { stoppedRunIds: [] };
        }

        const workflowRunRepository =
          await this.globalWorkspaceOrmManager.getRepository<SiblingWorkflowRunRecord>(
            workspaceId,
            'workflowRun',
            { shouldBypassPermissionChecks: true },
          );

        const openSiblingRuns = await workflowRunRepository.find({
          where: {
            candidateId,
            workflowId: workflowRun.workflowId,
            id: Not(workflowRunId),
            status: In([...OPEN_SIBLING_STATUSES]),
          },
          take: 100,
        });

        const olderSiblingRuns = openSiblingRuns.filter((siblingRun) =>
          isOlderWorkflowRunThan({
            siblingCreatedAt: siblingRun.createdAt,
            currentCreatedAt: workflowRun.createdAt,
          }),
        );

        const stoppedRunIds: string[] = [];

        for (const siblingRun of olderSiblingRuns) {
          try {
            await cancelResumeDelayedWorkflowJobs({
              delayedQueue: this.delayedQueue,
              workflowRunId: siblingRun.id,
            });

            await this.workflowRunWorkspaceService.endWorkflowRun({
              workspaceId,
              workflowRunId: siblingRun.id,
              status: WorkflowRunStatus.STOPPED,
              error: `Superseded by newer Candidate Sequencer run ${workflowRunId} (${entryStage})`,
            });
            stoppedRunIds.push(siblingRun.id);
          } catch (error) {
            this.logger.warn(
              `Failed to stop sibling sequencer run ${siblingRun.id} for candidate ${candidateId}: ${
                error instanceof Error ? error.message : String(error)
              }`,
            );
          }
        }

        if (stoppedRunIds.length > 0) {
          this.logger.log(
            `Stopped ${stoppedRunIds.length} older Candidate Sequencer run(s) for candidate ${candidateId} on ${entryStage} entry ${workflowRunId}`,
          );
        }

        return { stoppedRunIds };
      },
      authContext,
    );
  }
}
