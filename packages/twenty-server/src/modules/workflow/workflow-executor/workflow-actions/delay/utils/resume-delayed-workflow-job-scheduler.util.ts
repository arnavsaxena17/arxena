import { isDefined } from 'twenty-shared/utils';

import { type QueueJobOptions } from 'src/engine/core-modules/message-queue/drivers/interfaces/job-options.interface';
import { MessageQueueService } from 'src/engine/core-modules/message-queue/services/message-queue.service';
import { RESUME_DELAYED_WORKFLOW_JOB_NAME } from 'src/modules/workflow/workflow-executor/workflow-actions/delay/contants/resume-delayed-workflow-job-name';
import { type ResumeDelayedWorkflowJobData } from 'src/modules/workflow/workflow-executor/workflow-actions/delay/types/resume-delayed-workflow-job-data.type';

export const buildResumeDelayedWorkflowJobOptions = ({
  workflowRunId,
  stepId,
  delay,
}: {
  workflowRunId: string;
  stepId: string;
  delay?: number;
}): QueueJobOptions => ({
  id: `${workflowRunId}:${stepId}`,
  allowDuplicatedPrefixes: true,
  delay,
});

export const cancelResumeDelayedWorkflowJobs = async ({
  delayedQueue,
  workflowRunId,
  stepId,
}: {
  delayedQueue: MessageQueueService;
  workflowRunId: string;
  stepId?: string;
}): Promise<number> => {
  if (typeof delayedQueue.getInFlightJobs !== 'function') {
    return 0;
  }

  const jobs =
    await delayedQueue.getInFlightJobs<ResumeDelayedWorkflowJobData>();

  let removed = 0;

  for (const job of jobs) {
    const data = job.data;

    if (data.workflowRunId !== workflowRunId) {
      continue;
    }

    if (stepId && data.stepId !== stepId) {
      continue;
    }

    if (!isDefined(job.id)) {
      continue;
    }

    if (typeof delayedQueue.removeJob !== 'function') {
      continue;
    }

    await delayedQueue.removeJob(job.id);
    removed += 1;
  }

  return removed;
};

export const scheduleResumeDelayedWorkflowJob = async ({
  delayedQueue,
  data,
  delay,
}: {
  delayedQueue: MessageQueueService;
  data: ResumeDelayedWorkflowJobData;
  delay?: number;
}): Promise<void> => {
  await cancelResumeDelayedWorkflowJobs({
    delayedQueue,
    workflowRunId: data.workflowRunId,
    stepId: data.stepId,
  });

  await delayedQueue.add<ResumeDelayedWorkflowJobData>(
    RESUME_DELAYED_WORKFLOW_JOB_NAME,
    data,
    buildResumeDelayedWorkflowJobOptions({
      workflowRunId: data.workflowRunId,
      stepId: data.stepId,
      delay,
    }),
  );
};
