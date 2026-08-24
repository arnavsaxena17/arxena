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

export type EmploymentPositionMatchInput = {
  company?: string | null;
  company_id?: string | number | null;
  companyId?: string | number | null;
  role?: string | null;
};

export type TargetCompanyForPositionMatch = {
  companyName?: string | null;
  companyId?: string | number | null;
  companySlug?: string | null;
};

const normalizeCompanyId = (value: unknown): string => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim();
};

const collectTargetCompanyId = (
  target: TargetCompanyForPositionMatch,
): string => normalizeCompanyId(target.companyId);

const collectTargetCompanyNames = (
  target: TargetCompanyForPositionMatch,
): string[] => {
  const names: string[] = [];
  const seen = new Set<string>();
  for (const raw of [target.companyName, target.companySlug]) {
    const value = raw?.trim();
    if (!value) {
      continue;
    }
    for (const candidate of [value, value.replace(/-/g, ' ')]) {
      const key = candidate.toLowerCase();
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      names.push(candidate);
    }
  }
  return names;
};

const hasCompanyScope = (target: TargetCompanyForPositionMatch): boolean =>
  collectTargetCompanyId(target).length > 0 ||
  collectTargetCompanyNames(target).length > 0;

/**
 * Pick the current role at the searched company.
 * 1. Match `company_id` / `companyId` against the Sales Nav / Unipile company id.
 * 2. Otherwise match the employer name (or slug) against the role's company.
 * Never assumes `positions[0]` is the searched company.
 */
export const pickEmploymentPositionMatchingCompany = <
  T extends EmploymentPositionMatchInput,
>(
  positions: T[] | null | undefined,
  target: TargetCompanyForPositionMatch,
): T | undefined => {
  if (!positions?.length || !hasCompanyScope(target)) {
    return undefined;
  }

  const targetId = collectTargetCompanyId(target);
  if (targetId) {
    const idHit = positions.find((position) => {
      const id = normalizeCompanyId(position.company_id ?? position.companyId);
      return id.length > 0 && id === targetId;
    });
    if (idHit) {
      return idHit;
    }
  }

  const targetNames = collectTargetCompanyNames(target);
  for (const targetName of targetNames) {
    const nameHit = positions.find((position) =>
      companyNamesLooselyMatch(position.company ?? '', targetName),
    );
    if (nameHit) {
      return nameHit;
    }
  }

  return undefined;
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
