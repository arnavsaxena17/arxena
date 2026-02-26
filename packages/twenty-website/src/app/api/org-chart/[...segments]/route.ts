import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const getServerBaseUrl = () => {
  const url =
    process.env.SERVER_BASE_URL ??
    process.env.NEXT_PUBLIC_SERVER_BASE_URL ??
    '';
  return url.replace(/\/$/, '');
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ segments: string[] }> },
) {
  const serverBaseUrl = getServerBaseUrl();
  if (!serverBaseUrl) {
    return NextResponse.json(
      { message: 'Server base URL not configured' },
      { status: 500 },
    );
  }

  const { segments } = await params;
  if (!segments || segments.length === 0) {
    return NextResponse.json(
      { message: 'Company ID is required' },
      { status: 400 },
    );
  }

  const pathPart = segments.join('/');
  const nextParams = request.nextUrl.searchParams;
  const urlParams = new URL(request.url).searchParams;
  const companyName = nextParams.get('companyName') ?? urlParams.get('companyName');
  const website = nextParams.get('website') ?? urlParams.get('website');
  const country = nextParams.get('country') ?? urlParams.get('country');
  const functionRoot =
    nextParams.get('functionRoot') ?? urlParams.get('functionRoot');

  const queryParams = new URLSearchParams();
  if (companyName) queryParams.set('companyName', companyName);
  if (website) queryParams.set('website', website);
  if (country) queryParams.set('country', country);
  if (functionRoot) queryParams.set('functionRoot', functionRoot);

  const queryString = queryParams.toString();
  const url = `${serverBaseUrl}/org-chart/${pathPart}${queryString ? `?${queryString}` : ''}`;

  try {
    const authHeader = request.headers.get('authorization');

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        ...(authHeader && { Authorization: authHeader }),
      },
    });

    const contentType = response.headers.get('content-type') ?? '';
    const text = await response.text();

    if (
      !contentType.includes('application/json') ||
      !text.trim().startsWith('{')
    ) {
      console.error('Org chart proxy: upstream returned non-JSON', {
        url,
        status: response.status,
        contentType,
        bodyPreview: text.slice(0, 100),
      });
      return NextResponse.json(
        {
          status: 'error',
          message: response.ok
            ? 'Invalid response from org chart service'
            : `Org chart service error (${response.status})`,
        },
        {
          status: response.ok
            ? 502
            : response.status >= 500
              ? 502
              : response.status,
        },
      );
    }

    const data = JSON.parse(text) as Record<string, unknown>;
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Org chart proxy error:', error);
    return NextResponse.json(
      { status: 'error', message: 'Failed to fetch org chart' },
      { status: 500 },
    );
  }
}
