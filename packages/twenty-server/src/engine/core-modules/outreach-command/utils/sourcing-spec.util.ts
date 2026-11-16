import { isNonEmptyString } from '@sniptt/guards';

import { type ParsedRequirement } from 'src/engine/core-modules/linkedin-query-generation/types/linkedin-query-generation.types';
import {
  type SourcingBrief,
  type SourcingCoverage,
} from 'src/engine/core-modules/outreach-command/utils/sourcing-ledger.util';

// What one constraint is about. The judge reads it to pick the evidence a flag
// needs, the compiler reads it to pick a filter, and a constraint no source
// can filter becomes a post-filter (see candidate-sourcing/sources/adapter.ts)
export type SourcingConstraintField =
  | 'title'
  | 'seniority'
  | 'function'
  | 'industry'
  | 'company'
  | 'company_type'
  | 'location'
  | 'skill'
  | 'certification'
  | 'experience_years'
  | 'salary'
  | 'age'
  | 'keyword'
  | 'other';

export type SourcingConstraint = {
  field: SourcingConstraintField;
  // As the user wrote it, so the confirm step and the report can quote it
  userWords: string;
  // Comparable forms: lowercased terms, expansions, or the range below
  normalized: string[];
  range?: { min?: number; max?: number };
};

export type SourcingSoftConstraint = SourcingConstraint & {
  // Relative weight among the soft constraints; ranks rows, never blocks one
  weight?: number;
};

// The typed requirement a run is planned, judged and stopped against. Stored
// on the ledger brief as `spec`; coverage and sources stay on the brief itself,
// so there is one place each is written.
export type SourcingSpecDraft = {
  hard: SourcingConstraint[];
  soft: SourcingSoftConstraint[];
  exclusions: SourcingConstraint[];
  // Expansions the compiler searches with; the constraints keep the user's form
  normalized: { titles: string[]; industries: string[] };
  target: { count: number | null; precisionFloor?: number };
  budgetUsd?: number;
  // How Agent 1 classified the ask, kept for the compiler (types A to D)
  queryType?: ParsedRequirement['query_type'];
  precisionVsRecall?: ParsedRequirement['precision_vs_recall'];
};

// What the loop reads: the stored spec plus the brief fields it depends on
export type SourcingSpec = SourcingSpecDraft & {
  coverage: SourcingCoverage;
  sources?: string[];
};

const CONSTRAINT_FIELDS: readonly SourcingConstraintField[] = [
  'title',
  'seniority',
  'function',
  'industry',
  'company',
  'company_type',
  'location',
  'skill',
  'certification',
  'experience_years',
  'salary',
  'age',
  'keyword',
  'other',
];

const normalizeTerm = (term: string): string =>
  term.trim().replace(/\s+/g, ' ').toLowerCase();

const uniqueTerms = (terms: string[]): string[] => [
  ...new Set(terms.map(normalizeTerm).filter((term) => term.length > 0)),
];

const constraintOf = (
  field: SourcingConstraintField,
  userWords: string,
  range?: SourcingConstraint['range'],
): SourcingConstraint => ({
  field,
  userWords: userWords.trim(),
  normalized: uniqueTerms([userWords]),
  ...(range !== undefined && { range }),
});

const constraintsOf = (
  field: SourcingConstraintField,
  values: string[] | undefined,
): SourcingConstraint[] =>
  (values ?? [])
    .filter(isNonEmptyString)
    .map((value) => constraintOf(field, value));

const yearsRangeOf = (
  parsed: ParsedRequirement,
): SourcingConstraint['range'] | undefined => {
  const min = parsed.years_min ?? undefined;
  const max = parsed.years_max ?? undefined;

  if (min === undefined && max === undefined) {
    return undefined;
  }

  return {
    ...(min !== undefined && { min }),
    ...(max !== undefined && { max }),
  };
};

