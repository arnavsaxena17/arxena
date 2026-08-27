import { SALES_NAV_GRADE_TO_SENIORITIES } from 'src/engine/core-modules/candidate-search/constants/taxonomy-platform-maps';
import { pickEmploymentPositionMatchingCompany } from 'src/engine/core-modules/candidate-sourcing/utils/linkedin-orgchart-company-match.util';
import type { LinkedInSeniorityType } from 'src/engine/core-modules/linkedin-search/types/linkedin-search-parameter.type';
import {
  collectCurrentPositionRecords,
  extractCompanyFromPositionLike,
  extractCompanyIdFromPositionLike,
  extractTitleFromPositionLike,
  toPositionMatchInput,
} from 'src/engine/core-modules/people-api/utils/extract-candidate-job-title.util';
import {
  matchesTaxonomyFilter,
  type TaxonomyResolvedFields,
} from 'src/engine/core-modules/people-api/utils/filter-people-by-taxonomy.util';

export type SearchPositionIntent = {
  companyIds?: Array<string | number | null | undefined>;
  companyId?: string | number | null;
  companyName?: string | null;
  companySlug?: string | null;
  stdFunction?: string | null;
  stdFunctionRoot?: string | null;
  stdGrade?: string | null;
  salesNavSeniorities?: LinkedInSeniorityType[];
};

const asNonEmpty = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

const normalizeGradeKey = (value: string): string =>
  value.trim().toLowerCase().replace(/\s+/g, ' ');

export const isCompanySearchIntent = (
  intent?: SearchPositionIntent,
): boolean =>
  collectIntentCompanyIds(intent).length > 0 ||
  !!intent?.companyName?.trim() ||
  !!intent?.companySlug?.trim();

export const isTaxonomySearchIntent = (
  intent?: SearchPositionIntent,
): boolean =>
  !!intent?.stdFunction?.trim() ||
  !!intent?.stdFunctionRoot?.trim() ||
  !!intent?.stdGrade?.trim();

export const isSenioritySearchIntent = (
  intent?: SearchPositionIntent,
): boolean => (intent?.salesNavSeniorities?.length ?? 0) > 0;

export const isScopedSearchIntent = (
  intent?: SearchPositionIntent,
): boolean =>
  isCompanySearchIntent(intent) ||
  isTaxonomySearchIntent(intent) ||
  isSenioritySearchIntent(intent);

export const collectIntentCompanyIds = (
  intent?: SearchPositionIntent,
): string[] => {
  if (!intent) {
    return [];
  }

  const ids = [intent.companyId, ...(intent.companyIds ?? [])]
    .map((value) => {
      if (typeof value === 'number' && Number.isFinite(value)) {
        return String(value);
      }
      return asNonEmpty(value);
    })
    .filter((id) => id.length > 0);

  return [...new Set(ids)];
};

export const classifiedGradeMatchesSalesNavSeniorities = (
  stdGrade: string | null | undefined,
  seniorities: LinkedInSeniorityType[] | undefined,
): boolean => {
  if (!stdGrade?.trim() || !seniorities?.length) {
    return false;
  }

  const mapped =
    SALES_NAV_GRADE_TO_SENIORITIES[normalizeGradeKey(stdGrade)] ?? [];

  return mapped.some((seniority) => seniorities.includes(seniority));
};

const roleKey = (position: Record<string, unknown>): string =>
  extractTitleFromPositionLike(position)?.toLowerCase() ?? '';

const matchesRoleIntent = (
  position: Record<string, unknown>,
  intent: SearchPositionIntent,
  classifiedByRole?: ReadonlyMap<string, TaxonomyResolvedFields>,
): boolean => {
  const needsClassification =
    isTaxonomySearchIntent(intent) || isSenioritySearchIntent(intent);

  if (!needsClassification) {
    return true;
  }

  const resolved = classifiedByRole?.get(roleKey(position));

  if (!resolved) {
    return false;
  }

  if (
    intent.stdFunction?.trim() ||
    intent.stdFunctionRoot?.trim() ||
    (intent.stdGrade?.trim() &&
      (intent.stdFunction?.trim() || intent.stdFunctionRoot?.trim()))
  ) {
    if (!matchesTaxonomyFilter(resolved, intent)) {
      return false;
    }
  } else if (intent.stdGrade?.trim()) {
    if (
      normalizeGradeKey(resolved.stdGrade ?? '') !==
      normalizeGradeKey(intent.stdGrade)
    ) {
      return false;
    }
  }

  if (isSenioritySearchIntent(intent) && !intent.stdGrade?.trim()) {
    return classifiedGradeMatchesSalesNavSeniorities(
      resolved.stdGrade,
      intent.salesNavSeniorities,
    );
  }

  return true;
};

const pickFromPool = (
  pool: Record<string, unknown>[],
  intent?: SearchPositionIntent,
  classifiedByRole?: ReadonlyMap<string, TaxonomyResolvedFields>,
): Record<string, unknown> | undefined => {
  if (pool.length === 0) {
    return undefined;
  }

  let candidates = pool;

  if (isCompanySearchIntent(intent)) {
    const matched = pickEmploymentPositionMatchingCompany(
      pool.map(toPositionMatchInput),
      {
        companyName: intent?.companyName,
        companyId: intent?.companyId,
        companyIds: intent?.companyIds,
        companySlug: intent?.companySlug,
      },
    );

    if (matched) {
      candidates = [matched.entry];
    } else {
      const hasEmployerIdentity = pool.some(
        (position) =>
          !!extractCompanyFromPositionLike(position) ||
          !!extractCompanyIdFromPositionLike(position),
      );

      if (hasEmployerIdentity) {
        return undefined;
      }
    }
  } else if (
    !isTaxonomySearchIntent(intent) &&
    !isSenioritySearchIntent(intent)
  ) {
    const withCompanyId = pool.filter(
      (position) => !!extractCompanyIdFromPositionLike(position),
    );

    if (withCompanyId.length === 1) {
      return withCompanyId[0];
    }

    return pool[0];
  }

  if (isTaxonomySearchIntent(intent) || isSenioritySearchIntent(intent)) {
    return candidates.find((position) =>
      matchesRoleIntent(position, intent ?? {}, classifiedByRole),
    );
  }

  return candidates[0];
};

export const pickCurrentPositionForSearchIntent = (
  candidate: Record<string, unknown>,
  intent?: SearchPositionIntent,
  classifiedByRole?: ReadonlyMap<string, TaxonomyResolvedFields>,
): Record<string, unknown> | undefined => {
  const { currentPositions, currentExperience } =
    collectCurrentPositionRecords(candidate);
  const pool =
    currentPositions.length > 0 ? currentPositions : currentExperience;

  return pickFromPool(
    pool.length > 0 ? pool : [candidate],
    intent,
    classifiedByRole,
  );
};

export const flattenCandidateFromMatchedPosition = (
  candidate: Record<string, unknown>,
  position: Record<string, unknown> | undefined,
): Record<string, unknown> => {
  if (!position) {
    return candidate;
  }

  const title = extractTitleFromPositionLike(position);
  const company = extractCompanyFromPositionLike(position);
  const linkedinCompanyId = extractCompanyIdFromPositionLike(position);

  return {
    ...candidate,
    ...(title ? { title, jobTitle: title } : {}),
    ...(company
      ? { company, companyName: company, jobCompanyName: company }
      : {}),
    ...(linkedinCompanyId ? { jobCompanyId: linkedinCompanyId } : {}),
  };
};
