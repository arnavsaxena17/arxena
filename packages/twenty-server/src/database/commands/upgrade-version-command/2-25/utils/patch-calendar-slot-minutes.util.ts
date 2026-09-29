const CALENDAR_SLOT_MINUTES_FROM = 20;
const CALENDAR_SLOT_MINUTES_TO = 30;

type WorkflowStepSettings = {
  input?: {
    logicFunctionInput?: {
      slotMinutes?: number;
    };
  };
};

// Seeded get-calendar-availability steps stored 20-minute windows.
// Only those inputs change; other step fields stay as saved.
export const patchCalendarSlotMinutesOnSteps = (
  steps: unknown,
): { next: unknown; changed: boolean } => {
  if (!Array.isArray(steps)) {
    return { next: steps, changed: false };
  }

  let changed = false;

  const next = steps.map((step) => {
    if (step === null || typeof step !== 'object' || Array.isArray(step)) {
      return step;
    }

    const settings = (step as { settings?: WorkflowStepSettings }).settings;
    const logicFunctionInput = settings?.input?.logicFunctionInput;

    if (logicFunctionInput?.slotMinutes !== CALENDAR_SLOT_MINUTES_FROM) {
      return step;
    }

    changed = true;

    return {
      ...step,
      settings: {
        ...settings,
        input: {
          ...settings?.input,
          logicFunctionInput: {
            ...logicFunctionInput,
            slotMinutes: CALENDAR_SLOT_MINUTES_TO,
          },
        },
      },
    };
  });

  return { next, changed };
};

type WorkflowRunStateWithSteps = {
  flow?: {
    steps?: unknown;
  };
};

export const patchCalendarSlotMinutesOnRunState = (
  state: unknown,
): { next: unknown; changed: boolean } => {
  if (state === null || typeof state !== 'object' || Array.isArray(state)) {
    return { next: state, changed: false };
  }

  const steps = (state as WorkflowRunStateWithSteps).flow?.steps;
  const stepsResult = patchCalendarSlotMinutesOnSteps(steps);

  if (!stepsResult.changed) {
    return { next: state, changed: false };
  }

  return {
    next: {
      ...state,
      flow: {
        ...(state as WorkflowRunStateWithSteps).flow,
        steps: stepsResult.next,
      },
    },
    changed: true,
  };
};
