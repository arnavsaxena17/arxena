// Models often stringify nested tool args; coerce before Zod validation.
export const coerceExecuteToolArguments = (value: unknown): unknown => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return value;
  }

  const record = value as Record<string, unknown>;

  if (typeof record.arguments !== 'string') {
    return value;
  }

  try {
    const parsed = JSON.parse(record.arguments) as unknown;

    if (
      parsed !== null &&
      typeof parsed === 'object' &&
      !Array.isArray(parsed)
    ) {
      return {
        ...record,
        arguments: parsed,
      };
    }
  } catch {
    return value;
  }

  return value;
};
