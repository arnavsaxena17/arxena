import {
  cleanCompanyNameForDisplay,
  cleanPersonNameForDisplay,
} from 'twenty-shared/arx';

const normalize = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const tokensOf = (value: string): string[] =>
  normalize(value)
    .split(' ')
    .filter((token) => token.length > 1);

// The repo's display cleaners do the heavy lifting: they drop "Dr", "Mr", "CA"
// and legal suffixes such as "Pvt. Ltd."
const nameTokensOf = (value: string): string[] =>
  tokensOf(cleanPersonNameForDisplay(value));

const companyTokensOf = (value: string): string[] =>
  tokensOf(cleanCompanyNameForDisplay(value));

// Same person: first and last name both present (middle names and titles such
// as "Dr." do not matter). A single-word name must match exactly.
export const nameMatches = (
  rowName: string,
  candidateName: string,
): boolean => {
  const wanted = nameTokensOf(rowName);
  const found = new Set(nameTokensOf(candidateName));

  if (wanted.length === 0 || found.size === 0) {
    return false;
  }

  return wanted.length === 1
    ? found.has(wanted[0]) && found.size === 1
    : found.has(wanted[0]) && found.has(wanted[wanted.length - 1]);
};

// Same employer: one name holds all the meaningful words of the other
// ("Vadilal" in "Vadilal Industries Limited", "Subway India" in "Subway")
export const companyMatches = (
  rowCompany: string,
  candidateCompanies: string[],
): boolean => {
  const wanted = companyTokensOf(rowCompany);

  if (wanted.length === 0) {
    return false;
  }

  return candidateCompanies.some((candidate) => {
    const found = companyTokensOf(candidate);

    if (found.length === 0) {
      return false;
    }

    const foundSet = new Set(found);
    const wantedSet = new Set(wanted);

    return (
      wanted.every((token) => foundSet.has(token)) ||
      found.every((token) => wantedSet.has(token))
    );
  });
};

// Free text (a Google headline and snippet) names the company when every
// meaningful word of it appears there
export const textMentionsCompany = (
  text: string,
  companyName: string,
): boolean => {
  const wanted = companyTokensOf(companyName);
  const found = new Set(tokensOf(text));

  return wanted.length > 0 && wanted.every((token) => found.has(token));
};

// Fallback when no model is available: the company on the profile, or the
// words its evidence was read from, names the row's company
export const profileMatchesCompany = (
  profile: { companyName: string; evidence: string },
  companyName: string,
): boolean =>
  companyMatches(companyName, [profile.companyName]) ||
  textMentionsCompany(profile.evidence, companyName);
