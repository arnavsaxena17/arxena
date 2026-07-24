import type { LinkedInSearchQuery, QueryConstructorResult } from '../schemas/query-constructor.schema';
import type { ClassicPeopleSearchStrategyResult, GeneratedSearchParameters, RecruiterPeopleSearchStrategyResult, SalesNavigatorPeopleSearchStrategyResult } from '../types/candidate-search-request.type';

/**
 * Normalize a Boolean/comma-separated string for deduplication: split, lowercase, trim, sort, join.
 * Ensures "A OR B" and "B OR A" produce the same signature.
 */
function normalizeForDedup(value: string | null | undefined): string {
  if (!value || typeof value !== 'string') return '';
  const parts = value
    .split(/\s+OR\s+|,|\|/i)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set(parts)].sort().join('|');
}

type ParamShape = Record<string, unknown>;

function extractStringArray(arr: unknown): string[] {
  if (!arr) return [];
  if (Array.isArray(arr)) {
    return arr.map((item) => {
      if (typeof item === 'string') return item.toLowerCase().trim();
      if (item && typeof item === 'object' && 'keywords' in item) return String((item as { keywords: unknown }).keywords).toLowerCase().trim();
      if (item && typeof item === 'object' && 'id' in item) return String((item as { id: unknown }).id).toLowerCase().trim();
      return String(item).toLowerCase().trim();
    }).filter(Boolean).sort();
  }
  if (arr && typeof arr === 'object' && 'include' in arr && Array.isArray((arr as { include: unknown[] }).include)) {
    return (arr as { include: string[] }).include.map((l) => String(l).toLowerCase().trim()).filter(Boolean).sort();
  }
  return [];
}

function extractRoleOrTitle(params: ParamShape): string {
  const adv = params.advanced_keywords as { title?: string } | undefined;
  if (adv?.title) return normalizeForDedup(adv.title);
  const role = params.role as { include?: string[] } | Array<{ keywords?: string }> | undefined;
  if (role && typeof role === 'object') {
    if (Array.isArray(role) && role[0] && 'keywords' in role[0]) {
      return normalizeForDedup((role[0] as { keywords: string }).keywords);
    }
    if ('include' in role && Array.isArray(role.include)) {
      return role.include.map((s) => s.trim().toLowerCase()).sort().join('|');
    }
  }
  return '';
}

/**
 * Build a deduplication signature from parameters to detect redundant strategies.
 * Handles Classic, Sales Navigator, and Recruiter param shapes.
 */
function buildParamSignature(params: ParamShape): string {
  const kw = normalizeForDedup((params.keywords as string) ?? '');
  const loc = extractStringArray(params.location).join('|');
  const co = extractStringArray(params.company).join('|');
  const title = extractRoleOrTitle(params);
  return [kw, loc, co, title].filter(Boolean).join('::');
}

/**
 * Filter out redundant strategies: keep first of each group with identical signatures.
 */
function deduplicateStrategies<T extends { parameters: Record<string, unknown> }>(
  strategies: T[],
): T[] {
  const seen = new Set<string>();
  return strategies.filter((s) => {
    const sig = buildParamSignature(s.parameters as ParamShape);
    if (sig && seen.has(sig)) return false;
    if (sig) seen.add(sig);
    return true;
  });
}

/**
 * Split a Boolean or comma-separated string into an array of non-empty trimmed strings.
 * Handles " OR ", ",", and plain space separation.
 */
function splitToArray(value: string | null | undefined): string[] {
  if (!value || typeof value !== 'string') return [];
  const parts = value
    .split(/\s+OR\s+|,|\|/i)
    .map((s) => s.trim())
    .filter(Boolean);
  return [...new Set(parts)];
}

/**
 * Map a single Agent 4 linkedin_boolean_search to Classic people search parameters.
 * Direct mapping: job_title → advanced_keywords.title, keywords → keywords, location → location.
 * No combining of job title and keywords.
 */
function mapToClassicParams(
  query: LinkedInSearchQuery,
  _index: number,
): Omit<ClassicPeopleSearchStrategyResult['parameters'], never> & Record<string, unknown> {
  const bs = query.linkedin_boolean_search;
  const locationArr = splitToArray(bs.location ?? '');
  const companyArr = splitToArray(bs.company ?? '');
  const keywords = (bs.keywords ?? '').trim() || undefined;
  const title = (bs.job_title ?? '').trim() || undefined;
  return {
    keywords,
    location: locationArr.length > 0 ? locationArr : undefined,
    company: companyArr.length > 0 ? companyArr : undefined,
    ...(title && {
      advanced_keywords: {
        first_name: undefined,
        last_name: undefined,
        title,
        company: undefined,
        school: undefined,
      },
    }),
  };
}

/**
 * Map a single Agent 4 linkedin_boolean_search to Sales Navigator people search parameters.
 * Direct mapping: job_title → role.include, keywords → keywords, location → location.
 * No combining of job title and keywords.
 */
