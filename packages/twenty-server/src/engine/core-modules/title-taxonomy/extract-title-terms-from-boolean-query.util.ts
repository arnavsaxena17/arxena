// Curated queries for some functions are a plain list of titles
// ((CEO OR "chief executive" OR founder)); others are function AND seniority
// expressions, which are not a title list and are skipped.
export const extractTitleTermsFromBooleanQuery = (query: string): string[] => {
  if (/\b(AND|NOT)\b/.test(query)) {
    return [];
  }

  return query
    .split(/\bOR\b/)
    .map((term) => term.replace(/[()"]/g, '').trim().toLowerCase())
    .filter((term) => term !== '');
};
