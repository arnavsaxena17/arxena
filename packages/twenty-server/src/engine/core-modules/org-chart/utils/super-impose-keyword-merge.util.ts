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

export const extractKeywordsClauseFromGeneratedSearchParameters = (
  generated: GeneratedSearchParameters,
): string | undefined => {
  const classicKeywords =
    generated.classicPeopleSearch?.keywords?.trim() || undefined;
  const strategyKeywords =
    generated.salesNavigatorPeopleSearchStrategies?.[0]?.parameters?.keywords;
  const salesNavKeywords =
    typeof strategyKeywords === 'string' ? strategyKeywords.trim() : undefined;
  const classicPeopleSearch = generated.classicPeopleSearch as
    | { job_title?: string }
    | undefined;
  const jobTitleClause = wrapJobTitleAsOrClause(
    classicPeopleSearch?.job_title ??
      generated.salesNavigatorPeopleSearchStrategies?.[0]?.parameters?.role
        ?.include?.[0] ??
      null,
  );

  return classicKeywords || salesNavKeywords || jobTitleClause;
};
