const RESULT_ARRAY_KEYS = [
  'documents',
  'organic',
  'items',
  'results',
  'data',
  'elements',
  'people',
  'profiles',
  'companies',
  'candidates',
];

const countResults = (value: unknown): number | null => {
  if (Array.isArray(value)) {
    return value.length;
  }

  if (value === null || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;

  for (const key of RESULT_ARRAY_KEYS) {
    if (Array.isArray(record[key])) {
      return (record[key] as unknown[]).length;
    }
  }

  // Wrapped payloads ({ result: {...} }, { body: {...} }) one level down
  for (const key of ['result', 'body', 'response', 'value']) {
    if (record[key] !== null && typeof record[key] === 'object') {
      const nested = countResults(record[key]);

      if (nested !== null) {
        return nested;
      }
    }
  }

  return null;
};

export const summarizeProviderResponse = (
  value: unknown,
): { resultCount: number | null; responseBytes: number | null } => {
  if (value === undefined) {
    return { resultCount: null, responseBytes: null };
  }

  let responseBytes: number | null = null;

  try {
    responseBytes =
      typeof value === 'string'
        ? Buffer.byteLength(value)
        : Buffer.byteLength(JSON.stringify(value) ?? '');
  } catch {
    responseBytes = null;
  }

  return { resultCount: countResults(value), responseBytes };
};
