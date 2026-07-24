import type {
  SearchQuery,
  SearchQuerySet,
} from 'src/engine/core-modules/linkedin-query-generation/types/linkedin-query-generation.types';
import type {
  ClassicPeopleSearchStrategyResult,
  GeneratedSearchParameters,
  RecruiterPeopleSearchStrategyResult,
  SalesNavigatorPeopleSearchStrategyResult,
} from '../types/candidate-search-request.type';

type PeopleSearchType = 'classic' | 'sales_navigator' | 'recruiter';

type ParamShape = Record<string, unknown>;

function splitToArray(value: string | null | undefined): string[] {
  if (!value || typeof value !== 'string') {
    return [];
  }

  const parts = value
    .split(/\s+OR\s+|,|\|/i)
    .map((part) => part.trim())
    .filter(Boolean);

  return [...new Set(parts)];
}

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
  return querySet.search_query_set.map((query, index) => {
    const id = `linkedin-query-classic-${index + 1}`;
    const label = buildStrategyLabel(query, index);

    const normalizedLocation = normalizeStringArray(query.location);
    const normalizedCompany = normalizeStringArray(query.company);

    const parameters: ClassicPeopleSearchStrategyResult['parameters'] = {
      keywords: query.keywords ?? undefined,
      ...(normalizedLocation && { location: normalizedLocation }),
      ...(normalizedCompany && { company: normalizedCompany }),
      ...(query.job_title && {
        advanced_keywords: {
          first_name: undefined,
          last_name: undefined,
          title: query.job_title,
          company: undefined,
          school: undefined,
        },
      }),
    };

    return {
      id,
      label,
      description: label,
      strategyText: label,
      originalUserQuery: requirement,
      clarificationQuestions: null,
      clarificationAnswers: null,
      parameters,
    };
  });
}

function buildSalesNavigatorStrategies(
  querySet: SearchQuerySet,
  requirement?: string,
): SalesNavigatorPeopleSearchStrategyResult[] {
  return querySet.search_query_set.map((query, index) => {
    const id = `linkedin-query-sales-nav-${index + 1}`;
    const label = buildStrategyLabel(query, index);

    const normalizedLocation = normalizeStringArray(query.location);
    const normalizedCompany = normalizeStringArray(query.company);
    const roleInclude = splitToArray(query.job_title);

    const parameters: SalesNavigatorPeopleSearchStrategyResult['parameters'] = {
      keywords: query.keywords ?? undefined,
      ...(normalizedLocation && { location: { include: normalizedLocation } }),
      ...(normalizedCompany && { company: { include: normalizedCompany } }),
      ...(roleInclude.length > 0 && { role: { include: roleInclude } }),
    };

    return {
      id,
      label,
      description: label,
      strategyText: label,
      originalUserQuery: requirement,
      clarificationQuestions: null,
      clarificationAnswers: null,
      parameters,
    };
  });
}

function buildRecruiterStrategies(
  querySet: SearchQuerySet,
  requirement?: string,
): RecruiterPeopleSearchStrategyResult[] {
  return querySet.search_query_set.map((query, index) => {
    const id = `linkedin-query-recruiter-${index + 1}`;
    const label = buildStrategyLabel(query, index);

    const normalizedLocation = normalizeStringArray(query.location);
    const normalizedCompany = normalizeStringArray(query.company);

    const parameters: RecruiterPeopleSearchStrategyResult['parameters'] = {
      keywords: query.keywords ?? undefined,
      ...(query.job_title && {
        role: [{ keywords: query.job_title }],
      }),
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
    };

    return {
      id,
      label,
      description: label,
      strategyText: label,
      originalUserQuery: requirement,
      clarificationQuestions: null,
      clarificationAnswers: null,
      parameters,
    };
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
    );

    if (strategies.length > 0) {
      generated.classicPeopleSearchStrategies = strategies;
    }

    return generated;
  }

  if (searchType === 'sales_navigator') {
    const strategies = deduplicateStrategies(
      buildSalesNavigatorStrategies(querySet, requirement),
    );

    if (strategies.length > 0) {
      generated.salesNavigatorPeopleSearchStrategies = strategies;
    }

    return generated;
  }

  const strategies = deduplicateStrategies(
    buildRecruiterStrategies(querySet, requirement),
  );

  if (strategies.length > 0) {
    generated.recruiterPeopleSearchStrategies = strategies;
  }

  return generated;
}

