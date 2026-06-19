import { Logger } from '@nestjs/common';

import { QueueJobOptions, ScheduleDelayedJobOptions } from 'src/engine/core-modules/message-queue/drivers/interfaces/job-options.interface';
import { MessageQueueDriver } from 'src/engine/core-modules/message-queue/drivers/interfaces/message-queue-driver.interface';
import {
    MessageQueueJob,
    MessageQueueJobData,
} from 'src/engine/core-modules/message-queue/interfaces/message-queue-job.interface';

import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';

export class SyncDriver implements MessageQueueDriver {
  private readonly logger = new Logger(SyncDriver.name);
  private workersMap: {
    [queueName: string]: (job: MessageQueueJob) => Promise<void> | void;
  } = {};
  private readonly delayedJobs = new Map<
    string,
    { queueName: MessageQueue; timeoutId: NodeJS.Timeout }
  >();

  constructor() {}

  async add<T extends MessageQueueJobData>(
    queueName: MessageQueue,
    jobName: string,
    data: T,
    options?: QueueJobOptions,
  ): Promise<void> {
    const delayMs = options?.delayMs ?? 0;
    if (delayMs > 0) {
      setTimeout(() => {
        void this.processJob(queueName, { id: '', name: jobName, data });
      }, delayMs);
      return;
    }
    await this.processJob(queueName, { id: '', name: jobName, data });
  }

  async addCron<T extends MessageQueueJobData | undefined>({
    queueName,
    jobName,
    data,
  }: {
    queueName: MessageQueue;
    jobName: string;
    data: T;
  }): Promise<void> {
    this.logger.log(`Running cron job with SyncDriver`);
    await this.processJob(queueName, {
      id: '',
      name: jobName,
      // TODO: Fix this type issue
      data: data as any,
    });
  }

  async removeCron({ queueName }: { queueName: MessageQueue }) {
    this.logger.log(`Removing '${queueName}' cron job with SyncDriver`);
  }

  async scheduleOrRescheduleDelayed<T extends MessageQueueJobData>(
    queueName: MessageQueue,
    jobName: string,
    data: T,
    options: ScheduleDelayedJobOptions,
  ): Promise<void> {
    const trimmedJobId = options.id.trim();
    const delayMs = Math.max(0, options.delayMs);
    const existing = this.delayedJobs.get(trimmedJobId);

    if (existing) {
      clearTimeout(existing.timeoutId);
      this.delayedJobs.delete(trimmedJobId);
    }

    const timeoutId = setTimeout(() => {
      this.delayedJobs.delete(trimmedJobId);
      void this.processJob(queueName, {
        id: trimmedJobId,
        name: jobName,
        data,
      });
    }, delayMs);

    this.delayedJobs.set(trimmedJobId, { queueName, timeoutId });
  }

  async cancelDelayed(_queueName: MessageQueue, jobId: string): Promise<void> {
    const trimmedJobId = jobId.trim();
    const existing = this.delayedJobs.get(trimmedJobId);

    if (!existing) {
      return;
    }

    clearTimeout(existing.timeoutId);
    this.delayedJobs.delete(trimmedJobId);
  }

  work<T extends MessageQueueJobData>(
    queueName: MessageQueue,
    handler: (job: MessageQueueJob<T>) => Promise<void> | void,
  ) {
    this.logger.log(`Registering handler for queue: ${queueName}`);
    this.workersMap[queueName] = handler;
  }

  async processJob<T extends MessageQueueJobData>(
    queueName: string,
    job: MessageQueueJob<T>,
  ) {
    const worker = this.workersMap[queueName];

    if (worker) {
      await worker(job);
    } else {
      this.logger.error(`No handler found for job: ${queueName}`);
    }
  }
}
