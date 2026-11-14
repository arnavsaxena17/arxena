import { CompanyAutocompleteItem } from '../services/pdl-autocomplete.service';

/**
 * Curated autocomplete rows for companies that are missing or filtered out of PDL
 * (e.g. PDL classic autocomplete applies a minimum profile count).
 */
const ARXENA_COMPANY_AUTOCOMPLETE: CompanyAutocompleteItem = {
  name: 'Arxena',
  meta: {
    id: 'arxena',
    linkedin_slug: 'arxena',
    website: 'arxena.com',
    industry: 'Internet',
    linkedin_url: 'https://www.linkedin.com/company/arxena/',
    employee_count: 10,
  },
  count: 10,
};

const normalizeQuery = (inputText: string): string =>
  inputText.trim().toLowerCase();

const manualEntriesForQuery = (
  normalizedQuery: string,
): CompanyAutocompleteItem[] => {
  if (normalizedQuery === 'arxena') {
    return [ARXENA_COMPANY_AUTOCOMPLETE];
  }
  return [];
};

const resultKey = (item: CompanyAutocompleteItem): string => {
  const slug = item.meta.linkedin_slug?.trim().toLowerCase();
  const id = item.meta.id?.trim().toLowerCase();
  return slug || id || '';
};

export const mergeManualCompanyAutocompleteResults = (
  inputText: string,
  results: CompanyAutocompleteItem[],
): CompanyAutocompleteItem[] => {
  const manual = manualEntriesForQuery(normalizeQuery(inputText));
  if (manual.length === 0) {
    return results;
  }

  const existingKeys = new Set(
    results.map((r) => resultKey(r)).filter((k) => k.length > 0),
  );

  const toPrepend = manual.filter((m) => {
    const key = resultKey(m);
    return key.length > 0 && !existingKeys.has(key);
  });

  return [...toPrepend, ...results];
};
