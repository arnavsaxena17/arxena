import { isDefined } from 'twenty-shared/utils';

import { cleanRawCompanyName } from 'src/engine/core-modules/org-chart/utils/clean-raw-company-name.util';
import { levenshteinDistance } from 'src/engine/core-modules/org-chart/utils/levenshtein-distance.util';

export type CompanyMatchConfidence = 'high' | 'medium' | 'low';

// Thresholds on the name distance (edits between the cleaned query and the
// cleaned hit name, so "Torrent Power Limited" matches "Torrent Power" at 0):
// - high: at most 1 edit (typo or punctuation), no other company just as
//   close (same-name companies make the pick a coin toss) and a corporate
//   score above 0 when the index has one;
// - medium: at most 3 edits or 25% of the query length;
// - low: anything further.
// The corporate_score scale was not checked against the index, so it only
// blocks "high" when it is 0 or below.
export const COMPANY_MATCH_CONFIDENCE_THRESHOLDS = {
  highMaxNameDistance: 1,
  mediumMaxNameDistance: 3,
  mediumMaxNameDistanceRatio: 0.25,
  highMinCorporateScore: 0,
} as const;

export const companyNameDistance = (
  cleanedQuery: string,
  hitName: string,
  editDistance: number,
): number => {
  const cleanedHitName = cleanRawCompanyName(hitName);

  if (cleanedHitName.length === 0) {
    return editDistance;
  }

  return Math.min(
    editDistance,
    levenshteinDistance(
      cleanedQuery.toLowerCase(),
      cleanedHitName.toLowerCase(),
    ),
  );
};

export const companyMatchConfidence = ({
  cleanedQuery,
  nameDistance,
  corporateScore,
  runnerUpNameDistance,
}: {
  cleanedQuery: string;
  nameDistance: number;
  corporateScore: number | null;
  runnerUpNameDistance: number | null;
}): CompanyMatchConfidence => {
  const thresholds = COMPANY_MATCH_CONFIDENCE_THRESHOLDS;
  const passesCorporateScore =
    !isDefined(corporateScore) ||
    corporateScore > thresholds.highMinCorporateScore;
  const hasCloseRunnerUp =
    isDefined(runnerUpNameDistance) && runnerUpNameDistance <= nameDistance;

  if (
    nameDistance <= thresholds.highMaxNameDistance &&
    passesCorporateScore &&
    !hasCloseRunnerUp
  ) {
    return 'high';
  }

  if (
    nameDistance <= thresholds.mediumMaxNameDistance ||
    nameDistance <= cleanedQuery.length * thresholds.mediumMaxNameDistanceRatio
  ) {
    return 'medium';
  }

  return 'low';
};
