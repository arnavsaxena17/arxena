import type { GeneratedSearchParameters } from 'src/engine/core-modules/candidate-search/types/candidate-search-request.type';

export const andMergeBooleanSearchClauses = (
  clauses: Array<string | null | undefined>,
): string | undefined => {
  const cleaned = clauses
    .map((clause) => clause?.trim())
    .filter((clause): clause is string => !!clause);

  if (cleaned.length === 0) {
    return undefined;
  }

  if (cleaned.length === 1) {
    return cleaned[0];
  }

  return cleaned
    .map((clause) =>
      clause.includes(' ') || /OR|AND/i.test(clause) ? `(${clause})` : clause,
    )
    .join(' AND ');
};

export const wrapJobTitleAsOrClause = (jobTitle: string | null | undefined): string | undefined => {
  const trimmed = jobTitle?.trim();
  if (!trimmed) {
    return undefined;
  }

  if (trimmed.includes(' OR ') || trimmed.startsWith('(')) {
    return trimmed;
  }

  const terms = trimmed
    .split(/[\s/|,]+/g)
    .map((term) => term.trim())
    .filter((term) => term.length > 1);

  if (terms.length <= 1) {
    return trimmed;
  }

  return terms.join(' OR ');
};

const readTrimmedString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed || undefined;
};

export const extractKeywordsClauseFromGeneratedSearchParameters = (
  generated: GeneratedSearchParameters,
): string | undefined => {
  const classicKeywords =
    generated.classicPeopleSearch?.keywords?.trim() ||
    generated.classicPeopleSearchStrategies?.[0]?.parameters?.keywords?.trim() ||
    undefined;
  const strategyKeywords =
    generated.salesNavigatorPeopleSearchStrategies?.[0]?.parameters?.keywords;

  return (
    classicKeywords ||
    (typeof strategyKeywords === 'string'
      ? strategyKeywords.trim() || undefined
      : undefined)
  );
};

export const extractJobTitleClauseFromGeneratedSearchParameters = (
  generated: GeneratedSearchParameters,
): string | undefined => {
  const salesNavTitle =
    generated.salesNavigatorPeopleSearchStrategies?.[0]?.parameters?.role
      ?.include?.[0];
  const classicTitle =
    generated.classicPeopleSearchStrategies?.[0]?.parameters?.advanced_keywords
      ?.title;
  const recruiterTitle =
    generated.recruiterPeopleSearchStrategies?.[0]?.parameters?.role?.[0]
      ?.keywords;
  const classicPeopleSearch = generated.classicPeopleSearch as
    | { job_title?: string }
    | undefined;

  return (
    readTrimmedString(salesNavTitle) ||
    readTrimmedString(classicTitle) ||
    readTrimmedString(recruiterTitle) ||
    wrapJobTitleAsOrClause(classicPeopleSearch?.job_title)
  );
};

export const extractLinkedInSearchClauseFromGeneratedSearchParameters = (
  generated: GeneratedSearchParameters,
): string | undefined =>
  extractKeywordsClauseFromGeneratedSearchParameters(generated) ||
  extractJobTitleClauseFromGeneratedSearchParameters(generated);