function mapToSalesNavigatorParams(
  query: LinkedInSearchQuery,
): Omit<SalesNavigatorPeopleSearchStrategyResult['parameters'], never> & Record<string, unknown> {
  const bs = query.linkedin_boolean_search;
  const keywords = (bs.keywords ?? '').trim() || undefined;
  const roleInclude = splitToArray(bs.job_title ?? '');
  const locationArr = splitToArray(bs.location ?? '');
  const companyArr = splitToArray(bs.company ?? '');
  return {
    keywords,
    location: locationArr.length > 0 ? { include: locationArr } : undefined,
    company: companyArr.length > 0 ? { include: companyArr } : undefined,
    ...(roleInclude.length > 0 && { role: { include: roleInclude } }),
  };
}

/**
 * Map a single Agent 4 linkedin_boolean_search to Recruiter people search parameters.
 * Direct mapping: job_title → role (keywords form), keywords → keywords, location → location.
 * No combining of job title and keywords.
 */
function mapToRecruiterParams(
  query: LinkedInSearchQuery,
): Omit<RecruiterPeopleSearchStrategyResult['parameters'], never> & Record<string, unknown> {
  const bs = query.linkedin_boolean_search;
  const keywords = (bs.keywords ?? '').trim() || undefined;
  const jobTitle = (bs.job_title ?? '').trim();
  const locationArr = splitToArray(bs.location ?? '');
  const companyArr = splitToArray(bs.company ?? '');
  const role = jobTitle ? [{ keywords: jobTitle }] : undefined;
  return {
    keywords,
    role,
    location:
      locationArr.length > 0
        ? locationArr.map((loc) => ({
            id: loc,
            priority: 'MUST_HAVE' as const,
            scope: 'CURRENT' as const,
          }))
        : undefined,
    company:
      companyArr.length > 0
        ? companyArr.map((name) => ({ keywords: name }))
        : undefined,
  };
}

function buildStrategyId(index: number, queryId: number): string {
  return `multi-agent-${index}-${queryId}`;
}

/**
 * Build a short label/description from a LinkedIn search query (schema only has query_id and linkedin_boolean_search).
 */
function buildStrategyLabel(query: LinkedInSearchQuery): string {
  const bs = query.linkedin_boolean_search;
  const parts: string[] = [];
  if (bs.keywords?.trim()) parts.push(bs.keywords.trim());
  if (bs.job_title?.trim()) parts.push(bs.job_title.trim());
  if (bs.location?.trim()) parts.push(bs.location.trim());
  if (bs.company?.trim()) parts.push(bs.company.trim());
  if (parts.length > 0) return parts.join(' · ').slice(0, 120);
  return `Query ${query.query_id}`;
}

/**
 * Map Query Constructor (Agent 4) output to GeneratedSearchParameters for a given search type.
 */
export function mapQueryConstructorToUnresolved(
  agent4Output: QueryConstructorResult,
  searchType: 'classic' | 'sales_navigator' | 'recruiter',
): GeneratedSearchParameters {
  const searches = agent4Output.linkedin_searches ?? [];
  const generated: GeneratedSearchParameters = {};

  if (searchType === 'classic') {
    const strategies: ClassicPeopleSearchStrategyResult[] = deduplicateStrategies(
      searches.map((q, i) => {
        const label = 'To be created by the LLM';
        return {
          id: buildStrategyId(i, q.query_id),
          label,
          description: 'To be created by the LLM',
          strategyText: 'To be created by the LLM',
          parameters: mapToClassicParams(q, i) as ClassicPeopleSearchStrategyResult['parameters'],
        };
      }),
    );
    if (strategies.length > 0) {
      generated.classicPeopleSearchStrategies = strategies;
    }
  } else if (searchType === 'sales_navigator') {
    const strategies: SalesNavigatorPeopleSearchStrategyResult[] = deduplicateStrategies(
      searches.map((q, i) => {
        const label = buildStrategyLabel(q);
        return {
          id: buildStrategyId(i, q.query_id),
          label,
          description: label,
          strategyText: label,
          parameters: mapToSalesNavigatorParams(q) as SalesNavigatorPeopleSearchStrategyResult['parameters'],
        };
      }),
    );
    if (strategies.length > 0) {
      generated.salesNavigatorPeopleSearchStrategies = strategies;
    }
  } else {
    const strategies: RecruiterPeopleSearchStrategyResult[] = deduplicateStrategies(
      searches.map((q, i) => {
        const label = buildStrategyLabel(q);
        return {
          id: buildStrategyId(i, q.query_id),
          label,
          description: label,
          strategyText: label,
          parameters: mapToRecruiterParams(q) as RecruiterPeopleSearchStrategyResult['parameters'],
        };
      }),
    );
    if (strategies.length > 0) {
      generated.recruiterPeopleSearchStrategies = strategies;
    }
  }

  return generated;
}
