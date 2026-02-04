import type { LinkedInSearchQuery, QueryConstructorResult } from '../schemas/query-constructor.schema';
import type { ClassicPeopleSearchStrategyResult, GeneratedSearchParameters, RecruiterPeopleSearchStrategyResult, SalesNavigatorPeopleSearchStrategyResult } from '../types/candidate-search-request.type';

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
 * Map Query Constructor (Agent 4) output to GeneratedSearchParameters for a given search type.
 */
export function mapQueryConstructorToUnresolved(
  agent4Output: QueryConstructorResult,
  searchType: 'classic' | 'sales_navigator' | 'recruiter',
): GeneratedSearchParameters {
  const searches = agent4Output.linkedin_searches ?? [];
  const generated: GeneratedSearchParameters = {};

  if (searchType === 'classic') {
    const strategies: ClassicPeopleSearchStrategyResult[] = searches.map(
      (q, i) => ({
        id: buildStrategyId(i, q.query_id),
        label: q.query_name,
        description: q.reasoning ?? q.query_name,
        strategyText: q.reasoning ?? '',
        parameters: mapToClassicParams(q, i) as ClassicPeopleSearchStrategyResult['parameters'],
      }),
    );
    if (strategies.length > 0) {
      generated.classicPeopleSearchStrategies = strategies;
    }
  } else if (searchType === 'sales_navigator') {
    const strategies: SalesNavigatorPeopleSearchStrategyResult[] = searches.map(
      (q, i) => ({
        id: buildStrategyId(i, q.query_id),
        label: q.query_name,
        description: q.reasoning ?? q.query_name,
        strategyText: q.reasoning ?? '',
        parameters: mapToSalesNavigatorParams(q) as SalesNavigatorPeopleSearchStrategyResult['parameters'],
      }),
    );
    if (strategies.length > 0) {
      generated.salesNavigatorPeopleSearchStrategies = strategies;
    }
  } else {
    const strategies: RecruiterPeopleSearchStrategyResult[] = searches.map(
      (q, i) => ({
        id: buildStrategyId(i, q.query_id),
        label: q.query_name,
        description: q.reasoning ?? q.query_name,
        strategyText: q.reasoning ?? '',
        parameters: mapToRecruiterParams(q) as RecruiterPeopleSearchStrategyResult['parameters'],
      }),
    );
    if (strategies.length > 0) {
      generated.recruiterPeopleSearchStrategies = strategies;
    }
  }

  return generated;
}
