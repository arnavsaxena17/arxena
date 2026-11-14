import type {
  SearchQuery,
  SearchQuerySet,
} from 'src/domains/discovery/query/linkedin-query-generation/types/linkedin-query-generation.types';
import type {
  ClassicPeopleSearchStrategyResult,
  GeneratedSearchParameters,
  RecruiterPeopleSearchStrategyResult,
  SalesNavigatorPeopleSearchStrategyResult,
} from 'src/domains/discovery/query/types/candidate-search-request.type';

type PeopleSearchType = 'classic' | 'sales_navigator' | 'recruiter';

// LinkedIn ANDs the facets with the keyword box, so one combination is a single
// point of failure for the same reason it is on Harvest: a title worded
// differently, or a keyword the profile never used, returns nothing. The
// carriers are therefore varied and the results unioned. Capped because each
// extra search spends the account's daily quota.
export const LINKEDIN_MAX_STRATEGIES_PER_QUERY = 4;

type CarrierVariant = {
  kind: 'all' | 'titles' | 'keywords';
  keywords?: string;
  title?: string;
};

const carrierVariants = (
  keywords: string | undefined,
  title: string | undefined,
): CarrierVariant[] => {
  const variants: CarrierVariant[] = [];

  if (keywords && title) {
    variants.push({ kind: 'all', keywords, title });
  }

  if (title) {
    variants.push({ kind: 'titles', title });
  }

  if (keywords) {
    variants.push({ kind: 'keywords', keywords });
  }

  return variants.length > 0 ? variants : [{ kind: 'all' }];
};

const variantLabel = (variant: CarrierVariant): string =>
  variant.kind === 'titles'
    ? 'titles only'
    : variant.kind === 'keywords'
      ? 'keywords only'
      : '';

type ParamShape = Record<string, unknown>;

function normalizeStringArray(values: string[] | null): string[] | undefined {
  if (!values || values.length === 0) {
    return undefined;
  }

  const normalized = values
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => value.toLowerCase());

  if (normalized.length === 0) {
    return undefined;
  }

  return [...new Set(normalized)];
}

function extractStringArray(arr: unknown): string[] {
  if (!arr) {
    return [];
  }

  if (Array.isArray(arr)) {
    return arr
      .map((item) => {
        if (typeof item === 'string') {
          return item.toLowerCase().trim();
        }
        if (item && typeof item === 'object' && 'keywords' in item) {
          return String(
            (item as { keywords: unknown }).keywords,
          ).toLowerCase().trim();
        }
        if (item && typeof item === 'object' && 'id' in item) {
          return String((item as { id: unknown }).id).toLowerCase().trim();
        }

        return String(item).toLowerCase().trim();
      })
      .filter(Boolean)
      .sort();
  }

  if (
    arr &&
    typeof arr === 'object' &&
    'include' in arr &&
    Array.isArray((arr as { include: unknown[] }).include)
  ) {
    return (arr as { include: unknown[] }).include
      .map((value) => String(value).toLowerCase().trim())
      .filter(Boolean)
      .sort();
  }

  return [];
}

function extractRoleOrTitle(params: ParamShape): string {
  const advancedKeywords = params.advanced_keywords as
    | { title?: string }
    | undefined;

  if (advancedKeywords?.title) {
    return normalizeForDedup(advancedKeywords.title);
  }

  const role = params.role as
    | { include?: string[] }
    | Array<{ keywords?: string }>
    | undefined;

  if (!role || typeof role !== 'object') {
    return '';
  }

  if (Array.isArray(role) && role[0] && 'keywords' in role[0]) {
    return normalizeForDedup((role[0] as { keywords: string }).keywords);
  }

  if ('include' in role && Array.isArray(role.include)) {
    return role.include
      .map((value) => value.trim().toLowerCase())
      .sort()
      .join('|');
  }

  return '';
}

function normalizeForDedup(value: string | null | undefined): string {
  if (!value || typeof value !== 'string') {
    return '';
  }

  const parts = value
    .split(/\s+OR\s+|,|\|/i)
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);

  return [...new Set(parts)].sort().join('|');
}

function buildParamSignature(params: ParamShape): string {
  const keywords = normalizeForDedup((params.keywords as string) ?? '');
  const location = extractStringArray(params.location).join('|');
  const company = extractStringArray(params.company).join('|');
  const roleOrTitle = extractRoleOrTitle(params);

  return [keywords, location, company, roleOrTitle].filter(Boolean).join('::');
}

