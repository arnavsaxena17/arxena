import {
  cleanCompanyNames,
  cleanCompanyNameForCollectorQuery,
  cleanRawCompanyName,
} from 'src/engine/core-modules/org-chart/utils/clean-raw-company-name.util';
import { buildResolveCompanyFromRawNameQuery } from 'src/engine/core-modules/org-chart/utils/build-resolve-company-from-raw-name-query.util';
import { levenshteinDistance } from 'src/engine/core-modules/org-chart/utils/levenshtein-distance.util';
import { pickBestCompanyNameHit } from 'src/engine/core-modules/org-chart/utils/pick-best-company-name-hit.util';

describe('cleanCompanyNames', () => {
  it('strips corporate suffixes, geo tokens, and normalizes', () => {
    expect(cleanCompanyNames('Nestle India Ltd')).toBe('nestle');
    expect(cleanCompanyNames('Zydus Lifesciences Ltd.')).toBe(
      'zydus lifesciences',
    );
  });

  it('removes ampersands and merges single-letter tokens', () => {
    expect(cleanCompanyNames('Larsen & Toubro (L&T)')).toBe('larsen toubro lt');
  });
});

describe('cleanRawCompanyName', () => {
  it('applies DataCleaning then CompanyCollector uppercase', () => {
    expect(cleanRawCompanyName('Nestle India Ltd')).toBe('NESTLE');
    expect(cleanRawCompanyName('Zydus Lifesciences Ltd.')).toBe(
      'ZYDUS LIFESCIENCES',
    );
    expect(cleanRawCompanyName('Larsen & Toubro (L&T)')).toBe(
      'LARSEN TOUBRO LT',
    );
  });

  it('passes through collector cleaning when already data-cleaned', () => {
    expect(cleanCompanyNameForCollectorQuery('torrent power')).toBe(
      'TORRENT POWER',
    );
  });
});

describe('levenshteinDistance', () => {
  it('returns 0 for identical strings', () => {
    expect(levenshteinDistance('acme', 'acme')).toBe(0);
  });

  it('counts substitutions', () => {
    expect(levenshteinDistance('kitten', 'sitting')).toBe(3);
  });
});

describe('buildResolveCompanyFromRawNameQuery', () => {
  it('requires linkedin_url and count_org and uses synonym analyzers', () => {
    const query = buildResolveCompanyFromRawNameQuery('TORRENT POWER') as {
      bool: {
        must: Array<Record<string, unknown>>;
      };
    };

    expect(query.bool.must[0]).toEqual({
      exists: { field: 'linkedin_url' },
    });
    expect(query.bool.must[1]).toEqual({
      exists: { field: 'count_org' },
    });

    const nestedBool = query.bool.must[2] as {
      bool: { should: Array<Record<string, unknown>> };
    };

    expect(nestedBool.bool.should[0]).toMatchObject({
      match_phrase: {
        name: {
          query: 'TORRENT POWER',
          analyzer: 'synonym',
        },
      },
    });
  });
});

describe('pickBestCompanyNameHit', () => {
  it('picks closest name then highest count_org on ties', () => {
    const picked = pickBestCompanyNameHit('TORRENT POWER', [
      {
        _source: {
          name: 'Torrent Power Limited',
          count_org: 10,
          id: 'small',
        },
      },
      {
        _source: {
          name: 'Torrent Power',
          count_org: 50,
          id: 'best',
        },
      },
      {
        _source: {
          name: 'Torrent Power',
          count_org: 20,
          id: 'worse',
        },
      },
    ]);

    expect(picked?.source.id).toBe('best');
    expect(picked?.editDistance).toBe(0);
  });

  it('returns null when no named hits', () => {
    expect(pickBestCompanyNameHit('ACME', [{ _source: {} }])).toBeNull();
  });
});
