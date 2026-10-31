import { ProviderCallLogService } from 'src/engine/core-modules/provider-call-log/services/provider-call-log.service';
import {
  getProviderCallContext,
  withProviderCallContext,
} from 'src/engine/core-modules/provider-call-log/storage/provider-call-context.storage';

// insert runs synchronously inside record(); this lets its catch() settle
const flush = () => Promise.resolve();

describe('ProviderCallLogService', () => {
  const insert = jest.fn().mockResolvedValue(undefined);
  const write = jest.fn().mockResolvedValue(undefined);
  let service: ProviderCallLogService;

  beforeEach(() => {
    insert.mockClear();
    write.mockClear();
    service = new ProviderCallLogService(
      { insert } as never,
      { write } as never,
    );
  });

  it('tags a record with the chat turn, tool call, company and stage', async () => {
    await withProviderCallContext(
      {
        workspaceId: 'workspace-1',
        threadId: 'thread-1',
        turnId: 'turn-1',
        toolName: 'find_people_by_company',
      },
      () =>
        withProviderCallContext({ toolCallId: 'call-1' }, () =>
          withProviderCallContext({ subject: 'Zomato', stage: 'harvest' }, () =>
            service.record({
              provider: 'harvest',
              operation: 'harvest_search:v1',
              request: { title: 'Head of Supply Chain' },
              cacheStatus: 'fetched',
              response: { elements: [1, 2, 3] },
            }),
          ),
        ),
    );
    await flush();

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'workspace-1',
        threadId: 'thread-1',
        turnId: 'turn-1',
        toolCallId: 'call-1',
        toolName: 'find_people_by_company',
        subject: 'Zomato',
        stage: 'harvest',
        provider: 'harvest',
        request: { title: 'Head of Supply Chain' },
        success: true,
        resultCount: 3,
      }),
    );
  });

  it('never fails the caller when the insert fails', async () => {
    insert.mockRejectedValueOnce(new Error('relation does not exist'));

    expect(() =>
      service.record({
        provider: 'serp',
        operation: 'serp:v1',
        cacheStatus: 'redis_hit',
      }),
    ).not.toThrow();
    await flush();
  });

  it('stores an uncached answer and points the record at it', async () => {
    const answer = await service.track(
      { provider: 'theorg', operation: 'theorg:page', request: { url: 'u' } },
      async () => '<html></html>',
    );
    await flush();

    expect(answer).toBe('<html></html>');
    expect(write).toHaveBeenCalledTimes(1);

    const [{ folder, name }] = write.mock.calls[0];

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        cacheStatus: 'uncached',
        responseLocation: `${folder}/${name}`,
        responseBytes: 13,
      }),
    );
    expect(folder).toMatch(/^provider-call-log\/theorg\/\d{4}-\d{2}-\d{2}$/);
  });

  it('records a thrown fetch as an error and rethrows it', async () => {
    await expect(
      service.track({ provider: 'perplexity', operation: 'search' }, () =>
        Promise.reject(new Error('HTTP 429')),
      ),
    ).rejects.toThrow('HTTP 429');
    await flush();

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        cacheStatus: 'error',
        success: false,
        errorMessage: 'HTTP 429',
      }),
    );
    expect(write).not.toHaveBeenCalled();
  });

  it('wraps a non-object request so the column always holds an object', async () => {
    service.record({
      provider: 'serp',
      operation: 'serp:v1',
      request: 'https://www.google.com/search?q=x',
      cacheStatus: 'fetched',
    });
    await flush();

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        request: { value: 'https://www.google.com/search?q=x' },
      }),
    );
  });
});

describe('withProviderCallContext', () => {
  it('keeps the outer value when the inner patch leaves a field unset', () => {
    const inner = withProviderCallContext(
      { threadId: 'thread-1', toolCallId: 'outer' },
      () =>
        withProviderCallContext(
          { toolCallId: undefined, stage: 'google' },
          () => getProviderCallContext(),
        ),
    );

    expect(inner).toEqual({
      threadId: 'thread-1',
      toolCallId: 'outer',
      stage: 'google',
    });
    expect(getProviderCallContext()).toEqual({});
  });

  it('keeps parallel stages apart', async () => {
    jest.useRealTimers();

    const stageAfterWait = (stage: string, waitMs: number) =>
      withProviderCallContext({ stage }, async () => {
        await new Promise((resolve) => setTimeout(resolve, waitMs));

        return getProviderCallContext().stage;
      });

    await expect(
      Promise.all([stageAfterWait('harvest', 10), stageAfterWait('serp', 1)]),
    ).resolves.toEqual(['harvest', 'serp']);
  });
});
