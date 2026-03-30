import { headers } from 'next/headers';

import { CANONICAL_SITE_URL } from '@/lib/sitemap';

function isProductionDeployment(): boolean {
  if (
    process.env.VERCEL_ENV === 'preview' ||
    process.env.VERCEL_ENV === 'development'
  ) {
    return false;
  }
  if (process.env.VERCEL_ENV === 'production') {
    return true;
  }
  return process.env.NODE_ENV === 'production';
}

function shouldPreferCanonicalOverLocalhost(): boolean {
  return isProductionDeployment();
}

export async function getBaseUrl(): Promise<string> {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.VERCEL_URL;
  if (envUrl) {
    const base = envUrl.startsWith('http') ? envUrl : `https://${envUrl}`;
    const normalized = base.replace(/\/$/, '');
    if (
      shouldPreferCanonicalOverLocalhost() &&
      /localhost|127\.0\.0\.1/.test(normalized)
    ) {
      return CANONICAL_SITE_URL;
    }
    return normalized;
  }

  const headersList = await headers();
  const host = headersList.get('host') ?? 'localhost:3002';
  const hostWithoutPort = host.split(':')[0] ?? host;
  if (
    hostWithoutPort === 'arxena.com' ||
    hostWithoutPort === 'www.arxena.com'
  ) {
    return CANONICAL_SITE_URL;
  }
  const protocol = headersList.get('x-forwarded-proto') ?? 'http';
  return `${protocol}://${host}`.replace(/\/$/, '');
}
