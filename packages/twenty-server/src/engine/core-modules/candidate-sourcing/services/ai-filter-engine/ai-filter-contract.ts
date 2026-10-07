// Model-independent contract of the AI filter node.
//
// Input : records (people or companies) + a FilterSpec.
// Output: one RecordVerdict per record, always in this shape, whatever model
//         answered. Each model adapter (jev, OpenAI) only has to translate its
//         own request/response format to and from this contract; everything
//         downstream (kept / rejected / failed, the workflow variables) reads
//         the contract, so changing the model never changes the node's outputs.

export type FilterFieldType = 'boolean' | 'enum' | 'text';

export type FilterFieldSpec = {
  name: string;
  type: FilterFieldType;
  description?: string;
  enumValues?: string[];
  // Optional fields enrich the verdict (e.g. a reason) when the model can
  // produce them. They never decide keep/reject and never cause a failure, so
  // a model that cannot answer them (jev answers only boolean/enum) is still
  // a valid engine for the filter.
  optional?: boolean;
};

export type FilterSubject = 'person' | 'company' | 'record';

export type FilterSpec = {
  name: string;
  subject: FilterSubject;
  // What a good record looks like: the campaign's definition of "keep".
  criteria: string;
  // Runtime facts about the workspace / project (ICP titles, locations, what
  // is sold). Appended to the criteria, never required.
  context?: string;
  fields: FilterFieldSpec[];
  keepField: string;
  model: string;
  metadataFields: string[];
  // Records per model call on batch-capable models. 1 disables batching.
  batchSize?: number;
  // Concurrent model calls.
  concurrency?: number;
};

export type FilterAnswerValue = boolean | string;

export type RecordVerdict = {
  id: string;
  // answered: every required field was valid. failed: the model gave no usable
  // answer. A failed record is neither kept nor rejected.
  status: 'answered' | 'failed';
  answers: Record<string, FilterAnswerValue>;
  keep: boolean | null;
  reason?: string;
  error?: string;
};

export type FilterRunStats = {
  engine: 'jev' | 'openai';
  model: string;
  calls: number;
  retriedRecords: number;
  durationMs: number;
};

const TRUE_WORDS = new Set(['true', 'yes', 'y', '1']);
const FALSE_WORDS = new Set(['false', 'no', 'n', '0']);

const coerceBoolean = (value: unknown): boolean | null => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const word = value.trim().toLowerCase();

    if (TRUE_WORDS.has(word)) {
      return true;
    }

    if (FALSE_WORDS.has(word)) {
      return false;
    }
  }

  return null;
};

const coerceEnum = (value: unknown, enumValues: string[]): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const wanted = value.trim().toLowerCase();

  return (
    enumValues.find((candidate) => candidate.toLowerCase() === wanted) ?? null
  );
};

export const isRequiredField = (field: FilterFieldSpec): boolean =>
  field.optional !== true && field.type !== 'text';

export const getRequiredFields = (
  fields: FilterFieldSpec[],
): FilterFieldSpec[] => fields.filter(isRequiredField);

export const getReasonFieldName = (
  fields: FilterFieldSpec[],
): string | undefined =>
  fields.find(
    (field) =>
      field.type === 'text' &&
      ['reason', 'rationale', 'explanation'].includes(field.name.toLowerCase()),
  )?.name;

// Turns whatever a model returned into a verdict. A required field that is
// missing or outside its allowed values makes the record `failed`; it is never
// defaulted to false, because that would silently reject a good record.
export const buildVerdict = ({
  id,
  raw,
  spec,
}: {
  id: string;
  raw: Record<string, unknown> | null | undefined;
  spec: Pick<FilterSpec, 'fields' | 'keepField'>;
}): RecordVerdict => {
  if (raw === null || raw === undefined || typeof raw !== 'object') {
    return {
      id,
      status: 'failed',
      answers: {},
      keep: null,
      error: 'No answer from the filter model',
    };
  }

  const answers: Record<string, FilterAnswerValue> = {};
  const problems: string[] = [];

  for (const field of spec.fields) {
    const rawValue = raw[field.name];

    if (field.type === 'boolean') {
      const value = coerceBoolean(rawValue);

      if (value === null) {
        if (isRequiredField(field)) {
          problems.push(`"${field.name}" is not a boolean`);
        }
        continue;
      }

      answers[field.name] = value;
      continue;
    }

    if (field.type === 'enum') {
      const value = coerceEnum(rawValue, field.enumValues ?? []);

      if (value === null) {
        if (isRequiredField(field)) {
          problems.push(
            `"${field.name}" is not one of ${(field.enumValues ?? []).join('|')}`,
          );
        }
        continue;
      }

      answers[field.name] = value;
      continue;
    }

    if (typeof rawValue === 'string' && rawValue.trim() !== '') {
      answers[field.name] = rawValue.trim();
    }
  }

  const keepAnswer = answers[spec.keepField];

  if (problems.length > 0 || typeof keepAnswer !== 'boolean') {
    return {
      id,
      status: 'failed',
      answers,
      keep: null,
      error:
        problems.length > 0
          ? `Invalid answer: ${problems.join('; ')}`
          : `Missing keep answer "${spec.keepField}"`,
    };
  }

  const reasonField = getReasonFieldName(spec.fields);
  const reason = reasonField ? answers[reasonField] : undefined;

  return {
    id,
    status: 'answered',
    answers,
    keep: keepAnswer,
    ...(typeof reason === 'string' ? { reason } : {}),
  };
};

export const failedVerdict = (id: string, error: string): RecordVerdict => ({
  id,
  status: 'failed',
  answers: {},
  keep: null,
  error,
});
