export const COMPANY_LOGO_ENDPOINT_PATH = '/org-chart/company-logo';

/** Website proxy on twenty-website (Next.js API route). */
export const WEBSITE_COMPANY_LOGO_ENDPOINT_PATH =
  '/api/org-chart/company-logo';

export const buildCompanyLogoPath = (
  website: string,
  endpointPath: string = COMPANY_LOGO_ENDPOINT_PATH,
): string | undefined => {
  const trimmedWebsite = website?.trim();

  if (!trimmedWebsite) {
    return undefined;
  }

  return `${endpointPath.replace(/\/$/, '')}/${encodeURIComponent(trimmedWebsite)}`;
};

export const getCompanyLogoUrl = ({
  website,
  serverBaseUrl,
  endpointPath = COMPANY_LOGO_ENDPOINT_PATH,
}: {
  website: string | null | undefined;
  serverBaseUrl: string | null | undefined;
  endpointPath?: string;
}): string | undefined => {
  const trimmedBase = serverBaseUrl?.trim();
  const logoPath = buildCompanyLogoPath(website ?? '', endpointPath);

  if (!logoPath || !trimmedBase) {
    return undefined;
  }

  return `${trimmedBase.replace(/\/$/, '')}${logoPath}`;
};

export const getWebsiteCompanyLogoUrl = (
  website: string | null | undefined,
): string | undefined =>
  buildCompanyLogoPath(website ?? '', WEBSITE_COMPANY_LOGO_ENDPOINT_PATH);
