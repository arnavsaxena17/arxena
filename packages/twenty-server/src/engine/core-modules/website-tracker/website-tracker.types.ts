export const WEBSITE_DOMAIN_LIMIT = 3;

export const WEBSITE_TRACKING_APP_ID_PREFIX = 'trk_';

export type WebsiteDomainStatus = 'PENDING' | 'ACTIVE' | 'INACTIVE' | 'FAILED';

export type WebsiteDomainTrackingLevel = 'COMPANY';

export type WebsiteVisitorConfidence = 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';

export type WebsiteCollectInput = {
  appId: string;
  path?: string;
  pageUrl?: string;
  referrer?: string;
  origin?: string | null;
  hostDomain?: string | null;
};

export type WebsiteCollectResult = {
  ok: boolean;
  persisted: boolean;
  visitorUpserted: boolean;
  companyName: string | null;
  companyDomain: string | null;
  confidence: string;
  error?: string;
};

export type WebsiteSnippetResult = {
  appId: string;
  enabled: boolean;
  snippet: string;
  siteBaseUrl: string;
  apiBaseUrl: string;
};

export const normalizeWebsiteHostname = (raw: string): string | null => {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) {
    return null;
  }

  try {
    const withProtocol =
      trimmed.startsWith('http://') || trimmed.startsWith('https://')
        ? trimmed
        : `https://${trimmed}`;
    const url = new URL(withProtocol);
    return url.hostname.replace(/^www\./, '');
  } catch {
    const withoutPath = trimmed.split('/')[0]?.replace(/^www\./, '');
    return withoutPath || null;
  }
};

export const hostnameFromOriginOrUrl = (
  originOrUrl?: string | null,
): string | null => {
  if (!originOrUrl?.trim()) {
    return null;
  }

  return normalizeWebsiteHostname(originOrUrl);
};

export const buildWebsiteTrackerSnippet = (input: {
  appId: string;
  siteBaseUrl?: string;
  apiBaseUrl?: string;
}): string => {
  const siteBaseUrl = (input.siteBaseUrl ?? 'https://arxena.com').replace(
    /\/$/,
    '',
  );
  const apiBaseUrl = (input.apiBaseUrl ?? siteBaseUrl).replace(/\/$/, '');

  return `<script>
(function(a,r,x,e,n,a){
  a.arxenaTracker=a.arxenaTracker||function(){(a.arxenaTracker.q=a.arxenaTracker.q||[]).push(arguments)};
  n=r.createElement(x);n.async=1;n.src=e;
  r.getElementsByTagName(x)[0].parentNode.insertBefore(n,r.getElementsByTagName(x)[0]);
  a.arxenaTracker('init',{appId:${JSON.stringify(input.appId)},apiBaseUrl:${JSON.stringify(apiBaseUrl)}});
})(window,document,'script','${siteBaseUrl}/embed/website-tracker.js',0,window);
</script>`;
};

export const mapConfidenceToSelect = (
  confidence: string,
): WebsiteVisitorConfidence => {
  switch (confidence) {
    case 'high':
      return 'HIGH';
    case 'medium':
      return 'MEDIUM';
    case 'low':
      return 'LOW';
    default:
      return 'NONE';
  }
};
