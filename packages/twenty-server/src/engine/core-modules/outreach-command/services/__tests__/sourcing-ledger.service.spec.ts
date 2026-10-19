import { SourcingLedgerService } from 'src/engine/core-modules/outreach-command/services/sourcing-ledger.service';
import { type SourcingLedgerEvent } from 'src/engine/core-modules/outreach-command/utils/sourcing-ledger.util';

const stop = (because: string): SourcingLedgerEvent => ({
  kind: 'stop',
  at: 't',
  target: 10,
  qualified: 1,
  because,
});

const buildCache = () => {
  const store = new Map<string, unknown>();

  return {
    get: jest.fn(async (key: string) => store.get(key)),
    set: jest.fn(async (key: string, value: unknown) => {
      // A slow write, so an unqueued second append would read stale data
      // (timers are faked in this suite, so yield through the microtask queue)
      for (let tick = 0; tick < 10; tick += 1) {
        await Promise.resolve();
      }

      store.set(key, value);
    }),
  };
};

const becauseOf = (event: SourcingLedgerEvent): string =>
  event.kind === 'stop' ? event.because : '';

describe('SourcingLedgerService', () => {
  it('should keep every event when appends overlap', async () => {
    const service = new SourcingLedgerService(buildCache() as never);

    await Promise.all([
      service.append('w', 'p', stop('one')),
      service.append('w', 'p', stop('two')),
      service.append('w', 'p', stop('three')),
    ]);

    expect((await service.read('w', 'p')).map(becauseOf)).toEqual([
      'one',
      'two',
      'three',
    ]);
  });

  it('should keep a ledger per project', async () => {
    const service = new SourcingLedgerService(buildCache() as never);

    await service.append('w', 'p1', stop('a'));

    expect(await service.read('w', 'p2')).toEqual([]);
  });

  it('should not throw when the cache fails', async () => {
    const service = new SourcingLedgerService({
      get: jest.fn(async () => {
        throw new Error('redis down');
      }),
      set: jest.fn(),
    } as never);

    await expect(service.append('w', 'p', stop('x'))).resolves.toBeUndefined();
  });

  it('should keep only the latest 100 events', async () => {
    const service = new SourcingLedgerService(buildCache() as never);

    for (let index = 0; index < 105; index += 1) {
      await service.append('w', 'p', stop(String(index)));
    }

    const events = await service.read('w', 'p');

    expect(events).toHaveLength(100);
    expect(becauseOf(events[0])).toBe('5');
  });
});
