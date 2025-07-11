import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { InjectCacheStorage } from 'src/engine/core-modules/cache-storage/decorators/cache-storage.decorator';
import { CacheStorageService } from 'src/engine/core-modules/cache-storage/services/cache-storage.service';
import { CacheStorageNamespace } from 'src/engine/core-modules/cache-storage/types/cache-storage-namespace.enum';

export enum CacheStrategy {
  DEFAULT = 'DEFAULT',      // Default caching (5 min TTL)
  REAL_TIME = 'REAL_TIME', // No caching, always fresh
  LONG_TERM = 'LONG_TERM'  // Longer cache (1 hour TTL)
}

@Injectable()
export class QueryCacheService {
  private readonly REAL_TIME_PATTERNS = [
    /real_?time/i,           // Matches realTime or real_time
    /live/i,                 // Matches live queries
    /notification/i,         // Matches notification queries
    /status/i,              // Matches status checks
    /progress/i,            // Matches progress updates
    /stream/i               // Matches streaming data
  ];

  private readonly DEFAULT_TTL = 300; // 5 minutes
  private readonly LONG_TERM_TTL = 3600; // 1 hour

  constructor(
    @InjectCacheStorage(CacheStorageNamespace.EngineWorkspace)
    private readonly cacheStorage: CacheStorageService,
  ) {}

  private generateCacheKey(query: string, variables: any, workspaceId: string): string {
    const queryHash = createHash('sha256')
      .update(query + JSON.stringify(variables) + workspaceId)
      .digest('hex');
    
    return `graphql:query:${queryHash}`;
  }

  private detectCacheStrategy(query: string): CacheStrategy {
    // Check for directive based cache control
    if (query.includes('@realTime') || query.includes('@skipCache')) {
      return CacheStrategy.REAL_TIME;
    }

    if (query.includes('@longTerm')) {
      return CacheStrategy.LONG_TERM;
    }

    // Check for real-time patterns in the query
    const isRealTimeQuery = this.REAL_TIME_PATTERNS.some(pattern => 
      pattern.test(query)
    );

    if (isRealTimeQuery) {
      return CacheStrategy.REAL_TIME;
    }

    return CacheStrategy.DEFAULT;
  }

  private getTTL(strategy: CacheStrategy): number {
    switch (strategy) {
      case CacheStrategy.REAL_TIME:
        return 0; // No caching
      case CacheStrategy.LONG_TERM:
        return this.LONG_TERM_TTL;
      case CacheStrategy.DEFAULT:
      default:
        return this.DEFAULT_TTL;
    }
  }

  async getCachedResult(query: string, variables: any, workspaceId: string): Promise<any | null> {
    const strategy = this.detectCacheStrategy(query);
    
    // Skip cache for real-time queries
    if (strategy === CacheStrategy.REAL_TIME) {
      return null;
    }

    const cacheKey = this.generateCacheKey(query, variables, workspaceId);
    return this.cacheStorage.get(cacheKey);
  }

  async setCachedResult(
    query: string,
    variables: any,
    workspaceId: string,
    result: any,
    forceTTL?: number,
  ): Promise<void> {
    const strategy = this.detectCacheStrategy(query);
    
    // Don't cache real-time queries
    if (strategy === CacheStrategy.REAL_TIME) {
      return;
    }

    const cacheKey = this.generateCacheKey(query, variables, workspaceId);
    const ttl = forceTTL ?? this.getTTL(strategy);
    
    await this.cacheStorage.set(cacheKey, result, ttl);
  }

  async invalidateCache(query: string, variables: any, workspaceId: string): Promise<void> {
    const cacheKey = this.generateCacheKey(query, variables, workspaceId);
    await this.cacheStorage.del(cacheKey);
  }

  async invalidateByPattern(pattern: string): Promise<void> {
    // This assumes your Redis implementation supports pattern-based deletion
    const key = `graphql:query:*${pattern}*`;
    await this.cacheStorage.del(key);
  }
} 