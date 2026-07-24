import type { WarmPathResolveResponse } from '@/candidate-table/types/warm-path.types';

export type ResolveWarmPathsRequest = {
  targetLinkedinUrl: string;
  linkedinUnipileAccountId?: string;
  maxBridges?: number;
  expandViewerConnectors?: boolean;
};

export const resolveWarmPaths = async (
  baseUrl: string,
  accessToken: string,
  body: ResolveWarmPathsRequest,
): Promise<WarmPathResolveResponse> => {
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/warm-paths/resolve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      typeof payload.message === 'string'
        ? payload.message
        : typeof payload.detail === 'string'
          ? payload.detail
          : `Warm path resolve failed (${response.status})`;
    throw new Error(message);
  }

  return payload as WarmPathResolveResponse;
};
