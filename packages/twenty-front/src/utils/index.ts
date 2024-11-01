export const sanitizeURL = (link: string | null | undefined) => {
  return link
    ? link.replace(/(https?:\/\/)|(www\.)/g, '').replace(/\/$/, '')
    : '';
};


console.log({
  locationOrigin: window.location.origin,
  locationPathname: window.location.pathname,
  locationHref: window.location.href,
  documentBaseURI: document.baseURI
});

export const getLogoUrlFromDomainName = (
  domainName?: string,
): string | undefined => {
  if (!domainName) return undefined;
  
  const sanitizedDomain = sanitizeURL(domainName);
  if (!sanitizedDomain) return undefined;

  // Ensure we're using an absolute path from the root
  const url = `/api/favicon-proxy?domain=${encodeURIComponent(sanitizedDomain)}`
  console.log("This si url ", url);
  return url;

};
