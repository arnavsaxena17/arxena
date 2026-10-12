import {
  labelWebSearchEngine,
  resolveProviderConcurrency,
  resolveSonarSpillMs,
  resolveWebSearchProviderChain,
} from 'src/engine/core-modules/arx-web-search/utils/web-search-provider-chain.util';

describe('web search provider chain', () => {
  it('should default to perplexity, serp, then the paid openai tool', () => {
    expect(resolveWebSearchProviderChain({})).toEqual([
      'perplexity',
      'serp',
      'openai',
    ]);
  });

  it('should follow ARX_WEB_SEARCH_PROVIDERS, dropping unknown names and duplicates', () => {
    expect(
      resolveWebSearchProviderChain({
        ARX_WEB_SEARCH_PROVIDERS: ' SERP, bogus,perplexity ,serp',
      }),
    ).toEqual(['serp', 'perplexity']);
  });

  it('should still honour the older single-provider switch', () => {
    expect(
      resolveWebSearchProviderChain({ ARX_WEB_SEARCH_PROVIDER: 'openai' }),
    ).toEqual(['openai']);
    expect(
      resolveWebSearchProviderChain({ ARX_WEB_SEARCH_PROVIDER: 'perplexity' }),
    ).toEqual(['perplexity', 'serp', 'openai']);
  });

  it('should read per-provider concurrency and ignore bad values', () => {
    expect(resolveProviderConcurrency('serp', {})).toBe(24);
    expect(
      resolveProviderConcurrency('serp', {
        ARX_WEB_SEARCH_CONCURRENCY_SERP: '40',
      }),
    ).toBe(40);
    expect(
      resolveProviderConcurrency('openai', {
        ARX_WEB_SEARCH_CONCURRENCY_OPENAI: 'lots',
      }),
    ).toBe(8);
  });

  it('should never spill Sonar to the next provider unless asked to', () => {
    expect(resolveSonarSpillMs({})).toBe(0);
    expect(resolveSonarSpillMs({ ARX_WEB_SEARCH_SPILL_MS: '4000' })).toBe(4000);
  });

  it('should label a run by the providers that answered', () => {
    expect(labelWebSearchEngine({ perplexity: 3 })).toBe('perplexity-search');
    expect(labelWebSearchEngine({ serp: 2 })).toBe('bright-data-serp');
    expect(labelWebSearchEngine({ openai: 1 })).toBe('openai-web-search');
    expect(labelWebSearchEngine({ perplexity: 3, serp: 2 })).toBe(
      'mixed-web-search',
    );
    expect(labelWebSearchEngine({})).toBe('openai-web-search');
  });
});
