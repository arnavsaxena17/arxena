export const COMPANY_LOGO_ENDPOINT_PATH = '/org-chart/company-logo';

export const getCompanyLogoUrl = ({
  website,
  serverBaseUrl,
}: {
  website: string | null | undefined;
  serverBaseUrl: string | null | undefined;
}): string | undefined => {
  const trimmedWebsite = website?.trim();
  const trimmedBase = serverBaseUrl?.trim();

  if (!trimmedWebsite || !trimmedBase) {
    return undefined;
  }

  return `${trimmedBase.replace(/\/$/, '')}${COMPANY_LOGO_ENDPOINT_PATH}?website=${encodeURIComponent(
    trimmedWebsite,
  )}`;
};
