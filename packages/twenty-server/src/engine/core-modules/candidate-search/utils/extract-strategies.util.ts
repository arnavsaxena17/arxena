import type {
    ClassicPeopleSearchStrategyResult,
    GeneratedSearchParameters,
    RecruiterPeopleSearchStrategyResult,
    SalesNavigatorPeopleSearchStrategyResult,
} from '../types/candidate-search-request.type';

export type PeopleSearchStrategyResult =
  | ClassicPeopleSearchStrategyResult
  | SalesNavigatorPeopleSearchStrategyResult
  | RecruiterPeopleSearchStrategyResult;

const STRATEGY_KEYS = {
  classic: 'classicPeopleSearchStrategies',
  sales_navigator: 'salesNavigatorPeopleSearchStrategies',
  recruiter: 'recruiterPeopleSearchStrategies',
} as const;

export function extractStrategiesFromGeneratedParams(
  searchParams: GeneratedSearchParameters,
  searchType: 'classic' | 'sales_navigator' | 'recruiter',
  searchCategory: 'people' | 'companies' | 'posts' | 'jobs',
): PeopleSearchStrategyResult[] {
  if (searchCategory !== 'people') {
    return [];
  }
  const key = STRATEGY_KEYS[searchType];
  const strategies = (searchParams[key] as PeopleSearchStrategyResult[] | undefined) ?? [];
  return strategies;
}

const PRIMARY_PARAM_KEYS = {
  classic: 'classicPeopleSearch',
  sales_navigator: 'salesNavigatorPeopleSearch',
  recruiter: 'recruiterPeopleSearch',
} as const;

/**
 * Inverse of extractStrategiesFromGeneratedParams: build GeneratedSearchParameters
 * from strategy rows (e.g. org-chart simple / business-division / routed generators).
 */
export function attachPeopleStrategiesToGeneratedSearchParameters(
  strategies: PeopleSearchStrategyResult[],
  searchType: 'classic' | 'sales_navigator' | 'recruiter',
): GeneratedSearchParameters {
  if (strategies.length === 0) {
    return {};
  }
  const first = strategies[0];
  const strategyKey = STRATEGY_KEYS[searchType];
  const primaryKey = PRIMARY_PARAM_KEYS[searchType];
  return {
    [primaryKey]: first.parameters,
    [strategyKey]: strategies,
  } as GeneratedSearchParameters;
}
