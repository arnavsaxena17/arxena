import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const getServerBaseUrl = () => {
  const url =
    process.env.SERVER_BASE_URL ??
    process.env.NEXT_PUBLIC_SERVER_BASE_URL ??
    (process.env.NODE_ENV === 'development'
      ? 'http://localhost:3000'
      : 'https://app.arxena.com');
  return url.replace(/\/$/, '');
};

export async function GET(request: NextRequest) {
  const serverBaseUrl = getServerBaseUrl();
  if (!serverBaseUrl) {
    return new NextResponse(null, { status: 500 });
  }

  const website =
    request.nextUrl.searchParams.get('website') ??
    new URL(request.url).searchParams.get('website');
  if (!website?.trim()) {
    return NextResponse.json(
      { message: 'Query parameter "website" is required' },
      { status: 400 },
    );
  }
  try {
    const authHeader = request.headers.get('authorization');
    const cookieHeader = request.headers.get('cookie');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    const response = await fetch(
      `${serverBaseUrl}/org-chart/company-logo?website=${encodeURIComponent(website)}`,
      {
        method: 'GET',
        signal: controller.signal,
        headers: {
          ...(authHeader && { Authorization: authHeader }),
          ...(cookieHeader && { Cookie: cookieHeader }),
        },
      },
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      return new NextResponse(null, { status: response.status });
    }

    const contentType = response.headers.get('content-type') ?? 'image/png';
    const body = await response.arrayBuffer();

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return new NextResponse(null, { status: 504 });
    }
    return new NextResponse(null, { status: 404 });
  }
}
