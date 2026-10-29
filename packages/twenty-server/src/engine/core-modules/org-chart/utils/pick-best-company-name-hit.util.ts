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

const hasName = (
  hit: CompanyNameResolverEsHit,
): hit is CompanyNameResolverEsHit & {
  _source: CompanyNameResolverHitSource & { name: string };
} =>
  isDefined(hit._source) &&
  typeof hit._source.name === 'string' &&
  hit._source.name.trim().length > 0;

// Closest name first, then highest count_org; the sort is stable so equal
// hits keep their Elasticsearch order (the Python collector's tie-break).
export const rankCompanyNameHits = (
  cleanedCompanyName: string,
  hits: CompanyNameResolverEsHit[],
  limit: number = hits.length,
): PickedCompanyNameHit[] =>
  hits
    .filter(hasName)
    .map((hit) => ({
      source: hit._source,
      editDistance: levenshteinDistance(
        cleanedCompanyName.toLowerCase(),
        hit._source.name.toLowerCase(),
      ),
    }))
    .sort(
      (left, right) =>
        left.editDistance - right.editDistance ||
        Number(right.source.count_org ?? 0) -
          Number(left.source.count_org ?? 0),
    )
    .slice(0, Math.max(0, limit));

// Port of Python CompanyCollector.run_query best-hit selection
export const pickBestCompanyNameHit = (
  cleanedCompanyName: string,
  hits: CompanyNameResolverEsHit[],
): PickedCompanyNameHit | null =>
  rankCompanyNameHits(cleanedCompanyName, hits, 1)[0] ?? null;
