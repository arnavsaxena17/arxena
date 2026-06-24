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

/**
 * Loopback URL for SSR / server-side fetches to this app's API routes.
 * Avoids hairpinning through the public domain (EC2 would see its own IP as client).
 */
export async function getInternalAppUrl(): Promise<string> {
  const envInternal = process.env.INTERNAL_APP_URL?.trim();
  if (envInternal) {
    return envInternal.replace(/\/$/, '');
  }

  if (process.env.NODE_ENV === 'development') {
    const port = process.env.PORT ?? process.env.WEBSITE_PORT ?? '3002';
    return `http://127.0.0.1:${port}`;
  }

  const headersList = await headers();
  const host = headersList.get('host');
  if (host) {
    const portPart = host.includes(':') ? host.split(':')[1] : null;
    const port =
      portPart ?? process.env.PORT ?? process.env.WEBSITE_PORT ?? '3002';
    return `http://127.0.0.1:${port}`;
  }

  const port = process.env.PORT ?? process.env.WEBSITE_PORT ?? '3002';
  return `http://127.0.0.1:${port}`;
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
