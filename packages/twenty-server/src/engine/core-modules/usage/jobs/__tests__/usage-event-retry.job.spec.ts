import { Logger } from '@nestjs/common';

import { type EventLogEmitterService } from 'src/engine/core-modules/event-logs/emit/event-log-emitter.service';
import { type WorkspaceEventEnvelope } from 'src/engine/core-modules/event-logs/types/workspace-event-envelope.type';
import { type MessageQueueService } from 'src/engine/core-modules/message-queue/services/message-queue.service';
import { USAGE_EVENT_RETRY_MAX_ATTEMPTS } from 'src/engine/core-modules/usage/constants/usage-event-retry.constant';
import {
  getUsageEventRetryDelayMs,
  UsageEventRetryJob,
} from 'src/engine/core-modules/usage/jobs/usage-event-retry.job';

const ENVELOPES = [
  { table: 'usageEvent', row: { workspaceId: 'ws-1' } },
] as unknown as WorkspaceEventEnvelope[];

describe('UsageEventRetryJob', () => {
  let job: UsageEventRetryJob;
  let dispatch: jest.Mock;
  let addToQueue: jest.Mock;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    dispatch = jest.fn().mockResolvedValue(undefined);
    addToQueue = jest.fn().mockResolvedValue(undefined);

    job = new UsageEventRetryJob(
      { dispatch } as unknown as EventLogEmitterService,
      { add: addToQueue } as unknown as MessageQueueService,
    );
  });

  it('should dispatch the stored envelopes without re-queueing when the write succeeds', async () => {
    await job.handle({ workspaceId: 'ws-1', envelopes: ENVELOPES, attempt: 1 });

    expect(dispatch).toHaveBeenCalledWith(ENVELOPES);
    expect(addToQueue).not.toHaveBeenCalled();
  });

  it('should re-queue with the next attempt and a longer delay when the write fails', async () => {
    dispatch.mockRejectedValue(new Error('clickhouse down'));

    await job.handle({ workspaceId: 'ws-1', envelopes: ENVELOPES, attempt: 2 });

    expect(addToQueue).toHaveBeenCalledWith(
      UsageEventRetryJob.name,
      { workspaceId: 'ws-1', envelopes: ENVELOPES, attempt: 3 },
      { delay: getUsageEventRetryDelayMs(2) },
    );
  });

  it('should stop retrying and log the payload after the maximum attempts', async () => {
    dispatch.mockRejectedValue(new Error('clickhouse down'));
    const errorSpy = jest.spyOn(Logger.prototype, 'error');

    await job.handle({
      workspaceId: 'ws-1',
      envelopes: ENVELOPES,
      attempt: USAGE_EVENT_RETRY_MAX_ATTEMPTS,
    });

    expect(addToQueue).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('payload='),
      expect.any(Error),
    );
  });

  it('should double the delay on each attempt', () => {
    expect(getUsageEventRetryDelayMs(1)).toBe(30_000);
    expect(getUsageEventRetryDelayMs(2)).toBe(60_000);
    expect(getUsageEventRetryDelayMs(3)).toBe(120_000);
  });
});
