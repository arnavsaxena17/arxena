export function getAuthBaseUrl(): string {
  const base =
    process.env.FRONTEND_URL ?? 'https://app.arxena.com';
  const normalized = base.startsWith('http') ? base : `https://${base}`;
  return normalized.replace(/\/$/, '');
}

export function getSignUpUrl(): string {
  return `${getAuthBaseUrl()}/sign-up`;
}

export function getSignInUrl(): string {
  return `${getAuthBaseUrl()}/sign-in`;
}
