export interface QueueJobOptions {
  id?: string;
  priority?: number;
  retryLimit?: number;
  /** BullMQ / drivers: delay before the job becomes active (ms). */
  delayMs?: number;
}

export interface QueueCronJobOptions extends QueueJobOptions {
  repeat: {
    every?: number;
    pattern?: string;
    limit?: number;
  };
}
