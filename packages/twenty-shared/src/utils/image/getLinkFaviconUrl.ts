import { getLogoUrlFromDomainName } from './getLogoUrlFromDomainName';

// Resolves a favicon URL from an arbitrary link by extracting the hostname
// first, so paths (e.g. https://linkedin.com/company/twenty) don't leak into
// the logo lookup. Must stay the single source of truth for LINKS image
// identifiers on both the front and the server. The browser then loads
// `/org-chart/company-logo`, which waterfalls Twenty Icons → Google → Nubela.
export const getLinkFaviconUrl = (
  link: string | null | undefined,
  serverBaseUrl?: string,
): string | undefined => {
  const trimmed = (link ?? '').trim();

  if (!trimmed) {
    return undefined;
  }

  const normalized =
    trimmed.startsWith('http://') || trimmed.startsWith('https://')
      ? trimmed
      : `https://${trimmed}`;

  try {
    const hostname = new URL(normalized).hostname;

    return getLogoUrlFromDomainName(hostname, serverBaseUrl);
  } catch {
    return undefined;
  }
};
