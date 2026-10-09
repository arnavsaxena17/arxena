import { Logger } from '@nestjs/common';

import { EventLogEmitterService } from 'src/engine/core-modules/event-logs/emit/event-log-emitter.service';
import { type MessageQueueService } from 'src/engine/core-modules/message-queue/services/message-queue.service';
import { UsageEventRetryJob } from 'src/engine/core-modules/usage/jobs/usage-event-retry.job';
import { UsageOperationType } from 'src/engine/core-modules/usage/enums/usage-operation-type.enum';
import { UsageResourceType } from 'src/engine/core-modules/usage/enums/usage-resource-type.enum';
import { UsageUnit } from 'src/engine/core-modules/usage/enums/usage-unit.enum';
import { UsageEventListener } from 'src/engine/core-modules/usage/listeners/usage-event.listener';
import { type UsageEvent } from 'src/engine/core-modules/usage/types/usage-event.type';
import { type CustomWorkspaceEventBatch } from 'src/engine/workspace-event-emitter/types/custom-workspace-batch-event.type';

const USAGE_EVENT: UsageEvent = {
  resourceType: UsageResourceType.WORKFLOW,
  operationType: UsageOperationType.WORKFLOW_EXECUTION,
  quantity: 1,
  unit: UsageUnit.INVOCATION,
  creditsUsedMicro: 1,
};

const buildBatch = (
  overrides: Partial<CustomWorkspaceEventBatch<UsageEvent>> = {},
): CustomWorkspaceEventBatch<UsageEvent> =>
  ({
    workspaceId: 'ws-1',
    events: [USAGE_EVENT],
    ...overrides,
  }) as CustomWorkspaceEventBatch<UsageEvent>;

describe('UsageEventListener', () => {
  let listener: UsageEventListener;
  let dispatch: jest.Mock;
  let isEnabled: jest.Mock;
  let addToQueue: jest.Mock;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    dispatch = jest.fn().mockResolvedValue(undefined);
    isEnabled = jest.fn().mockReturnValue(true);

    addToQueue = jest.fn().mockResolvedValue(undefined);

    listener = new UsageEventListener(
      {
        dispatch,
        isEnabled,
      } as unknown as EventLogEmitterService,
      { add: addToQueue } as unknown as MessageQueueService,
    );
  });

  it('dispatchs a usageEvent envelope for each event in the batch', async () => {
    await listener.handleUsageRecordedEvent(buildBatch());

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch.mock.calls[0][0]).toEqual([
      expect.objectContaining({
        table: 'usageEvent',
        row: expect.objectContaining({ workspaceId: 'ws-1' }),
      }),
    ]);
  });

  it('skips when the batch has no workspaceId', async () => {
    await listener.handleUsageRecordedEvent(
      buildBatch({ workspaceId: undefined }),
    );

    expect(dispatch).not.toHaveBeenCalled();
  });

  it('skips when no sink is configured', async () => {
    isEnabled.mockReturnValue(false);

    await listener.handleUsageRecordedEvent(buildBatch());

    expect(dispatch).not.toHaveBeenCalled();
  });

  it('does not fail the emitting flow when dispatch errors', async () => {
    dispatch.mockRejectedValue(new Error('clickhouse down'));

    await expect(
      listener.handleUsageRecordedEvent(buildBatch()),
    ).resolves.toBeUndefined();
  });

  it('schedules a retry with the envelopes when dispatch errors', async () => {
    dispatch.mockRejectedValue(new Error('clickhouse down'));

    await listener.handleUsageRecordedEvent(buildBatch());

    expect(addToQueue).toHaveBeenCalledWith(
      UsageEventRetryJob.name,
      expect.objectContaining({
        workspaceId: 'ws-1',
        attempt: 1,
        envelopes: [expect.objectContaining({ table: 'usageEvent' })],
      }),
      expect.objectContaining({ delay: expect.any(Number) }),
    );
  });

  it('does not schedule a retry when dispatch succeeds', async () => {
    await listener.handleUsageRecordedEvent(buildBatch());

    expect(addToQueue).not.toHaveBeenCalled();
  });

  it('still resolves when scheduling the retry also fails', async () => {
    dispatch.mockRejectedValue(new Error('clickhouse down'));
    addToQueue.mockRejectedValue(new Error('redis down'));

    await expect(
      listener.handleUsageRecordedEvent(buildBatch()),
    ).resolves.toBeUndefined();
  });
});
