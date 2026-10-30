import { SourcingBudgetService } from 'src/engine/core-modules/outreach-command/services/sourcing-budget.service';

const build = () => {
  const store = new Map<string, unknown>();
  const cache = {
    get: jest.fn(async (key: string) => store.get(key)),
    set: jest.fn(async (key: string, value: unknown) => {
      store.set(key, value);
    }),
  };

  return { service: new SourcingBudgetService(cache as never), store };
};

describe('SourcingBudgetService', () => {
  it('allows a call when no run cap is configured', async () => {
    const { service } = build();
    const check = await service.check({
      workspaceId: 'w',
      projectId: 'p',
      estimatedUsd: 10,
      tool: 'Bright Data',
    });

    expect(check.allowed).toBe(true);
    expect(check.status.runCapUsd).toBeUndefined();
  });

  it('refuses a call that does not fit in the remaining cap', async () => {
    const { service } = build();

    await service.configure({
      workspaceId: 'w',
      projectId: 'p',
      runCapUsd: 1,
      budgetRunId: 'run-1',
    });
    await service.recordSpend({
      workspaceId: 'w',
      projectId: 'p',
      usd: 0.8,
    });

    const allowed = await service.check({
      workspaceId: 'w',
      projectId: 'p',
      estimatedUsd: 0.3,
      tool: 'Bright Data',
    });
    const refused = await service.check({
      workspaceId: 'w',
      projectId: 'p',
      estimatedUsd: 0.5,
      tool: 'Bright Data',
    });

    expect(allowed.allowed).toBe(false);
    expect(refused.allowed).toBe(false);
    expect(refused.message).toContain('$0.20 left');

    await service.configure({
      workspaceId: 'w',
      projectId: 'p',
      runCapUsd: 1.2,
      budgetRunId: 'run-1',
    });

    const afterRaise = await service.check({
      workspaceId: 'w',
      projectId: 'p',
      estimatedUsd: 0.5,
      tool: 'Bright Data',
    });

    expect(afterRaise.allowed).toBe(false);
    expect(afterRaise.status.remainingUsd).toBeCloseTo(0.4);
  });

  it('starts a fresh spend window when the cap is authorized again', async () => {
    const { service } = build();

    await service.configure({
      workspaceId: 'w',
      projectId: 'p',
      runCapUsd: 1,
      budgetRunId: 'run-1',
    });
    await service.recordSpend({
      workspaceId: 'w',
      projectId: 'p',
      usd: 1,
    });

    const exhausted = await service.getStatus('w', 'p');
    expect(exhausted.exhausted).toBe(true);

    await service.configure({
      workspaceId: 'w',
      projectId: 'p',
      runCapUsd: 2,
      budgetRunId: 'run-2',
    });

    const second = await service.getStatus('w', 'p');
    expect(second.spentUsd).toBe(0);
    expect(second.remainingUsd).toBe(2);
    expect(second.exhausted).toBe(false);
  });

  it('ignores a charge when no budget is configured', async () => {
    const { service } = build();

    const status = await service.recordSpend({
      workspaceId: 'w',
      projectId: 'p',
      usd: 3,
    });

    expect(status.spentUsd).toBe(0);
    expect(status.exhausted).toBe(false);
  });
});
