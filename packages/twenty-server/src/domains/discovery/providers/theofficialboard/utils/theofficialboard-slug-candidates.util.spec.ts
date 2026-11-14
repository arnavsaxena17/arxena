import {
  firstSegmentSlugCandidate,
  generateTheOfficialBoardSlugCandidates,
  normalizeTheOfficialBoardSlugInput,
  stripTrailingCorporateSlugSegments,
} from './theofficialboard-slug-candidates.util';

describe('theofficialboard-slug-candidates.util', () => {
  it('normalizes company names into slugs', () => {
    expect(normalizeTheOfficialBoardSlugInput('State Grid Corporation of China')).toBe(
      'state-grid-corporation-of-china',
    );
  });

  it('strips trailing legal suffixes', () => {
    expect(stripTrailingCorporateSlugSegments('acme-holdings-ltd')).toBe('acme');
  });

  it('builds first segment fallback', () => {
    expect(firstSegmentSlugCandidate('walmart-inc')).toBe('walmart');
  });

  it('builds ordered deduped candidates', () => {
    expect(generateTheOfficialBoardSlugCandidates('amazon-inc')).toEqual([
      'amazon-inc',
      'amazon',
    ]);
  });
});
