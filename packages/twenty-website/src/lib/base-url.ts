import { headers } from 'next/headers';

export async function getBaseUrl(): Promise<string> {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.VERCEL_URL;
  if (envUrl) {
    const base = envUrl.startsWith('http') ? envUrl : `https://${envUrl}`;
    return base.replace(/\/$/, '');
  }
  const headersList = await headers();
  const host = headersList.get('host') ?? 'localhost:3002';
  const protocol = headersList.get('x-forwarded-proto') ?? 'http';
  return `${protocol}://${host}`.replace(/\/$/, '');
}
