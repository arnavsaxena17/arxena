import { type ResolvedRoles } from 'src/engine/core-modules/title-taxonomy/title-expansion.service';

// One paid search: a taxonomy class (or an unclassified role on its own) and
// the roles that share it. Roles that share a class (Procurement Head and CPO)
// share a search but keep their own pair states.
export type RoleSearchPlan = {
  key: string;
  roles: string[];
  titles: string[];
  titleExpression: string | null;
};

// A role's own search carries its titles, so the cap is per role; the
// company-wide union cap is only for the merged single search below
export const MAX_TITLES_PER_ROLE_QUERY = 6;

export const buildRoleSearches = (
  resolvedRoles: ResolvedRoles,
  roles: string[],
): RoleSearchPlan[] => {
  const groups = new Map<string, RoleSearchPlan>();
  const plans = resolvedRoles.rolePlans;

  // A caller (or an older test double) without a per-role plan keeps the
  // merged single search, which is what every caller did before the fan-out
  if (!Array.isArray(plans) || plans.length === 0) {
    return [
      {
        key: 'all',
        roles,
        titles: resolvedRoles.searchTitles.slice(
          0,
          MAX_TITLES_PER_ROLE_QUERY * Math.max(roles.length, 1),
        ),
        titleExpression: resolvedRoles.booleanTitleExpression ?? null,
      },
    ];
  }

  for (const plan of plans) {
    const key =
      plan.titleClass === null
        ? `role:${plan.role.trim().toLowerCase()}`
        : `${plan.titleClass.functionId}|${plan.titleClass.functionRoot ?? ''}|${plan.titleClass.grade ?? ''}`;
    const titles = plan.searchTitles.slice(0, MAX_TITLES_PER_ROLE_QUERY);
    const existing = groups.get(key);

    if (existing !== undefined) {
      existing.roles.push(plan.role);
      existing.titles = [...new Set([...existing.titles, ...titles])];

      continue;
    }

    groups.set(key, {
      key,
      roles: [plan.role],
      titles,
      titleExpression: plan.titleExpression,
    });
  }

  return [...groups.values()];
};

// Seniority tiers for a role's titles. A cell (company x role family x source)
// asks tier 1 first and goes down a tier only when the one above returned
// nobody, so a company with a Head of Procurement never pays for its managers.
const TIER_ONE_TITLE =
  /\b(chief|cxo|ceo|cfo|coo|cto|cmo|cpo|chro|cso|csco|vp|svp|evp|avp|vice president|president|head|md|managing director)\b/i;
const TIER_TWO_TITLE = /\b(director|gm|general manager|dgm|agm|leader)\b/i;

export const titleTierOf = (title: string): 1 | 2 | 3 =>
  TIER_ONE_TITLE.test(title) ? 1 : TIER_TWO_TITLE.test(title) ? 2 : 3;

// The titles split by tier, top tier first, empty tiers left out
export const splitTitlesByTier = (titles: string[]): string[][] =>
  ([1, 2, 3] as const)
    .map((tier) => titles.filter((title) => titleTierOf(title) === tier))
    .filter((tierTitles) => tierTitles.length > 0);

// The ledger stage for one cell, so a trace can show every company x family x
// source cell as run, with its tier. The company is the ledger row's subject.
export const cellStage = ({
  familyKey,
  source,
  tier,
}: {
  familyKey: string;
  source: 'bright_data' | 'harvest' | 'google' | 'serp_sources';
  tier?: number | 'boolean';
}): string =>
  `cell:${familyKey}|${source}${
    tier === undefined ? '' : tier === 'boolean' ? '|boolean' : `|t${tier}`
  }`;

// The searches one role search becomes. A curated boolean filter is one
// search; a title list is one per tier, asked top tier first. A search with no
// titles still runs once, on the company alone.
export const tieredSearchesOf = (
  search: RoleSearchPlan,
): Array<{ titles: string[]; tier: number | 'boolean' }> => {
  if (search.titleExpression !== null && search.titleExpression.trim() !== '') {
    return [{ titles: search.titles, tier: 'boolean' }];
  }

  const tiers = splitTitlesByTier(search.titles).map((titles) => ({
    titles,
    tier: titleTierOf(titles[0]),
  }));

  return tiers.length > 0 ? tiers : [{ titles: search.titles, tier: 1 }];
};
