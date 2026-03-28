/**
 * Opt-in smoke test: verifies BullMQ `delay` (via QueueJobOptions.delayMs) against Redis.
 * Does not start the app or send any messages.
 *
 * Run (Redis must be reachable):
 *   RUN_BULLMQ_REDIS_DELAY_TEST=true REDIS_URL=redis://127.0.0.1:6379 yarn nx run twenty-server:test --testPathPattern=bullmq-delay.redis --skip-nx-cache
 */

import { Queue } from 'bullmq';
import IORedis from 'ioredis';

import { MessageQueue } from '../message-queue.constants';
import { BullMQDriver } from './bullmq.driver';

const RUN = process.env.RUN_BULLMQ_REDIS_DELAY_TEST === 'true';
const REDIS_URL =
  process.env.REDIS_URL ?? 'redis://127.0.0.1:6379';

const delayMs = 1500;

(RUN ? describe : describe.skip)('BullMQ delayed jobs (Redis, no messages)', () => {
  let redis: IORedis;
  let driver: BullMQDriver;

  beforeAll(() => {
    jest.useRealTimers();
  });

  afterAll(() => {
    jest.useFakeTimers();
  });

  beforeEach(async () => {
    redis = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });
    const cleanup = new Queue(MessageQueue.testQueue, {
      connection: redis,
    });
    await cleanup.obliterate({ force: true });
    await cleanup.close();

    driver = new BullMQDriver({ connection: redis });
    driver.register(MessageQueue.testQueue);
  });

  afterEach(async () => {
    await driver.onModuleDestroy();
    await redis.quit();
  });

  it(
    'runs the worker only after delayMs when using BullMQDriver.add',
    async () => {
      const processedAt: number[] = [];

      await driver.work<{ marker: number }>(
        MessageQueue.testQueue,
        async ({ data }) => {
          processedAt.push(Date.now());
          expect(data.marker).toBe(42);
        },
      );

      const started = Date.now();
      await driver.add(
        MessageQueue.testQueue,
        'DelaySmoke',
        { marker: 42 },
        { delayMs },
      );

      await new Promise<void>((resolve, reject) => {
        const t = setTimeout(() => {
          reject(
            new Error(
              `Job did not run within ${delayMs + 8000}ms — is Redis up?`,
            ),
          );
        }, delayMs + 8000);

        const check = () => {
          if (processedAt.length > 0) {
            clearTimeout(t);
            resolve();
            return;
          }
          setTimeout(check, 50);
        };
        check();
      });

      expect(processedAt).toHaveLength(1);
      const elapsed = processedAt[0] - started;
      expect(elapsed).toBeGreaterThanOrEqual(delayMs - 200);
    },
    20000,
  );
});
