import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const AVATAR_KEY_PATTERN = /^[a-f0-9]{64}$/u;

const getServerBaseUrl = () => {
  const url =
    process.env.SERVER_BASE_URL ??
    process.env.NEXT_PUBLIC_SERVER_BASE_URL ??
    (process.env.NODE_ENV === 'development'
      ? 'http://localhost:3000'
      : 'https://app.arxena.com');
  return url.replace(/\/$/, '');
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ key: string }> },
) {
  const serverBaseUrl = getServerBaseUrl();
  if (!serverBaseUrl) {
    return new NextResponse(null, { status: 500 });
  }

  const { key } = await params;
  const normalizedKey = key.trim().toLowerCase();
  if (!AVATAR_KEY_PATTERN.test(normalizedKey)) {
    return new NextResponse(null, { status: 400 });
  }

  try {
    const response = await fetch(`${serverBaseUrl}/avatars/${normalizedKey}`, {
      method: 'GET',
      cache: 'no-store',
    });

    if (!response.ok) {
      return new NextResponse(null, { status: response.status });
    }

    const contentType = response.headers.get('content-type') ?? 'image/webp';
    const cacheControl =
      response.headers.get('cache-control') ??
      'public, max-age=31536000, immutable';
    const body = await response.arrayBuffer();

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': cacheControl,
        'Cross-Origin-Resource-Policy': 'cross-origin',
      },
    });
  } catch {
    return new NextResponse(null, { status: 503 });
  }
}