function deduplicateStrategies<T extends { parameters: ParamShape }>(
  strategies: T[],
): T[] {
  const seen = new Set<string>();

  return strategies.filter((strategy) => {
    const signature = buildParamSignature(strategy.parameters);

    if (signature && seen.has(signature)) {
      return false;
    }

    if (signature) {
      seen.add(signature);
    }

    return true;
  });
}

function buildStrategyLabel(query: SearchQuery, index: number): string {
  const parts: string[] = [];

  if (query.keywords?.trim()) {
    parts.push(query.keywords.trim());
  }

  if (query.job_title?.trim()) {
    parts.push(query.job_title.trim());
  }

  if (query.location && query.location.length > 0) {
    parts.push(query.location.join(', '));
  }

  if (query.company && query.company.length > 0) {
    parts.push(query.company.join(', '));
  }

  if (parts.length === 0) {
    return `LinkedIn query ${index + 1}`;
  }

  const label = parts.join(' · ');

  if (label.length <= 160) {
    return label;
  }

  return `${label.slice(0, 157)}...`;
}

function buildClassicStrategies(
  querySet: SearchQuerySet,
  requirement?: string,
): ClassicPeopleSearchStrategyResult[] {
  return querySet.search_query_set.flatMap((query, index) => {
    const normalizedLocation = normalizeStringArray(query.location);
    const normalizedCompany = normalizeStringArray(query.company);
    const jobTitle = query.job_title?.trim() || undefined;
    const keywords = query.keywords?.trim() || undefined;
    const fence = {
      ...(normalizedLocation && { location: normalizedLocation }),
      ...(normalizedCompany && { company: normalizedCompany }),
    };

    return carrierVariants(keywords, jobTitle).map((variant) => {
      const label = buildStrategyLabel(
        {
          ...query,
          keywords: variant.keywords ?? null,
          job_title: variant.title ?? null,
        },
        index,
      );

      const parameters: ClassicPeopleSearchStrategyResult['parameters'] = {
        ...(variant.keywords ? { keywords: variant.keywords } : {}),
        ...fence,
        ...(variant.title
          ? {
              advanced_keywords: {
                first_name: undefined,
                last_name: undefined,
                title: variant.title,
                company: undefined,
                school: undefined,
              },
            }
          : {}),
      };

      return {
        id: `linkedin-query-classic-${index + 1}-${variant.kind}`,
        label: [variantLabel(variant), label].filter(Boolean).join(' · '),
        description: label,
        strategyText: label,
        originalUserQuery: requirement,
        clarificationQuestions: null,
        clarificationAnswers: null,
        parameters,
      };
    });
  });
}

function buildSalesNavigatorStrategies(
  querySet: SearchQuerySet,
  requirement?: string,
): SalesNavigatorPeopleSearchStrategyResult[] {
  return querySet.search_query_set.flatMap((query, index) => {
    const normalizedLocation = normalizeStringArray(query.location);
    const normalizedCompany = normalizeStringArray(query.company);
    const excludedCompanies = normalizeStringArray(query.exclude_companies ?? null);
    const excludedLocations = normalizeStringArray(query.exclude_locations ?? null);
    const jobTitle = query.job_title?.trim() || undefined;
    const keywords = query.keywords?.trim() || undefined;

    const fence = {
      ...(normalizedLocation || excludedLocations
        ? {
            location: {
              ...(normalizedLocation && { include: normalizedLocation }),
              ...(excludedLocations && { exclude: excludedLocations }),
            },
          }
        : {}),
      ...(normalizedCompany || excludedCompanies
        ? {
            company: {
              ...(normalizedCompany && { include: normalizedCompany }),
              ...(excludedCompanies && { exclude: excludedCompanies }),
            },
          }
        : {}),
    };

    const toStrategy = (
      kind: string,
      carrier: Record<string, unknown>,
      labelPrefix = '',
    ) => {
      const parameters: SalesNavigatorPeopleSearchStrategyResult['parameters'] = {
        ...fence,
        ...carrier,
      };
      const label = buildStrategyLabel(
        { ...query, keywords: null, job_title: null },
        index,
      );

      return {
        id: `linkedin-query-sales-nav-${index + 1}-${kind}`,
        label: [labelPrefix, label].filter(Boolean).join(' · ') || `Sales Navigator ${kind}`,
        description: label,
        strategyText: label,
        originalUserQuery: requirement,
        clarificationQuestions: null,
        clarificationAnswers: null,
        parameters,
      };
    };

    const strategies = carrierVariants(keywords, jobTitle).map((variant) =>
      toStrategy(
        variant.kind,
        {
          ...(variant.keywords ? { keywords: variant.keywords } : {}),
          ...(variant.title ? { role: { include: [variant.title] } } : {}),
        },
        variantLabel(variant),
      ),
    );

    // The facet-only browse: the seat's own industry/company-type filters with
    // no keyword or title carrier, which is what reaches people whose profile
    // does not match the words
    if (query.company_type) {
      strategies.push(
        toStrategy('facets', { company_type: [query.company_type] }, 'facet browse'),
      );
    }

    return strategies;
  });
}

