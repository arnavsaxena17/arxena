import {
  actionForSourceError,
  pageCostUsd,
} from 'src/domains/ingestion/candidate-sourcing/sources/adapter';
import {
  SOURCE_ALIASES,
  SOURCE_REGISTRY,
  isSourceCountReliable,
  pickSources,
  resolveSource,
} from 'src/domains/ingestion/candidate-sourcing/sources/registry';

describe('source registry', () => {
  it('should describe every alias under its own key', () => {
    for (const alias of SOURCE_ALIASES) {
      expect(SOURCE_REGISTRY[alias].alias).toBe(alias);
      expect(SOURCE_REGISTRY[alias].kinds.length).toBeGreaterThan(0);
    }
  });

  it('should never trust a classic LinkedIn count', () => {
    expect(isSourceCountReliable('linkedin', 'classic')).toBe(false);
    expect(isSourceCountReliable('linkedin', 'sales_navigator')).toBe(true);
    expect(isSourceCountReliable('linkedin_pool')).toBe(false);
    expect(isSourceCountReliable('harvest')).toBe(true);
    expect(isSourceCountReliable('serp')).toBe(false);
  });

  it('should resolve the other spellings of a source', () => {
    expect(resolveSource('internal-index')?.alias).toBe('index');
    expect(resolveSource('LINKEDIN_POOL')?.alias).toBe('linkedin_pool');
    expect(resolveSource('linkedin_xray')?.alias).toBe('xray');
    expect(resolveSource('bright-data')?.alias).toBe('bright_data');
  });

  it('should not resolve a name it does not know, or a renamed one', () => {
    expect(resolveSource('naukri')).toBeUndefined();
    expect(resolveSource('unipile')).toBeUndefined();
    expect(resolveSource('pool')).toBeUndefined();
  });

  it('should label a subset in the order asked for', () => {
    expect(pickSources(['harvest', 'linkedin'])).toEqual([
      { alias: 'harvest', label: 'Harvest' },
      { alias: 'linkedin', label: 'LinkedIn (your account)' },
    ]);
  });
});

describe('pageCostUsd', () => {
  it('should price a page from a per-row cost', () => {
    expect(pageCostUsd(SOURCE_REGISTRY.harvest.costModel, 25)).toBe(0.1);
  });

  it('should return null, not zero, for an unpriced source', () => {
    expect(pageCostUsd(SOURCE_REGISTRY.apollo.costModel, 25)).toBeNull();
    expect(pageCostUsd(SOURCE_REGISTRY.index.costModel, 25)).toBe(0);
  });
});

describe('actionForSourceError', () => {
  it('should wait out a Unipile rate limit and retry a SERP one', () => {
    expect(actionForSourceError('rate_limited', 'never')).toBe('defer');
    expect(actionForSourceError('rate_limited', 'backoff')).toBe('retry');
  });

  it('should not retry a paid source on its own', () => {
    expect(actionForSourceError('upstream', 'paid')).toBe('defer');
  });

  it('should stop on budget and drop an empty candidate', () => {
    expect(actionForSourceError('budget', 'free')).toBe('stop');
    expect(actionForSourceError('no_results', 'free')).toBe('drop');
  });
});
