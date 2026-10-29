import {
  companyMatchConfidence,
  companyNameDistance,
} from 'src/engine/core-modules/org-chart/utils/company-match-confidence.util';
import {
  pickBestCompanyNameHit,
  rankCompanyNameHits,
} from 'src/engine/core-modules/org-chart/utils/pick-best-company-name-hit.util';

describe('rankCompanyNameHits', () => {
  const hits = [
    { _source: { name: 'Torrent Power Limited', count_org: 10, id: 'far' } },
    { _source: { name: 'Torrent Power', count_org: 20, id: 'tied-small' } },
    { _source: {} },
    { _source: { name: 'Torrent Power', count_org: 50, id: 'best' } },
    { _source: { name: 'Torrent Pharma', count_org: 90, id: 'other' } },
  ];

  it('should rank by edit distance then count_org and drop unnamed hits', () => {
    const ranked = rankCompanyNameHits('TORRENT POWER', hits);

    expect(ranked.map((hit) => hit.source.id)).toEqual([
      'best',
      'tied-small',
      'other',
      'far',
    ]);
    expect(ranked[0].editDistance).toBe(0);
  });

  it('should return at most the requested number of hits', () => {
    expect(rankCompanyNameHits('TORRENT POWER', hits, 2)).toHaveLength(2);
  });

  it('should keep the first hit among equal ones, as the best-hit pick does', () => {
    const equalHits = [
      { _source: { name: 'Acme', count_org: 5, id: 'first' } },
      { _source: { name: 'Acme', count_org: 5, id: 'second' } },
    ];

    expect(rankCompanyNameHits('ACME', equalHits)[0].source.id).toBe('first');
    expect(pickBestCompanyNameHit('ACME', equalHits)?.source.id).toBe('first');
  });

  it('should return an empty list when no hit has a name', () => {
    expect(rankCompanyNameHits('ACME', [{ _source: {} }])).toEqual([]);
  });
});

describe('companyNameDistance', () => {
  it('should ignore corporate suffixes on the hit name', () => {
    expect(
      companyNameDistance('TORRENT POWER', 'Torrent Power Limited', 8),
    ).toBe(0);
  });
});

describe('companyMatchConfidence', () => {
  const base = {
    cleanedQuery: 'TORRENT POWER',
    corporateScore: null,
    runnerUpNameDistance: null,
  };

  it('should be high when the name matches within one edit and no other company is as close', () => {
    expect(companyMatchConfidence({ ...base, nameDistance: 0 })).toBe('high');
    expect(
      companyMatchConfidence({
        ...base,
        nameDistance: 1,
        corporateScore: 0.8,
        runnerUpNameDistance: 4,
      }),
    ).toBe('high');
  });

  it('should be medium when another company has the same name distance', () => {
    expect(
      companyMatchConfidence({
        ...base,
        nameDistance: 0,
        runnerUpNameDistance: 0,
      }),
    ).toBe('medium');
  });

  it('should be medium when the corporate score is zero or below', () => {
    expect(
      companyMatchConfidence({ ...base, nameDistance: 0, corporateScore: 0 }),
    ).toBe('medium');
  });

  it('should be medium within three edits or a quarter of the query length', () => {
    expect(companyMatchConfidence({ ...base, nameDistance: 3 })).toBe('medium');
    expect(
      companyMatchConfidence({
        ...base,
        cleanedQuery: 'INTERNATIONAL BUSINESS MACHINES',
        nameDistance: 7,
      }),
    ).toBe('medium');
  });

  it('should be low beyond the medium thresholds', () => {
    expect(companyMatchConfidence({ ...base, nameDistance: 4 })).toBe('low');
  });
});
