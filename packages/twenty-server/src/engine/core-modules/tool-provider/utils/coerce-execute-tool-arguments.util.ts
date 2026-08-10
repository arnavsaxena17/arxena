import { isDefined } from 'twenty-shared/utils';

const EXECUTE_TOOL_META_KEYS = new Set([
  'toolName',
  'arguments',
  'parameters',
  'args',
  'input',
]);

const tryParseJson = (value: string): unknown => {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return undefined;
  }
};

const isPlainObject = (
  value: unknown,
): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

// Unwrap string / double-stringified payloads into a plain object.
const coerceToObject = (value: unknown): Record<string, unknown> | undefined => {
  if (isPlainObject(value)) {
    return value;
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  const parsed = tryParseJson(value.trim());

  if (isPlainObject(parsed)) {
    return parsed;
  }

  if (typeof parsed === 'string') {
    const nested = tryParseJson(parsed.trim());

    if (isPlainObject(nested)) {
      return nested;
    }
  }

  return undefined;
};

const resolveArgumentsObject = (
  record: Record<string, unknown>,
): { argumentsObject?: Record<string, unknown>; unresolved: boolean } => {
  const candidates = [
    record.arguments,
    record.parameters,
    record.args,
    record.input,
  ];

  let sawExplicitCandidate = false;

  for (const candidate of candidates) {
    if (candidate === undefined || candidate === null) {
      continue;
    }

    sawExplicitCandidate = true;

    const asObject = coerceToObject(candidate);

    if (isDefined(asObject)) {
      return { argumentsObject: asObject, unresolved: false };
    }

    if (isPlainObject(candidate)) {
      return { argumentsObject: candidate, unresolved: false };
    }
  }

  // Models often flatten nested tool fields onto execute_tool itself.
  const flattenedEntries = Object.entries(record).filter(
    ([key]) => !EXECUTE_TOOL_META_KEYS.has(key),
  );

  if (flattenedEntries.length > 0) {
    return {
      argumentsObject: Object.fromEntries(flattenedEntries),
      unresolved: false,
    };
  }

  // Explicit but unparseable (e.g. broken JSON string) — leave for Zod.
  if (sawExplicitCandidate) {
    return { unresolved: true };
  }

  return { argumentsObject: {}, unresolved: false };
};

// Models often stringify nested tool args, alias the field, or flatten nested
// tool fields onto execute_tool. Coerce before Zod validation.
export const coerceExecuteToolArguments = (value: unknown): unknown => {
  const record =
    coerceToObject(value) ?? (isPlainObject(value) ? value : undefined);

  if (!isDefined(record)) {
    return value;
  }

  const toolName =
    typeof record.toolName === 'string' ? record.toolName : undefined;
  const { argumentsObject, unresolved } = resolveArgumentsObject(record);

  if (unresolved) {
    return value;
  }

  if (!isDefined(toolName)) {
    if (!isDefined(argumentsObject)) {
      return value;
    }

    return {
      ...record,
      arguments: argumentsObject,
    };
  }

  return {
    toolName,
    arguments: argumentsObject ?? {},
  };
};
