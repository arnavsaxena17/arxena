/**
 * BullMQ worker check for queued org-chart jobs (Apify / LinkedIn x-ray / Unipile).
 * Queue name must match twenty-server MessageQueue.orgchartApifyQueue.
 */
import { Queue } from 'bullmq';
import Redis from 'ioredis';

export const ORGCHART_APIFY_BULLMQ_QUEUE_NAME = 'orgchart-apify-queue';

/**
 * Throws if no BullMQ workers are registered for the org-chart queue on this Redis.
 * Call before awaiting Redis terminal events for queued=true responses.
 */
export async function assertOrgchartApifyQueueHasWorkers(
  redisUrl: string,
): Promise<void> {
  const connection = new Redis(redisUrl, { maxRetriesPerRequest: null });
  const queue = new Queue(ORGCHART_APIFY_BULLMQ_QUEUE_NAME, { connection });
  try {
    let count: number;
    try {
      count = await queue.getWorkersCount();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(
        `Could not read BullMQ worker count for queue "${ORGCHART_APIFY_BULLMQ_QUEUE_NAME}" on E2E_REDIS_URL (same Redis as twenty-server?). ${msg}`,
      );
    }
    if (count < 1) {
      throw new Error(
        `No BullMQ workers for queue "${ORGCHART_APIFY_BULLMQ_QUEUE_NAME}" (getWorkersCount=${count}). ` +
          `Queued org-chart jobs will not run, so Redis will never publish a terminal complete/error for requestId. ` +
          `Start the twenty-server worker process (BullMQ consumers for orgchart-apify-queue) with the same Redis as E2E_REDIS_URL, ` +
          `or set E2E_ORGCHART_MATRIX_RELAXED=1 / unset E2E_ORGCHART_ASSERT_COMPLETION to skip waiting.`,
      );
    }
    console.log(
      `[orgchart-matrix] BullMQ workers=${count} queue=${ORGCHART_APIFY_BULLMQ_QUEUE_NAME}`,
    );
  } finally {
    await queue.close();
    await connection.quit();
  }
}
