import { getCompanyLogoUrl } from './getCompanyLogoUrl';

export const sanitizeURL = (link: string | null | undefined) => {
  return link
    ? link.replace(/(https?:\/\/)|(www\.)/g, '').replace(/\/$/, '')
    : '';
};

export const getLogoUrlFromDomainName = (
  domainName?: string,
  serverBaseUrl?: string,
): string | undefined => {
  const sanitizedDomain = sanitizeURL(domainName);

  return sanitizedDomain
    ? getCompanyLogoUrl({
        website: sanitizedDomain,
        serverBaseUrl,
      })
    : undefined;
};