function buildRecruiterStrategies(
  querySet: SearchQuerySet,
  requirement?: string,
): RecruiterPeopleSearchStrategyResult[] {
  return querySet.search_query_set.flatMap((query, index) => {
    const normalizedLocation = normalizeStringArray(query.location);
    const normalizedCompany = normalizeStringArray(query.company);
    const excludedCompany = normalizeStringArray(query.exclude_companies ?? null)?.join(' ');
    const jobTitle = query.job_title?.trim() || undefined;
    const keywords = query.keywords?.trim() || undefined;

    const fence = {
      ...(normalizedLocation && {
        location: normalizedLocation.map((location) => ({
          id: location,
          priority: 'MUST_HAVE' as const,
          scope: 'CURRENT' as const,
        })),
      }),
      ...(normalizedCompany && {
        company: normalizedCompany.map((company) => ({
          keywords: company,
        })),
      }),
      // Recruiter has no include/exclude pair on the company facet;
      // DOESNT_HAVE is how this seat expresses "not these companies"
      ...(excludedCompany && {
        company: [
          ...(normalizedCompany ?? []).map((company) => ({
            keywords: company,
          })),
          { keywords: excludedCompany, priority: 'DOESNT_HAVE' as const },
        ],
      }),
    };

    return carrierVariants(keywords, jobTitle).map((variant) => {
      const label = buildStrategyLabel(
        {
          ...query,
          keywords: variant.keywords ?? null,
          job_title: variant.title ?? null,
        },
        index,
      );

      const parameters: RecruiterPeopleSearchStrategyResult['parameters'] = {
        ...(variant.keywords ? { keywords: variant.keywords } : {}),
        ...(variant.title ? { role: [{ keywords: variant.title }] } : {}),
        ...fence,
      };

      return {
        id: `linkedin-query-recruiter-${index + 1}-${variant.kind}`,
        label: [variantLabel(variant), label].filter(Boolean).join(' · '),
        description: label,
        strategyText: label,
        originalUserQuery: requirement,
        clarificationQuestions: null,
        clarificationAnswers: null,
        parameters,
      };
    });
  });
}

export function mapLinkedinSearchQueriesToGeneratedParameters(
  querySet: SearchQuerySet,
  searchType: PeopleSearchType,
  requirement?: string,
): GeneratedSearchParameters {
  const generated: GeneratedSearchParameters = {};

  if (searchType === 'classic') {
    const strategies = deduplicateStrategies(
      buildClassicStrategies(querySet, requirement),
    ).slice(0, LINKEDIN_MAX_STRATEGIES_PER_QUERY);

    if (strategies.length > 0) {
      generated.classicPeopleSearchStrategies = strategies;
    }

    return generated;
  }

  if (searchType === 'sales_navigator') {
    const strategies = deduplicateStrategies(
      buildSalesNavigatorStrategies(querySet, requirement),
    ).slice(0, LINKEDIN_MAX_STRATEGIES_PER_QUERY);

    if (strategies.length > 0) {
      generated.salesNavigatorPeopleSearchStrategies = strategies;
    }

    return generated;
  }

  const strategies = deduplicateStrategies(
    buildRecruiterStrategies(querySet, requirement),
  ).slice(0, LINKEDIN_MAX_STRATEGIES_PER_QUERY);

  if (strategies.length > 0) {
    generated.recruiterPeopleSearchStrategies = strategies;
  }

  return generated;
}

