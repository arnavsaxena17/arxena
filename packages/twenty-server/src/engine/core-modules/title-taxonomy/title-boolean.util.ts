// Google understands OR and parentheses but not the word AND: a space is its
// implicit AND. NOT is a leading minus. So a curated LinkedIn boolean title
// expression can be sent to a "site:linkedin.com/in" query with a light
// rewrite, instead of flattening it to a title list (which loses "VP
// Manufacturing" when the role was "Head of Manufacturing").
export const toGoogleTitleClause = (expression: string): string =>
  expression
    .replace(/\bAND\b/g, ' ')
    .replace(/\bNOT\s+/g, '-')
    .replace(/\s+/g, ' ')
    .trim();

// A company x role search can carry one clause per function x grade. More than
// this many paid SERP queries per company is not worth the recall.
export const MAX_GOOGLE_TITLE_CLAUSES = 3;

// Google caps a query at about 32 words; a longer boolean clause is dropped
// rather than truncated into invalid parentheses.
export const isGoogleTitleClauseUsable = (clause: string): boolean =>
  clause !== '' && clause.split(/\s+/).length <= 30;
