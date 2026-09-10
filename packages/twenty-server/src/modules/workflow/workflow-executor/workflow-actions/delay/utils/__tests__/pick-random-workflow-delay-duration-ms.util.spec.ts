import { pickRandomWorkflowDelayDurationMs } from 'src/modules/workflow/workflow-executor/workflow-actions/delay/utils/pick-random-workflow-delay-duration-ms.util';

describe('pickRandomWorkflowDelayDurationMs', () => {
  it('returns a value within the inclusive millisecond range', () => {
    const delayInMs = pickRandomWorkflowDelayDurationMs({
      minDuration: { minutes: 2 },
      maxDuration: { minutes: 15 },
      random: () => 0,
    });

    expect(delayInMs).toBe(2 * 60 * 1000);
  });

  it('includes the maximum bound when random is nearly 1', () => {
    const delayInMs = pickRandomWorkflowDelayDurationMs({
      minDuration: { minutes: 2 },
      maxDuration: { minutes: 15 },
      random: () => 0.999999,
    });

    expect(delayInMs).toBe(15 * 60 * 1000);
  });

  it('returns the fixed duration when min equals max', () => {
    const delayInMs = pickRandomWorkflowDelayDurationMs({
      minDuration: { minutes: 5 },
      maxDuration: { minutes: 5 },
      random: () => 0.5,
    });

    expect(delayInMs).toBe(5 * 60 * 1000);
  });

  it('throws when minimum is greater than maximum', () => {
    expect(() =>
      pickRandomWorkflowDelayDurationMs({
        minDuration: { minutes: 15 },
        maxDuration: { minutes: 2 },
      }),
    ).toThrow(
      'Minimum delay duration must be less than or equal to maximum delay duration',
    );
  });
});
