import { SetMetadata } from '@nestjs/common';

import { PROCESS_METADATA } from 'src/engine/core-modules/message-queue/message-queue.constants';

export type MessageQueueProcessOptions = {
  jobName: string;
  // Concurrency is configured per-queue in MESSAGE_QUEUE_WORKER_CONFIG.
  // Accepted here so object-form @Process({ jobName }) call sites type-check.
  concurrency?: number;
};

export function Process(
  jobNameOrOptions: string | MessageQueueProcessOptions,
): MethodDecorator {
  const jobName =
    typeof jobNameOrOptions === 'string'
      ? jobNameOrOptions
      : jobNameOrOptions.jobName;

  return SetMetadata(PROCESS_METADATA, { jobName });
}
