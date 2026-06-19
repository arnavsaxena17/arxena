import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import PgBoss from 'pg-boss';

import {
    QueueCronJobOptions,
    QueueJobOptions,
    ScheduleDelayedJobOptions,
} from 'src/engine/core-modules/message-queue/drivers/interfaces/job-options.interface';
import { MessageQueueDriver } from 'src/engine/core-modules/message-queue/drivers/interfaces/message-queue-driver.interface';
import { MessageQueueJob } from 'src/engine/core-modules/message-queue/interfaces/message-queue-job.interface';
import { MessageQueueWorkerOptions } from 'src/engine/core-modules/message-queue/interfaces/message-queue-worker-options.interface';

import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { getJobKey } from 'src/engine/core-modules/message-queue/utils/get-job-key.util';

export type PgBossDriverOptions = PgBoss.ConstructorOptions;

const DEFAULT_PG_BOSS_CRON_PATTERN_WHEN_NOT_PROVIDED = '*/1 * * * *';

export class PgBossDriver
  implements MessageQueueDriver, OnModuleInit, OnModuleDestroy
{
  private pgBoss: PgBoss;
  private readonly delayedJobIdsByStableKey = new Map<string, string>();

  constructor(options: PgBossDriverOptions) {
    this.pgBoss = new PgBoss(options);
  }

  async onModuleInit() {
    await this.pgBoss.start();
  }

  async onModuleDestroy() {
    await this.pgBoss.stop();
  }

  async work<T>(
    queueName: string,
    handler: (job: MessageQueueJob<T>) => Promise<void>,
    options?: MessageQueueWorkerOptions,
  ) {
    return this.pgBoss.work<T>(
      `${queueName}.*`,
      options?.concurrency
        ? {
            teamConcurrency: options.concurrency,
          }
        : {},
      async (job) => {
        // PGBoss work with wildcard job name
        const jobName = job.name.split('.')?.[1];

        if (!jobName) {
          throw new Error('Job name could not be splited from the job.');
        }

        await handler({
          data: job.data,
          id: job.id,
          name: jobName,
        });
      },
    );
  }

  async addCron<T>({
    queueName,
    jobName,
    data,
    options,
    jobId,
  }: {
    queueName: MessageQueue;
    jobName: string;
    data: T;
    options: QueueCronJobOptions;
    jobId?: string;
  }): Promise<void> {
    const name = `${queueName}.${getJobKey({ jobName, jobId })}`;

    await this.pgBoss.schedule(
      name,
      options.repeat.pattern ?? DEFAULT_PG_BOSS_CRON_PATTERN_WHEN_NOT_PROVIDED,
      data as object,
    );
  }

  async removeCron({
    queueName,
    jobName,
    jobId,
  }: {
    queueName: MessageQueue;
    jobName: string;
    jobId?: string;
  }): Promise<void> {
    const name = `${queueName}.${getJobKey({ jobName, jobId })}`;

    await this.pgBoss.unschedule(name);
  }

  async add<T>(
    queueName: MessageQueue,
    jobName: string,
    data: T,
    options?: QueueJobOptions,
  ): Promise<void> {
    const { delayMs, ...rest } = options ?? {};
    const sendOpts: Record<string, unknown> = options
      ? {
          ...rest,
          singletonKey: options?.id,
          useSingletonQueue: true, // When used with singletonKey, ensures only one job can be queued. See https://logsnag.com/blog/deep-dive-into-background-jobs-with-pg-boss-and-typescript
        }
      : {};

    if (delayMs != null && delayMs > 0) {
      sendOpts.startAfter = new Date(Date.now() + delayMs);
    }

    await this.pgBoss.send(
      `${queueName}.${jobName}`,
      data as object,
      sendOpts,
    );
  }

  async scheduleOrRescheduleDelayed<T>(
    queueName: MessageQueue,
    jobName: string,
    data: T,
    options: ScheduleDelayedJobOptions,
  ): Promise<void> {
    const trimmedJobId = options.id.trim();
    const delayMs = Math.max(0, options.delayMs);
    const jobNameWithQueue = `${queueName}.${jobName}`;
    const stableKey = `${queueName}:${trimmedJobId}`;

    await this.cancelDelayed(queueName, trimmedJobId);

    const createdJobId = await this.pgBoss.send(jobNameWithQueue, data as object, {
      singletonKey: trimmedJobId,
      useSingletonQueue: true,
      startAfter: new Date(Date.now() + delayMs),
    });

    if (createdJobId) {
      this.delayedJobIdsByStableKey.set(stableKey, createdJobId);
    }
  }

  async cancelDelayed(queueName: MessageQueue, jobId: string): Promise<void> {
    const trimmedJobId = jobId.trim();
    if (!trimmedJobId) {
      return;
    }

    const stableKey = `${queueName}:${trimmedJobId}`;
    const existingJobId = this.delayedJobIdsByStableKey.get(stableKey);

    if (!existingJobId) {
      return;
    }

    await this.pgBoss.cancel(existingJobId);
    this.delayedJobIdsByStableKey.delete(stableKey);
  }
}
