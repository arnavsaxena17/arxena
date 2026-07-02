import { NextRequest, NextResponse } from 'next/server';

import { getServerBaseUrl } from '@/lib/get-server-base-url';

export const dynamic = 'force-dynamic';

const forwardTestWebhookHeaders = (
  request: NextRequest,
): Record<string, string> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const viewKey = request.headers.get('x-test-webhook-view-key');

  if (viewKey) {
    headers['X-Test-Webhook-View-Key'] = viewKey;
  }

  return headers;
};

const proxyTestWebhookRequest = async (
  request: NextRequest,
  method: 'GET' | 'DELETE',
): Promise<NextResponse> => {
  const serverBaseUrl = getServerBaseUrl();
  const queryString = request.nextUrl.searchParams.toString();
  const url = `${serverBaseUrl}/test-webhook/events${
    queryString ? `?${queryString}` : ''
  }`;

  const response = await fetch(url, {
    method,
    headers: forwardTestWebhookHeaders(request),
  });

  const responseBody = await response.text();

  return new NextResponse(responseBody, {
    status: response.status,
    headers: {
      'Content-Type':
        response.headers.get('content-type') ?? 'application/json',
    },
  });
};

export async function GET(request: NextRequest) {
  try {
    return proxyTestWebhookRequest(request, 'GET');
  } catch (error) {
    console.error('Failed to proxy test webhook GET', error);

    return NextResponse.json(
      { message: 'Unable to fetch captured webhook events.' },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    return proxyTestWebhookRequest(request, 'DELETE');
  } catch (error) {
    console.error('Failed to proxy test webhook DELETE', error);

    return NextResponse.json(
      { message: 'Unable to clear captured webhook events.' },
      { status: 500 },
    );
  }
}
