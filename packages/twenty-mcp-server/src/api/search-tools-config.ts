import {
  ALL_SEARCH_TOOLS_ENABLED,
  type SearchToolsConfig,
} from 'twenty-shared/outreach';

import { callRestAPIGet } from './rest-client';

const CACHE_TTL_MS = 60_000;

let cachedConfig: { value: SearchToolsConfig; fetchedAt: number } | undefined;

// The provider flags live in the server env, so the server is the source of truth.
// On fetch failure we reuse the last known flags, else leave every provider enabled
// (the server default) rather than blocking the MCP surface.
export const getSearchToolsConfig = async (
  baseUrl: string,
  apiToken: string,
): Promise<SearchToolsConfig> => {
  const now = Date.now();

  if (cachedConfig && now - cachedConfig.fetchedAt < CACHE_TTL_MS) {
    return cachedConfig.value;
  }

  try {
    const fetched = (await callRestAPIGet(
      baseUrl,
      apiToken,
      'arxena-tools',
      'search-tools-config',
    )) as Partial<SearchToolsConfig>;

    const value: SearchToolsConfig = { ...ALL_SEARCH_TOOLS_ENABLED };

    for (const key of Object.keys(value) as Array<keyof SearchToolsConfig>) {
      const flag = fetched[key];

      if (typeof flag === 'boolean') {
        value[key] = flag;
      }
    }

    cachedConfig = { value, fetchedAt: now };

    return value;
  } catch (error: unknown) {
    // eslint-disable-next-line no-console
    console.error(
      `[mcp] Could not load search tools config: ${error instanceof Error ? error.message : String(error)}`,
    );

    return cachedConfig?.value ?? ALL_SEARCH_TOOLS_ENABLED;
  }
};

export const resetSearchToolsConfigCacheForTests = (): void => {
  cachedConfig = undefined;
};
