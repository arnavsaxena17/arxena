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

// A company x role search carries one clause per function x grade; the Google
// search service bounds how many paid SERP queries a company may run.

// Google caps a query at about 32 words; a longer boolean clause is dropped
// rather than truncated into invalid parentheses. Callers cap the clause to
// GOOGLE_TITLE_TERM_BUDGET first, so this is a last-resort guard.
export const isGoogleTitleClauseUsable = (clause: string): boolean =>
  clause !== '' && clause.split(/\s+/).length <= 30;
