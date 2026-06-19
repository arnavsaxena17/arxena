export interface QueueJobOptions {
  id?: string;
  priority?: number;
  retryLimit?: number;
  /** BullMQ / drivers: delay before the job becomes active (ms). */
  delayMs?: number;
}

/** Stable job id + delay for sliding-window delayed jobs (reschedule replaces the timer). */
export type ScheduleDelayedJobOptions = {
  id: string;
  delayMs: number;
};

export interface QueueCronJobOptions extends QueueJobOptions {
  repeat: {
    every?: number;
    pattern?: string;
    limit?: number;
  };
}
