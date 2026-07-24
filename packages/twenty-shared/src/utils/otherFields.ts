export type OtherFieldsRecord = Record<
  string,
  string | number | boolean | object | null
>;

export type LegacyCandidateFieldValueEdge = {
  node?: {
    name?: string | null;
    candidateFields?: {
      name?: string | null;
    } | null;
  } | null;
};

export type CandidateWithCustomFields = {
  otherFields?: OtherFieldsRecord | null;
  candidateFieldValues?: {
    edges?: LegacyCandidateFieldValueEdge[];
  } | null;
};

export const UPLOAD_OTHER_FIELDS_EXCLUDED_KEYS = [
  'age',
  'birth_date',
  'full_name',
  'gender',
  'all_mails',
  'all_numbers',
  'experience_stats',
  'queryId',
  'data_sources',
  'interests',
  'locations',
  'profiles',
  'phone_numbers',
  'tables',
  'socialprofiles',
  'count_promotions',
  'ug_graduation_year',
  'pg_graduation_year',
  'current_role_tenure',
  'total_tenure',
  'total_job_changes',
  'average_tenure',
  'pg_institute_name',
  'ug_graduation_degree',
  'pg_graduation_degree',
  'education_institute_ug',
  'education_type_ug',
  'education_year_ug',
  'education_course_ug',
  'education_institute_pg',
  'education_type_pg',
  'education_year_pg',
  'education_course_pg',
  'ug_institute_name',
] as const;

export const toSnakeCaseKey = (fieldName: string): string =>
  fieldName
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, '')
    .replace(/__+/g, '_');

export const toCamelCaseKey = (fieldName: string): string =>
  fieldName.replace(/_([a-z])/g, (_match, letter: string) =>
    letter.toUpperCase(),
  );

export const questionTextToKey = (question: string): string =>
  toSnakeCaseKey(
    question
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, ''),
  );

