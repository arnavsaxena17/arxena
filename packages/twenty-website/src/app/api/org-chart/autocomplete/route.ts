import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const getServerBaseUrl = () => {
  const url =
    process.env.SERVER_BASE_URL ??
    process.env.NEXT_PUBLIC_SERVER_BASE_URL ??
    (process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : '');
  return url.replace(/\/$/, '');
};

const BACKEND_PATH = '/org-chart/companies/autocomplete';

async function proxyToBackend(
  serverBaseUrl: string,
  body: { input_text: string; query: Record<string, unknown>; params: Record<string, unknown> },
  headers: Headers,
) {
  const authHeader = headers.get('authorization');
  const cookieHeader = headers.get('cookie');

  const response = await fetch(`${serverBaseUrl}${BACKEND_PATH}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authHeader && { Authorization: authHeader }),
      ...(cookieHeader && { Cookie: cookieHeader }),
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}

export async function GET(request: NextRequest) {
  const serverBaseUrl = getServerBaseUrl();
  if (!serverBaseUrl) {
    return NextResponse.json(
      { message: 'Server base URL not configured' },
      { status: 500 },
    );
  }

  const name = request.nextUrl.searchParams.get('name') ?? request.nextUrl.searchParams.get('q');
  if (!name?.trim()) {
    return NextResponse.json(
      { message: 'Query param "name" or "q" is required' },
      { status: 400 },
    );
  }

  try {
    return proxyToBackend(
      serverBaseUrl,
      { input_text: name.trim(), query: {}, params: {} },
      request.headers,
    );
  } catch (error) {
    console.error('Org chart autocomplete proxy error:', error);
    return NextResponse.json(
      { message: 'Autocomplete request failed' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const serverBaseUrl = getServerBaseUrl();
  if (!serverBaseUrl) {
    return NextResponse.json(
      { message: 'Server base URL not configured' },
      { status: 500 },
    );
  }

  try {
    const body = (await request.json()) as {
      input_text?: string;
      query?: Record<string, unknown>;
      params?: Record<string, unknown>;
    };
    const inputText = body?.input_text ?? '';
    return proxyToBackend(
      serverBaseUrl,
      {
        input_text: typeof inputText === 'string' ? inputText : '',
        query: body?.query ?? {},
        params: body?.params ?? {},
      },
      request.headers,
    );
  } catch (error) {
    console.error('Org chart autocomplete proxy error:', error);
    return NextResponse.json(
      { message: 'Autocomplete request failed' },
      { status: 500 },
    );
  }
}
