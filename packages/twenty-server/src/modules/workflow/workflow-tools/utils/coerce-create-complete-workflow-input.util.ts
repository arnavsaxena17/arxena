import { isDefined } from 'twenty-shared/utils';

const DATABASE_EVENT_ACTIONS = new Set([
  'created',
  'updated',
  'deleted',
  'upserted',
]);

const LOGIC_FUNCTION_INPUT_KEYS = new Set([
  'logicFunctionId',
  'logicFunctionInput',
]);

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const coerceBooleanFlag = (
  value: unknown,
  fallback = false,
): { value: boolean } => {
  if (isPlainObject(value) && typeof value.value === 'boolean') {
    return { value: value.value };
  }

  if (typeof value === 'boolean') {
    return { value };
  }

  if (isPlainObject(value) && typeof value.enabled === 'boolean') {
    return { value: value.enabled };
  }

  if (isPlainObject(value) && typeof value.maxRetries === 'number') {
    return { value: value.maxRetries > 0 };
  }

  return { value: fallback };
};

const coerceErrorHandlingOptions = (value: unknown) => {
  const options = isPlainObject(value) ? value : {};

  return {
    retryOnFailure: coerceBooleanFlag(options.retryOnFailure),
    continueOnFailure: coerceBooleanFlag(
      options.continueOnFailure ?? options.onError === 'CONTINUE',
    ),
  };
};

const coerceDatabaseEventTrigger = (
  trigger: Record<string, unknown>,
): Record<string, unknown> => {
  const settings = isPlainObject(trigger.settings) ? { ...trigger.settings } : {};

  if (typeof settings.eventName !== 'string' || settings.eventName.length === 0) {
    const objectName =
      (typeof settings.objectNameSingular === 'string'
        ? settings.objectNameSingular
        : undefined) ??
      (typeof settings.objectType === 'string' ? settings.objectType : undefined);
    const rawEventType =
      typeof settings.eventType === 'string'
        ? settings.eventType.toLowerCase()
        : undefined;
    const action =
      isDefined(rawEventType) && DATABASE_EVENT_ACTIONS.has(rawEventType)
        ? rawEventType
        : undefined;

    if (isDefined(objectName) && isDefined(action)) {
      settings.eventName = `${objectName}.${action}`;
    }
  }

  if (!isPlainObject(settings.outputSchema)) {
    settings.outputSchema = {};
  }

  return {
    ...trigger,
    settings,
  };
};

const coerceLogicFunctionStep = (
  step: Record<string, unknown>,
): Record<string, unknown> => {
  const settings = isPlainObject(step.settings) ? { ...step.settings } : {};
  const input = isPlainObject(settings.input) ? { ...settings.input } : {};
  const existingLogicFunctionInput = isPlainObject(input.logicFunctionInput)
    ? input.logicFunctionInput
    : {};
  const flattenedEntries = Object.fromEntries(
    Object.entries(input).filter(([key]) => !LOGIC_FUNCTION_INPUT_KEYS.has(key)),
  );

  settings.input = {
    logicFunctionId: input.logicFunctionId,
    logicFunctionInput: {
      ...flattenedEntries,
      ...existingLogicFunctionInput,
    },
  };
  settings.errorHandlingOptions = coerceErrorHandlingOptions(
    settings.errorHandlingOptions,
  );

  if (!isPlainObject(settings.outputSchema)) {
    settings.outputSchema = {};
  }

  return {
    ...step,
    valid: typeof step.valid === 'boolean' ? step.valid : true,
    settings,
  };
};

const coerceGenericStep = (
  step: Record<string, unknown>,
): Record<string, unknown> => {
  const settings = isPlainObject(step.settings) ? { ...step.settings } : {};

  if (isDefined(settings.errorHandlingOptions) || step.type !== undefined) {
    settings.errorHandlingOptions = coerceErrorHandlingOptions(
      settings.errorHandlingOptions,
    );
  }

  if (!isPlainObject(settings.outputSchema)) {
    settings.outputSchema = {};
  }

  return {
    ...step,
    valid: typeof step.valid === 'boolean' ? step.valid : true,
    settings,
  };
};

const coerceEdge = (edge: unknown) => {
  if (!isPlainObject(edge)) {
    return edge;
  }

  const source =
    typeof edge.source === 'string'
      ? edge.source
      : typeof edge.from === 'string'
        ? edge.from
        : undefined;
  const target =
    typeof edge.target === 'string'
      ? edge.target
      : typeof edge.to === 'string'
        ? edge.to
        : undefined;

  return {
    ...edge,
    source,
    target,
  };
};

export const coerceCreateCompleteWorkflowInput = (raw: unknown): unknown => {
  if (!isPlainObject(raw)) {
    return raw;
  }

  const next: Record<string, unknown> = { ...raw };

  if (isPlainObject(next.trigger) && next.trigger.type === 'DATABASE_EVENT') {
    next.trigger = coerceDatabaseEventTrigger(next.trigger);
  }

  if (Array.isArray(next.steps)) {
    next.steps = next.steps.map((step) => {
      if (!isPlainObject(step)) {
        return step;
      }

      return step.type === 'LOGIC_FUNCTION'
        ? coerceLogicFunctionStep(step)
        : coerceGenericStep(step);
    });
  }

  if (Array.isArray(next.edges)) {
    next.edges = next.edges.map(coerceEdge);
  }

  return next;
};
