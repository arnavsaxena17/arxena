// redis_hit / s3_hit / coalesced: answered without reaching the provider.
// fetched: the provider was called and the answer cached. uncached: the
// provider was called by a path that never caches (AI overview zone, page
// scrapes). error: the provider call threw.
export type ProviderCallCacheStatus =
  | 'redis_hit'
  | 's3_hit'
  | 'coalesced'
  | 'fetched'
  | 'uncached'
  | 'error';
