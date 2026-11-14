export type WebSearchProviderId = 'perplexity' | 'serp' | 'openai';

// Most accurate and cheapest first, the paid model-driven web search last
// (60-company eval: Perplexity Sonar 95.6% in 2-3s, Google SERP 74.2% in 28s).
export const DEFAULT_WEB_SEARCH_PROVIDER_CHAIN: WebSearchProviderId[] = [
  'perplexity',
  'serp',
  'openai',
];

const VALID_PROVIDERS = new Set<string>(DEFAULT_WEB_SEARCH_PROVIDER_CHAIN);

// Lookups in flight per provider, shared by every run in the process. Sonar is
// also paced by its own request-start interval, so more than a few in flight
// adds nothing there; SERP tolerated 24 workers without a single error.
const DEFAULT_PROVIDER_CONCURRENCY: Record<WebSearchProviderId, number> = {
  perplexity: 8,
  serp: 24,
  openai: 8,
};

const MAX_PROVIDER_CONCURRENCY = 100;

// ARX_WEB_SEARCH_PROVIDERS="perplexity,serp,openai" sets the order. The older
// ARX_WEB_SEARCH_PROVIDER switch still works: "openai" is the paid tool alone,
// "perplexity" is the full chain.
export const resolveWebSearchProviderChain = (
  env: NodeJS.ProcessEnv = process.env,
): WebSearchProviderId[] => {
  const configured = (env.ARX_WEB_SEARCH_PROVIDERS ?? '')
    .split(',')
    .map((provider) => provider.trim().toLowerCase())
    .filter((provider): provider is WebSearchProviderId =>
      VALID_PROVIDERS.has(provider),
    );

  if (configured.length > 0) {
    return [...new Set(configured)];
  }

  if (env.ARX_WEB_SEARCH_PROVIDER?.trim().toLowerCase() === 'openai') {
    return ['openai'];
  }

  return [...DEFAULT_WEB_SEARCH_PROVIDER_CHAIN];
};

export const resolveProviderConcurrency = (
  provider: WebSearchProviderId,
  env: NodeJS.ProcessEnv = process.env,
): number => {
  const configured = Number(
    env[`ARX_WEB_SEARCH_CONCURRENCY_${provider.toUpperCase()}`],
  );

  return Number.isFinite(configured) && configured >= 1
    ? Math.min(Math.floor(configured), MAX_PROVIDER_CONCURRENCY)
    : DEFAULT_PROVIDER_CONCURRENCY[provider];
};

// When the Sonar pacing queue is longer than this many ms, a lookup skips to
// the next provider instead of waiting. 0 (default) never skips: accuracy over
// speed until the SERP fallback has been checked on the column in question.
export const resolveSonarSpillMs = (
  env: NodeJS.ProcessEnv = process.env,
): number => {
  const configured = Number(env.ARX_WEB_SEARCH_SPILL_MS);

  return Number.isFinite(configured) && configured > 0 ? configured : 0;
};

// The usage label of a column run, from the lookups each provider answered.
export const labelWebSearchEngine = (
  providers: Partial<Record<WebSearchProviderId, number>>,
):
  | 'perplexity-search'
  | 'bright-data-serp'
  | 'openai-web-search'
  | 'mixed-web-search' => {
  const used = (Object.keys(providers) as WebSearchProviderId[]).filter(
    (provider) => (providers[provider] ?? 0) > 0,
  );

  if (used.length > 1) {
    return 'mixed-web-search';
  }

  if (used[0] === 'perplexity') {
    return 'perplexity-search';
  }

  return used[0] === 'serp' ? 'bright-data-serp' : 'openai-web-search';
};