// Agent 1 does not say what is required, so the split is fixed here: who the
// person is (role, seniority, place, employer, tenure) must hold; what they
// know ranks them. A high_precision ask makes skills and certifications hard
// too. Pay and age only a candidate can confirm, so they rank and never block.
export const sourcingSpecFromParsedRequirement = (
  parsed: ParsedRequirement,
  options?: { targetCount?: number | null; budgetUsd?: number },
): SourcingSpecDraft => {
  const yearsRange = yearsRangeOf(parsed);
  const isHighPrecision = parsed.precision_vs_recall === 'high_precision';

  const identity: SourcingConstraint[] = [
    ...(isNonEmptyString(parsed.position_title)
      ? [constraintOf('title', parsed.position_title)]
      : []),
    ...(isNonEmptyString(parsed.seniority_level)
      ? [constraintOf('seniority', parsed.seniority_level)]
      : []),
    ...constraintsOf('location', parsed.location),
    ...constraintsOf('company', parsed.target_companies),
    ...(isNonEmptyString(parsed.company_type)
      ? [constraintOf('company_type', parsed.company_type)]
      : []),
    ...(yearsRange !== undefined
      ? [
          constraintOf(
            'experience_years',
            parsed.experience_range ??
              `${yearsRange.min ?? ''}-${yearsRange.max ?? ''} years`,
            yearsRange,
          ),
        ]
      : []),
  ];

  const expertise: SourcingConstraint[] = [
    ...constraintsOf('skill', parsed.technical_skills),
    ...constraintsOf('certification', parsed.certifications),
  ];

  const context: SourcingSoftConstraint[] = [
    ...constraintsOf('industry', parsed.domain_expertise),
    ...constraintsOf('keyword', parsed.industry_terms),
    ...(isNonEmptyString(parsed.salary_range)
      ? [constraintOf('salary', parsed.salary_range)]
      : []),
    ...(isNonEmptyString(parsed.age_range)
      ? [constraintOf('age', parsed.age_range)]
      : []),
  ];

  return {
    hard: isHighPrecision ? [...identity, ...expertise] : identity,
    soft: isHighPrecision ? context : [...expertise, ...context],
    exclusions: [],
    normalized: {
      titles: uniqueTerms(
        isNonEmptyString(parsed.position_title) ? [parsed.position_title] : [],
      ),
      industries: uniqueTerms([
        ...parsed.domain_expertise,
        ...parsed.industry_terms,
      ]),
    },
    target: { count: options?.targetCount ?? null },
    ...(options?.budgetUsd !== undefined && { budgetUsd: options.budgetUsd }),
    queryType: parsed.query_type,
    precisionVsRecall: parsed.precision_vs_recall,
  };
};

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter(isNonEmptyString) : [];

const asFiniteNumber = (value: unknown): number | undefined => {
  const number = typeof value === 'string' ? Number(value) : value;

  return typeof number === 'number' && Number.isFinite(number)
    ? number
    : undefined;
};

