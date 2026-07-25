import { NextRequest, NextResponse } from 'next/server';

import { getServerBaseUrl } from '@/lib/get-server-base-url';

export const dynamic = 'force-dynamic';

const forwardTestWebhookHeaders = (
  request: NextRequest,
): Record<string, string> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const signature = request.headers.get('x-twenty-webhook-signature');
  const timestamp = request.headers.get('x-twenty-webhook-timestamp');
  const nonce = request.headers.get('x-twenty-webhook-nonce');
  const viewKey = request.headers.get('x-test-webhook-view-key');

  if (signature) {
    headers['X-Twenty-Webhook-Signature'] = signature;
  }
  if (timestamp) {
    headers['X-Twenty-Webhook-Timestamp'] = timestamp;
  }
  if (nonce) {
    headers['X-Twenty-Webhook-Nonce'] = nonce;
  }
  if (viewKey) {
    headers['X-Test-Webhook-View-Key'] = viewKey;
  }

  return headers;
};

const proxyTestWebhookRequest = async (
  request: NextRequest,
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  body?: string,
): Promise<NextResponse> => {
  const serverBaseUrl = getServerBaseUrl();
  const queryString = request.nextUrl.searchParams.toString();
  const url = `${serverBaseUrl}/test-webhook/${path}${
    queryString ? `?${queryString}` : ''
  }`;

  const response = await fetch(url, {
    method,
    headers: forwardTestWebhookHeaders(request),
    ...(body !== undefined && { body }),
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();

    return proxyTestWebhookRequest(request, 'POST', 'webhook', body);
  } catch (error) {
    console.error('Failed to proxy test webhook POST', error);

    return NextResponse.json(
      { message: 'Unable to receive webhook.' },
      { status: 500 },
    );
  }
}
