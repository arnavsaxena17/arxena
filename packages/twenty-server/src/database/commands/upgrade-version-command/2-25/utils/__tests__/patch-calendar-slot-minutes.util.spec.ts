import {
  patchCalendarSlotMinutesOnRunState,
  patchCalendarSlotMinutesOnSteps,
} from 'src/database/commands/upgrade-version-command/2-25/utils/patch-calendar-slot-minutes.util';

describe('patchCalendarSlotMinutesOnSteps', () => {
  it('rewrites calendar steps from 20-minute slots to 30-minute slots', () => {
    const steps = [
      {
        id: 'calendar',
        settings: {
          input: {
            logicFunctionId: 'lf-calendar',
            logicFunctionInput: { days: 5, slotMinutes: 20 },
          },
        },
      },
      {
        id: 'already-thirty',
        settings: {
          input: {
            logicFunctionInput: { slotMinutes: 30 },
          },
        },
      },
      { id: 'unrelated', settings: { input: {} } },
    ];

    const result = patchCalendarSlotMinutesOnSteps(steps);

    expect(result.changed).toBe(true);
    expect(result.next).toEqual([
      {
        id: 'calendar',
        settings: {
          input: {
            logicFunctionId: 'lf-calendar',
            logicFunctionInput: { days: 5, slotMinutes: 30 },
          },
        },
      },
      steps[1],
      steps[2],
    ]);
    expect(steps[0]?.settings.input.logicFunctionInput.slotMinutes).toBe(20);
  });

  it('rewrites run flow steps from 20-minute slots to 30-minute slots', () => {
    const state = {
      flow: {
        trigger: { type: 'MANUAL' },
        steps: [
          {
            settings: {
              input: { logicFunctionInput: { slotMinutes: 20 } },
            },
          },
        ],
      },
    };

    const result = patchCalendarSlotMinutesOnRunState(state);

    expect(result.changed).toBe(true);
    expect(result.next).toEqual({
      flow: {
        trigger: { type: 'MANUAL' },
        steps: [
          {
            settings: {
              input: { logicFunctionInput: { slotMinutes: 30 } },
            },
          },
        ],
      },
    });
  });

  it('leaves non-arrays unchanged', () => {
    expect(patchCalendarSlotMinutesOnSteps(null)).toEqual({
      next: null,
      changed: false,
    });
  });
});
