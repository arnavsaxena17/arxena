export type OrgChartEmbedMode = 'live' | 'published';

export type OrgChartEmbedOptions = {
  height?: string;
  showFilters?: boolean;
  hidePoweredBy?: boolean;
  mode?: 'iframe' | 'inline';
  theme?: Record<string, string>;
};

export type OrgChartEmbed = {
  id: string;
  embedKey: string;
  name: string;
  allowedOrigins: string[];
  mode: OrgChartEmbedMode;
  companyDomain?: string;
  publishSlug?: string;
  allowedDomains?: string[];
  options: OrgChartEmbedOptions;
  rateLimitPerMinute: number;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  updatedAt: string;
};
