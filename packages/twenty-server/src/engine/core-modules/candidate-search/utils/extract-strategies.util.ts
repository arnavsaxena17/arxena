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
