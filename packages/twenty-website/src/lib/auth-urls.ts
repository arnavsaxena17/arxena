export function getAuthBaseUrl(): string {
  const base =
    process.env.NEXT_PUBLIC_FRONTEND_URL ??
    process.env.FRONTEND_URL ??
    'https://app.arxena.com';
  const normalized = base.startsWith('http') ? base : `https://${base}`;
  return normalized.replace(/\/$/, '');
}

/** App sign-up path. Org chart CTAs pass context via sessionStorage (`navigateToOrgChartSignup` in twenty-shared), not query params in HTML. */
export function getSignUpUrl(): string {
  return `${getAuthBaseUrl()}/welcome`;
}

export function getSignInUrl(): string {
  return `${getAuthBaseUrl()}/sign-in`;
}
