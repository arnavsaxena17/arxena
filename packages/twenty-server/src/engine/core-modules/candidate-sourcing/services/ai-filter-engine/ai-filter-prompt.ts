import {
  getValueFromCandidateRecord,
  hasMeaningfulCandidateFieldValue,
} from 'twenty-shared';

import {
  type FilterFieldSpec,
  type FilterSpec,
  type FilterSubject,
} from 'src/engine/core-modules/candidate-sourcing/services/ai-filter-engine/ai-filter-contract';

const SUBJECT_LABEL: Record<FilterSubject, string> = {
  person: 'person (a LinkedIn profile)',
  company: 'company',
  record: 'record',
};

// One record as `field: value` lines. Only fields the filter asked for are
// sent, and empty ones are dropped so the model is never shown blanks.
// Plain-language labels for fields whose raw name hides the unit. A bare
// "size: 501-1000" was misread as a count above 1000 by small models.
const FIELD_LABELS: Record<string, string> = {
  size: 'company size (employees)',
};

export const buildRecordText = (
  record: Record<string, unknown>,
  metadataFields: string[],
): string =>
  metadataFields
    .map((field) => {
      const value = getValueFromCandidateRecord(record, field);

      if (!hasMeaningfulCandidateFieldValue(value)) {
        return '';
      }

      const text =
        typeof value === 'object' ? JSON.stringify(value) : String(value);

      return `${FIELD_LABELS[field] ?? field}: ${text}`;
    })
    .filter(Boolean)
    .join('\n');

// What the model is told about the task: shared by every adapter so a model
// change does not change the decision rules.
export const buildInstructions = (
  spec: Pick<
    FilterSpec,
    'subject' | 'criteria' | 'context' | 'keepField' | 'webSearch'
  >,
): string =>
  (spec.keepField === undefined
    ? [
        `You fill columns for one ${SUBJECT_LABEL[spec.subject]} at a time.`,
        spec.webSearch === true
          ? 'Use web search to find the answer. Prefer the most recent figure and use only credible sources. When you cannot find a credible answer, leave it empty (null for numbers, "unknown" for text and lists). Never guess.'
          : 'Judge from the fields shown and from what you reliably know about the person or company they describe (a company name usually tells its sector). When you are not reasonably sure, leave it empty (null for numbers, "unknown" for text and lists). Never invent a figure.',
        `Task:\n${spec.criteria.trim()}`,
      ]
    : [
        `You screen one ${SUBJECT_LABEL[spec.subject]} at a time for an outbound sales campaign.`,
        `Decide "${spec.keepField}" = true only when the record clearly meets the criteria below; otherwise false.`,
        'Judge only from the fields shown. Do not guess missing facts and do not reward a record for being famous. When the fields are too thin to confirm the criteria, answer false.',
        `Criteria:\n${spec.criteria.trim()}`,
      ]
  )
    .concat(spec.context?.trim() ? [`Campaign context:\n${spec.context.trim()}`] : [])
    .filter(Boolean)
    .join('\n\n');

export const describeField = (
  field: FilterFieldSpec,
  allowUnknown = false,
): string => {
  const options =
    field.type === 'enum' && field.enumValues
      ? ` (one of: ${[...field.enumValues, ...(allowUnknown ? ['unknown'] : [])].join(', ')})`
      : '';
  const kind =
    field.type === 'text'
      ? 'short text, max 20 words'
      : field.type === 'integer'
        ? 'whole number, null when unknown'
        : field.type === 'number'
          ? 'number, null when unknown'
          : field.type;

  return `- ${field.name}: ${kind}${options}${field.description ? `. ${field.description}` : ''}`;
};
