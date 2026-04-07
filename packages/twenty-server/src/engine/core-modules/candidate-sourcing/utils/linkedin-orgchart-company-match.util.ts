import type { LinkedInPeopleSearchResult } from 'src/engine/core-modules/linkedin-search/types/linkedin-search-response.type';

/**
 * Normalizes company names for org-chart target matching (subsidiary / suffix tolerant).
 */
export const normalizeCompanyNameForMatch = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[,.\s]+(inc|llc|ltd|limited|corp|corporation|plc|gmbh|sa|bv|pty)\b\.?$/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

export const companyNamesLooselyMatch = (a: string, b: string): boolean => {
  const na = normalizeCompanyNameForMatch(a);
  const nb = normalizeCompanyNameForMatch(b);

  if (!na || !nb) {
    return false;
  }

  if (na === nb) {
    return true;
  }

  if (na.includes(nb) || nb.includes(na)) {
    return true;
  }

  return false;
};

/**
 * True if the candidate's current role (from Bright Data–enriched positions) matches the org-chart company.
 */
export const linkedInPeopleSearchResultMatchesTargetCompany = (
  candidate: LinkedInPeopleSearchResult,
  targetCompanyName: string,
): boolean => {
  const target = targetCompanyName.trim();

  if (!target) {
    return true;
  }

  const employerNames: string[] = [];

  for (const p of candidate.current_positions ?? []) {
    const c = p.company?.trim();

    if (c) {
      employerNames.push(c);
    }
  }

  for (const w of candidate.work_experience ?? []) {
    if (w.end !== undefined) {
      continue;
    }

    const c = w.company?.trim();

    if (c) {
      employerNames.push(c);
    }
  }

  for (const name of employerNames) {
    if (companyNamesLooselyMatch(name, target)) {
      return true;
    }
  }

  return false;
};
