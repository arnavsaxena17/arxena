import {
  COMPANY_COLLECTOR_SEPARATORS,
  COMPANY_COLLECTOR_STOP_WORDS,
  COMPANY_NAME_CLEANING_STOP_WORDS,
} from 'src/engine/core-modules/org-chart/utils/company-name-cleaning-stopwords.const';

const collapseWhitespace = (text: string): string =>
  text
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length > 0)
    .join(' ');

const removeCompanyCleaningStopWords = (text: string): string =>
  text
    .split(' ')
    .filter((token) => token.length > 0)
    .filter((token) => !COMPANY_NAME_CLEANING_STOP_WORDS.has(token))
    .join(' ');

const replaceAmpersands = (text: string): string =>
  text.replaceAll('&', '').replaceAll('&amp;', '').replaceAll('amp', '');

const removeSymbols = (text: string): string =>
  text.replace(/[^\w]/g, ' ').replace(/[^\x00-\x7F]+/g, ' ');

// Port of DataCleaning.merge_single_chars — "a b" → "ab"
const mergeSingleChars = (text: string): string =>
  text.replace(/(?<=\b[a-z]) (?=[a-z]\b)/g, '');

// Port of DataCleaning.clean_company_names (lowercase output)
export const cleanCompanyNames = (rawCompanyName: string): string => {
  if (
    typeof rawCompanyName !== 'string' ||
    rawCompanyName.trim().length === 0
  ) {
    return '';
  }

  let text = rawCompanyName.toLowerCase();

  text = removeCompanyCleaningStopWords(text);
  text = text.replaceAll('-', ' ');
  text = text.replaceAll('.', ' ');
  text = collapseWhitespace(text);
  text = replaceAmpersands(text);
  text = removeSymbols(text);
  text = collapseWhitespace(text);
  text = mergeSingleChars(text);
  text = mergeSingleChars(text);

  return text.trim();
};

// Port of CompanyCollector.cleaned_query (uppercase, separator strip)
export const cleanCompanyNameForCollectorQuery = (
  companyName: string,
): string => {
  let text = companyName.trim();

  for (const separator of COMPANY_COLLECTOR_SEPARATORS) {
    text = text.split(separator).join(' ');
  }

  const tokens = text
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length > 0)
    .filter((token) => !COMPANY_COLLECTOR_STOP_WORDS.has(token.toLowerCase()));

  return tokens.join(' ').toUpperCase();
};

// Production path: DataCleaning.clean_company_names then CompanyCollector.cleaned_query
export const cleanRawCompanyName = (rawCompanyName: string): string => {
  const dataCleaned = cleanCompanyNames(rawCompanyName);

  if (dataCleaned.length === 0) {
    return '';
  }

  return cleanCompanyNameForCollectorQuery(dataCleaned);
};
