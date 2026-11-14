import { type OrgchartStrategyResult } from 'src/domains/org-graph/org-chart/build/types/orgchart-linkedin-search.types';
import {
  dedupeAndReturnCandidates,
  dedupeOrgchartCandidates,
} from 'src/domains/org-graph/org-chart/build/services/orgchart-linkedin-candidates.util';

const strategyResult = (
  transformedCandidates: unknown[],
): OrgchartStrategyResult => ({
  strategy: { id: 's1' } as OrgchartStrategyResult['strategy'],
  result: {
    itemCount: transformedCandidates.length,
    searchResults: null,
    transformedCandidates,
  },
});

describe('dedupeOrgchartCandidates', () => {
  it('should keep one row per profile url, whatever the field is called', () => {
    const candidates = [
      { id: 'a', linkedinUrl: 'https://linkedin.com/in/jane' },
      { id: 'b', linkedin_url: 'https://LinkedIn.com/in/jane' },
      { id: 'c', linkedinUrl: 'https://linkedin.com/in/john' },
    ];

    expect(dedupeOrgchartCandidates(candidates)).toEqual([
      candidates[0],
      candidates[2],
    ]);
  });

  it('should fall back to the row id when there is no profile url', () => {
    const candidates = [{ id: 'same' }, { id: 'same' }, { id: 'other' }];

    expect(dedupeOrgchartCandidates(candidates)).toEqual([
      { id: 'same' },
      { id: 'other' },
    ]);
  });

  it('should drop a row that carries no identifier at all', () => {
    const candidates = [{ headline: 'no id' }, { id: 'kept' }];

    expect(dedupeOrgchartCandidates(candidates)).toEqual([{ id: 'kept' }]);
  });
});

describe('dedupeAndReturnCandidates', () => {
  it('should keep every row of every strategy when the request has no scope filter', () => {
    const first = { id: '1' };
    const second = { id: '2' };

    expect(
      dedupeAndReturnCandidates({
        strategyResults: [strategyResult([first]), strategyResult([second])],
        hasSubsetScopeFilters: false,
        businessDivisionRequested: false,
        country: '',
        functionRoot: '',
      }),
    ).toEqual([first, second]);
  });

  it('should keep the requested country and drop the rest when the request is scoped', () => {
    const inIndia = {
      id: 'in',
      linkedinUrl: 'https://linkedin.com/in/a',
      country: 'India',
    };
    const inGermany = {
      id: 'de',
      linkedinUrl: 'https://linkedin.com/in/b',
      country: 'Germany',
    };

    expect(
      dedupeAndReturnCandidates({
        strategyResults: [strategyResult([inIndia, inGermany])],
        hasSubsetScopeFilters: true,
        businessDivisionRequested: false,
        country: 'India',
        functionRoot: '',
      }),
    ).toEqual([inIndia]);
  });

  it('should filter a business-division request even without a scope filter on it', () => {
    const inIndia = {
      id: 'in',
      linkedinUrl: 'https://linkedin.com/in/a',
      country: 'India',
    };
    const inGermany = {
      id: 'de',
      linkedinUrl: 'https://linkedin.com/in/b',
      country: 'Germany',
    };

    expect(
      dedupeAndReturnCandidates({
        strategyResults: [strategyResult([inIndia, inGermany])],
        hasSubsetScopeFilters: false,
        businessDivisionRequested: true,
        country: 'India',
        functionRoot: '',
      }),
    ).toEqual([inIndia]);
  });

  it('should dedupe a person found by two strategies before filtering', () => {
    const fromFirst = {
      id: 'a',
      linkedinUrl: 'https://linkedin.com/in/jane',
      country: 'India',
    };
    const fromSecond = {
      id: 'b',
      linkedinUrl: 'https://linkedin.com/in/jane',
      country: 'India',
    };

    expect(
      dedupeAndReturnCandidates({
        strategyResults: [
          strategyResult([fromFirst]),
          strategyResult([fromSecond]),
        ],
        hasSubsetScopeFilters: false,
        businessDivisionRequested: false,
        country: '',
        functionRoot: '',
      }),
    ).toEqual([fromFirst]);
  });

  it('should ignore a strategy that returned no rows', () => {
    const only = { id: '1' };

    expect(
      dedupeAndReturnCandidates({
        strategyResults: [
          {
            strategy: { id: 's1' } as OrgchartStrategyResult['strategy'],
            result: null,
          },
          strategyResult([only]),
        ],
        hasSubsetScopeFilters: false,
        businessDivisionRequested: false,
        country: '',
        functionRoot: '',
      }),
    ).toEqual([only]);
  });
});
