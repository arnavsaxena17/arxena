import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const getServerBaseUrl = () => {
  const url =
    process.env.SERVER_BASE_URL ??
    process.env.NEXT_PUBLIC_SERVER_BASE_URL ??
    (process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : '');
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
  console.log('DEBUG:', {
    nextUrl: request.nextUrl.toString(),
    url: request.url,
    websiteFromNext: request.nextUrl.searchParams.get('website'),
    websiteFromUrl: new URL(request.url).searchParams.get('website'),
  });

  try {
    const authHeader = request.headers.get('authorization');
    const cookieHeader = request.headers.get('cookie');

    const response = await fetch(
      `${serverBaseUrl}/org-chart/company-logo?website=${encodeURIComponent(website)}`,
      {
        method: 'GET',
        headers: {
          ...(authHeader && { Authorization: authHeader }),
          ...(cookieHeader && { Cookie: cookieHeader }),
        },
      },
    );

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
    console.error('Org chart company logo proxy error:', error);
    return new NextResponse(null, { status: 500 });
  }
}
