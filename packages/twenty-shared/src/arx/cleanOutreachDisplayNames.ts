import { toTitleCase } from '../utils/strings/toTitleCase';

// Legal/corporate suffixes only — for message display, not search matching.
// Full DataCleaning.clean_company_names also strips geo/industry tokens and
// lowercases; that is too aggressive for outreach copy.
const CORPORATE_SUFFIXES = new Set([
  'pte',
  'ltd',
  'pvt',
  'llp',
  'llc',
  'limited',
  'private',
  'inc',
  'corp',
  'corporation',
  'co',
  'company',
  'companies',
  'pty',
  'gmbh',
  'plc',
  'sa',
  'ag',
  'incorporated',
  'assoc',
  'association',
]);

// Port of arxena-site NameProcessor titles set
const PERSON_TITLES = new Set([
  'dr',
  'prof',
  'professor',
  'mr',
  'mrs',
  'ms',
  'ca',
]);

const normalizeToken = (token: string): string =>
  token.toLowerCase().replace(/\./g, '');

// "Lite Bite Foods Pvt. Ltd." → "Lite Bite Foods"
export const cleanCompanyNameForDisplay = (
  rawCompanyName: string | null | undefined,
): string => {
  if (rawCompanyName == null || typeof rawCompanyName !== 'string') {
    return '';
  }

  const tokens = rawCompanyName
    .trim()
    .replace(/[.,()/]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 0);

  while (tokens.length > 1) {
    const lastToken = normalizeToken(tokens[tokens.length - 1] ?? '');

    if (!CORPORATE_SUFFIXES.has(lastToken)) {
      break;
    }

    tokens.pop();
  }

  if (tokens.length === 0) {
    return '';
  }

  return toTitleCase(tokens.join(' '));
};

// Port of arxena-site NameProcessor: title-case and drop Mr/Dr/etc.
export const cleanPersonNameForDisplay = (
  rawName: string | null | undefined,
): string => {
  if (rawName == null || typeof rawName !== 'string') {
    return '';
  }

  const trimmed = rawName.trim();

  if (trimmed.length === 0) {
    return '';
  }

  const parts = toTitleCase(trimmed)
    .split(/\s+/)
    .filter((part) => part.length > 0);

  while (parts.length > 0) {
    const firstPart = normalizeToken(parts[0] ?? '');

    if (!PERSON_TITLES.has(firstPart)) {
      break;
    }

    parts.shift();
  }

  return parts.join(' ');
};
