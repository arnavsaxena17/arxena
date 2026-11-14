import {
  type FilterFieldSpec,
  type FilterFieldType,
  type FilterSpec,
  type RecordVerdict,
} from 'src/domains/ingestion/candidate-sourcing/services/ai-filter-engine/ai-filter-contract';
import { buildRecordText } from 'src/domains/ingestion/candidate-sourcing/services/ai-filter-engine/ai-filter-prompt';

// A candidate-table AI filter as the recruiting UI saves it. It is turned
// into the engine's FilterSpec here, so there is one filter engine and this
// is only a way of describing a filter to it.
export type CandidateFilterField = {
  name: string;
  type: string;
  description?: string;
  enumValues?: string[];
};

export type CandidateFilterConfig = {
  modelName: string;
  prompt: string;
  selectedModel: string;
  fields: CandidateFilterField[];
  selectedMetadataFields: string[];
  includeResume?: boolean;
  concurrency?: number;
};

export type CandidateFilterResult = {
  candidateId: string;
  enrichedData: Record<string, boolean | string | number>;
};

const FIELD_TYPES: Readonly<Record<string, FilterFieldType>> = {
  boolean: 'boolean',
  bool: 'boolean',
  enum: 'enum',
  number: 'number',
  float: 'number',
  integer: 'integer',
  int: 'integer',
};

// Anything the engine has no stricter type for is free text
const toFieldSpec = (field: CandidateFilterField): FilterFieldSpec => {
  const type = FIELD_TYPES[field.type.trim().toLowerCase()] ?? 'text';

  return {
    name: field.name,
    // An enum with no values cannot be validated, so it is read as text
    type:
      type === 'enum' && (field.enumValues ?? []).length === 0 ? 'text' : type,
    ...(field.description !== undefined && { description: field.description }),
    ...(field.enumValues !== undefined && { enumValues: field.enumValues }),
  };
};

const metadataFieldsOf = (config: CandidateFilterConfig): string[] => [
  ...config.selectedMetadataFields.filter((field) => field !== 'resume'),
  ...(config.includeResume === true ? ['resume'] : []),
];

// No keepField: a candidate filter fills columns, it never drops a row
export const toFilterSpec = (config: CandidateFilterConfig): FilterSpec => ({
  name: config.modelName,
  subject: 'person',
  criteria: config.prompt,
  fields: config.fields.map(toFieldSpec),
  model: config.selectedModel,
  metadataFields: metadataFieldsOf(config),
  ...(config.concurrency !== undefined && { concurrency: config.concurrency }),
});

// Each filter's answers land on the candidate under the filter's own field
// names. A failed verdict adds nothing, so a column is left empty rather than
// filled with a guess.
export const mergeVerdicts = (
  results: Map<string, CandidateFilterResult>,
  verdicts: RecordVerdict[],
): void => {
  for (const verdict of verdicts) {
    const result = results.get(verdict.id) ?? {
      candidateId: verdict.id,
      enrichedData: {},
    };

    if (verdict.status === 'answered') {
      Object.assign(result.enrichedData, verdict.answers);
    }

    results.set(verdict.id, result);
  }
};

export type CandidateFilterTokenEstimate = {
  totalInputTokens: number;
  totalOutputTokens: number;
  estimatedCost: number;
  totalCandidates: number;
};

// A rough preview before a run: one token per four characters, at GPT-4o
// list prices. The run itself reports what it actually used.
export const estimateFilterTokens = (
  candidates: Array<Record<string, unknown>>,
  configs: CandidateFilterConfig[],
): CandidateFilterTokenEstimate => {
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  for (const config of configs) {
    const metadataFields = metadataFieldsOf(config);

    for (const candidate of candidates) {
      totalInputTokens += Math.ceil(
        (config.prompt.length +
          buildRecordText(candidate, metadataFields).length) /
          4,
      );
      totalOutputTokens += Math.ceil((config.fields.length * 50) / 4);
    }
  }

  return {
    totalInputTokens,
    totalOutputTokens,
    estimatedCost:
      (totalInputTokens / 1000) * 0.005 + (totalOutputTokens / 1000) * 0.015,
    totalCandidates: candidates.length,
  };
};
