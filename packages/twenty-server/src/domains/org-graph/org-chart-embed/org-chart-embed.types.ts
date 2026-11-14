export type OrgChartEmbedMode = 'live' | 'published';

export type OrgChartEmbedOptions = {
  height?: string;
  showFilters?: boolean;
  hidePoweredBy?: boolean;
  theme?: Record<string, string>;
};

export type OrgChartEmbedConfig = {
  id: string;
  embedKey: string;
  workspaceId: string;
  name: string;
  allowedOrigins: string[];
  mode: OrgChartEmbedMode;
  companyDomain?: string;
  publishSlug?: string;
  companyId?: string;
  allowedDomains?: string[];
  options: OrgChartEmbedOptions;
  rateLimitPerMinute: number;
  expiresAt: string | null;
  revokedAt: string | null;
  createdByMemberId?: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateOrgChartEmbedInput = {
  name: string;
  allowedOrigins: string[];
  mode: OrgChartEmbedMode;
  companyDomain?: string;
  publishSlug?: string;
  allowedDomains?: string[];
  options?: OrgChartEmbedOptions;
  rateLimitPerMinute?: number;
  expiresAt?: string | null;
};

export type UpdateOrgChartEmbedInput = {
  name?: string;
  allowedOrigins?: string[];
  companyDomain?: string;
  publishSlug?: string;
  allowedDomains?: string[];
  options?: OrgChartEmbedOptions;
  rateLimitPerMinute?: number;
  expiresAt?: string | null;
};

export type OrgChartEmbedResolveResult = {
  status: 'ok';
  companyId: string;
  companyName: string;
  mode: OrgChartEmbedMode;
  options: OrgChartEmbedOptions;
  result: Record<string, unknown>;
};
