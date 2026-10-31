import { type CompanyOutcome } from 'src/engine/core-modules/tool/tools/find-people-by-company-tool/find-people-by-company.types';
import { createFindPeopleProgressReporter } from 'src/engine/core-modules/tool/tools/find-people-by-company-tool/find-people-progress.util';

const outcome = (company: string, people: number): CompanyOutcome =>
  ({
    company,
    people: Array.from({ length: people }, () => ({})),
    spentUsd: 0.05,
    roleStates: [
      { role: 'Head of Supply Chain', terminalState: 'found' },
      { role: 'Procurement Head', terminalState: 'none_found' },
    ],
  }) as unknown as CompanyOutcome;

describe('createFindPeopleProgressReporter', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should say which companies are done, who was found and what is still running', () => {
    const onToolProgress = jest.fn();
    const progress = createFindPeopleProgressReporter({
      onToolProgress,
      companyCount: 2,
      roleCount: 2,
    });

    progress.companyStarted('Milky Mist');
    progress.companyStarted('Hatsun');
    progress.companyFinished('Milky Mist', outcome('Milky Mist', 2));

    const latest =
      onToolProgress.mock.calls[onToolProgress.mock.calls.length - 1][0];

    expect(onToolProgress.mock.calls[0][0].message).toBe(
      'Looking up 2 companies × 2 roles',
    );
    expect(latest).toEqual(
      expect.objectContaining({
        toolName: 'find_people_by_company',
        state: 'running',
        current: 1,
        total: 2,
        logs: ['Milky Mist: 2 people, 1 of 2 roles filled'],
      }),
    );
    expect(latest.message).toContain('1 of 2 companies done');
    expect(latest.message).toContain('2 people found');
    expect(latest.message).toContain('searching Hatsun');
  });

  it('should keep reporting while a company is slow, and stop once finished', () => {
    const onToolProgress = jest.fn();
    const progress = createFindPeopleProgressReporter({
      onToolProgress,
      companyCount: 1,
      roleCount: 1,
    });

    progress.companyStarted('Hatsun');
    const beforeHeartbeat = onToolProgress.mock.calls.length;

    jest.advanceTimersByTime(10_000);
    expect(onToolProgress.mock.calls.length).toBe(beforeHeartbeat + 2);

    progress.finish('completed');
    const afterFinish = onToolProgress.mock.calls.length;

    jest.advanceTimersByTime(10_000);
    expect(onToolProgress.mock.calls.length).toBe(afterFinish);
    expect(
      onToolProgress.mock.calls[onToolProgress.mock.calls.length - 1][0].state,
    ).toBe('completed');
  });

  it('should do nothing when the caller streams no progress', () => {
    const progress = createFindPeopleProgressReporter({
      companyCount: 1,
      roleCount: 1,
    });

    expect(() => {
      progress.companyStarted('Hatsun');
      progress.finish('completed');
    }).not.toThrow();
  });
});
