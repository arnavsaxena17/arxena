import { isDefined } from 'twenty-shared/utils';

import { levenshteinDistance } from 'src/engine/core-modules/org-chart/utils/levenshtein-distance.util';

export type CompanyNameResolverHitSource = {
  id?: string;
  name?: string;
  website?: string;
  industry?: string;
  country?: string;
  linkedin_url?: string;
  count_org?: number;
  size?: string;
  founded?: string;
  corporate_score?: number;
  is_org_chart?: boolean | string;
};

export type CompanyNameResolverEsHit = {
  _source?: CompanyNameResolverHitSource;
};

export type PickedCompanyNameHit = {
  source: CompanyNameResolverHitSource;
  editDistance: number;
};

// Port of Python CompanyCollector.run_query best-hit selection
export const pickBestCompanyNameHit = (
  cleanedCompanyName: string,
  hits: CompanyNameResolverEsHit[],
): PickedCompanyNameHit | null => {
  const hitsWithName = hits.filter(
    (
      hit,
    ): hit is CompanyNameResolverEsHit & {
      _source: CompanyNameResolverHitSource & { name: string };
    } =>
      isDefined(hit._source) &&
      typeof hit._source.name === 'string' &&
      hit._source.name.trim().length > 0,
  );

  if (hitsWithName.length === 0) {
    return null;
  }

  const distances = hitsWithName.map((hit) => ({
    hit,
    editDistance: levenshteinDistance(
      cleanedCompanyName.toLowerCase(),
      hit._source.name.toLowerCase(),
    ),
  }));

  const minimumDistance = Math.min(
    ...distances.map((entry) => entry.editDistance),
  );

  const closestHits = distances.filter(
    (entry) => entry.editDistance === minimumDistance,
  );

  let bestHit = closestHits[0].hit;
  let bestCountOrg = Number(bestHit._source.count_org ?? 0);

  for (const entry of closestHits.slice(1)) {
    const countOrg = Number(entry.hit._source.count_org ?? 0);

    if (countOrg > bestCountOrg) {
      bestHit = entry.hit;
      bestCountOrg = countOrg;
    }
  }

  return {
    source: bestHit._source,
    editDistance: minimumDistance,
  };
};
