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
