import { normalizeCompanyName } from 'src/engine/core-modules/org-chart/utils/match-bright-data-company-name.util';

const COUNTRY_WORDS = new Set(['india', 'indian', 'usa', 'uk', 'global']);

// Words that can follow a brand on a profile without changing which company it is
const BENIGN_WORDS = new Set([
  ...COUNTRY_WORDS,
  'the',
  'and',
  'of',
  'food',
  'foods',
  'group',
  'holdings',
  'official',
  'services',
]);

const tokenize = (value: string): string[] =>
  normalizeCompanyName(value)
    .split(' ')
    .filter((token) => token !== '');

const brandTokens = (name: string): string[] =>
  tokenize(name).filter((token) => !COUNTRY_WORDS.has(token));

// The name as given, its alternates (brand, legal, parent), and the name
// without a trailing country word
export const buildCompanyVariants = (
  name: string,
  alternateNames: string[] = [],
): string[] => {
  const variants: string[] = [];
  const seen = new Set<string>();

  for (const candidate of [name, ...alternateNames]) {
    const trimmed = candidate.trim();
    const withoutCountry = brandTokens(trimmed).join(' ');

    for (const variant of [trimmed, withoutCountry]) {
      const key = variant.toLowerCase();

      if (variant !== '' && !seen.has(key)) {
        seen.add(key);
        variants.push(variant);
      }
    }
  }

  return variants;
};

const containsPhrase = (tokens: string[], phrase: string[]): boolean => {
  for (let start = 0; start + phrase.length <= tokens.length; start += 1) {
    if (phrase.every((word, offset) => tokens[start + offset] === word)) {
      return true;
    }
  }

  return false;
};

// Does the company on a profile belong to one of the names we are looking for?
// A multi-word brand must appear as a phrase ("faces canada" is not "happy
// faces"). A one-word brand must be the whole name once harmless words are
// dropped, so "acme" matches "Acme Foods Pvt Ltd" but not "Acme Robotics".
export const matchesAnyCompanyVariant = (
  variants: string[],
  candidateCompanyName: unknown,
): boolean => {
  if (typeof candidateCompanyName !== 'string') {
    return false;
  }

  const candidateTokens = tokenize(candidateCompanyName);

  return variants.some((variant) => {
    const phrase = brandTokens(variant);

    if (phrase.length === 0) {
      return false;
    }

    if (phrase.length > 1) {
      return containsPhrase(candidateTokens, phrase);
    }

    const remaining = candidateTokens.filter(
      (token) => !BENIGN_WORDS.has(token),
    );

    return remaining.length === 1 && remaining[0] === phrase[0];
  });
};

// Used when a search result has no separate company field, only free text
export const textMentionsAnyCompanyVariant = (
  variants: string[],
  text: string,
): boolean => {
  const tokens = tokenize(text);

  return variants.some((variant) => {
    const phrase = brandTokens(variant);

    return phrase.length > 0 && containsPhrase(tokens, phrase);
  });
};
