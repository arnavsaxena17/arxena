import { Injectable } from '@nestjs/common';
import { getToolCallCacheKey } from './utils/mcp-tool-call-cache-key.util';

const CACHE_TTL_MS = 30_000;

@Injectable()
export class McpToolCallCacheService {
  private readonly cache = new Map<
    string,
    { result: string; timestamp: number }
  >();

  buildKey(name: string, args: Record<string, unknown>): string {
    return getToolCallCacheKey(name, args);
  }

  getCachedToolResult(cacheKey: string): string | null {
    const cached = this.cache.get(cacheKey);
    if (!cached) {
      return null;
    }
    const age = Date.now() - cached.timestamp;
    if (age > CACHE_TTL_MS) {
      this.cache.delete(cacheKey);
      return null;
    }
    return cached.result;
  }

  cacheToolResult(cacheKey: string, result: string): void {
    this.cache.set(cacheKey, {
      result,
      timestamp: Date.now(),
    });
    if (this.cache.size > 100) {
      const now = Date.now();
      for (const [key, value] of this.cache.entries()) {
        if (now - value.timestamp > CACHE_TTL_MS) {
          this.cache.delete(key);
        }
      }
    }
  }
}