const normalizeConstraint = (
  value: unknown,
  fallbackField: SourcingConstraintField,
): SourcingSoftConstraint | undefined => {
  if (isNonEmptyString(value)) {
    return constraintOf(fallbackField, value);
  }

  if (typeof value !== 'object' || value === null) {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const userWords = [record.userWords, record.description, record.text].find(
    isNonEmptyString,
  );

  if (userWords === undefined) {
    return undefined;
  }

  const field = CONSTRAINT_FIELDS.includes(
    record.field as SourcingConstraintField,
  )
    ? (record.field as SourcingConstraintField)
    : fallbackField;
  const normalized = asStringArray(record.normalized);
  const range =
    typeof record.range === 'object' && record.range !== null
      ? {
          min: asFiniteNumber((record.range as Record<string, unknown>).min),
          max: asFiniteNumber((record.range as Record<string, unknown>).max),
        }
      : undefined;
  const weight = asFiniteNumber(record.weight);

  return {
    field,
    userWords: userWords.trim(),
    normalized:
      normalized.length > 0
        ? uniqueTerms(normalized)
        : uniqueTerms([userWords]),
    ...(range !== undefined &&
      (range.min !== undefined || range.max !== undefined) && {
        range: {
          ...(range.min !== undefined && { min: range.min }),
          ...(range.max !== undefined && { max: range.max }),
        },
      }),
    ...(weight !== undefined && { weight }),
  };
};

const normalizeConstraints = (
  value: unknown,
  fallbackField: SourcingConstraintField,
): SourcingSoftConstraint[] | undefined => {
  if (value === undefined) {
    return undefined;
  }

  const items = Array.isArray(value) ? value : [value];

  return items
    .map((item) => normalizeConstraint(item, fallbackField))
    .filter((item): item is SourcingSoftConstraint => item !== undefined);
};

// Same contract as normalizeSourcingBriefDraft: accept what a model writes (a
// string per constraint, a bare number for the target) and keep only the
// fields that are present, so a later brief refines the spec without
// restating it
export const normalizeSourcingSpecDraft = (
  value: unknown,
): Partial<SourcingSpecDraft> | undefined => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const hard = normalizeConstraints(record.hard, 'other');
  const soft = normalizeConstraints(record.soft, 'other');
  const exclusions = normalizeConstraints(record.exclusions, 'other');
  const normalizedRecord =
    typeof record.normalized === 'object' && record.normalized !== null
      ? (record.normalized as Record<string, unknown>)
      : undefined;
  const targetRecord =
    typeof record.target === 'object' && record.target !== null
      ? (record.target as Record<string, unknown>)
      : { count: record.target };
  const targetCount = asFiniteNumber(targetRecord.count);
  const precisionFloor = asFiniteNumber(targetRecord.precisionFloor);
  const budgetUsd = asFiniteNumber(record.budgetUsd);

  return {
    ...(hard !== undefined && {
      hard: hard.map(({ weight: _weight, ...constraint }) => constraint),
    }),
    ...(soft !== undefined && { soft }),
    ...(exclusions !== undefined && {
      exclusions: exclusions.map(
        ({ weight: _weight, ...constraint }) => constraint,
      ),
    }),
    ...(normalizedRecord !== undefined && {
      normalized: {
        titles: uniqueTerms(asStringArray(normalizedRecord.titles)),
        industries: uniqueTerms(asStringArray(normalizedRecord.industries)),
      },
    }),
    ...((targetCount !== undefined ||
      targetRecord.count === null ||
      precisionFloor !== undefined) && {
      target: {
        count:
          targetCount !== undefined && targetCount >= 0 ? targetCount : null,
        ...(precisionFloor !== undefined &&
          precisionFloor >= 0 &&
          precisionFloor <= 1 && { precisionFloor }),
      },
    }),
    ...(budgetUsd !== undefined && budgetUsd >= 0 && { budgetUsd }),
    ...(isNonEmptyString(record.queryType) &&
      ['A', 'B', 'C', 'D'].includes(record.queryType) && {
        queryType: record.queryType as SourcingSpecDraft['queryType'],
      }),
    ...(isNonEmptyString(record.precisionVsRecall) &&
      ['high_precision', 'high_recall', 'balanced'].includes(
        record.precisionVsRecall,
      ) && {
        precisionVsRecall:
          record.precisionVsRecall as SourcingSpecDraft['precisionVsRecall'],
      }),
  };
};

export const mergeSourcingSpec = (
  previous: SourcingSpecDraft | undefined,
  next: Partial<SourcingSpecDraft> | undefined,
): SourcingSpecDraft | undefined => {
  if (previous === undefined && next === undefined) {
    return undefined;
  }

  return {
    hard: [],
    soft: [],
    exclusions: [],
    normalized: { titles: [], industries: [] },
    target: { count: null },
    ...previous,
    ...next,
  };
};

const exclusionsFromText = (text: string | undefined): SourcingConstraint[] =>
  (text ?? '')
    .split(/[;,\n]/)
    .filter((part) => part.trim().length > 0)
    .map((part) => constraintOf('other', part));

// The spec the loop runs on. A brief written before `spec` existed still
// yields one: criteria split by mustHave, target, the run cap and the
// exclusions text fill what the stored spec leaves out.
export const resolveSourcingSpec = (brief: SourcingBrief): SourcingSpec => {
  const stored = brief.spec;
  const fromCriteria = (mustHave: boolean): SourcingConstraint[] =>
    brief.criteria
      .filter((criterion) => criterion.mustHave === mustHave)
      .map((criterion) => constraintOf('other', criterion.description));

  return {
    hard: stored?.hard ?? fromCriteria(true),
    soft: stored?.soft ?? fromCriteria(false),
    exclusions: stored?.exclusions ?? exclusionsFromText(brief.exclusions),
    normalized: stored?.normalized ?? { titles: [], industries: [] },
    target: stored?.target ?? { count: brief.target },
    ...((stored?.budgetUsd ?? brief.capsUsd?.run) !== undefined && {
      budgetUsd: stored?.budgetUsd ?? brief.capsUsd?.run,
    }),
    ...(stored?.queryType !== undefined && { queryType: stored.queryType }),
    ...(stored?.precisionVsRecall !== undefined && {
      precisionVsRecall: stored.precisionVsRecall,
    }),
    coverage: brief.coverage ?? 'best_effort',
    ...(brief.sources !== undefined && { sources: brief.sources }),
  };
};