export const parseOtherFieldValue = (
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

export const normalizeOtherFields = (
  otherFields: unknown,
): OtherFieldsRecord => {
  if (!otherFields || typeof otherFields !== 'object' || Array.isArray(otherFields)) {
    return {};
  }

  return otherFields as OtherFieldsRecord;
};

export const buildOtherFieldsFromUnmapped = (
  unmappedCandidateObject: Array<{ key: string; value: unknown }>,
  excludedFields: readonly string[] = UPLOAD_OTHER_FIELDS_EXCLUDED_KEYS,
): OtherFieldsRecord => {
  const otherFields: OtherFieldsRecord = {};

  for (const field of unmappedCandidateObject) {
    if (!field.key || excludedFields.includes(field.key)) {
      continue;
    }

    if (field.value === null || field.value === undefined || field.value === '') {
      continue;
    }

    const key = toSnakeCaseKey(field.key);
    otherFields[key] = parseOtherFieldValue(field.value);
  }

  return otherFields;
};

export const mergeOtherFields = (
  existing: unknown,
  patch: Record<string, unknown>,
): OtherFieldsRecord => {
  const base = normalizeOtherFields(existing);
  const merged: OtherFieldsRecord = { ...base };

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

export const otherFieldsToFlatRow = (
  otherFields: unknown,
): Record<string, string | number | boolean | object | null> => {
  const normalized = normalizeOtherFields(otherFields);
  const flatRow: Record<string, string | number | boolean | object | null> = {};

  for (const [key, value] of Object.entries(normalized)) {
    flatRow[toCamelCaseKey(key)] = value;
  }

  return flatRow;
};

export const candidateFieldValuesToOtherFields = (
  edges: LegacyCandidateFieldValueEdge[] | undefined,
): OtherFieldsRecord => {
  const otherFields: OtherFieldsRecord = {};

  for (const edge of edges ?? []) {
    const fieldName = edge.node?.candidateFields?.name;
    const fieldValue = edge.node?.name;

    if (!fieldName || fieldValue === null || fieldValue === undefined) {
      continue;
    }

    otherFields[toSnakeCaseKey(fieldName)] = parseOtherFieldValue(fieldValue);
  }

  return otherFields;
};

export const hasLegacyFieldValues = (
  candidate: CandidateWithCustomFields,
): boolean => {
  const edges = candidate.candidateFieldValues?.edges ?? [];

  return edges.some(
    (edge) =>
      edge.node?.candidateFields?.name &&
      edge.node?.name !== null &&
      edge.node?.name !== undefined,
  );
};

export const isOtherFieldsEmpty = (otherFields: unknown): boolean =>
  Object.keys(normalizeOtherFields(otherFields)).length === 0;

export const getResolvedOtherFields = (
  candidate: CandidateWithCustomFields,
): OtherFieldsRecord => {
  const fromOtherFields = normalizeOtherFields(candidate.otherFields);

  if (!isOtherFieldsEmpty(fromOtherFields)) {
    return fromOtherFields;
  }

  return candidateFieldValuesToOtherFields(candidate.candidateFieldValues?.edges);
};

export const getCandidateCustomField = (
  candidate: CandidateWithCustomFields,
  fieldName: string,
): string | number | boolean | object | null | undefined => {
  const resolved = getResolvedOtherFields(candidate);
  const snakeKey = toSnakeCaseKey(fieldName);
  const camelKey = toCamelCaseKey(snakeKey);

  if (snakeKey in resolved) {
    return resolved[snakeKey];
  }

  if (camelKey in resolved) {
    return resolved[camelKey];
  }

  return undefined;
};

/**
 * Resolve a field from a flattened candidate row (e.g. after otherFieldsToFlatRow),
 * accepting either snake_case or camelCase keys from AI filter selectedMetadataFields.
 */
export const getValueFromCandidateRecord = (
  candidate: Record<string, unknown>,
  fieldName: string,
): unknown => {
  if (Object.prototype.hasOwnProperty.call(candidate, fieldName)) {
    return candidate[fieldName];
  }

  const snakeKey = toSnakeCaseKey(fieldName);
  if (
    snakeKey !== fieldName &&
    Object.prototype.hasOwnProperty.call(candidate, snakeKey)
  ) {
    return candidate[snakeKey];
  }

  const camelKey = toCamelCaseKey(snakeKey);
  if (
    camelKey !== fieldName &&
    camelKey !== snakeKey &&
    Object.prototype.hasOwnProperty.call(candidate, camelKey)
  ) {
    return candidate[camelKey];
  }

  return undefined;
};

export const hasMeaningfulCandidateFieldValue = (value: unknown): boolean => {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value === 'string' && value.trim() === '') {
    return false;
  }

  if (Array.isArray(value) && value.length === 0) {
    return false;
  }

  return true;
};

export const collectOtherFieldKeys = (
  candidates: CandidateWithCustomFields[],
): string[] => {
  const keys = new Set<string>();

  for (const candidate of candidates) {
    const resolved = getResolvedOtherFields(candidate);

    for (const key of Object.keys(resolved)) {
      keys.add(key);
    }
  }

  return Array.from(keys);
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

export type LegacyFieldValueRow = {
  fieldName: string;
  value: string;
};

export const buildOtherFieldsFromLegacyRows = (
  rows: LegacyFieldValueRow[],
): OtherFieldsRecord => {
  const otherFields: OtherFieldsRecord = {};

  for (const row of rows) {
    if (!row.fieldName || row.value === null || row.value === undefined || row.value === '') {
      continue;
    }

    otherFields[toSnakeCaseKey(row.fieldName)] = parseOtherFieldValue(row.value);
  }

  return otherFields;
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

export const questionsRequireAnswerRemap = (
  oldQuestions: string[],
  newQuestions: string[],
): boolean => {
  const normalizedOld = oldQuestions.map((question) => question.trim()).filter(Boolean);
  const normalizedNew = newQuestions.map((question) => question.trim()).filter(Boolean);

  if (normalizedOld.length === 0) {
    return false;
  }

  const sharedLength = Math.min(normalizedOld.length, normalizedNew.length);

  for (let index = 0; index < sharedLength; index++) {
    if (normalizedOld[index] !== normalizedNew[index]) {
      return true;
    }
  }

  return normalizedOld.length > normalizedNew.length;
};

export const parseRowOtherFields = (row: Record<string, unknown>): OtherFieldsRecord =>
  normalizeOtherFields(row.otherFields ?? row.otherfields);

export const remapOtherFieldsForQuestionChanges = (
  otherFields: OtherFieldsRecord,
  oldQuestions: string[],
  newQuestions: string[],
): OtherFieldsRecord => {
  const remapped = { ...otherFields };

  for (let index = 0; index < oldQuestions.length; index++) {
    const oldQuestion = oldQuestions[index]?.trim();
    const newQuestion = newQuestions[index]?.trim();

    if (!oldQuestion || !newQuestion || oldQuestion === newQuestion) {
      continue;
    }

    const oldKey = questionTextToKey(oldQuestion);
    const newKey = questionTextToKey(newQuestion);

    if (oldKey in remapped) {
      remapped[newKey] = remapped[oldKey];
      delete remapped[oldKey];
    }
  }

  return remapped;
};
