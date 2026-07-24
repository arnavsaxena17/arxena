export type MigrateOtherFieldsRecord = Record<
  string,
  string | number | boolean | object | null
>;

const toSnakeCaseKey = (fieldName: string): string =>
  fieldName
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, '')
    .replace(/__+/g, '_');

const parseOtherFieldValue = (
  value: unknown,
): string | number | boolean | object | null => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== 'string') {
    return value as string | number | boolean | object;
  }

  const trimmed = value.trim();

  if (trimmed === '') {
    return null;
  }

  try {
    return JSON.parse(trimmed) as string | number | boolean | object;
  } catch {
    return value;
  }
};

const normalizeOtherFields = (otherFields: unknown): MigrateOtherFieldsRecord => {
  if (!otherFields || typeof otherFields !== 'object' || Array.isArray(otherFields)) {
    return {};
  }

  return otherFields as MigrateOtherFieldsRecord;
};

export const isJsonColumnEmpty = (value: unknown): boolean => {
  if (value === null || value === undefined) {
    return true;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();

    if (trimmed === '' || trimmed === '{}' || trimmed === '[]' || trimmed === 'null') {
      return true;
    }

    try {
      const parsed = JSON.parse(trimmed) as unknown;

      if (Array.isArray(parsed)) {
        return parsed.length === 0;
      }

      if (typeof parsed === 'object' && parsed !== null) {
        return Object.keys(parsed).length === 0;
      }
    } catch {
      return false;
    }
  }

  if (Array.isArray(value)) {
    return value.length === 0;
  }

  if (typeof value === 'object') {
    return Object.keys(value).length === 0;
  }

  return false;
};

export const mergeChatQuestionsPreservingOrder = (
  existingQuestions: string[],
  newQuestions: string[],
): string[] => {
  const merged = [...existingQuestions];

  for (const question of newQuestions) {
    const trimmed = question.trim();

    if (!trimmed || merged.includes(trimmed)) {
      continue;
    }

    merged.push(trimmed);
  }

  return merged;
};

export const buildOtherFieldsFromLegacyRows = (
  rows: Array<{ fieldName: string; value: string }>,
): MigrateOtherFieldsRecord => {
  const otherFields: MigrateOtherFieldsRecord = {};

  for (const row of rows) {
    if (!row.fieldName || row.value === null || row.value === undefined || row.value === '') {
      continue;
    }

    otherFields[toSnakeCaseKey(row.fieldName)] = parseOtherFieldValue(row.value);
  }

  return otherFields;
};

export const mergeOtherFieldsForMigration = (
  existing: unknown,
  patch: MigrateOtherFieldsRecord,
): MigrateOtherFieldsRecord => {
  const base = normalizeOtherFields(existing);
  const merged: MigrateOtherFieldsRecord = { ...base };

  for (const [rawKey, rawValue] of Object.entries(patch)) {
    const key = toSnakeCaseKey(rawKey);

    if (rawValue === null || rawValue === undefined || rawValue === '') {
      delete merged[key];
      continue;
    }

    merged[key] = parseOtherFieldValue(rawValue);
  }

  return merged;
};
