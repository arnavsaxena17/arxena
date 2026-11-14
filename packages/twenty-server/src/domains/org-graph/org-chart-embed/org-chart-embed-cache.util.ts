import type { OrgChartEmbedConfig } from './org-chart-embed.types';

export const orgChartEmbedKeyCacheKey = (embedKey: string): string =>
  `org-embed:key:${embedKey}`;

export const orgChartEmbedWorkspaceIndexCacheKey = (
  workspaceId: string,
): string => `org-embed:workspace:${workspaceId}`;

export const orgChartEmbedRateLimitCacheKey = (
  embedKey: string,
  minuteBucket: string,
): string => `org-embed:rate:${embedKey}:${minuteBucket}`;

export const orgChartEmbedUsageCacheKey = (
  embedKey: string,
  dayKey: string,
): string => `org-embed:usage:${embedKey}:${dayKey}`;

export type OrgChartEmbedWorkspaceIndex = {
  embedKeys: string[];
};

export const isOrgChartEmbedConfigActive = (
  config: OrgChartEmbedConfig,
  now = Date.now(),
): boolean => {
  if (config.revokedAt) {
    return false;
  }
  if (config.expiresAt) {
    const expiresAtMs = Date.parse(config.expiresAt);
    if (Number.isFinite(expiresAtMs) && expiresAtMs <= now) {
      return false;
    }
  }
  return true;
};
