import { Injectable, Optional } from '@nestjs/common';

import { ProviderQueryCacheService } from 'src/engine/core-modules/cache-storage/services/provider-query-cache.service';

import { getToolCallCacheKey } from './utils/mcp-tool-call-cache-key.util';

const CACHE_TTL_MS = 30_000;
const MCP_DURABLE_TOOL_CACHE_PREFIX = 'mcp-durable-tool:v1';

// Read-only paid/web search tools that are safe to reuse across sessions
const DURABLE_SEARCH_TOOL_NAMES = new Set([
  'exa_web_search',
  'app_exa_web_search',
]);

@Injectable()
export class McpToolCallCacheService {
  private readonly cache = new Map<
    string,
    { result: string; timestamp: number }
  >();

  constructor(
    @Optional()
    private readonly providerQueryCache?: ProviderQueryCacheService,
  ) {}

  buildKey(name: string, args: Record<string, unknown>): string {
    return getToolCallCacheKey(name, args);
  }

  async getCachedToolResult(
    cacheKey: string,
    toolName?: string,
  ): Promise<string | null> {
    const cached = this.cache.get(cacheKey);

    if (cached) {
      const age = Date.now() - cached.timestamp;

      if (age <= CACHE_TTL_MS) {
        return cached.result;
      }

      this.cache.delete(cacheKey);
    }

    if (
      !toolName ||
      !DURABLE_SEARCH_TOOL_NAMES.has(toolName) ||
      !this.providerQueryCache
    ) {
      return null;
    }

    const fromRedis = await this.providerQueryCache.get<{ result: string }>(
      MCP_DURABLE_TOOL_CACHE_PREFIX,
      { cacheKey },
    );

    return fromRedis?.result ?? null;
  }

  async cacheToolResult(
    cacheKey: string,
    result: string,
    toolName?: string,
  ): Promise<void> {
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

    if (
      !toolName ||
      !DURABLE_SEARCH_TOOL_NAMES.has(toolName) ||
      !this.providerQueryCache
    ) {
      return;
    }

    await this.providerQueryCache.set(
      MCP_DURABLE_TOOL_CACHE_PREFIX,
      { cacheKey },
      { result },
    );
  }
}
